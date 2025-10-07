/**
 * get_team_stats Tool
 *
 * Fetches team standings and statistics from scaha.net.
 */

import { z } from 'zod';
import { getTeamStats } from '../lib/scrapers.js';

export const GetTeamStatsArgsSchema = z.object({
  season: z.string().describe('Season identifier (e.g., "2024-25")'),
  division: z.string().describe('Division name'),
  team_slug: z.string().describe('Team name or identifier'),
});

export const getTeamStatsTool = {
  definition: {
    name: 'get_team_stats',
    description: 'Get team statistics from scaha.net standings',
    inputSchema: {
      type: 'object' as const,
      properties: {
        season: {
          type: 'string',
          description: 'Season identifier (e.g., "2024-25")',
        },
        division: {
          type: 'string',
          description: 'Division name',
        },
        team_slug: {
          type: 'string',
          description: 'Team name or identifier',
        },
      },
      required: ['season', 'division', 'team_slug'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, division, team_slug } =
        GetTeamStatsArgsSchema.parse(args);

      const stats = await getTeamStats(season, division, team_slug);

      if (!stats) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Team "${team_slug}" not found in ${division} division for ${season} season`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error fetching team stats: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
