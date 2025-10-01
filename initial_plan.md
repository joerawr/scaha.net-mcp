Scaha.net MCP Server

I want to make an MCP server to crawl the scaha.net website to make pulling schedules, stats, and scoreboards a simple tool call for an LLM agent I am building. 
- Get stats for team 
- Get stats for player 
- Get schedule 
- Get schedule (CSV)



More discussion here: https://vercel.com/blog/grep-a-million-github-repositories-via-mcp
https://vercel.com/changelog/mcp-server-support-on-vercel

The github page has usage:
https://github.com/vercel/mcp-handler

We can test locally with STDIO, then when it's MVP releaseable:
Remote, hosted server: Deploy on Vercel as a remote MCP server; the adapter handles the wire protocol so you focus on scraping/formatting. Templates and examples already exist.
https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js


Evaluate this Recommended tool design (TypeScript MCP server on Vercel)

Define four tools; keep params explicit and results normalized.

- get_team_stats
params: { season: "2025-26", division: "14U-AA", team_slug: "jr-kings-14u-aa" }
returns: standings row + computed metrics (GF, GA, GD, win%, PPG, recent form).

- get_player_stats
params: { season, division, team_slug, player: { name?: string, number?: string } }
returns: per-game line + totals (G, A, P, PIM), with canonical player id if available.

- get_schedule
params: { season, division?, team_slug?, date_range?: { start: ISO, end: ISO } }
returns: array of { game_id, date, time_local, home, away, venue, rink, status, score? }.

- get_schedule_csv
params: { season, division?, team_slug? }
returns: { filename, mime: "text/csv", data_base64 } so the client can save/parse.

- Pages/structure: Public pages include Scoreboard/Standings and a “Master Game Schedule” area with CSV/Excel exports. You’ll likely need to hit *.xhtml endpoints and possibly follow a session cookie (JSESSIONID). A headless fetch is usually enough; only use headless browser if the HTML is JS-rendered.  We can test to see if headless browser needs to be implemented.  The scaha site is a fairly static design with no changes or regular upgrades other than stats and schedules.
- Parsing: Build selectors robust to table changes; normalize team names (strip spaces, punctuation, unify abbreviations).
- Time zones: Normalize to America/Los_Angeles and include the raw string from the site for traceability.
- CSV path: Prefer the site’s own CSV/Excel links when present; less brittle than HTML scraping.

Determinism: Keep outputs strictly typed and stable so your agent’s planner can rely on them.
