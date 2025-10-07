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
import { getScheduleTool } from '../../../src/tools/get_schedule.js';
import { getTeamStatsTool } from '../../../src/tools/get_team_stats.js';
import { getPlayerStatsTool } from '../../../src/tools/get_player_stats.js';
import { getScheduleCSVTool } from '../../../src/tools/get_schedule_csv.js';
import { listScheduleOptionsTool } from '../../../src/tools/list_schedule_options.js';

/**
 * Some transports (including Streamable HTTP) wrap tool arguments under an
 * `arguments` key. Normalise so the existing tool handlers keep working.
 */
function resolveToolArgs(args: unknown) {
  if (
    args &&
    typeof args === 'object' &&
    'arguments' in (args as Record<string, unknown>) &&
    typeof (args as Record<string, unknown>).arguments === 'object' &&
    (args as Record<string, unknown>).arguments !== null
  ) {
    return (args as { arguments: unknown }).arguments;
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
      getScheduleTool.definition.inputSchema as any,
      async (args) => {
        const result = await getScheduleTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register get_team_stats tool
    server.tool(
      getTeamStatsTool.definition.name,
      getTeamStatsTool.definition.description || '',
      getTeamStatsTool.definition.inputSchema as any,
      async (args) => {
        const result = await getTeamStatsTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register get_player_stats tool
    server.tool(
      getPlayerStatsTool.definition.name,
      getPlayerStatsTool.definition.description || '',
      getPlayerStatsTool.definition.inputSchema as any,
      async (args) => {
        const result = await getPlayerStatsTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register get_schedule_csv tool
    server.tool(
      getScheduleCSVTool.definition.name,
      getScheduleCSVTool.definition.description || '',
      getScheduleCSVTool.definition.inputSchema as any,
      async (args) => {
        const result = await getScheduleCSVTool.handler(resolveToolArgs(args));
        return result;
      }
    );

    // Register list_schedule_options tool
    server.tool(
      listScheduleOptionsTool.definition.name,
      listScheduleOptionsTool.definition.description || '',
      listScheduleOptionsTool.definition.inputSchema as any,
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
