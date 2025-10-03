# SCAHA MCP Server Tests

Integration tests for verifying the SCAHA MCP server is functioning correctly. These tests are designed to be run from **both** the MCP server repo and consuming agent applications.

## Purpose

These tests serve as a **contract verification** tool:
- ✅ Verify MCP server is running and healthy
- ✅ Confirm all tools return expected data structures
- ✅ Test with known data points (Jr. Kings schedule, etc.)
- ✅ Allow agent apps to verify MCP server before debugging their own code

## Quick Start

### 1. Start the MCP Server

```bash
npm run dev
# Server starts on http://localhost:3000
```

### 2. Run Tests

```bash
# Run all integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Quick health check
npm run test:health
```

## Running from Agent Application

If you're developing an agent application that consumes this MCP server, you can run these tests to verify the MCP server is working correctly **before** debugging your own code.

### Option 1: Clone and Test Locally

```bash
# Clone the SCAHA MCP server repo
git clone https://github.com/joerawr/scaha-mcp.git
cd scaha-mcp

# Install dependencies
npm install

# Start the server (in one terminal)
npm run dev

# Run tests (in another terminal)
npm run test:integration
```

### Option 2: Quick Health Check via curl

```bash
# Check if MCP server is running
curl -s http://localhost:3000/mcp/health | jq

# Should return:
# {
#   "status": "healthy",
#   "service": "scaha-mcp",
#   "version": "1.0.0",
#   ...
# }
```

### Option 3: Test Specific Tool

```bash
# Test list_schedule_options
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{
      "name":"list_schedule_options",
      "arguments":{}
    }
  }' | sed -n 's/^data: //p' | jq

# Test get_schedule with known data
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{
      "name":"get_schedule",
      "arguments":{
        "season":"2025/26",
        "schedule":"14U B",
        "team":"Jr. Kings (1)",
        "date":"2025-10-05"
      }
    }
  }' | sed -n 's/^data: //p' | jq
```

## Test Coverage

### Health Check Tests
- ✅ Server returns healthy status
- ✅ All tools are listed in health endpoint

### list_schedule_options Tests
- ✅ Returns valid seasons/schedules/teams structure
- ✅ Includes 2025/26 season
- ✅ Lists schedules for a given season
- ✅ Lists teams for a given schedule (14U B)
- ✅ Verifies Jr. Kings team exists

### get_schedule Tests
- ✅ Returns array of games for Jr. Kings
- ✅ Verifies game structure (game_id, date, time, venue, etc.)
- ✅ Date format validation (YYYY-MM-DD)
- ✅ Time format validation (HH:MM:SS)
- ✅ Date filtering works (2025-10-05)
- ✅ Known game verification (Jr. Kings vs Heat on 10/5)

### get_schedule_csv Tests
- ✅ Returns CSV with correct structure
- ✅ Includes base64-encoded data
- ✅ Generates descriptive filename
- ✅ CSV has correct headers
- ✅ At least one game row exists

### Error Handling Tests
- ✅ Invalid team name throws error
- ✅ Invalid schedule name throws error

## Test Data

Tests use **known verified data points** (see `tests/fixtures/expected-responses.json`):

- **Season**: 2025/26
- **Schedule**: 14U B
- **Team**: Jr. Kings (1)
- **Known Game**: Jr. Kings (1) vs Heat on 2025-10-05 at 16:15

These data points were verified manually on scaha.net and are stable for testing.

## Timeouts

Browser automation takes time:
- Default test timeout: **30 seconds**
- Health check: **5 seconds**
- Expected tool response time: **5-15 seconds**

If tests timeout, the MCP server may be:
1. Not running
2. Experiencing network issues reaching scaha.net
3. SCAHA website is down/changed

## Environment Variables

```bash
# Override MCP server URL (default: http://localhost:3000/mcp)
MCP_SERVER_URL=http://localhost:3001/mcp npm run test:integration
```

## Interpreting Results

### ✅ All Tests Pass
- MCP server is working correctly
- If your agent app has issues, the problem is in your integration code

### ❌ Tests Fail
- MCP server has issues
- Check server logs
- Verify scaha.net is accessible
- Check if SCAHA website structure changed

### ⏱️ Tests Timeout
- Server not running on expected port
- Network issues
- Browser automation is stuck

## Debugging Failed Tests

1. **Check server is running:**
   ```bash
   curl http://localhost:3000/mcp/health
   ```

2. **Check server logs:**
   - Look at terminal where `npm run dev` is running
   - Check for Puppeteer errors
   - Check for network errors

3. **Test scaha.net directly:**
   ```bash
   curl -I https://www.scaha.net/scaha/scoreboard.xhtml
   ```

4. **Run single test:**
   ```bash
   npm run test:watch
   # Then filter to specific test name
   ```

5. **Enable verbose logging:**
   - Tests log tool input/output
   - Check vitest output for details

## Adding New Tests

When adding new tools or features:

1. Add test case to `tests/integration/mcp-tools.test.ts`
2. Add expected response structure to `tests/fixtures/expected-responses.json`
3. Use known, stable test data
4. Set appropriate timeout (30s for browser automation)
5. Verify structure, not exact values (except for known test data)

Example:
```typescript
it('should get team stats', async () => {
  const result = await callMCPTool('get_team_stats', {
    season: '2024-25',
    division: 'Bantam AA',
    team_slug: 'Jr. Ducks',
  });

  expect(result).toHaveProperty('gp');
  expect(result).toHaveProperty('w');
  expect(result).toHaveProperty('l');
  expect(result.gp).toBeGreaterThan(0);
}, TEST_TIMEOUT);
```

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Start MCP Server
  run: npm run dev &

- name: Wait for server
  run: npx wait-on http://localhost:3000/mcp/health

- name: Run integration tests
  run: npm run test:integration
```

## Support

- **Issues**: https://github.com/joerawr/scaha-mcp/issues
- **Documentation**: See main README.md and CLAUDE.md
- **Test Fixtures**: `tests/fixtures/expected-responses.json`

## License

MIT
