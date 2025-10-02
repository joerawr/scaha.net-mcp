import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  getTeamStats,
  getPlayerStats,
  getSchedule,
  downloadScheduleCSV,
} from '@/lib/scrapers';
import {
  getScoreboardOptionsWithBrowser,
  downloadScheduleCSVWithBrowser,
} from '@/lib/browser-scrapers';

export const maxDuration = 300; // 5 minutes for Vercel

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'list_schedule_options',
      'List available seasons, schedules, and teams from the scoreboard page',
      {
        season: z
          .string()
          .optional()
          .describe('Optional season name (e.g., "SCAHA 2025/26 Season") to target'),
        schedule: z
          .string()
          .optional()
          .describe('Optional schedule name (e.g., "14U B Regular Season") to target'),
        team: z
          .string()
          .optional()
          .describe('Optional team name to target'),
      },
      async ({ season, schedule, team }) => {
        const options = await getScoreboardOptionsWithBrowser(season, schedule, team);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(options, null, 2),
            },
          ],
        };
      }
    );

    server.tool(
      'get_team_stats',
      'Get team statistics from scaha.net standings',
      {
        season: z.string().describe('Season identifier (e.g., "2024-25")'),
        division: z.string().describe('Division name'),
        team_slug: z.string().describe('Team name or identifier'),
      },
      async ({ season, division, team_slug }) => {
        const stats = await getTeamStats(season, division, team_slug);

        if (!stats) {
          return {
            content: [
              {
                type: 'text',
                text: `Team "${team_slug}" not found in ${division} division for ${season} season`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }
    );

    server.tool(
      'get_player_stats',
      'Get player statistics from scaha.net',
      {
        season: z.string().describe('Season identifier (e.g., "2024-25")'),
        division: z.string().describe('Division name'),
        team_slug: z.string().describe('Team name or identifier'),
        player: z.object({
          name: z.string().optional().describe('Player name (partial match supported)'),
          number: z.string().optional().describe('Player jersey number'),
        }).describe('Player identifier - provide either name or number'),
      },
      async ({ season, division, team_slug, player }) => {
        if (!player.name && !player.number) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Must provide either player name or number',
              },
            ],
          };
        }

        const stats = await getPlayerStats(season, division, team_slug, player);

        if (!stats) {
          const identifier = player.number ? `#${player.number}` : player.name;
          return {
            content: [
              {
                type: 'text',
                text: `Player "${identifier}" not found on ${team_slug}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }
    );

    server.tool(
      'get_schedule',
      'Get game schedule from scaha.net with optional filters',
      {
        season: z.string().describe('Season identifier (e.g., "2024-25")'),
        division: z.string().optional().describe('Division name (optional filter)'),
        team_slug: z.string().optional().describe('Team name (optional filter)'),
        date_range: z.object({
          start: z.string().describe('Start date in YYYY-MM-DD format'),
          end: z.string().describe('End date in YYYY-MM-DD format'),
        }).optional().describe('Date range filter (optional)'),
      },
      async ({ season, division, team_slug, date_range }) => {
        const games = await getSchedule(season, division, team_slug, date_range);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(games, null, 2),
            },
          ],
        };
      }
    );

    server.tool(
      'get_schedule_csv',
      'Download raw CSV schedule data from scaha.net using browser automation',
      {
        season: z.string().describe('Season name (e.g., "SCAHA 2025/26 Season" or "2025/26")'),
        schedule: z.string().describe('Schedule name (e.g., "14U B Regular Season" or "14U B")'),
        team: z.string().describe('Team name (e.g., "Jr. Kings (1)" or "Jr Kings")'),
      },
      async ({ season, schedule, team }) => {
        const csvData = await downloadScheduleCSVWithBrowser(season, schedule, team);
        const base64Data = Buffer.from(csvData).toString('base64');

        // Extract year from season (e.g., "2025/26" -> "2025-26")
        const yearMatch = season.match(/(\d{4})[\/-]?(\d{2,4})?/);
        const year = yearMatch ? `${yearMatch[1]}-${yearMatch[2] || yearMatch[1].slice(-2)}` : 'unknown';

        // Extract tier from schedule (e.g., "14U B Regular Season" -> "14U-B")
        const tierMatch = schedule.match(/(\d+U)\s*([A-Z]+(?:\s*Div\s*\d+)?)/i);
        const tier = tierMatch ? `${tierMatch[1]}-${tierMatch[2].replace(/\s+/g, '')}` : schedule.replace(/\s+/g, '-');

        // Clean team name for filename
        const teamClean = team.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');

        // Generate timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

        const filename = `SCAHA_${year}_${tier}_${teamClean}_${timestamp}.csv`;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                filename,
                mime: 'text/csv',
                data_base64: base64Data,
                size_bytes: csvData.length,
              }, null, 2),
            },
          ],
        };
      }
    );
  },
  {
    serverInfo: {
      name: 'scaha-mcp',
      version: '1.0.0',
    },
  },
  {
    maxDuration: 300,
  }
);

export { handler as GET, handler as POST };
