/**
 * get_schedule_csv Tool
 *
 * Downloads raw CSV schedule data from scaha.net (base64 encoded).
 */

import { z } from 'zod';
import { downloadScheduleCSVWithBrowser } from '../lib/browser-scrapers.js';

const GetScheduleCSVArgsSchema = z.object({
  season: z
    .string()
    .describe('Season name (e.g., "SCAHA 2025/26 Season" or "2025/26")'),
  schedule: z
    .string()
    .describe('Schedule name (e.g., "14U B Regular Season" or "14U B")'),
  team: z.string().describe('Team name (e.g., "Jr. Kings (1)" or "Jr Kings")'),
});

export const getScheduleCSVTool = {
  definition: {
    name: 'get_schedule_csv',
    description:
      'Download raw CSV schedule data from scaha.net using browser automation',
    inputSchema: {
      type: 'object' as const,
      properties: {
        season: {
          type: 'string',
          description: 'Season name (e.g., "SCAHA 2025/26 Season" or "2025/26")',
        },
        schedule: {
          type: 'string',
          description:
            'Schedule name (e.g., "14U B Regular Season" or "14U B")',
        },
        team: {
          type: 'string',
          description: 'Team name (e.g., "Jr. Kings (1)" or "Jr Kings")',
        },
      },
      required: ['season', 'schedule', 'team'],
    },
  },

  handler: async (args: unknown) => {
    try {
      const { season, schedule, team } = GetScheduleCSVArgsSchema.parse(args);

      const csvData = await downloadScheduleCSVWithBrowser(
        season,
        schedule,
        team
      );
      const base64Data = Buffer.from(csvData).toString('base64');

      // Extract year from season (e.g., "2025/26" → "2025-26")
      const yearMatch = season.match(/(\d{4})[\/-]?(\d{2,4})?/);
      const year = yearMatch
        ? `${yearMatch[1]}-${yearMatch[2] || yearMatch[1].slice(-2)}`
        : 'unknown';

      // Extract tier from schedule (e.g., "14U B Regular Season" → "14U-B")
      const tierMatch = schedule.match(/(\d+U)\s*([A-Z]+(?:\s*Div\s*\d+)?)/i);
      const tier = tierMatch
        ? `${tierMatch[1]}-${tierMatch[2].replace(/\s+/g, '')}`
        : schedule.replace(/\s+/g, '-');

      // Clean team name for filename
      const teamClean = team.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');

      // Generate timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);

      const filename = `SCAHA_${year}_${tier}_${teamClean}_${timestamp}.csv`;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                filename,
                mime: 'text/csv',
                data_base64: base64Data,
                size_bytes: csvData.length,
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
            text: `Error downloading CSV: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  },
};
