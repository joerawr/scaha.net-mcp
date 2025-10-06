/**
 * list_schedule_options Tool
 *
 * Lists available seasons, schedules, and teams from the scoreboard page.
 */

import { z } from 'zod';
import { getScoreboardOptionsWithBrowser } from '../lib/browser-scrapers.js';

const ListScheduleOptionsArgsSchema = z.object({
  season: z
    .string()
    .optional()
    .describe('Optional season name (e.g., "SCAHA 2025/26 Season") to target'),
  schedule: z
    .string()
    .optional()
    .describe('Optional schedule name (e.g., "14U B Regular Season") to target'),
  team: z.string().optional().describe('Optional team name to target'),
});

export const listScheduleOptionsTool = {
  definition: {
    name: 'list_schedule_options',
    description:
      'List available seasons, schedules, and teams from the scoreboard page',
    inputSchema: {
      type: 'object' as const,
      properties: {
        season: {
          type: 'string',
          description:
            'Optional season name (e.g., "SCAHA 2025/26 Season") to target',
        },
        schedule: {
          type: 'string',
          description:
            'Optional schedule name (e.g., "14U B Regular Season") to target',
        },
        team: {
          type: 'string',
          description: 'Optional team name to target',
        },
      },
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, schedule, team } =
        ListScheduleOptionsArgsSchema.parse(args);

      const options = await getScoreboardOptionsWithBrowser(
        season,
        schedule,
        team
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(options, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error listing schedule options: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
