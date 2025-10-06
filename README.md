# @joerawr/scaha-mcp

[![npm version](https://badge.fury.io/js/@joerawr%2Fscaha-mcp.svg)](https://www.npmjs.com/package/@joerawr/scaha-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides access to youth hockey data from scaha.net (Southern California Amateur Hockey Association).

## Features

Exposes scaha.net data through MCP tool calls:
- **`get_schedule`** - Game schedules with optional date filtering
- **`get_team_stats`** - Team standings and statistics
- **`get_player_stats`** - Individual player statistics
- **`get_schedule_csv`** - Schedule exports (CSV format, base64 encoded)
- **`list_schedule_options`** - Available seasons, schedules, and teams

## Installation

### For Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "scaha": {
      "command": "npx",
      "args": ["-y", "@joerawr/scaha-mcp"]
    }
  }
}
```

**Config location**:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### For Development (from source)

```bash
git clone https://github.com/joerawr/scaha.net-mcp.git
cd scaha.net-mcp
npm install
npm run build
npm link

# Use in Claude Desktop config:
{
  "mcpServers": {
    "scaha": {
      "command": "scaha-mcp"
    }
  }
}
```

### Chrome/Chromium Requirement

This MCP server uses Puppeteer for web scraping and requires Chrome or Chromium. It will auto-detect your browser, but you can specify the path:

```json
{
  "mcpServers": {
    "scaha": {
      "command": "npx",
      "args": ["-y", "@joerawr/scaha-mcp"],
      "env": {
        "CHROME_EXECUTABLE_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      }
    }
  }
}
```

## Available Tools

### `get_schedule`
Get game schedules with optional date filtering.

**Parameters**:
- `season` (string, required): Season name (e.g., "2025/26" or "SCAHA 2025/26 Season")
- `schedule` (string, required): Schedule name (e.g., "14U B" or "14U B Regular Season")
- `team` (string, required): Team name (e.g., "Jr. Kings (1)")
- `date` (string, optional): Filter to specific date (YYYY-MM-DD format)

**Example**:
```
"Who do the 14U B Jr Kings (1) play on 10/12/2025?"
```

**Returns**: Array of game objects with home/away teams, scores, venue, rink, time.

### `get_team_stats`
Get team standings and statistics.

**Parameters**:
- `season` (string, required): Season identifier (e.g., "2024-25")
- `division` (string, required): Division name
- `team_slug` (string, required): Team identifier

### `get_player_stats`
Get individual player statistics.

**Parameters**:
- `season` (string, required): Season identifier
- `division` (string, required): Division name
- `team_slug` (string, required): Team identifier
- `player` (object, required): Object with `name` or `number`

### `get_schedule_csv`
Download raw CSV schedule data (base64 encoded).

**Parameters**:
- `season` (string, required): Season name
- `schedule` (string, required): Schedule name
- `team` (string, required): Team name

**Returns**: JSON with `filename`, `mime`, `data_base64`, `size_bytes`.

### `list_schedule_options`
List available seasons, schedules, and teams from the scoreboard page.

**Parameters**:
- `season` (string, optional): Optional season to filter
- `schedule` (string, optional): Optional schedule to filter
- `team` (string, optional): Optional team to filter

## How It Works

This MCP server uses Puppeteer to scrape data from scaha.net. It handles:
- JavaServer Faces (JSF) session management
- Form submissions and dropdown selections
- CSV export downloads
- Pacific timezone handling

The server communicates via STDIO transport, making it compatible with Claude Desktop and other MCP clients.

## Tech Stack

- **Language**: TypeScript
- **MCP SDK**: @modelcontextprotocol/sdk v1.18.2
- **Scraping**: Puppeteer v24.23.0 + Cheerio v1.1.2
- **Validation**: Zod v3.25.76
- **Timezone**: date-fns + @date-fns/tz

## Development

```bash
npm install       # Install dependencies
npm run build     # Build TypeScript
npm run dev       # Run with tsx (no build needed)
```

## Data Source

**scaha.net** - Southern California Amateur Hockey Association

- Scoreboard/Schedule: https://www.scaha.net/scaha/scoreboard.xhtml
- Stats Central: https://www.scaha.net/scaha/statscentral.xhtml

## Related Projects

- [HockeyGoTime](https://github.com/joerawr/HockeyGoTime) - Conversational AI for SCAHA schedules (uses this MCP server)

## License

MIT

## Contributing

Issues and pull requests welcome! Please report bugs at https://github.com/joerawr/scaha.net-mcp/issues

## Version History

### 1.0.0 (2025-10-06)
- Initial release
- 5 MCP tools for SCAHA data
- STDIO transport for Claude Desktop
- Puppeteer-based scraping
- Browser automation for schedule CSV export
