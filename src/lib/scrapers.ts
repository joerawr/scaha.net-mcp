import * as cheerio from 'cheerio';
import {
  TeamStats,
  PlayerStats,
  GoalieStats,
  Game,
  SelectOption,
  ScoreboardOptionState,
} from './types.js';
import { normalizeTeamName, teamNamesMatch, parseScore } from './utils.js';
import { getStandingsWithBrowser } from './browser-scrapers.js';
import {
  escapeIdForSelector,
  extractFormUpdate,
  parseScoreboardPage,
  parseStatsCentralPage,
} from './scaha-dom.js';

const BASE_URL = 'https://www.scaha.net';
const SCOREBOARD_URL = `${BASE_URL}/scaha/scoreboard.xhtml`;
const STATS_CENTRAL_URL = `${BASE_URL}/scaha/statscentral.xhtml`;

/**
 * JSF Session state manager
 */
interface JSFSession {
  jsessionid: string;
  viewState: string;
}

/**
 * Extract JSESSIONID and ViewState from initial page load
 */
async function initJSFSession(url: string): Promise<{ session: JSFSession; html: string }>{
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SCAHA-MCP/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Extract JSESSIONID from Set-Cookie header
  const setCookie = response.headers.get('set-cookie') || '';
  const jsessionMatch = setCookie.match(/JSESSIONID=([^;]+)/);
  const jsessionid = jsessionMatch ? jsessionMatch[1] : '';

  // Extract ViewState from HTML
  const html = await response.text();
  const $ = cheerio.load(html);
  const viewState = ($('input[name="javax.faces.ViewState"]').val() as string) || '';

  return { session: { jsessionid, viewState }, html };
}

/**
 * Submit JSF form with AJAX postback
 */
async function submitJSFForm(
  url: string,
  session: JSFSession,
  formData: Record<string, string>
): Promise<string> {
  const body = new URLSearchParams({
    ...formData,
    'javax.faces.ViewState': session.viewState,
  });

  const response = await fetch(`${url};jsessionid=${session.jsessionid}`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SCAHA-MCP/1.0)',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `JSESSIONID=${session.jsessionid}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();

  const viewStateMatch = text.match(
    /<update id="javax\.faces\.ViewState"><!\[CDATA\[(.*?)\]\]><\/update>/s
  );

  if (viewStateMatch && viewStateMatch[1]) {
    session.viewState = viewStateMatch[1];
  } else {
    const fullPageViewStateMatch = text.match(
      /name="javax\.faces\.ViewState".*?value="([^"]+)"/s
    );
    if (fullPageViewStateMatch && fullPageViewStateMatch[1]) {
      session.viewState = fullPageViewStateMatch[1];
    }
  }

  return text;
}

function findOptionByLabel(options: SelectOption[], query: string): SelectOption | undefined {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    options.find((opt) => opt.label.toLowerCase() === normalizedQuery) ||
    options.find((opt) => opt.label.toLowerCase().includes(normalizedQuery))
  );
}

export async function getScoreboardOptionsState(
  seasonQuery?: string,
  scheduleQuery?: string,
  teamQuery?: string
): Promise<ScoreboardOptionState> {
  const { session, html } = await initJSFSession(SCOREBOARD_URL);
  let parsed = parseScoreboardPage(html);
  let { dom } = parsed;
  let optionState = parsed.options;

  if (seasonQuery) {
    const targetSeason = findOptionByLabel(optionState.seasons, seasonQuery);

    if (!targetSeason) {
      throw new Error(`Season "${seasonQuery}" not found on scoreboard page.`);
    }

    if (!targetSeason.selected) {
      const partial = await submitJSFForm(SCOREBOARD_URL, session, {
        [dom.seasonField]: targetSeason.value,
        [dom.scheduleField]: '0',
        [dom.teamField]: '0',
        [dom.submitField]: '1',
      });

      const updatedHtml = extractFormUpdate(partial, dom.formId);
      if (updatedHtml) {
        parsed = parseScoreboardPage(updatedHtml);
        dom = parsed.dom;
        optionState = parsed.options;
      }
    }
  }

  if (scheduleQuery) {
    const targetSchedule = findOptionByLabel(optionState.schedules, scheduleQuery);

    if (!targetSchedule) {
      throw new Error(`Schedule "${scheduleQuery}" not found on scoreboard page.`);
    }

    if (!targetSchedule.selected) {
      const currentSeason = optionState.seasons.find(s => s.selected);
      const partial = await submitJSFForm(SCOREBOARD_URL, session, {
        [dom.seasonField]: currentSeason?.value || '0',
        [dom.scheduleField]: targetSchedule.value,
        [dom.teamField]: '0',
        [dom.submitField]: '1',
      });

      const updatedHtml = extractFormUpdate(partial, dom.formId);
      if (updatedHtml) {
        parsed = parseScoreboardPage(updatedHtml);
        dom = parsed.dom;
        optionState = parsed.options;
      }
    }
  }

  if (teamQuery) {
    const targetTeam = findOptionByLabel(optionState.teams, teamQuery);

    if (!targetTeam) {
      throw new Error(`Team "${teamQuery}" not found on scoreboard page.`);
    }

    if (!targetTeam.selected) {
      const currentSeason = optionState.seasons.find(s => s.selected);
      const currentSchedule = optionState.schedules.find(s => s.selected);
      const partial = await submitJSFForm(SCOREBOARD_URL, session, {
        [dom.seasonField]: currentSeason?.value || '0',
        [dom.scheduleField]: currentSchedule?.value || '0',
        [dom.teamField]: targetTeam.value,
        [dom.submitField]: '1',
      });

      const updatedHtml = extractFormUpdate(partial, dom.formId);
      if (updatedHtml) {
        parsed = parseScoreboardPage(updatedHtml);
        dom = parsed.dom;
        optionState = parsed.options;
      }
    }
  }

  return optionState;
}

