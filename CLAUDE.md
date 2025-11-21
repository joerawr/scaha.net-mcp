# CLAUDE.md - SCAHA MCP Server

This file provides guidance when working with code in this repository.

## Project Overview

**SCAHA MCP Server** is a Model Context Protocol (MCP) server that provides access to youth hockey data from scaha.net (Southern California Amateur Hockey Association). It's designed to be used as both a local tool (via STDIO) and a remotely deployed service (via HTTP).

## Package Information

- **npm package**: `@joerawr/scaha-mcp`
- **Type**: Dual-transport MCP server
- **Package manager**: npm (not pnpm or yarn)
- **Entry points**:
  - STDIO: `dist/index.js` (CLI executable)
  - HTTP: `app/api/mcp/route.ts` (Next.js API route)

## Development Commands

```bash
npm install              # Install dependencies
npm run build            # Build STDIO transport (default)
npm run build:stdio      # Build STDIO transport (TypeScript → dist/)
npm run build:http       # Build HTTP transport (Next.js → .next/)
npm run build:all        # Build both transports
npm run dev              # Run STDIO server in dev mode (tsx)
npm run dev:http         # Run HTTP server in dev mode (Next.js)
npm run typecheck        # Type-check without emitting files
npm test                 # Test STDIO server
```

## Architecture

### Dual-Transport Design

This MCP server supports two transport modes:

**1. STDIO Transport** (Primary)
- Entry: `src/index.ts`
- Transport: `StdioServerTransport`
- Build: `tsc -p tsconfig.build.json`
- Output: `dist/` directory
- Use case: Local MCP clients (Claude Desktop, Cursor, Cline)
- Invocation: `npx @joerawr/scaha-mcp`

**2. HTTP Transport** (Secondary)
- Entry: `http/app/api/mcp/route.ts`
- Transport: `mcp-handler` (StreamableHTTP)
- Build: `cd http && next build`
- Output: `http/.next/` directory
- Use case: Remote deployment (Vercel, web apps)
- URL: `https://scaha-mcp.vercel.app/api/mcp`

### Shared Tool Implementations

Both transports use the same tool implementations from `src/tools/`:
- `get_schedule.ts` - Game schedules with date filtering
- `get_team_stats.ts` - Team standings and statistics
- `get_player_stats.ts` - Individual player statistics
- `get_schedule_csv.ts` - CSV schedule exports (base64 encoded)
- `list_schedule_options.ts` - Available seasons/schedules/teams

### Data Flow

```
MCP Client (Claude Desktop or HockeyGoTime)
  ↓ (STDIO or HTTP)
MCP Server (src/index.ts or http/app/api/mcp/route.ts)
  ↓
Tool Handler (src/tools/*)
  ↓
Browser Scraper (src/lib/browser-scrapers.ts)
  ↓
Puppeteer → scaha.net (JavaServer Faces website)
  ↓
Data returned as JSON
```

## Important Implementation Details

### TypeScript Configuration

We use **two separate TypeScript configs** to handle the dual-transport architecture:

**`tsconfig.json`** - For Next.js and IDE
- `noEmit: true` (Next.js handles its own compilation)
- `moduleResolution: bundler`
- Includes: `src/**/*`, `http/app/**/*`

**`tsconfig.build.json`** - For STDIO builds
- Extends `tsconfig.json`
- `noEmit: false` (generates files in `dist/`)
- `outDir: ./dist`
- Includes: `src/**/*` only (excludes `app/`)

