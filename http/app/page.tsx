// Issue #2: Documentation page for HTTP transport deployment
export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>SCAHA MCP Server</h1>
      <p>This is an MCP server for SCAHA hockey schedule data.</p>
      <p><em>Supports dual transports: STDIO (local) and HTTP (remote deployment)</em></p>
      <h2>Usage</h2>
      <ul>
        <li><strong>STDIO</strong>: <code>npx @joerawr/scaha-mcp</code></li>
        <li><strong>HTTP</strong>: <code>{typeof window !== 'undefined' ? window.location.origin : 'https://scaha-mcp.vercel.app'}/api/mcp</code></li>
      </ul>
      <h2>Available Tools</h2>
      <ul>
        <li>get_schedule</li>
        <li>get_team_stats</li>
        <li>get_player_stats</li>
        <li>get_schedule_csv</li>
        <li>list_schedule_options</li>
      </ul>
    </div>
  )
}
