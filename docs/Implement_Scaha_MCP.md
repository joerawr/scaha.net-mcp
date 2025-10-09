# Implementing SCAHA MCP Integration

This document provides step-by-step instructions for integrating the SCAHA MCP server into your Next.js agent application.

## Overview

The SCAHA MCP server provides tools for querying Southern California Amateur Hockey Association data including schedules, team stats, and player stats. It runs locally as a Next.js HTTP endpoint and uses browser automation to scrape scaha.net.

## Prerequisites

1. SCAHA MCP server running locally on `http://localhost:3000/mcp`
2. Your agent app following the TypeScript Next.js starter pattern with `/lib/mcp/client/` structure

## Before You Start: Verify MCP Server is Working

**Important:** Before implementing the integration, verify the SCAHA MCP server is functioning correctly. This will save debugging time by confirming any issues are in your integration code, not the MCP server.

### Quick Health Check

```bash
curl http://localhost:3000/mcp/health | jq
```

Expected response:
```json
{
  "status": "healthy",
  "service": "scaha-mcp",
  "version": "1.0.0",
  "tools": {
    "working": ["list_schedule_options", "get_schedule", "get_schedule_csv"]
  }
}
```

### Run Integration Tests

The SCAHA MCP server includes a comprehensive test suite. Run it to verify everything works:

```bash
# Clone the SCAHA MCP repo
git clone https://github.com/joerawr/scaha-mcp.git
cd scaha-mcp
npm install

# Start server in one terminal
npm run dev

# Run tests in another terminal
npm run test:integration
```

**Expected Result:** ✅ 12/12 tests passing (~40 seconds)

If tests fail, check:
- SCAHA MCP server logs for errors
- Network connectivity to scaha.net
- Port 3000 is not in use by another service

**Once tests pass, proceed with integration.**

## Implementation Steps

### Step 1: Create SCAHA MCP Client Types

Create `/lib/mcp/client/scaha-types.ts`:

```typescript
// SCAHA MCP Client Configuration
export interface SCHAMCPClientConfig {
  serverUrl?: string; // Default: http://localhost:3000/mcp
}

// Tool: list_schedule_options
export interface SchaListScheduleOptionsParams {
  season?: string;    // e.g., "2025/26"
  schedule?: string;  // e.g., "14U B"
  team?: string;      // e.g., "Jr. Kings (1)"
}

export interface SchaSelectOption {
  value: string;
  label: string;
  selected: boolean;
}

export interface SchaScheduleOptionsResult {
  seasons: SchaSelectOption[];
  schedules: SchaSelectOption[];
  teams: SchaSelectOption[];
}

// Tool: get_schedule
export interface SchaGetScheduleParams {
  season: string;     // Required: e.g., "2025/26"
  schedule: string;   // Required: e.g., "14U B"
  team: string;       // Required: e.g., "Jr. Kings (1)"
  date?: string;      // Optional: YYYY-MM-DD format
}

export interface SchaGame {
  game_id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  home: string;
  home_score: number | null;
  away: string;
  away_score: number | null;
  venue: string;
  rink: string;
}

export type SchaScheduleResult = SchaGame[];

// Tool: get_schedule_csv
export interface SchaGetScheduleCSVParams {
  season: string;     // Required: e.g., "2025/26"
  schedule: string;   // Required: e.g., "14U B"
  team: string;       // Required: e.g., "Jr. Kings (1)"
}

export interface SchaScheduleCSVResult {
  filename: string;
  mime: string;
  data_base64: string;
  size_bytes: number;
}

// Tool: get_team_stats
export interface SchaGetTeamStatsParams {
  season: string;
  division: string;
  team_slug: string;
}

export interface SchaTeamStats {
  team: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
}

// Tool: get_player_stats
export interface SchaGetPlayerStatsParams {
  season: string;
  division: string;
  team_slug: string;
  player: {
    name?: string;
    number?: string;
  };
}

export interface SchaPlayerStats {
  number: string;
  name: string;
  team: string;
  gp: number;
  g: number;
  a: number;
  pts: number;
  pims: number;
}
```

