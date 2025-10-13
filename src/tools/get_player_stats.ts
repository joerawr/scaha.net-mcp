/**
 * get_player_stats Tool
 *
 * Fetches individual player statistics from scaha.net.
 */

import { z } from 'zod';
import { getPlayerStats } from '../lib/scrapers.js';

export const GetPlayerStatsArgsSchema = z.object({
  season: z.string().describe('Season identifier (e.g., "2024-25")'),
  division: z.string().describe('Division name'),
  team_slug: z.string().optional().describe('Team name or identifier (optional - stats are division-wide on SCAHA)'),
  category: z
    .enum(['players', 'goalies'])
    .optional()
    .describe(
      'Set to "goalies" to fetch goalie stats; defaults to player skaters'
    ),
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
          description: 'Team name or identifier (optional - stats are division-wide on SCAHA)',
        },
        category: {
          type: 'string',
          enum: ['players', 'goalies'],
          description: 'Set to "goalies" to view goalie stats (default players)',
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
      required: ['season', 'division', 'player'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, division, team_slug, category, player } =
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

      let normalizedName = player.name;
      let selectedCategory = category;

      if (!selectedCategory && normalizedName) {
        if (normalizedName.toLowerCase().includes('goalie')) {
          selectedCategory = 'goalies';
          normalizedName = normalizedName.replace(/goalie/gi, '').trim() || undefined;
        }
      }

      const stats = await getPlayerStats(
        season,
        division,
        team_slug ?? undefined,
        { ...player, name: normalizedName },
        selectedCategory ?? 'players'
      );

      if (!stats) {
        const identifier = player.number
          ? `#${player.number}`
          : normalizedName || player.name || 'unknown';
        const categoryLabel =
          (selectedCategory ?? 'players') === 'goalies' ? ' goalie' : '';
        const locationMsg = team_slug
          ? ` on ${team_slug}`
          : ` in ${division}`;
        return {
          content: [
            {
              type: 'text' as const,
              text: `Player${categoryLabel} "${identifier}" not found${locationMsg}`,
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
