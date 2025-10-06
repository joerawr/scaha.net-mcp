#!/usr/bin/env node
/**
 * SCAHA MCP Server - STDIO Transport
 *
 * Entry point for the MCP server that provides SCAHA hockey data.
 * Communicates via STDIO for use with Claude Desktop and other MCP clients.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './server.js';

async function main() {
  // Create MCP server instance
  const server = new Server(
    {
      name: 'scaha-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all SCAHA tools
  registerTools(server);

  // Connect STDIO transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error('✅ SCAHA MCP server running on STDIO');
  console.error('   Ready to receive MCP requests...');
}

// Run server
main().catch((error) => {
  console.error('❌ Fatal error in SCAHA MCP server:', error);
  process.exit(1);
});
