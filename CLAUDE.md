# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript MCP (Model Context Protocol) server that scrapes scaha.net (Southern California Amateur Hockey Association) to provide youth hockey data via tool calls. The server exposes schedules, standings, team stats, and player stats.

## Architecture

**MCP Tool Pattern**: This project follows the Vercel MCP handler pattern:
- All MCP tools are defined in `app/mcp/route.ts` using `createMcpHandler()`
- Tools use Zod schemas for input validation
- Helper functions live in `/lib` directory (scrapers, parsers, utilities)

**Data Source**: scaha.net uses JavaScript-heavy forms (JSF/BootsFaces) that require browser automation for dynamic content. We use:
- **Puppeteer** (`puppeteer-core` + `@sparticuz/chromium`) for browser automation
- **Cheerio** for static HTML parsing when possible

**File Structure**:
```
/app/mcp/route.ts           # MCP handler with all 5 tools defined inline
/lib/scrapers.ts            # HTTP-based scraping functions
/lib/browser-scrapers.ts    # Puppeteer-based browser automation
/lib/types.ts               # TypeScript interfaces matching scaha.net data
/lib/utils.ts               # Team name normalization, date/time parsing
/scripts/test-client.mjs    # Local STDIO testing script
```

## MCP Tools

The server provides exactly 5 tools:

1. **list_schedule_options** - Returns available seasons, schedules, and teams from scoreboard page
2. **get_team_stats** - Returns standings data for a specific team
3. **get_player_stats** - Returns stats for a player (searchable by name or number)
4. **get_schedule** - Returns array of games with filtering options
5. **get_schedule_csv** - Downloads and returns CSV from scaha.net (base64 encoded)

## Data Contracts

**Team Stats** (from scaha.net standings):
- `gp, w, l, t, points, gf, ga, gd` (exactly what scaha.net provides, no computed metrics)

**Player Stats** (from scaha.net player stats):
- `number, name, team, gp, g, a, pts, pims`

**Schedule/Games** (from scaha.net CSV export):
- `game_id, date, time, type, status, home, away, home_score, away_score, venue, rink`
- Status: "Final" or "Scheduled"
- Scores: numeric or "--" for unplayed games

## Key Implementation Details

**Timestamps**: All dates/times must be normalized to America/Los_Angeles timezone. Always include the raw string from scaha.net for traceability.

**Team Normalization**: Team names need normalization (strip spaces, punctuation, handle abbreviations like "Jr. Ducks (1)" vs "Jr Ducks").

**Browser Automation Strategy**:
- scaha.net's scoreboard uses JavaScript (BsF.ajax.callAjax) to dynamically populate dropdowns
- Teams list only appears after selecting a schedule via onChange event
- Solution: Use Puppeteer to execute JavaScript, select options, wait for AJAX updates
- Schedule tables are extracted from DOM and converted to CSV format
- Works in both local development (system Chrome) and Vercel (@sparticuz/chromium)

**CSV Filename Generation**: Auto-generated descriptive filenames with format:
`SCAHA_{year}_{tier}_{team}_{timestamp}.csv` (e.g., `SCAHA_2025-26_14U-B_Jr_Kings_1__2025-10-02T06-34-56.csv`)

**Session Handling**: Browser automation handles JSESSIONID cookies automatically.

## Development Path

1. Local STDIO testing first (using `scripts/test-client.mjs`)
2. Deploy to Vercel as remote MCP server when ready
3. Enable Fluid compute on Vercel for efficient execution

## Testing with curl

Start the dev server:
```bash
npm run dev
```

Test MCP tools via HTTP (requires both `application/json` and `text/event-stream` in Accept header):

### List available teams for a schedule:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_schedule_options","arguments":{"season":"2025/26","schedule":"14U B"}}}'
```

### Download team schedule as CSV:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_schedule_csv","arguments":{"season":"2025/26","schedule":"14U B","team":"Jr. Kings (1)"}}}'
```

### Extract and save CSV locally:
```bash
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_schedule_csv","arguments":{"season":"2025/26","schedule":"14U B","team":"Jr. Kings (1)"}}}' \
  | sed -n 's/^data: //p' \
  | jq -r '.result.content[0].text' \
  | jq -r '.data_base64' \
  | base64 -D > schedule.csv
```

**Note**: Browser automation takes ~5-10 seconds per request in development. Expect similar or slightly longer times on Vercel.

## Reference Data

See `scaha_sample_schedule.csv` for example of scaha.net's CSV export format.
See `PLAN.md` for complete implementation plan with phases.
- add the fix and the request format
- save request format