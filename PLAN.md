# TypeScript MCP Server for scaha.net - Implementation Plan

## Project Overview
Build a TypeScript MCP server that scrapes scaha.net for youth hockey data and exposes it via tool calls. Uses browser automation (Puppeteer) to handle JavaScript-populated dropdowns. Start with local HTTP testing, then deploy to Vercel.

## Phase 1: Project Setup ✅
1. ✅ Initialize Next.js project with TypeScript
2. ✅ Install dependencies:
   - `@modelcontextprotocol/sdk`
   - `mcp-handler`
   - `zod` (validation)
   - `cheerio` (HTML parsing)
   - `date-fns` + `date-fns-tz` (time handling)
   - `puppeteer-core` (browser automation)
   - `@sparticuz/chromium` (Vercel-compatible Chromium)
3. ✅ Create file structure:
   ```
   /app/mcp/route.ts           # MCP handler with all tools
   /lib/scrapers.ts            # Static HTML scraping functions
   /lib/browser-scrapers.ts    # Browser automation scrapers
   /lib/types.ts               # TypeScript interfaces
   /lib/utils.ts               # Normalization helpers
   /scripts/test-client.mjs    # Local testing (optional)
   ```

## Phase 2: Core Infrastructure (lib/) ✅

### types.ts - Define interfaces matching scaha.net data ✅
- `TeamStats`: team, gp, w, l, t, points, gf, ga, gd
- `PlayerStats`: number, name, team, gp, g, a, pts, pims
- `Game`: game_id, date, time, type, status, home, away, home_score, away_score, venue, rink
- `SelectOption`: value, label, selected (for dropdown navigation)
- `ScoreboardOptionState`: seasons, schedules, teams (dropdown states)
- Tool parameter/response types

### utils.ts - Helper functions
- Team name normalization (strip spaces, punctuation, handle abbreviations)
- Date/time parsing with America/Los_Angeles timezone normalization
- Keep raw strings for traceability

### scrapers.ts - Scraping logic using Cheerio
- HTTP client with JSESSIONID session handling if needed
- `scrapeStandings(season, division)` → parse standings table
- `scrapePlayerStats(season, division, team_slug)` → parse player stats table
- `scrapeSchedule(season, division?, team_slug?)` → parse schedule table
- Note: Static HTML scraping insufficient for JavaScript-populated dropdowns

### browser-scrapers.ts - Browser automation using Puppeteer ✅
- ✅ `getBrowserConfig()` → detect local Chrome vs Vercel chromium
- ✅ `getScoreboardOptionsWithBrowser(seasonQuery?, scheduleQuery?, teamQuery?)` → navigate dropdowns, return available options
- ✅ `downloadScheduleCSVWithBrowser(season, schedule, team)` → full navigation + table extraction
- ✅ Uses `puppeteer-core` + `@sparticuz/chromium` for Vercel compatibility
- ✅ Executes JavaScript to populate dynamic dropdowns via BsF.ajax.callAjax
- ✅ Extracts schedule table (not standings) by checking for "game" and "date" headers
- ✅ Waits for AJAX completion with `page.waitForNetworkIdle()`

## Phase 3: MCP Tools (app/mcp/route.ts) ✅
Define 5 tools using `createMcpHandler()`:

### 1. list_schedule_options ✅
- **Params** (Zod): `{ season?: string, schedule?: string, team?: string }`
- **Returns**: `{ seasons: SelectOption[], schedules: SelectOption[], teams: SelectOption[] }`
- **Implementation**: Use `getScoreboardOptionsWithBrowser()` to navigate scoreboard dropdowns and return available options
- **Purpose**: Discovery tool - helps clients find valid season/schedule/team names before querying schedules
- **Status**: ✅ Implemented and tested

### 2. get_team_stats
- **Params** (Zod): `{ season: string, division: string, team_slug: string }`
- **Returns**: `{ team: string, gp: number, w: number, l: number, t: number, points: number, gf: number, ga: number, gd: number }`
- **Implementation**: Scrape standings page, find team row, parse stats

