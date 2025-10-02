#!/usr/bin/env node

/**
 * HTTP Test Client for SCAHA MCP Server
 *
 * Usage:
 *   1. Start dev server: npm run dev
 *   2. Run this script: node scripts/test-http.mjs
 */

const MCP_URL = 'http://localhost:3000/mcp';

function parseSSE(text) {
  // Parse Server-Sent Events format
  const lines = text.trim().split('\n');
  let data = '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      data += line.substring(6);
    }
  }

  return JSON.parse(data);
}

async function callMcp(method, params = {}) {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error('Response:', text);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Parse SSE format
  return parseSSE(text);
}

async function main() {
  console.log('🏒 Testing SCAHA MCP Server at', MCP_URL);
  console.log('');

  try {
    // List available tools
    console.log('📋 Listing available tools...');
    const toolsList = await callMcp('tools/list');
    console.log(JSON.stringify(toolsList, null, 2));
    console.log('');

    // Test 1: Get team stats
    console.log('🧪 Test 1: Get Team Stats');
    const teamStats = await callMcp('tools/call', {
      name: 'get_team_stats',
      arguments: {
        season: '2024-25',
        division: 'Bantam AA',
        team_slug: 'Jr. Ducks',
      },
    });
    console.log(JSON.stringify(teamStats, null, 2));
    console.log('');

    // Test 2: Get player stats
    console.log('🧪 Test 2: Get Player Stats');
    const playerStats = await callMcp('tools/call', {
      name: 'get_player_stats',
      arguments: {
        season: '2024-25',
        division: 'Bantam AA',
        team_slug: 'Jr. Ducks',
        player: {
          number: '7',
        },
      },
    });
    console.log(JSON.stringify(playerStats, null, 2));
    console.log('');

    // Test 3: Get schedule
    console.log('🧪 Test 3: Get Schedule');
    const schedule = await callMcp('tools/call', {
      name: 'get_schedule',
      arguments: {
        season: '2024-25',
        division: 'Bantam AA',
        date_range: {
          start: '2024-09-01',
          end: '2024-12-31',
        },
      },
    });
    console.log(JSON.stringify(schedule, null, 2));
    console.log('');

    // Test 4: Get schedule CSV
    console.log('🧪 Test 4: Get Schedule CSV');
    const csv = await callMcp('tools/call', {
      name: 'get_schedule_csv',
      arguments: {
        season: '2024-25',
        division: 'Bantam AA',
      },
    });
    console.log(JSON.stringify(csv, null, 2));
    console.log('');

    console.log('✅ All tests complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
