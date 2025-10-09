## Problem
Clients needed goalie-friendly player stats and accurate team standings, but the STDIO build (dist/) still served outdated scrapers. Claude calls were failing with “player not found” and standings requests timed out because the data was still scraped via legacy HTML parsing that no longer reflected the scoreboard’s DataTables output.

## Solution
- Rebuild the STDIO bundle so `dist/` includes the new browser-driven scrapers.
- Ensure `get_player_stats` handles goalie keyword detection and returns the Stats Central table results.
- Replace the old HTML standings scraper with a Puppeteer flow that selects the season/schedule, waits for DataTables to render, and parses the standings rows.
- Document in `README.md` and `docs/Implement_Scaha_MCP.md` how to obtain the exact `division` and `team_slug` values via `list_schedule_options` to avoid timeouts.

## Rabbit holes
- Don’t revert to the non-browser scrapers; they miss AJAX-populated tables.
- Avoid guessing team slugs—always read them from `list_schedule_options`.

## No gos
- Changing MCP SDK versions or collapsing the dual transport setup.
- Shipping without rebuilding `dist/` (Claude will continue running stale code).
