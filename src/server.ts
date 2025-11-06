/**
 * SCAHA MCP Server - Tool Registration
 *
 * Registers all MCP tools and handles tool execution requests.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getScheduleTool } from './tools/get_schedule.js';
import { getTeamStatsTool } from './tools/get_team_stats.js';
import { getDivisionStandingsTool } from './tools/get_division_standings.js';
import { getPlayerStatsTool } from './tools/get_player_stats.js';
import { getDivisionPlayerStatsTool } from './tools/get_division_player_stats.js';
import { getScheduleCSVTool } from './tools/get_schedule_csv.js';
import { listScheduleOptionsTool } from './tools/list_schedule_options.js';
import { getTeamRosterTool } from './tools/get_team_roster.js';

/**
 * Register all SCAHA tools with the MCP server
 */
export function registerTools(server: Server) {
  // List all available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        getScheduleTool.definition,
        getTeamStatsTool.definition,
        getDivisionStandingsTool.definition,
        getPlayerStatsTool.definition,
        getDivisionPlayerStatsTool.definition,
        getScheduleCSVTool.definition,
        listScheduleOptionsTool.definition,
        getTeamRosterTool.definition,
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_schedule':
          return await getScheduleTool.handler(args);
        case 'get_team_stats':
          return await getTeamStatsTool.handler(args);
        case 'get_division_standings':
          return await getDivisionStandingsTool.handler(args);
        case 'get_player_stats':
          return await getPlayerStatsTool.handler(args);
        case 'get_division_player_stats':
          return await getDivisionPlayerStatsTool.handler(args);
        case 'get_schedule_csv':
          return await getScheduleCSVTool.handler(args);
        case 'list_schedule_options':
          return await listScheduleOptionsTool.handler(args);
        case 'get_team_roster':
          return await getTeamRosterTool.handler(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Log error to stderr (stdout is reserved for MCP protocol)
      console.error(`❌ Error executing tool "${name}":`, error);

      // Return error to client
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  });
}
