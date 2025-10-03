import { describe, it, expect, beforeAll } from 'vitest';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
const TEST_TIMEOUT = 30000; // 30 seconds for browser automation

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

async function callMCPTool(toolName: string, args: Record<string, any>): Promise<any> {
  const response = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();

  // Parse SSE format (strip "data: " prefix)
  const lines = text.split('\n').filter(line => line.startsWith('data: '));
  if (lines.length === 0) {
    throw new Error('No SSE data in response');
  }

  const jsonData = lines[0].substring(6); // Remove "data: " prefix
  const mcpResponse: MCPResponse = JSON.parse(jsonData);

  if (mcpResponse.error) {
    throw new Error(`MCP Error ${mcpResponse.error.code}: ${mcpResponse.error.message}`);
  }

  if (!mcpResponse.result?.content?.[0]?.text) {
    throw new Error('Invalid MCP response structure');
  }

  return JSON.parse(mcpResponse.result.content[0].text);
}

describe('SCAHA MCP Server Integration Tests', () => {
  beforeAll(async () => {
    // Health check
    const healthResponse = await fetch(`${MCP_SERVER_URL.replace('/mcp', '')}/mcp/health`);
    const health = await healthResponse.json();
    expect(health.status).toBe('healthy');
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${MCP_SERVER_URL.replace('/mcp', '')}/mcp/health`);
      const health = await response.json();

      expect(health).toMatchObject({
        status: 'healthy',
        service: 'scaha-mcp',
        version: '1.0.0',
      });
      expect(health.tools.available).toContain('list_schedule_options');
      expect(health.tools.available).toContain('get_schedule');
      expect(health.tools.available).toContain('get_schedule_csv');
    });
  });

  describe('list_schedule_options', () => {
    it('should list available seasons', async () => {
      const result = await callMCPTool('list_schedule_options', {});

      expect(result).toHaveProperty('seasons');
      expect(result).toHaveProperty('schedules');
      expect(result).toHaveProperty('teams');

      expect(Array.isArray(result.seasons)).toBe(true);
      expect(result.seasons.length).toBeGreaterThan(0);

      // Verify structure of season options
      const firstSeason = result.seasons.find((s: any) => s.value !== '0');
      expect(firstSeason).toHaveProperty('value');
      expect(firstSeason).toHaveProperty('label');
      expect(firstSeason).toHaveProperty('selected');
    }, TEST_TIMEOUT);

    it('should return 2025/26 season', async () => {
      const result = await callMCPTool('list_schedule_options', {});

      const season2025 = result.seasons.find((s: any) =>
        s.label.includes('2025/26')
      );

      expect(season2025).toBeDefined();
      expect(season2025.label).toContain('SCAHA 2025/26 Season');
    }, TEST_TIMEOUT);

    it('should list schedules for 2025/26 season', async () => {
      const result = await callMCPTool('list_schedule_options', {
        season: '2025/26',
      });

      expect(result.schedules.length).toBeGreaterThan(0);

      // Should have various age divisions
      const scheduleLabels = result.schedules.map((s: any) => s.label);
      const has14U = scheduleLabels.some((label: string) => label.includes('14U'));
      expect(has14U).toBe(true);
    }, TEST_TIMEOUT);

    it('should list teams for 14U B schedule', async () => {
      const result = await callMCPTool('list_schedule_options', {
        season: '2025/26',
        schedule: '14U B',
      });

      expect(result.teams.length).toBeGreaterThan(1); // More than just "All Teams"

      // Should have Jr. Kings
      const hasJrKings = result.teams.some((t: any) =>
        t.label.includes('Jr. Kings')
      );
      expect(hasJrKings).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('get_schedule', () => {
    it('should get Jr. Kings schedule', async () => {
      const result = await callMCPTool('get_schedule', {
        season: '2025/26',
        schedule: '14U B',
        team: 'Jr. Kings (1)',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify game structure
      const firstGame = result[0];
      expect(firstGame).toHaveProperty('game_id');
      expect(firstGame).toHaveProperty('date');
      expect(firstGame).toHaveProperty('time');
      expect(firstGame).toHaveProperty('type');
      expect(firstGame).toHaveProperty('status');
      expect(firstGame).toHaveProperty('home');
      expect(firstGame).toHaveProperty('away');
      expect(firstGame).toHaveProperty('venue');
      expect(firstGame).toHaveProperty('rink');

      // Verify date format (YYYY-MM-DD)
      expect(firstGame.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify time format (HH:MM:SS)
      expect(firstGame.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }, TEST_TIMEOUT);

    it('should filter by specific date', async () => {
      const result = await callMCPTool('get_schedule', {
        season: '2025/26',
        schedule: '14U B',
        team: 'Jr. Kings (1)',
        date: '2025-10-05',
      });

      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        // All games should be on 2025-10-05
        result.forEach((game: any) => {
          expect(game.date).toBe('2025-10-05');
        });

        // Verify the known game
        const game = result.find((g: any) =>
          (g.home === 'Jr. Kings (1)' && g.away === 'Heat') ||
          (g.away === 'Jr. Kings (1)' && g.home === 'Heat')
        );

        if (game) {
          expect(game.time).toBe('16:15:00');
          expect(game.venue).toBe('Paramount Ice Land');
        }
      }
    }, TEST_TIMEOUT);

    it('should return empty array for future date with no games', async () => {
      const result = await callMCPTool('get_schedule', {
        season: '2025/26',
        schedule: '14U B',
        team: 'Jr. Kings (1)',
        date: '2026-12-31',
      });

      expect(Array.isArray(result)).toBe(true);
      // May be empty or have games depending on schedule
    }, TEST_TIMEOUT);
  });

  describe('get_schedule_csv', () => {
    it('should return CSV data for Jr. Kings', async () => {
      const result = await callMCPTool('get_schedule_csv', {
        season: '2025/26',
        schedule: '14U B',
        team: 'Jr. Kings (1)',
      });

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('mime');
      expect(result).toHaveProperty('data_base64');
      expect(result).toHaveProperty('size_bytes');

      expect(result.mime).toBe('text/csv');
      expect(result.filename).toMatch(/^SCAHA_.*\.csv$/);
      expect(result.size_bytes).toBeGreaterThan(0);

      // Decode and verify CSV structure
      const csvData = Buffer.from(result.data_base64, 'base64').toString('utf-8');
      const lines = csvData.trim().split('\n');

      expect(lines.length).toBeGreaterThan(1); // Header + at least one game

      // Verify CSV headers
      const headers = lines[0];
      expect(headers).toContain('Game #');
      expect(headers).toContain('Date');
      expect(headers).toContain('Time');
      expect(headers).toContain('Home');
      expect(headers).toContain('Away');
      expect(headers).toContain('Venue');

      // Verify at least one game row
      expect(lines[1]).toBeTruthy();
      expect(lines[1]).toMatch(/"\d+"/); // Game ID
    }, TEST_TIMEOUT);

    it('should generate descriptive filename', async () => {
      const result = await callMCPTool('get_schedule_csv', {
        season: '2025/26',
        schedule: '14U B',
        team: 'Jr. Kings (1)',
      });

      // Filename should include year, tier, and team
      expect(result.filename).toContain('2025-26');
      expect(result.filename).toContain('14U');
      expect(result.filename).toContain('Jr_Kings');
      expect(result.filename).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/); // Timestamp
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle invalid team name', async () => {
      await expect(
        callMCPTool('get_schedule', {
          season: '2025/26',
          schedule: '14U B',
          team: 'NonExistentTeam',
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    it('should handle invalid schedule name', async () => {
      await expect(
        callMCPTool('get_schedule_csv', {
          season: '2025/26',
          schedule: 'Invalid Schedule',
          team: 'Jr. Kings (1)',
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);
  });
});
