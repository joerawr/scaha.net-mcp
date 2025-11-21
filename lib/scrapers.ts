import * as cheerio from 'cheerio';
import {
  TeamStats,
  PlayerStats,
  Game,
  SelectOption,
  ScoreboardOptionState,
} from './types';
import { normalizeTeamName, teamNamesMatch, parseScore } from './utils';
import {
  extractFormUpdate,
  parseScoreboardPage,
  parseStatsCentralPage,
} from './scaha-dom';

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
  const { html } = await initJSFSession(SCOREBOARD_URL);
  const $ = cheerio.load(html);

  const standings: TeamStats[] = [];

  // Parse standings table (need to find actual table class/id from page)
  // Looking for table with columns: Team, GP, W, L, T, Points, GF, GA, GD
  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 9) {
      const teamText = $(cells[0]).text().trim();
      // Skip header rows or empty rows
      if (teamText && teamText !== 'Team' && !teamText.includes('Select')) {
        standings.push({
          team: teamText,
          gp: parseInt($(cells[1]).text().trim(), 10) || 0,
          w: parseInt($(cells[2]).text().trim(), 10) || 0,
          l: parseInt($(cells[3]).text().trim(), 10) || 0,
          t: parseInt($(cells[4]).text().trim(), 10) || 0,
          points: parseInt($(cells[5]).text().trim(), 10) || 0,
          gf: parseInt($(cells[6]).text().trim(), 10) || 0,
          ga: parseInt($(cells[7]).text().trim(), 10) || 0,
          gd: parseInt($(cells[8]).text().trim(), 10) || 0,
        });
      }
    }
  });

  return standings;
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
  teamSlug: string
): Promise<PlayerStats[]> {
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
    const response = await submitJSFForm(STATS_CENTRAL_URL, session, {
      [dom.seasonField]: seasonOption.value,
      [dom.scheduleField]: '0',
      [dom.submitField]: '1',
    });
    const updatedHtml = extractFormUpdate(response, dom.formId) ?? response;
    ({ dom, seasons, schedules } = parseStatsCentralPage(updatedHtml));
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

  const statsResponse = await submitJSFForm(STATS_CENTRAL_URL, session, {
    [dom.seasonField]: selectedSeasonValue,
    [dom.scheduleField]: selectedScheduleValue,
    [dom.playersButtonId]: dom.playersButtonId,
    [dom.submitField]: '1',
  });

  const statsHtml = extractFormUpdate(statsResponse, dom.formId) ?? statsResponse;
  const statsDoc = cheerio.load(statsHtml);

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
 * Get player stats by name or number
 */
export async function getPlayerStats(
  season: string,
  division: string,
  teamSlug: string,
  playerFilter: { name?: string; number?: string }
): Promise<PlayerStats | null> {
  const players = await scrapePlayerStats(season, division, teamSlug);

  if (playerFilter.number) {
    return players.find((p) => p.number === playerFilter.number) || null;
  }

  if (playerFilter.name) {
    const normalizedSearch = normalizeTeamName(playerFilter.name);
    return (
      players.find((p) => normalizeTeamName(p.name) === normalizedSearch) ||
      players.find((p) => normalizeTeamName(p.name).includes(normalizedSearch)) ||
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
