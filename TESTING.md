# SCAHA MCP Server Testing Guide

Quick reference for testing the SCAHA MCP server.

## Quick Commands

```bash
# Health check
npm run test:health

# Run all integration tests
npm run test:integration

# Watch mode (re-run on changes)
npm run test:watch

# UI mode (interactive browser)
npm run test:ui
```

## Test Results Summary

**Total Tests:** 12
**Status:** ✅ All Passing
**Duration:** ~40 seconds

### Test Breakdown

#### Health Check (1 test)
- ✅ Server returns healthy status

#### list_schedule_options (4 tests)
- ✅ Lists available seasons
- ✅ Returns 2025/26 season
- ✅ Lists schedules for 2025/26
- ✅ Lists teams for 14U B schedule

#### get_schedule (3 tests)
- ✅ Gets Jr. Kings schedule
- ✅ Filters by specific date (2025-10-05)
- ✅ Returns empty array for dates with no games

#### get_schedule_csv (2 tests)
- ✅ Returns CSV data for Jr. Kings
- ✅ Generates descriptive filename

#### Error Handling (2 tests)
- ✅ Handles invalid team name
- ✅ Handles invalid schedule name

## Test Data

Tests use **verified, stable data** from scaha.net:

| Property | Value |
|----------|-------|
| Season | 2025/26 |
| Schedule | 14U B |
| Team | Jr. Kings (1) |
| Known Game | Jr. Kings vs Heat |
| Game Date | 2025-10-05 |
| Game Time | 16:15:00 |
| Venue | Paramount Ice Land |

## Running from Agent Application

If you're building an agent app that uses this MCP server:

### Step 1: Verify MCP Server Works
```bash
# Quick health check
curl http://localhost:3000/mcp/health | jq

# Clone and test
git clone https://github.com/joerawr/scaha-mcp.git
cd scaha-mcp
npm install && npm run dev
# In another terminal:
npm run test:integration
```

### Step 2: Test Your Integration
If MCP server tests pass (✅), any issues are in **your** integration code.

Check:
- Correct server URL (`http://localhost:3000/mcp`)
- SSE transport configuration
- Tool parameter formats (see `tests/fixtures/expected-responses.json`)

## Expected Performance

| Operation | Time |
|-----------|------|
| Health check | < 1 second |
| list_schedule_options | 1.5-4 seconds |
| get_schedule | 4-7 seconds |
| get_schedule_csv | 4-7 seconds |

**Note:** Browser automation adds 5-10 seconds per request.

## Troubleshooting Test Failures

### All Tests Timeout
- Server not running (`npm run dev`)
- Wrong port (check 3000 is free)
- Network issues

### Specific Tests Fail
- SCAHA website changed structure
- Network issues reaching scaha.net
- Test data changed (rare)

### Browser Automation Errors
Check server logs for:
- Puppeteer errors
- Chromium launch failures
- Navigation timeouts

## Test Fixtures

See `tests/fixtures/expected-responses.json` for:
- Expected response structures
- Parameter formats
- Known test data
- Example tool calls

## CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run dev &
      - run: npx wait-on http://localhost:3000/mcp/health
      - run: npm run test:integration
```

## Documentation

- **Detailed Testing Docs:** `tests/README.md`
- **Integration Guide:** `Implement_Scaha_MCP.md`
- **Project Docs:** `CLAUDE.md`
- **Test Fixtures:** `tests/fixtures/expected-responses.json`

## Support

**Issues:** https://github.com/joerawr/scaha-mcp/issues
**Tests Pass?** MCP server is working correctly!
