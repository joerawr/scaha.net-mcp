# TypeScript MCP Server for scaha.net - Implementation Plan

## Project Overview
Build a TypeScript MCP server that scrapes scaha.net for youth hockey data and exposes it via tool calls. Start with local STDIO testing, then deploy to Vercel.

## Phase 1: Project Setup
1. Initialize Next.js project with TypeScript
2. Install dependencies:
   - `@modelcontextprotocol/sdk`
   - `mcp-handler`
   - `zod` (validation)
   - `cheerio` (HTML parsing)
   - `date-fns` + `date-fns-tz` (time handling)
3. Create file structure:
   ```
   /app/mcp/route.ts         # MCP handler with all tools
   /lib/scrapers.ts          # Scraping functions
   /lib/types.ts             # TypeScript interfaces
   /lib/utils.ts             # Normalization helpers
   /scripts/test-client.mjs  # Local testing
   ```

## Phase 2: Core Infrastructure (lib/)

### types.ts - Define interfaces matching scaha.net data
- `TeamStats`: team, gp, w, l, t, points, gf, ga, gd
- `PlayerStats`: number, name, team, gp, g, a, pts, pims
- `Game`: game_id, date, time, type, status, home, away, home_score, away_score, venue, rink
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
- `downloadScheduleCSV(...)` → download CSV directly from site

## Phase 3: MCP Tools (app/mcp/route.ts)
Define 4 tools using `createMcpHandler()`:

### 1. get_team_stats
- **Params** (Zod): `{ season: string, division: string, team_slug: string }`
- **Returns**: `{ team: string, gp: number, w: number, l: number, t: number, points: number, gf: number, ga: number, gd: number }`
- **Implementation**: Scrape standings page, find team row, parse stats

### 2. get_player_stats
- **Params**: `{ season: string, division: string, team_slug: string, player: { name?: string, number?: string } }`
- **Returns**: `{ number: string, name: string, team: string, gp: number, g: number, a: number, pts: number, pims: number }`
- **Implementation**: Scrape player stats page, match by name or number

### 3. get_schedule
- **Params**: `{ season: string, division?: string, team_slug?: string, date_range?: { start: string, end: string } }`
- **Returns**: `Array<{ game_id: string, date: string, time: string, type: string, status: string, home: string, away: string, home_score?: number, away_score?: number, venue: string, rink: string }>`
- **Implementation**: Scrape schedule page or parse CSV, filter by params

### 4. get_schedule_csv
- **Params**: `{ season: string, division?: string, team_slug?: string }`
- **Returns**: `{ filename: string, mime: "text/csv", data_base64: string }`
- **Implementation**: Download CSV from scaha.net, encode as base64

## Phase 4: Testing & Validation
1. Test manually with browser: verify scaha.net uses static HTML (no JS rendering needed)
2. Create `scripts/test-client.mjs` for local STDIO testing
3. Validate each tool with real scaha.net data
4. Ensure output types are stable and deterministic

## Phase 5: Vercel Deployment
1. Configure `next.config.ts` and `vercel.json`
2. Deploy to Vercel with Fluid compute enabled
3. Test remote MCP server endpoints
4. Document deployment process in README

## Key Technical Decisions
- **Parsing**: Cheerio for static HTML parsing (lightweight, fast)
- **CSV Strategy**: Download native CSV export from site directly
- **Timestamps**: Normalize to America/Los_Angeles, include raw strings for traceability
- **Validation**: Zod schemas for all tool inputs
- **Structure**: Follow vercel/mcp-handler pattern - tools in route.ts, helpers in /lib

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
