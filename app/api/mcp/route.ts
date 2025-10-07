/**
 * SCAHA MCP Server - HTTP Transport
 *
 * Implements HTTP transport for remote MCP server deployment.
 * See issue #2: Add dual-transport support (STDIO + HTTP)
 *
 * This provides HTTP/Streamable HTTP access to the same SCAHA tools
 * available via STDIO transport (src/index.ts).
 *
 * Architecture:
 * - Uses mcp-handler to wrap existing tool implementations
 * - All tools are defined in src/tools/ and work with both transports
 * - Enables serverless deployment while maintaining STDIO compatibility
 */

import { createMcpHandler } from 'mcp-handler';
import {
  getScheduleTool,
  GetScheduleArgsSchema,
} from '../../../src/tools/get_schedule.js';
import {
  getTeamStatsTool,
  GetTeamStatsArgsSchema,
} from '../../../src/tools/get_team_stats.js';
import {
  getPlayerStatsTool,
  GetPlayerStatsArgsSchema,
} from '../../../src/tools/get_player_stats.js';
import {
  getScheduleCSVTool,
  GetScheduleCSVArgsSchema,
} from '../../../src/tools/get_schedule_csv.js';
import {
  listScheduleOptionsTool,
  ListScheduleOptionsArgsSchema,
} from '../../../src/tools/list_schedule_options.js';

/**
 * Some transports (including Streamable HTTP) wrap tool arguments under an
 * `arguments` key. Normalise so the existing tool handlers keep working.
 */
function resolveToolArgs(args: unknown): unknown {
  if (
    args &&
    typeof args === 'object' &&
    'arguments' in (args as Record<string, unknown>) &&
    typeof (args as Record<string, unknown>).arguments === 'object' &&
    (args as Record<string, unknown>).arguments !== null
  ) {
    return (args as { arguments: unknown }).arguments;
  }

  if (
    args &&
    typeof args === 'object' &&
    'requestInfo' in (args as Record<string, unknown>)
  ) {
    const requestInfo = (args as { requestInfo?: Record<string, unknown> })
      .requestInfo;
    const body = requestInfo?.body;

    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'params' in parsed &&
          typeof parsed.params === 'object' &&
          parsed.params !== null &&
          'arguments' in parsed.params
        ) {
          return parsed.params.arguments;
        }
      } catch (error) {
        console.error('[scaha-mcp] Failed to parse request body:', error);
      }
    }
  }

  return args;
}

// Issue #2: HTTP transport wraps existing tool implementations
// All tools are imported from src/tools/ and work with both STDIO and HTTP transports
const handler = createMcpHandler(
  (server) => {
    // Register get_schedule tool
    server.tool(
      getScheduleTool.definition.name,
      getScheduleTool.definition.description || '',
      GetScheduleArgsSchema.shape,
      async (args) => {
        const result = await getScheduleTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register get_team_stats tool
    server.tool(
      getTeamStatsTool.definition.name,
      getTeamStatsTool.definition.description || '',
      GetTeamStatsArgsSchema.shape,
      async (args) => {
        const result = await getTeamStatsTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register get_player_stats tool
    server.tool(
      getPlayerStatsTool.definition.name,
      getPlayerStatsTool.definition.description || '',
      GetPlayerStatsArgsSchema.shape,
      async (args) => {
        const result = await getPlayerStatsTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register get_schedule_csv tool
    server.tool(
      getScheduleCSVTool.definition.name,
      getScheduleCSVTool.definition.description || '',
      GetScheduleCSVArgsSchema.shape,
      async (args) => {
        const result = await getScheduleCSVTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register list_schedule_options tool
    server.tool(
      listScheduleOptionsTool.definition.name,
      listScheduleOptionsTool.definition.description || '',
      ListScheduleOptionsArgsSchema.shape,
      async (args) => {
        const result = await listScheduleOptionsTool.handler(
          resolveToolArgs(args)
        );
        return result;
      }
    );
  },
  {
    serverInfo: {
      name: 'scaha-mcp',
      version: '1.0.0',
    },
  },
  { basePath: '/api' }
);

export { handler as GET, handler as POST, handler as DELETE };
