#!/usr/bin/env node
/**
 * Test script for get_team_roster tool
 *
 * Usage: node test-roster.mjs
 */

import { spawn } from 'child_process';

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  // Try to parse complete JSON-RPC messages
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || ''; // Keep incomplete line

  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  }
});

// Wait a bit for server to start
setTimeout(() => {
  console.log('\n=== Testing tools/list ===');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  }) + '\n');

  setTimeout(() => {
    console.log('\n=== Testing get_team_roster ===');
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_team_roster',
        arguments: {
          season: '2024-25',
          division: '14U B',
          team_slug: 'Jr. Kings'
        }
      }
    }) + '\n');

    // Exit after 30 seconds
    setTimeout(() => {
      console.log('\n=== Test complete ===');
      server.kill();
      process.exit(0);
    }, 30000);
  }, 2000);
}, 1000);
