/**
 * get_team_roster Tool
 *
 * Fetches complete team roster with all players and goalies from scaha.net.
 * This enables queries like "Who has the most points on our team?"
 */

import { z } from 'zod';
import { getTeamRosterWithBrowser } from '../lib/browser-scrapers.js';

export const GetTeamRosterArgsSchema = z.object({
  season: z.string().describe('Season identifier (e.g., "2024-25")'),
  division: z.string().describe('Division name (e.g., "14U B")'),
  team_slug: z.string().describe('Team name or identifier'),
});

export const getTeamRosterTool = {
  definition: {
    name: 'get_team_roster',
    description: 'Get complete team roster with all players and goalies stats from scaha.net. Use this to answer questions like "Who has the most points on our team?" or "Show me all players on the team".',
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
          description: 'Team name or identifier',
        },
      },
      required: ['season', 'division', 'team_slug'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, division, team_slug } =
        GetTeamRosterArgsSchema.parse(args);

      const roster = await getTeamRosterWithBrowser(season, division, team_slug);

      // Add summary statistics
      const totalPlayers = roster.players.length;
      const totalGoalies = roster.goalies.length;
      const totalRoster = totalPlayers + totalGoalies;

      const summary = {
        team: roster.team,
        division: roster.division,
        season: roster.season,
        roster_size: {
          total: totalRoster,
          players: totalPlayers,
          goalies: totalGoalies,
        },
        players: roster.players,
        goalies: roster.goalies,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error fetching team roster: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
