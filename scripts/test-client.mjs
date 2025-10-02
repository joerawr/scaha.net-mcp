#!/usr/bin/env node

/**
 * STDIO Test Client for SCAHA MCP Server
 *
 * Usage:
 *   node scripts/test-client.mjs
 *
 * This script tests the MCP server locally using stdio transport
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function main() {
  console.log('🏒 Starting SCAHA MCP Test Client...\n');

  // Start Next.js dev server as MCP stdio server
  const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });

  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['run', 'dev'],
  });

  const client = new Client(
    {
      name: 'scaha-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  console.log('✅ Connected to MCP server\n');

  // List available tools
  const tools = await client.listTools();
  console.log('📋 Available Tools:');
  tools.tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });
  console.log('');

  // Test 1: Get team stats
  console.log('🧪 Test 1: Get Team Stats');
  try {
    const result = await client.callTool('get_team_stats', {
      season: '2024-25',
      division: 'Bantam AA',
      team_slug: 'Jr. Ducks'
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  // Test 2: Get player stats
  console.log('🧪 Test 2: Get Player Stats');
  try {
    const result = await client.callTool('get_player_stats', {
      season: '2024-25',
      division: 'Bantam AA',
      team_slug: 'Jr. Ducks',
      player: {
        number: '7'
      }
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  // Test 3: Get schedule
  console.log('🧪 Test 3: Get Schedule');
  try {
    const result = await client.callTool('get_schedule', {
      season: '2024-25',
      division: 'Bantam AA',
      date_range: {
        start: '2024-09-01',
        end: '2024-12-31'
      }
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  // Test 4: Get schedule CSV
  console.log('🧪 Test 4: Get Schedule CSV');
  try {
    const result = await client.callTool('get_schedule_csv', {
      season: '2024-25',
      division: 'Bantam AA'
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  // Cleanup
  await client.close();
  serverProcess.kill();
  console.log('👋 Test complete');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