/**
 * Scrape standings from scoreboard page
 * Note: This scrapes the HTML table directly since there's no standings-only page
 */
export async function scrapeStandings(
  season: string,
  division: string
): Promise<TeamStats[]> {
  return getStandingsWithBrowser(season, division);
}

/**
 * Get team stats by finding team in standings
 */
export async function getTeamStats(
  season: string,
  division: string,
  teamSlug: string
): Promise<TeamStats | null> {
  const standings = await scrapeStandings(season, division);
  const team = standings.find((t) => teamNamesMatch(t.team, teamSlug));
  return team || null;
}

/**
 * Scrape player stats from stats central page
 */
export async function scrapePlayerStats(
  season: string,
  division: string,
  teamSlug?: string,
  category: 'players' | 'goalies' = 'players'
): Promise<(PlayerStats | GoalieStats)[]> {
  const { session, html } = await initJSFSession(STATS_CENTRAL_URL);

  const resolveOption = (options: SelectOption[], queries: string[]): SelectOption | undefined => {
    for (const query of queries) {
      if (!query) continue;
      const match = findOptionByLabel(options, query);
      if (match) return match;
    }
    return undefined;
  };

  const normalizeSeasonQuery = (value: string) =>
    value.replace(/-/g, '/').replace(/\s+/g, ' ').trim();

  let { dom, seasons, schedules } = parseStatsCentralPage(html);

  // Ensure the desired season is selected
  const seasonQueries = [
    normalizeSeasonQuery(season),
    `SCAHA ${normalizeSeasonQuery(season)}`,
    `SCAHA ${normalizeSeasonQuery(season)} Season`,
  ];
  const seasonOption = resolveOption(seasons, seasonQueries);
  if (!seasonOption) {
    throw new Error(`Season "${season}" not found on stats page.`);
  }

  if (!seasonOption.selected) {
    // WORKAROUND: SCAHA website has a caching bug when changing seasons via AJAX.
    // Historical season data gets cached from the default season, returning incorrect results.
    // This was verified by testing: changing to 2024/25 via AJAX still returns 2025/26 data.
    // A full page refresh (Puppeteer) is required for historical seasons.
    // See: https://github.com/joerawr/scaha.net-mcp/issues/9
    throw new Error(
      `Historical season data retrieval is currently unavailable due to a SCAHA website limitation. ` +
      `Only the current season (${seasons.find(s => s.selected)?.label || 'default'}) is supported. ` +
      `For historical data, please visit https://www.scaha.net/scaha/statscentral.xhtml directly. ` +
      `Issue: https://github.com/joerawr/scaha.net-mcp/issues/9`
    );
  }

  // Ensure the correct schedule/division is loaded
  const scheduleQueries = [
    division,
    `${division} Regular Season`,
    `${division} Season`,
  ];
  const scheduleOption = resolveOption(schedules, scheduleQueries);
  if (!scheduleOption) {
    throw new Error(`Division "${division}" not found for season "${season}".`);
  }

  if (!scheduleOption.selected) {
    const selectedSeasonValue =
      seasons.find((opt) => opt.selected)?.value ?? seasonOption.value;
    const response = await submitJSFForm(STATS_CENTRAL_URL, session, {
      [dom.seasonField]: selectedSeasonValue,
      [dom.scheduleField]: scheduleOption.value,
      [dom.submitField]: '1',
    });
    const updatedHtml = extractFormUpdate(response, dom.formId) ?? response;
    ({ dom, seasons, schedules } = parseStatsCentralPage(updatedHtml));
  }

  // Trigger the Players button to load stats table
  const selectedSeasonValue =
    seasons.find((opt) => opt.selected)?.value ?? seasonOption.value;
  const selectedScheduleValue =
    schedules.find((opt) => opt.selected)?.value ?? scheduleOption.value;

  const buttonParam =
    category === 'goalies' ? dom.goaliesButtonId : dom.playersButtonId;

  const statsResponse = await submitJSFForm(STATS_CENTRAL_URL, session, {
    [dom.seasonField]: selectedSeasonValue,
    [dom.scheduleField]: selectedScheduleValue,
    [buttonParam]: buttonParam,
    [dom.submitField]: '1',
  });

  const statsHtml = extractFormUpdate(statsResponse, dom.formId) ?? statsResponse;
  const statsDoc = cheerio.load(statsHtml);

  if (category === 'goalies') {
    const goalies: GoalieStats[] = [];
    statsDoc(`[id="${dom.goaliesTableId}"] tbody tr`).each((_, row) => {
      const cells = statsDoc(row).find('td');
      if (cells.length < 9) return;

      const number = statsDoc(cells[0]).text().trim();
      const name = statsDoc(cells[1]).text().trim();
      const team = statsDoc(cells[2]).text().trim();
      if (!number || !name || name === 'Name') return;

      if (!teamSlug || teamNamesMatch(team, teamSlug)) {
        const parseFloatOrNull = (value: string) => {
          const parsed = parseFloat(value);
          return Number.isFinite(parsed) ? parsed : null;
        };
        goalies.push({
          number,
          name,
          team,
          gp: parseInt(statsDoc(cells[3]).text().trim(), 10) || 0,
          mins: parseInt(statsDoc(cells[4]).text().trim(), 10) || 0,
          shots: parseInt(statsDoc(cells[5]).text().trim(), 10) || 0,
          saves: parseInt(statsDoc(cells[6]).text().trim(), 10) || 0,
          sv_pct: parseFloatOrNull(statsDoc(cells[7]).text().trim()),
          gaa: parseFloatOrNull(statsDoc(cells[8]).text().trim()),
        });
      }
    });
    return goalies;
  }

  const players: PlayerStats[] = [];

  statsDoc(`[id="${dom.playersTableId}"] tbody tr`).each((_, row) => {
    const cells = statsDoc(row).find('td');
    if (cells.length < 8) return;

    const number = statsDoc(cells[0]).text().trim();
    const name = statsDoc(cells[1]).text().trim();
    const team = statsDoc(cells[2]).text().trim();

    if (!number || !name || name === 'Name') return;

    if (!teamSlug || teamNamesMatch(team, teamSlug)) {
      players.push({
        number,
        name,
        team,
        gp: parseInt(statsDoc(cells[3]).text().trim(), 10) || 0,
        g: parseInt(statsDoc(cells[4]).text().trim(), 10) || 0,
        a: parseInt(statsDoc(cells[5]).text().trim(), 10) || 0,
        pts: parseInt(statsDoc(cells[6]).text().trim(), 10) || 0,
        pims: parseInt(statsDoc(cells[7]).text().trim(), 10) || 0,
      });
    }
  });

  return players;
}

