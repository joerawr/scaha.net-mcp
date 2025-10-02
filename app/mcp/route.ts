import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import {
  getTeamStats,
  getPlayerStats,
  getSchedule,
  downloadScheduleCSV,
} from '@/lib/scrapers';

export const maxDuration = 300; // 5 minutes for Vercel

const handler = createMcpHandler(
  (server) => {
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
      'Download raw CSV schedule data from scaha.net (base64 encoded)',
      {
        season: z.string().describe('Season identifier (e.g., "2024-25")'),
        division: z.string().optional().describe('Division name (optional filter)'),
        team_slug: z.string().optional().describe('Team name (optional filter)'),
      },
      async ({ season, division, team_slug }) => {
        const csvData = await downloadScheduleCSV(season, division, team_slug);
        const base64Data = Buffer.from(csvData).toString('base64');

        const filename = `scaha_schedule_${season}${division ? `_${division}` : ''}${team_slug ? `_${team_slug}` : ''}.csv`;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                filename,
                mime: 'text/csv',
                data_base64: base64Data,
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