**Why two configs?**
- Next.js and `tsc` have conflicting compilation requirements
- Prevents the stale code issue (Issue #3)
- See: https://github.com/joerawr/scaha.net-mcp/issues/3

### Scraping Strategy

**Why Puppeteer instead of fetch?**
- scaha.net uses JavaServer Faces (JSF) with heavy client-side JavaScript
- Dropdowns are populated dynamically via AJAX
- Standard HTTP requests don't execute JavaScript
- Puppeteer provides full browser automation

**Browser Configuration:**
- Development: Uses local Chrome/Chromium
- Production (Vercel): Uses `@sparticuz/chromium`
- Configurable via `CHROME_EXECUTABLE_PATH` env var

**Scraping modules:**
- `src/lib/browser-scrapers.ts` - Puppeteer-based (currently used)
- `src/lib/scrapers.ts` - Fetch-based (legacy, doesn't work reliably)
- `src/lib/scaha-dom.ts` - Detects live JSF form/select/button/table IDs so scrapers survive SCAHA ID renames

**JSF ID churn + resilience**
- SCAHA periodically renames JSF component IDs (e.g., scoreboard/stats central moved from `j_id_4c` → `j_id_4d` → `j_id_4e` during the 2024/25–2025/26 turnover).
- `scaha-dom.ts` parses the page to locate season/schedule/team selects, Players/Goalies buttons, and stats tables by content instead of hard-coding IDs.
- If selectors break again, first verify whether the form IDs shifted; if the markup shape changed (different selects/buttons/tables), adjust the heuristics in `scaha-dom.ts` rather than hard-coding new IDs.

### Build System

The build system handles both STDIO and HTTP builds:

**STDIO Build Process:**
```bash
npm run build:stdio
  ↓
tsc -p tsconfig.build.json  # Compiles src/ → dist/
  ↓
chmod +x dist/index.js      # Makes CLI executable
  ↓
dist/ contains:
  - index.js (with shebang)
  - server.js
  - lib/ (scrapers, types, utils)
  - tools/ (all 5 MCP tools)
```

**HTTP Build Process:**
```bash
npm run build:http
  ↓
cd http && next build  # Compiles http/app/ → http/.next/
  ↓
http/.next/ contains:
  - API route at /api/mcp
  - Server components
  - Optimized bundles
```

### Publishing to npm

When `npm publish` runs:
1. `prepublishOnly` script runs → `npm run build:stdio`
2. Only files in `"files": ["dist", "README.md", "LICENSE"]` are published
3. `http/` and `docs/` directories are NOT published (HTTP code stays in repo only)
4. npm users get a clean STDIO-only package (~2MB vs 60MB with Next.js)

**Testing before publish:**
```bash
npm run build:stdio
npm pack  # Creates tarball
tar -tzf joerawr-scaha-mcp-*.tgz  # Verify contents
```

## Deployment

### Local (STDIO)

Users install via npm:
```bash
npx @joerawr/scaha-mcp
```

Or add to Claude Desktop config:
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

### Remote (HTTP - Vercel)

**Automatic deployment:**
- Push to `main` → Vercel auto-deploys
- Build command: `npm run build:http` (configured in `vercel.json`)
- Endpoint: `https://scaha-mcp.vercel.app/api/mcp`

**vercel.json configuration:**
```json
{
  "buildCommand": "npm run build:http",
  "framework": "nextjs"
}
```

## Template for Other Leagues

This repo is designed to be **cloned and customized** for other hockey leagues:

```bash
# Clone for a new league
git clone https://github.com/joerawr/scaha.net-mcp.git pghl-mcp
cd pghl-mcp

# Update package name
# Edit package.json: "name": "@joerawr/pghl-mcp"

# Update scraping logic for new league's website
# Edit src/lib/browser-scrapers.ts

# Deploy to Vercel (new project)
vercel --project-name pghl-mcp

# Publish to npm
npm publish
```

**Key customization points:**
- `src/lib/browser-scrapers.ts` - Website-specific scraping logic
- `src/tools/*.ts` - Tool parameter schemas (season format, etc.)
- `package.json` - Package name, description, keywords
- `README.md` - League-specific documentation

## Related Projects

- **HockeyGoTime** - Next.js web app that consumes this MCP server via HTTP
  - Repository: `../HockeyGoTime/`
  - Connects via StreamableHTTP to deployed Vercel endpoint
  - Uses AI SDK to integrate MCP tools with OpenAI models

## Code Quality

**Always run type checking before committing:**
```bash
npm run typecheck
```

**No type errors should exist in:**
- `src/` (STDIO server code)
- `app/` (HTTP endpoint code)

## Reference MCP Servers

Good examples of dual-transport MCP servers:
- [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)
- [@modelcontextprotocol/server-memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [puppeteer-mcp-server](https://github.com/merajmehrabi/puppeteer-mcp-server)

## MCP Resources

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [AI SDK MCP Integration](https://ai-sdk.dev/cookbook/node/mcp-tools)

## GitHub Issue Pattern

When creating GitHub issues for this repository, use this format:

```markdown
## Problem
[Clear problem statement with context]

## Solution
[Proposed fix or approach]

## Rabbit holes
[Topics or approaches to avoid]

## No gos
[Things that should not be done, e.g., breaking changes, architecture shifts]
```

## Common Tasks

### Adding a New Tool

1. Create tool file: `src/tools/my_new_tool.ts`
2. Define schema and handler using existing tools as template
3. Register in `src/server.ts` (STDIO)
4. Register in `http/app/api/mcp/route.ts` (HTTP)
5. Update `README.md` with tool documentation
6. Run `npm run typecheck` to verify
7. Test both transports

### Debugging STDIO Server

```bash
# Test manually via stdin/stdout
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm run dev

# Run with tsx for live reloading
npm run dev
```

### Debugging HTTP Server

```bash
# Start Next.js dev server
npm run dev:http

# Test endpoint
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Updating Scraping Logic

1. Test changes locally against scaha.net
2. Be aware of rate limiting (add delays if needed)
3. Handle errors gracefully (website can be slow)
4. Update both `browser-scrapers.ts` if changing selectors
5. Consider adding error-specific messages for better UX

## Repository Structure

Clean separation of STDIO (npm) and HTTP (Vercel) code:

```
scaha-mcp/
├── src/              # STDIO server (npm package)
├── http/             # HTTP server (Vercel deployment)
│   ├── app/          # Next.js app
│   ├── next.config.js
│   └── *.config.*    # Next.js configs
├── docs/             # Development documentation
├── tests/            # Test suites
├── dist/             # Build output (gitignored)
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── README.md
├── CLAUDE.md
├── LICENSE
└── vercel.json
```

**Benefits of this structure:**
- Clear separation: STDIO vs HTTP code
- Easy to clone as template (delete `http/` if not needed)
- npm package only includes `dist/` (no Next.js bloat)
- Matches standard MCP server layout

## Important Notes

- **Don't move files out of `/http`** - Next.js configs belong there
- **Don't consolidate tsconfig files** - Two configs prevent build conflicts
- **Don't change MCP SDK version** without testing both transports
- **Do keep tool implementations DRY** - Same code serves both STDIO and HTTP
- **Do test both transports** before publishing or deploying
- **Do clean tsbuildinfo** if builds fail (`rm *.tsbuildinfo`)