/**
 * Get complete team roster (all players and goalies) using AJAX approach.
 * This avoids DataTables pagination issues by getting all data in one response.
 */
export async function scrapeTeamRoster(
  season: string,
  division: string,
  teamSlug: string
): Promise<{
  team: string;
  division: string;
  season: string;
  players: PlayerStats[];
  goalies: GoalieStats[];
}> {
  const { session, html } = await initJSFSession(STATS_CENTRAL_URL);

  const resolveOption = (options: SelectOption[], queries: string[]): SelectOption | undefined => {
    for (const query of queries) {
      if (!query) continue;
      const match = findOptionByLabel(options, query);
      if (match) return match;
    }
    return undefined;
  };

  const normalizeSeasonQuery = (value: string) =>
    value.replace(/-/g, '/').replace(/\s+/g, ' ').trim();

  let { dom, seasons, schedules } = parseStatsCentralPage(html);

  // Ensure the desired season is selected
  const seasonQueries = [
    normalizeSeasonQuery(season),
    `SCAHA ${normalizeSeasonQuery(season)}`,
    `SCAHA ${normalizeSeasonQuery(season)} Season`,
  ];
  const seasonOption = resolveOption(seasons, seasonQueries);
  if (!seasonOption) {
    throw new Error(`Season "${season}" not found on stats page.`);
  }

  if (!seasonOption.selected) {
    throw new Error(
      `Historical season data retrieval is currently unavailable due to a SCAHA website limitation. ` +
      `Only the current season (${seasons.find(s => s.selected)?.label || 'default'}) is supported. ` +
      `For historical data, please visit https://www.scaha.net/scaha/statscentral.xhtml directly. ` +
      `Issue: https://github.com/joerawr/scaha.net-mcp/issues/9`
    );
  }

  // Ensure the correct schedule/division is loaded
  const scheduleQueries = [
    division,
    `${division} Regular Season`,
    `${division} Season`,
  ];
  const scheduleOption = resolveOption(schedules, scheduleQueries);
  if (!scheduleOption) {
    throw new Error(`Division "${division}" not found for season "${season}".`);
  }

  if (!scheduleOption.selected) {
    const selectedSeasonValue =
      seasons.find((opt) => opt.selected)?.value ?? seasonOption.value;
    const response = await submitJSFForm(STATS_CENTRAL_URL, session, {
      [dom.seasonField]: selectedSeasonValue,
      [dom.scheduleField]: scheduleOption.value,
      [dom.submitField]: '1',
    });
    const updatedHtml = extractFormUpdate(response, dom.formId) ?? response;
    ({ dom, seasons, schedules } = parseStatsCentralPage(updatedHtml));
  }

  const selectedSeasonValue =
    seasons.find((opt) => opt.selected)?.value ?? seasonOption.value;
  const selectedScheduleValue =
    schedules.find((opt) => opt.selected)?.value ?? scheduleOption.value;

  // Fetch players by clicking Players button
  const playersResponse = await submitJSFForm(STATS_CENTRAL_URL, session, {
    [dom.seasonField]: selectedSeasonValue,
    [dom.scheduleField]: selectedScheduleValue,
    [dom.playersButtonId]: dom.playersButtonId,
    [dom.submitField]: '1',
  });

  const playersHtml = extractFormUpdate(playersResponse, dom.formId) ?? playersResponse;
  const playersDoc = cheerio.load(playersHtml);
  const players: PlayerStats[] = [];

  playersDoc(`[id="${dom.playersTableId}"] tbody tr`).each((_, row) => {
    const cells = playersDoc(row).find('td');
    if (cells.length < 8) return;

    const number = playersDoc(cells[0]).text().trim();
    const name = playersDoc(cells[1]).text().trim();
    const team = playersDoc(cells[2]).text().trim();

    if (!number || !name || name === 'Name') return;

    if (teamNamesMatch(team, teamSlug)) {
      players.push({
        number,
        name,
        team,
        gp: parseInt(playersDoc(cells[3]).text().trim(), 10) || 0,
        g: parseInt(playersDoc(cells[4]).text().trim(), 10) || 0,
        a: parseInt(playersDoc(cells[5]).text().trim(), 10) || 0,
        pts: parseInt(playersDoc(cells[6]).text().trim(), 10) || 0,
        pims: parseInt(playersDoc(cells[7]).text().trim(), 10) || 0,
      });
    }
  });

  // Fetch goalies by clicking Goalies button
  const goaliesResponse = await submitJSFForm(STATS_CENTRAL_URL, session, {
    [dom.seasonField]: selectedSeasonValue,
    [dom.scheduleField]: selectedScheduleValue,
    [dom.goaliesButtonId]: dom.goaliesButtonId,
    [dom.submitField]: '1',
  });

  const goaliesHtml = extractFormUpdate(goaliesResponse, dom.formId) ?? goaliesResponse;
  const goaliesDoc = cheerio.load(goaliesHtml);
  const goalies: GoalieStats[] = [];

  goaliesDoc(`[id="${dom.goaliesTableId}"] tbody tr`).each((_, row) => {
    const cells = goaliesDoc(row).find('td');
    if (cells.length < 9) return;

    const number = goaliesDoc(cells[0]).text().trim();
    const name = goaliesDoc(cells[1]).text().trim();
    const team = goaliesDoc(cells[2]).text().trim();
    if (!number || !name || name === 'Name') return;

    if (teamNamesMatch(team, teamSlug)) {
      const parseFloatOrNull = (value: string) => {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      goalies.push({
        number,
        name,
        team,
        gp: parseInt(goaliesDoc(cells[3]).text().trim(), 10) || 0,
        mins: parseInt(goaliesDoc(cells[4]).text().trim(), 10) || 0,
        shots: parseInt(goaliesDoc(cells[5]).text().trim(), 10) || 0,
        saves: parseInt(goaliesDoc(cells[6]).text().trim(), 10) || 0,
        sv_pct: parseFloatOrNull(goaliesDoc(cells[7]).text().trim()),
        gaa: parseFloatOrNull(goaliesDoc(cells[8]).text().trim()),
      });
    }
  });

  if (players.length === 0 && goalies.length === 0) {
    throw new Error(`No roster data found for team "${teamSlug}" in division "${division}"`);
  }

  // Determine the actual team name from the first player/goalie found
  const actualTeamName = players[0]?.team || goalies[0]?.team || teamSlug;

  return {
    team: actualTeamName,
    division,
    season,
    players,
    goalies,
  };
}

/**
 * Get player stats by name or number
 */
export async function getPlayerStats(
  season: string,
  division: string,
  teamSlug: string | undefined,
  playerFilter: { name?: string; number?: string },
  category: 'players' | 'goalies' = 'players'
): Promise<PlayerStats | GoalieStats | null> {
  const stats = await scrapePlayerStats(season, division, teamSlug, category);

  if (playerFilter.number) {
    return stats.find((p) => p.number === playerFilter.number) || null;
  }

  if (playerFilter.name) {
    const normalizedSearch = normalizeTeamName(playerFilter.name);
    if (!normalizedSearch) {
      return null;
    }
    return (
      stats.find((p) => normalizeTeamName(p.name) === normalizedSearch) ||
      stats.find((p) =>
        normalizeTeamName(p.name).includes(normalizedSearch)
      ) ||
      null
    );
  }

  return null;
}

/**
 * Scrape schedule table from scoreboard page and convert to CSV format
 * Since scaha.net uses client-side DataTables CSV export, we scrape the HTML table
 */
export async function downloadScheduleCSV(
  season: string,
  division?: string,
  teamSlug?: string
): Promise<string> {
  const { html } = await initJSFSession(SCOREBOARD_URL);
  const $ = cheerio.load(html);

  // Parse schedule/games table and convert to CSV
  // Columns: Game #, Date, Time, Type, Status, Home, Score, Away, Score, Venue, Rink
  const rows: string[] = [];

  // Add header
  rows.push('"Game #","Date","Time","Type","Status","Home","Score","Away","Score","Venue","Rink"');

  // Parse table rows
  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 11) {
      const gameNum = $(cells[0]).text().trim();
      // Skip if not a valid game number
      if (gameNum && /^\d+$/.test(gameNum)) {
        const csvRow = [
          gameNum,
          $(cells[1]).text().trim(), // Date
          $(cells[2]).text().trim(), // Time
          $(cells[3]).text().trim(), // Type
          $(cells[4]).text().trim(), // Status
          $(cells[5]).text().trim(), // Home
          $(cells[6]).text().trim(), // Home Score
          $(cells[7]).text().trim(), // Away
          $(cells[8]).text().trim(), // Away Score
          $(cells[9]).text().trim(), // Venue
          $(cells[10]).text().trim(), // Rink
        ].map(val => `"${val}"`).join(',');

        rows.push(csvRow);
      }
    }
  });

  return rows.join('\n');
}

