# Progress Notes – SCAHA MCP Server

## Current State
- `list_schedule_options` tool has been added to `app/mcp/route.ts`; 
  it registers via `createMcpHandler` alongside the existing tools.
- The helper logic lives in `lib/scrapers.ts`: 
  - `getScoreboardOptionsState()` now initializes a JSF session, parses the season/schedule/team dropdowns, 
    and optionally posts back to switch seasons.
  - New types (`SelectOption`, `ScoreboardOptionState`) are defined in `lib/types.ts`.
- Linting (`npm run lint`) passes after the changes.
- `scripts/extract_schedule.mjs` demonstrates parsing the AJAX partial to CSV; output stored at `data/14u_b_jr_kings_schedule.csv`.

## Testing Status
- Local CLI calls must use the MCP protocol methods:
  - `list_tools` → confirms the available tool names (should include `list_schedule_options`).
  - `call_tool` → invoke `list_schedule_options` with `{ "season": "SCAHA 2025/26 Season" }`.
- Reminder: Include both headers `Content-Type: application/json` and `Accept: application/json,text/event-stream`,
  then strip the `data:` prefix before piping to `jq` (e.g., `sed -n 's/^data: //p'`).

## Outstanding
- Validate that the MCP call returns the expected dropdown JSON (seasons/schedules/teams).
- Integrate the dropdown info into the README/UI if desired (currently the landing page still lists only legacy tools).


Trying to run:
curl -sN http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json,text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "list_schedule_options",
    "params": { "season": "SCAHA 2025/26 Season" }
  }' \
  | sed -n 's/^data: //p' \
  | jq

Getting:
{
  "jsonrpc": "2.0",
  "id": "tools",
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}