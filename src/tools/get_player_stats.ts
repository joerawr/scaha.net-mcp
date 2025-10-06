/**
 * get_player_stats Tool
 *
 * Fetches individual player statistics from scaha.net.
 */

import { z } from 'zod';
import { getPlayerStats } from '../lib/scrapers.js';

const GetPlayerStatsArgsSchema = z.object({
  season: z.string().describe('Season identifier (e.g., "2024-25")'),
  division: z.string().describe('Division name'),
  team_slug: z.string().describe('Team name or identifier'),
  player: z
    .object({
      name: z
        .string()
        .optional()
        .describe('Player name (partial match supported)'),
      number: z.string().optional().describe('Player jersey number'),
    })
    .describe('Player identifier - provide either name or number'),
});

export const getPlayerStatsTool = {
  definition: {
    name: 'get_player_stats',
    description: 'Get player statistics from scaha.net',
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
        player: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Player name (partial match supported)',
            },
            number: {
              type: 'string',
              description: 'Player jersey number',
            },
          },
          description: 'Player identifier - provide either name or number',
        },
      },
      required: ['season', 'division', 'team_slug', 'player'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, division, team_slug, player } =
        GetPlayerStatsArgsSchema.parse(args);

      if (!player.name && !player.number) {
        return {
          content: [
            {
              type: 'text' as const,
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
              type: 'text' as const,
              text: `Player "${identifier}" not found on ${team_slug}`,
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
            text: `Error fetching player stats: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