/**
 * Parse CSV schedule data into Game objects
 */
export function parseScheduleCSV(csvData: string): Game[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header row
  const dataLines = lines.slice(1);
  const games: Game[] = [];

  for (const line of dataLines) {
    // Parse CSV with quoted fields
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 11) continue;

    const cleanValue = (val: string) => val.replace(/^"|"$/g, '').trim();

    games.push({
      game_id: cleanValue(matches[0]),
      date: cleanValue(matches[1]),
      time: cleanValue(matches[2]),
      type: cleanValue(matches[3]),
      status: cleanValue(matches[4]),
      home: cleanValue(matches[5]),
      home_score: parseScore(cleanValue(matches[6])),
      away: cleanValue(matches[7]),
      away_score: parseScore(cleanValue(matches[8])),
      venue: cleanValue(matches[9]),
      rink: cleanValue(matches[10]),
    });
  }

  return games;
}

/**
 * Get schedule with optional filtering
 */
export async function getSchedule(
  season: string,
  division?: string,
  teamSlug?: string,
  dateRange?: { start: string; end: string }
): Promise<Game[]> {
  const csvData = await downloadScheduleCSV(season, division, teamSlug);
  let games = parseScheduleCSV(csvData);

  // Apply date range filter if provided
  if (dateRange) {
    games = games.filter((game) => {
      return game.date >= dateRange.start && game.date <= dateRange.end;
    });
  }

  return games;
}
