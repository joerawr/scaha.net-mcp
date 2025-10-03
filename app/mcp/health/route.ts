import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'scaha-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    tools: {
      available: [
        'list_schedule_options',
        'get_schedule',
        'get_schedule_csv',
        'get_team_stats',
        'get_player_stats',
      ],
      working: [
        'list_schedule_options',
        'get_schedule',
        'get_schedule_csv',
      ],
      needs_testing: [
        'get_team_stats',
        'get_player_stats',
      ],
    },
  });
}