### Step 2: Create SCAHA MCP Client

Create `/lib/mcp/client/scaha-client.ts`:

```typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import type { SCHAMCPClientConfig } from './scaha-types';

export class SchaMCPClient {
  private client: ReturnType<typeof createMCPClient> | null = null;
  private config: SCHAMCPClientConfig;
  private isConnected: boolean = false;

  constructor(config: SCHAMCPClientConfig = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'http://localhost:3000/mcp',
    };
  }

  async connect() {
    if (this.isConnected) {
      console.log('SCAHA MCP client already connected');
      return;
    }

    try {
      this.client = createMCPClient({
        transport: {
          type: 'sse',
          url: this.config.serverUrl!,
        },
      });

      this.isConnected = true;
      console.log('SCAHA MCP client connected successfully');
    } catch (error) {
      console.error('Failed to connect to SCAHA MCP server:', error);
      throw error;
    }
  }

  async disconnect() {
    // Note: Per MCP best practices, don't disconnect during streaming
    // This method is provided for cleanup only
    if (this.client) {
      this.isConnected = false;
      this.client = null;
      console.log('SCAHA MCP client disconnected');
    }
  }

  async getTools() {
    if (!this.isConnected || !this.client) {
      throw new Error('SCAHA MCP client not connected. Call connect() first.');
    }

    try {
      const tools = await this.client.getTools();
      console.log(`Retrieved ${Object.keys(tools).length} tools from SCAHA MCP server`);
      return tools;
    } catch (error) {
      console.error('Failed to get tools from SCAHA MCP server:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

// Singleton pattern for connection reuse
let schaClientInstance: SchaMCPClient | null = null;

export function getSchaMCPClient(config?: SCHAMCPClientConfig): SchaMCPClient {
  if (!schaClientInstance) {
    schaClientInstance = new SchaMCPClient(config);
  }
  return schaClientInstance;
}

export function resetSchaMCPClient() {
  if (schaClientInstance) {
    schaClientInstance.disconnect();
    schaClientInstance = null;
  }
}
```

### Step 3: Export from MCP Index

Update `/lib/mcp/index.ts` to include SCAHA client:

```typescript
// Add to existing exports
export {
  SchaMCPClient,
  getSchaMCPClient,
  resetSchaMCPClient,
} from './client/scaha-client';

export type {
  SCHAMCPClientConfig,
  SchaListScheduleOptionsParams,
  SchaScheduleOptionsResult,
  SchaGetScheduleParams,
  SchaGame,
  SchaScheduleResult,
  SchaGetScheduleCSVParams,
  SchaScheduleCSVResult,
  SchaGetTeamStatsParams,
  SchaTeamStats,
  SchaGetPlayerStatsParams,
  SchaPlayerStats,
} from './client/scaha-types';
```

### Step 4: Create API Route

Create `/app/api/agent-with-scaha/route.ts`:

```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getSchaMCPClient } from '@/lib/mcp';

export const maxDuration = 300; // 5 minutes for browser automation

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', {
        status: 400,
      });
    }

    // Initialize SCAHA MCP client
    const schaClient = getSchaMCPClient();
    await schaClient.connect();

    // Get available tools
    const schaTools = await schaClient.getTools();

    // Wrap tools with logging
    const wrappedTools: Record<string, any> = {};
    for (const [name, tool] of Object.entries(schaTools)) {
      wrappedTools[name] = {
        ...tool,
        execute: async (args: Record<string, any>) => {
          console.log(`Executing SCAHA tool: ${name}`, { input: args });
          const result = await tool.execute(args);
          console.log(`SCAHA tool ${name} completed`, { output: result });
          return result;
        },
      };
    }

    // Stream response with SCAHA tools
    const result = streamText({
      model: openai('gpt-4o'),
      messages,
      tools: wrappedTools,
      maxSteps: 10,
      system: `You are a helpful assistant with access to SCAHA (Southern California Amateur Hockey Association) data.

