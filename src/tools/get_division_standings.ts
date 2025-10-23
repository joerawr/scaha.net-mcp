/**
 * get_division_standings Tool
 *
 * Returns complete standings for all teams in a division.
 * Use this to answer "What are the division standings?" or "Who's in first place?"
 */

import { z } from 'zod';
import { scrapeStandings } from '../lib/scrapers.js';

export const GetDivisionStandingsArgsSchema = z.object({
  season: z.string().describe('Season identifier (e.g., "2024-25" or "2025-26")'),
  division: z.string().describe('Division name (e.g., "14U B", "16U A")'),
});

export const getDivisionStandingsTool = {
  definition: {
    name: 'get_division_standings',
    description:
      'Get complete standings for all teams in a division. Returns team records (W-L-T-OTL), ' +
      'points, goals for/against, and rankings. Use this to answer questions like "What are the ' +
      '14U B standings?" or "Who is in first place in the division?"',
    inputSchema: {
      type: 'object' as const,
      properties: {
        season: {
          type: 'string',
          description: 'Season identifier (e.g., "2024-25" or "2025-26")',
        },
        division: {
          type: 'string',
          description: 'Division name (e.g., "14U B", "16U A")',
        },
      },
      required: ['season', 'division'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, division } = GetDivisionStandingsArgsSchema.parse(args);

      const standings = await scrapeStandings(season, division);

      if (standings.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No standings found for ${division} division in ${season} season`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                season,
                division,
                teams: standings,
                total_teams: standings.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error fetching division standings: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
