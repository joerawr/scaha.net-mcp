export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">SCAHA MCP Server</h1>
        <p className="text-xl text-gray-600 mb-8">
          Southern California Amateur Hockey Association Data via MCP
        </p>
        <div className="bg-gray-100 p-6 rounded-lg max-w-2xl">
          <h2 className="text-2xl font-semibold mb-4">Available Tools</h2>
          <ul className="text-left space-y-2">
            <li><strong>get_team_stats</strong> - Team standings and statistics</li>
            <li><strong>get_player_stats</strong> - Individual player statistics</li>
            <li><strong>get_schedule</strong> - Game schedules with filtering</li>
            <li><strong>get_schedule_csv</strong> - Download CSV schedule data</li>
          </ul>
        </div>
        <p className="mt-8 text-sm text-gray-500">
          MCP endpoint: <code className="bg-gray-200 px-2 py-1 rounded">/mcp</code>
        </p>
      </div>
    </main>
  );
}