Available tools:
- list_schedule_options: Discover available seasons, schedules, and teams
- get_schedule: Get game schedules with optional date filtering
- get_schedule_csv: Download raw CSV schedule data
- get_team_stats: Get team standings and statistics
- get_player_stats: Get individual player statistics

When users ask about hockey schedules, games, or stats:
1. Use list_schedule_options first if you need to discover available options
2. For schedule queries, use get_schedule with the correct format:
   - season: "2025/26" (NOT "SCAHA 2025/26 Season")
   - schedule: "14U B" (NOT "14U B Regular Season")
   - team: exact name like "Jr. Kings (1)"
   - date: "YYYY-MM-DD" for filtering to specific dates

Note: Browser automation is used, so queries may take 5-10 seconds.`,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in SCAHA agent route:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

### Step 5: Create Frontend Page

Create `/app/agent-with-scaha/page.tsx`:

```typescript
import { ChatAssistant } from '@/components/chat-assistant';

export default function AgentWithSchaPage() {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">SCAHA Hockey Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask about youth hockey schedules, teams, and stats
        </p>
      </header>
      <ChatAssistant api="/api/agent-with-scaha" />
    </div>
  );
}
```

## Testing Your Integration

### Test Flow

1. **Verify MCP Server** → 2. **Implement Integration** → 3. **Test Agent App**

### 1. Verify MCP Server (Before Integration)

Always verify the MCP server is working first:

```bash
# Terminal 1: Start SCAHA MCP server
cd /path/to/scaha-mcp
npm run dev

# Terminal 2: Run health check
curl http://localhost:3000/mcp/health | jq

# Terminal 2: Run full integration tests
npm run test:integration
```

**Decision Point:**
- ✅ Tests pass → MCP server working, proceed to step 2
- ❌ Tests fail → Fix MCP server issues before integrating

### 2. Implement Integration (This Guide)

Follow the implementation steps above to create:
- `/lib/mcp/client/scaha-types.ts`
- `/lib/mcp/client/scaha-client.ts`
- `/lib/mcp/index.ts` (exports)
- `/app/api/agent-with-scaha/route.ts`
- `/app/agent-with-scaha/page.tsx`

### 3. Test Your Agent App

```bash
# Terminal 1: SCAHA MCP server (from step 1)
cd /path/to/scaha-mcp
npm run dev  # http://localhost:3000

# Terminal 2: Your agent app
cd /path/to/your-agent-app
npm run dev  # http://localhost:3001 (or different port)

# Terminal 3: Quick agent app test
curl http://localhost:3001/api/agent-with-scaha \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What teams are in 14U B?"}]}'
```

### Debugging Integration Issues

If your agent app has issues:

**Step 1: Re-verify MCP Server**
```bash
cd /path/to/scaha-mcp
npm run test:integration
```

- ✅ Tests pass → Issue is in your agent app integration code
- ❌ Tests fail → Issue is in MCP server

**Step 2: Check Your Integration**

Common issues:
- Wrong `serverUrl` (should be `http://localhost:3000/mcp`)
- Missing SSE transport configuration
- Incorrect parameter formats (see test fixtures)
- Not calling `await client.connect()` before `getTools()`

**Step 3: Test MCP Client Connection**

Add logging to your route.ts:
```typescript
const schaClient = getSchaMCPClient();
console.log('Connecting to SCAHA MCP...');
await schaClient.connect();
console.log('Connection status:', schaClient.getConnectionStatus());

const tools = await schaClient.getTools();
console.log('Retrieved tools:', Object.keys(tools));
```

**Step 4: Compare with Test Fixtures**

