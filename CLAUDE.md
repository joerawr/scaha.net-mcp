# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript MCP (Model Context Protocol) server that scrapes scaha.net (Southern California Amateur Hockey Association) to provide youth hockey data via tool calls. The server exposes schedules, standings, team stats, and player stats.

## Architecture

**MCP Tool Pattern**: This project follows the Vercel MCP handler pattern:
- All MCP tools are defined in `app/mcp/route.ts` using `createMcpHandler()`
- Tools use Zod schemas for input validation
- Helper functions live in `/lib` directory (scrapers, parsers, utilities)

**Data Source**: scaha.net provides static HTML pages with tables. We use Cheerio for HTML parsing (no headless browser needed).

**File Structure**:
```
/app/mcp/route.ts         # MCP handler with all 4 tools defined inline
/lib/scrapers.ts          # Scraping functions (HTTP client, page scrapers)
/lib/types.ts             # TypeScript interfaces matching scaha.net data
/lib/utils.ts             # Team name normalization, date/time parsing
/scripts/test-client.mjs  # Local STDIO testing script
```

## MCP Tools

The server provides exactly 4 tools:

1. **get_team_stats** - Returns standings data for a specific team
2. **get_player_stats** - Returns stats for a player (searchable by name or number)
3. **get_schedule** - Returns array of games with filtering options
4. **get_schedule_csv** - Downloads and returns CSV from scaha.net (base64 encoded)

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

**CSV Strategy**: scaha.net provides native CSV exports - download these directly rather than scraping HTML when possible.

**Session Handling**: May need JSESSIONID cookie handling depending on scaha.net requirements.

## Development Path

1. Local STDIO testing first (using `scripts/test-client.mjs`)
2. Deploy to Vercel as remote MCP server when ready
3. Enable Fluid compute on Vercel for efficient execution

## Reference Data

See `scaha_sample_schedule.csv` for example of scaha.net's CSV export format.
See `PLAN.md` for complete implementation plan with phases.