### 3. get_player_stats
- **Params**: `{ season: string, division: string, team_slug: string, player: { name?: string, number?: string } }`
- **Returns**: `{ number: string, name: string, team: string, gp: number, g: number, a: number, pts: number, pims: number }`
- **Implementation**: Scrape player stats page, match by name or number

### 4. get_schedule
- **Params**: `{ season: string, division?: string, team_slug?: string, date_range?: { start: string, end: string } }`
- **Returns**: `Array<{ game_id: string, date: string, time: string, type: string, status: string, home: string, away: string, home_score?: number, away_score?: number, venue: string, rink: string }>`
- **Implementation**: Scrape schedule page or parse CSV, filter by params

### 5. get_schedule_csv ✅
- **Params**: `{ season: string, schedule: string, team: string }` (all required for precise navigation)
- **Returns**: `{ filename: string, mime: "text/csv", data_base64: string, size_bytes: number }`
- **Implementation**: Use `downloadScheduleCSVWithBrowser()` to navigate scoreboard, select team, extract schedule table as CSV
- **Filename format**: `SCAHA_{year}_{tier}_{team}_{timestamp}.csv` (e.g., `SCAHA_2025-26_14U-A_Jr_Kings_1__2025-10-02T06-34-56.csv`)
- **Status**: ✅ Implemented and tested with 5 different teams

## Phase 4: Testing & Validation
1. ✅ Discovered scaha.net uses JavaScript (BootsFaces/JSF) for dynamic dropdown population - requires browser automation
2. ✅ Implemented Puppeteer-based browser scraper for JavaScript execution
3. ✅ Test with HTTP requests via curl (local dev server at http://localhost:3000/mcp)
4. ✅ Validated with multiple teams across different tiers:
   - 14U B Jr. Kings (1): plays Heat on 2025-10-05 at 16:15
   - 14U A Red Wings: plays Wave on 2025-10-05 at 10:20
   - 12U A Goldrush: plays @ Jr Firebirds on 2025-10-05 at 14:25
   - 10U A Bears: plays Jr. Kings (2) on 2025-10-05 at 10:30
   - 14U BB Stars: plays Avalanche on 2025-10-11 at 15:30
5. ✅ Ensure output types are stable and deterministic

## Phase 5: Vercel Deployment
1. Configure `next.config.ts` and `vercel.json`
2. Deploy to Vercel with Fluid compute enabled
3. Test remote MCP server endpoints
4. Document deployment process in README

## Key Technical Decisions
- **Browser Automation**: Puppeteer (`puppeteer-core` + `@sparticuz/chromium`) for JavaScript-heavy pages
  - Necessary because scaha.net uses BootsFaces/JSF with BsF.ajax.callAjax for dynamic dropdowns
  - Local development: system Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  - Production (Vercel): @sparticuz/chromium for serverless compatibility
- **Parsing**: Cheerio for static HTML parsing (lightweight, fast) where applicable
- **Table Extraction**: Identify schedule table by checking headers for "game" and "date" keywords
- **CSV Strategy**: Extract schedule table directly from DOM after team selection (no button clicks to avoid navigation)
- **Timestamps**: Normalize to America/Los_Angeles, include raw strings for traceability
- **Validation**: Zod schemas for all tool inputs
- **Structure**: Follow vercel/mcp-handler pattern - tools in route.ts, helpers in /lib
- **Performance**: Set `maxDuration: 300` (5 minutes) in route handler to allow browser operations

## CSV Format Reference (from scaha_sample_schedule.csv)
```csv
"Game #","Date","Time","Type","Status","Home","Score","Away","Score","Venue","Rink"
"149151710","2025-09-07","18:30:00","Game","Final","Avalanche","5","Jr. Ducks (1)","2","Aliso Viejo Ice","1"
```
- Game # = unique game ID
- Date = YYYY-MM-DD
- Time = HH:MM:SS (local time)
- Type = "Game" (possibly "Playoff", "Tournament")
- Status = "Final" or "Scheduled"
- Score = numeric or "--" for unplayed games
