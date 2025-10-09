# @joerawr/scaha-mcp

[![npm version](https://badge.fury.io/js/@joerawr%2Fscaha-mcp.svg)](https://www.npmjs.com/package/@joerawr/scaha-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server for SCAHA (Southern California Amateur Hockey Association) youth hockey data. Provides schedule, standings, and player stats via web scraping.

## Installation

### Claude Desktop

Add to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop after adding.

### Chrome/Chromium Required

This server uses Puppeteer for web scraping. Chrome or Chromium must be installed.

**Custom Chrome path** (optional):
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

### get_schedule
Get game schedules with optional date filtering.

**Parameters:**
- `season` (required): Season name (e.g., "2025/26")
- `schedule` (required): Schedule name (e.g., "14U B")
- `team` (required): Team name (e.g., "Jr. Kings (1)")
- `date` (optional): Filter to specific date (YYYY-MM-DD)

**Example:** "When do the 14U B Jr Kings (1) play on 10/12/2025?"

### get_team_stats
Get team standings and statistics.

**Parameters:**
- `season` (required): Season identifier
- `division` (required): Division/schedule name (e.g., "14U B" selects "14U B Regular Season")
- `team_slug` (required): Team identifier

### get_player_stats
Get individual player statistics.

**Parameters:**
- `season` (required): Season identifier
- `division` (required): Division name
- `team_slug` (required): Team identifier
- `player` (required): Object with `name` or `number`
- `category` (optional): Use `"goalies"` to fetch goalie stats (defaults to skaters). Including the word “goalie” in `player.name` also switches to goalie stats automatically.

### get_schedule_csv
Download schedule as CSV (base64 encoded).

**Parameters:**
- `season` (required): Season name
- `schedule` (required): Schedule name
- `team` (required): Team name

### list_schedule_options
List available seasons, schedules, and teams.

**Parameters:**
- `season` (optional): Filter by season
- `schedule` (optional): Filter by schedule
- `team` (optional): Filter by team

## HTTP Deployment (Optional)

For remote deployment, this server also supports HTTP transport via StreamableHTTP.

**Deploy to Vercel/Railway:**
1. Clone repository: `git clone https://github.com/joerawr/scaha.net-mcp.git`
2. Install: `npm install`
3. Build: `npm run build:http`
4. Deploy the `http/` directory
5. Endpoint available at: `https://your-domain.com/api/mcp`

**Note**: HTTP transport is for self-hosted deployments. Claude Desktop uses STDIO (above).

## Development

```bash
git clone https://github.com/joerawr/scaha.net-mcp.git
cd scaha.net-mcp
npm install
npm run build        # Build STDIO server
npm run dev          # Run in dev mode
npm test             # Test STDIO server
```

## Data Source

**scaha.net** - Southern California Amateur Hockey Association
- Scoreboard: https://www.scaha.net/scaha/scoreboard.xhtml
- Stats Central: https://www.scaha.net/scaha/statscentral.xhtml

Data is scraped using Puppeteer due to JavaServer Faces dynamic content.

## License

MIT - See LICENSE file

## Contributing

Issues and PRs welcome: https://github.com/joerawr/scaha.net-mcp/issues
