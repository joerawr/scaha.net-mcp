/**
 * get_division_player_stats Tool
 *
 * Fetches complete player statistics rankings for a division from scaha.net.
 * Returns all players (or filtered by team) sorted by points.
 */

import { z } from 'zod';
import { scrapePlayerStats } from '../lib/scrapers.js';

export const GetDivisionPlayerStatsArgsSchema = z.object({
  season: z.string().describe('Season identifier (e.g., "2024-25")'),
  division: z.string().describe('Division name (e.g., "14U B")'),
  team_slug: z
    .string()
    .optional()
    .describe('Optional: Filter to specific team (e.g., "Jr. Kings")'),
  category: z
    .enum(['players', 'goalies'])
    .optional()
    .describe('Set to "goalies" to fetch goalie stats; defaults to player skaters'),
  limit: z
    .number()
    .optional()
    .describe('Optional: Limit number of results (default: all players)'),
});

export const getDivisionPlayerStatsTool = {
  definition: {
    name: 'get_division_player_stats',
    description:
      'Get complete player statistics rankings for a division. Returns all players sorted by points, optionally filtered by team. Use this to answer questions like "Who has the most goals?" or "Who leads the division in scoring?"',
    inputSchema: {
      type: 'object' as const,
      properties: {
        season: {
          type: 'string',
          description: 'Season identifier (e.g., "2024-25")',
        },
        division: {
          type: 'string',
          description: 'Division name (e.g., "14U B")',
        },
        team_slug: {
          type: 'string',
          description:
            'Optional: Filter to specific team (e.g., "Jr. Kings", "Heat")',
        },
        category: {
          type: 'string',
          enum: ['players', 'goalies'],
          description: 'Set to "goalies" to view goalie stats (default: players)',
        },
        limit: {
          type: 'number',
          description: 'Optional: Limit number of results returned',
        },
      },
      required: ['season', 'division'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, division, team_slug, category, limit } =
        GetDivisionPlayerStatsArgsSchema.parse(args);

      const allPlayers = await scrapePlayerStats(
        season,
        division,
        team_slug ?? undefined,
        category ?? 'players'
      );

      if (allPlayers.length === 0) {
        const locationMsg = team_slug
          ? ` for team "${team_slug}"`
          : ` in ${division}`;
        const categoryLabel =
          (category ?? 'players') === 'goalies' ? 'Goalies' : 'Players';
        return {
          content: [
            {
              type: 'text' as const,
              text: `No ${categoryLabel.toLowerCase()} found${locationMsg} for ${season} season`,
            },
          ],
        };
      }

      // Apply limit if specified
      const players = limit ? allPlayers.slice(0, limit) : allPlayers;

      // Add rank to each player (based on their position in sorted list)
      const rankedPlayers = players.map((player, index) => ({
        rank: index + 1,
        ...player,
      }));

      const result = {
        season,
        division,
        team_filter: team_slug ?? null,
        category: category ?? 'players',
        total_count: allPlayers.length,
        returned_count: players.length,
        has_more: limit ? allPlayers.length > limit : false,
        players: rankedPlayers,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error fetching division player stats: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