Check your tool parameters match the expected format:
```bash
cat /path/to/scaha-mcp/tests/fixtures/expected-responses.json
```

### Example Queries

Try these queries in your agent chat:

1. **List available options:**
   - "What seasons are available?"
   - "Show me the schedules for 2025/26"
   - "What teams are in 14U B?"

2. **Get specific schedule:**
   - "Who are the 14U B Jr Kings playing on 10/5/2025?"
   - "Show me the Jr. Kings (1) schedule for October 2025"
   - "When does Heat play next?"

3. **Get team stats:**
   - "What are the standings for Jr. Ducks in Bantam AA?"
   - "Show me team stats for the 2024-25 season"

4. **Get player stats:**
   - "Who is number 7 on Jr. Ducks?"
   - "Show me stats for player Smith"

## Available Tools

### 1. list_schedule_options
Discovers available seasons, schedules, and teams.

**Parameters:**
- `season` (optional): Season name
- `schedule` (optional): Schedule name
- `team` (optional): Team name

**Returns:** Lists of available seasons, schedules, and teams

### 2. get_schedule
Gets game schedules with filtering.

**Parameters:**
- `season` (required): e.g., "2025/26"
- `schedule` (required): e.g., "14U B"
- `team` (required): e.g., "Jr. Kings (1)"
- `date` (optional): "YYYY-MM-DD"

**Returns:** Array of games with dates, times, scores, venues

### 3. get_schedule_csv
Downloads raw CSV schedule data.

**Parameters:** Same as get_schedule (without date filter)

**Returns:** Base64-encoded CSV file

### 4. get_team_stats
Gets team standings and statistics.

**Parameters:**
- `season`: e.g., "2024-25"
- `division`: Division name
- `team_slug`: Team identifier

**Returns:** GP, W, L, T, Points, GF, GA, GD

### 5. get_player_stats
Gets individual player statistics.

**Parameters:**
- `season`: e.g., "2024-25"
- `division`: Division name
- `team_slug`: Team identifier
- `player`: { name or number }

**Returns:** Number, Name, GP, G, A, PTS, PIMs

## Important Notes

1. **Browser Automation Delay:** Queries using get_schedule or get_schedule_csv take 5-10 seconds due to browser automation.

2. **Parameter Format:** Use short format for season/schedule:
   - ✅ "2025/26" and "14U B"
   - ❌ "SCAHA 2025/26 Season" and "14U B Regular Season"

3. **Connection Persistence:** The MCP client uses a singleton pattern. Don't disconnect during streaming operations.

4. **Error Handling:** Browser automation may fail if:
   - SCAHA website is down
   - Network issues
   - Invalid team/schedule names

5. **Local Development Only:** This configuration assumes both apps run locally. For production, deploy SCAHA MCP server to Vercel and update the `serverUrl` config.

## Verifying MCP Server is Working

Before debugging your agent app integration, verify the MCP server itself is working:

### Quick Health Check
```bash
curl http://localhost:3000/mcp/health | jq
```

Should return:
```json
{
  "status": "healthy",
  "service": "scaha-mcp",
  "version": "1.0.0",
  "tools": {
    "working": ["list_schedule_options", "get_schedule", "get_schedule_csv"]
  }
}
```

### Run Integration Tests

Clone the SCAHA MCP repo and run its test suite:

```bash
git clone https://github.com/joerawr/scaha-mcp.git
cd scaha-mcp
npm install

# Start server in one terminal
npm run dev

# Run tests in another terminal
npm run test:integration
```

If all tests pass (✅ 12/12), the MCP server is working correctly and any issues are in your agent app integration code.

## Troubleshooting

### "Failed to connect to SCAHA MCP server"
1. **Check server is running:**
   ```bash
   curl http://localhost:3000/mcp/health
   ```
2. Ensure no other service is using port 3000
3. Verify server started successfully (`npm run dev`)

