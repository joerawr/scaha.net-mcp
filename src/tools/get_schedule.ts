/**
 * get_schedule Tool
 *
 * Fetches game schedules from scaha.net with optional date filtering.
 */

import { z } from 'zod';
import { downloadScheduleCSVWithBrowser } from '../lib/browser-scrapers.js';

const GetScheduleArgsSchema = z.object({
  season: z.string().describe('Season name (e.g., "2025/26")'),
  schedule: z.string().describe('Schedule name (e.g., "14U B")'),
  team: z.string().describe('Team name (e.g., "Jr. Kings (1)")'),
  date: z
    .string()
    .optional()
    .describe('Filter to specific date (YYYY-MM-DD format)'),
});

export const getScheduleTool = {
  definition: {
    name: 'get_schedule',
    description: 'Get game schedule from scaha.net with optional date filter',
    inputSchema: {
      type: 'object' as const,
      properties: {
        season: {
          type: 'string',
          description: 'Season name (e.g., "2025/26")',
        },
        schedule: {
          type: 'string',
          description: 'Schedule name (e.g., "14U B")',
        },
        team: {
          type: 'string',
          description: 'Team name (e.g., "Jr. Kings (1)")',
        },
        date: {
          type: 'string',
          description: 'Optional date filter (YYYY-MM-DD)',
        },
      },
      required: ['season', 'schedule', 'team'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, schedule, team, date } =
        GetScheduleArgsSchema.parse(args);

      // Use browser automation to get CSV
      const csvData = await downloadScheduleCSVWithBrowser(
        season,
        schedule,
        team
      );

      // Parse CSV manually
      const lines = csvData.trim().split('\n');
      const games = [];

      for (let i = 1; i < lines.length; i++) {
        const match = lines[i].match(
          /"([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)"/
        );
        if (match) {
          const gameDate = match[2];

          // Filter by date if specified
          if (date && gameDate !== date) continue;

          games.push({
            game_id: match[1],
            date: gameDate,
            time: match[3],
            type: match[4],
            status: match[5],
            home: match[6],
            home_score: match[7] === '--' ? null : parseInt(match[7]),
            away: match[8],
            away_score: match[9] === '--' ? null : parseInt(match[9]),
            venue: match[10],
            rink: match[11],
          });
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(games, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error fetching schedule: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
