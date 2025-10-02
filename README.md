# SCAHA MCP Server

A Model Context Protocol (MCP) server that provides access to youth hockey data from scaha.net (Southern California Amateur Hockey Association).

## Features

Exposes scaha.net data through MCP tool calls:
- **`get_team_stats`** - Team standings and statistics
- **`get_player_stats`** - Individual player statistics
- **`get_schedule`** - Game schedules with filtering
- **`get_schedule_csv`** - Schedule exports (CSV format, base64 encoded)

## Status

✅ **MCP Server Working** - Infrastructure complete, JSF scraping implemented
⚠️ **In Progress** - Form submission logic needs refinement to select specific seasons/divisions

### Current Implementation

- ✅ Next.js 15 + TypeScript
- ✅ MCP handler with 4 tools (mcp-handler v1.0.2)
- ✅ JSF session management (JSESSIONID + ViewState)
- ✅ Cheerio HTML parsing
- ✅ Pacific timezone handling (date-fns-tz)
- ✅ Zod schema validation
- ⚠️ JSF form submission (needs dropdown selection logic)

## Tech Stack

- **Runtime**: Next.js 15 (App Router)
- **Language**: TypeScript
- **MCP SDK**: @modelcontextprotocol/sdk v1.18.2
- **Scraping**: Cheerio v1.1.2
- **Validation**: Zod v3.25.76
- **Deployment**: Vercel (with Fluid compute)

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Test MCP tools
npm run test:mcp
```

### Testing

1. Start the dev server: `npm run dev`
2. In a new terminal: `npm run test:mcp`
3. Or manually test the MCP endpoint at `http://localhost:3000/mcp`

## Architecture

```
/app/mcp/route.ts         # MCP handler with 4 tools
/lib/scrapers.ts          # JSF session management + Cheerio scraping
/lib/types.ts             # TypeScript interfaces
/lib/utils.ts             # Team name normalization + timezone utils
/scripts/test-http.mjs    # HTTP test client
```

### Data Source: scaha.net

The site uses **JavaServer Faces (JSF)** with:
- Session management via `JSESSIONID` cookie
- Form state tracking via `javax.faces.ViewState`
- Client-side DataTables for CSV export
- AJAX postbacks for dropdown selections

**Key Pages:**
- Scoreboard/Schedule: https://www.scaha.net/scaha/scoreboard.xhtml
- Stats Central: https://www.scaha.net/scaha/statscentral.xhtml

## Next Steps

- [ ] Implement JSF form submission to select season/division/team
- [ ] Add caching layer (Redis) for Vercel SSE transport
- [ ] Deploy to Vercel with Fluid compute
- [ ] Add error handling and retry logic
- [ ] Document API usage examples

## License

MIT