### "Tool execution timeout"
1. Browser automation can take 10-15 seconds
2. Increase `maxDuration` in route.ts if needed
3. Check SCAHA website is accessible:
   ```bash
   curl -I https://www.scaha.net/scaha/scoreboard.xhtml
   ```

### "Team not found" errors
1. Use exact team names from list_schedule_options
2. Include parentheses and numbers: "Jr. Kings (1)"
3. Check season/schedule are valid
4. Test with curl first to verify parameters

### When in Doubt: Run the Tests
If unsure whether issue is in MCP server or your agent app:
1. Run `npm run test:integration` on SCAHA MCP server
2. If tests pass → issue is in your agent app
3. If tests fail → issue is in MCP server (check server logs)

## Integration Test Suite

The SCAHA MCP server includes comprehensive integration tests that you can use to verify the server before debugging your agent app.

### What's Tested

✅ **12 Integration Tests** covering:
- Health check endpoint
- `list_schedule_options` - seasons, schedules, teams
- `get_schedule` - game schedules with date filtering
- `get_schedule_csv` - CSV export with base64 encoding
- Error handling for invalid inputs

### Test Data

Tests use verified, stable data from scaha.net:
- **Season:** 2025/26
- **Schedule:** 14U B
- **Team:** Jr. Kings (1)
- **Known Game:** Jr. Kings vs Heat on 2025-10-05 at 16:15
- **Venue:** Paramount Ice Land

### NPM Scripts

```bash
# Quick health check
npm run test:health

# Run all integration tests
npm run test:integration

# Watch mode (re-run on changes)
npm run test:watch

# Interactive UI
npm run test:ui
```

### Test Fixtures

See `tests/fixtures/expected-responses.json` for:
- Expected response structures for each tool
- Correct parameter formats
- Known test data
- Example tool calls

### When to Run Tests

**Before Integration:**
- Verify MCP server is working
- Understand expected response structures
- Confirm parameter formats

**During Integration:**
- Debug connection issues
- Verify tool availability
- Compare your responses to expected fixtures

**After Integration:**
- Regression testing
- Verify MCP server after updates
- Confirm SCAHA website hasn't changed

## Next Steps

1. **Verify MCP Server:** Run `npm run test:integration` on SCAHA MCP server
2. **Copy this file** to your agent app repository
3. **Implement integration:**
   - Create `scaha-types.ts`
   - Create `scaha-client.ts`
   - Update `/lib/mcp/index.ts` exports
   - Create `/app/api/agent-with-scaha/route.ts`
   - Create `/app/agent-with-scaha/page.tsx`
4. **Test integration:**
   - Start both servers
   - Try example queries
   - Compare responses to test fixtures
5. **Debug if needed:**
   - Re-run MCP tests to confirm server works
   - Add logging to your integration code
   - Check parameter formats match fixtures
6. **Deploy:** Deploy SCAHA MCP server to Vercel for production

## Resources

- **SCAHA MCP Server:** https://github.com/joerawr/scaha-mcp
- **Integration Tests:** Run `npm run test:integration` in SCAHA MCP repo
- **Test Fixtures:** `/tests/fixtures/expected-responses.json`
- **Testing Guide:** `/tests/README.md` in SCAHA MCP repo
- **Health Check:** `http://localhost:3000/mcp/health`
- **AI SDK MCP Docs:** https://ai-sdk.dev/cookbook/node/mcp-tools
- **SCAHA Website:** https://www.scaha.net

## Quick Reference: Testing Commands

```bash
# In SCAHA MCP server repo
npm run dev                    # Start server
npm run test:health            # Quick health check
npm run test:integration       # Run all tests
npm run test:watch            # Watch mode

# From anywhere
curl http://localhost:3000/mcp/health | jq    # Health check
```

**Remember:** If integration tests pass (✅ 12/12), the MCP server is working correctly. Any issues are in your agent app integration code.
