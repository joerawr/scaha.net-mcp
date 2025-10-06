import * as cheerio from 'cheerio';
import {
  TeamStats,
  PlayerStats,
  Game,
  SelectOption,
  ScoreboardOptionState,
} from './types.js';
import { normalizeTeamName, teamNamesMatch, parseScore } from './utils.js';

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

function escapeId(id: string): string {
  return `#${id.replace(/:/g, '\\:')}`;
}

function parseSelectOptionsFromDoc(
  $: cheerio.CheerioAPI,
  elementId: string
): SelectOption[] {
  const selector = escapeId(elementId);
  const options: SelectOption[] = [];

  $(selector)
    .find('option')
    .each((_, option) => {
      const el = $(option);
      options.push({
        value: el.attr('value') ?? '',
        label: el.text().trim(),
        selected: el.is(':selected') || el.attr('selected') !== undefined,
      });
    });

  return options;
}

function parseScoreboardOptionState(html: string): ScoreboardOptionState {
  const $ = cheerio.load(html);
  return {
    seasons: parseSelectOptionsFromDoc($, 'j_id_4c:j_id_4jInner'),
    schedules: parseSelectOptionsFromDoc($, 'j_id_4c:j_id_4mInner'),
    teams: parseSelectOptionsFromDoc($, 'j_id_4c:j_id_4pInner'),
  };
}

function extractUpdatedFormHtml(partialResponse: string): string | null {
  const targetedMatch = partialResponse.match(
    /<update id="j_id_4c"><!\[CDATA\[(.*?)\]\]><\/update>/s
  );

  if (targetedMatch && targetedMatch[1]) {
    return targetedMatch[1];
  }

  const fragments = [...partialResponse.matchAll(/<!\[CDATA\[(.*?)\]\]>/gs)].map(
    ([, fragment]) => fragment
  );

  return fragments.length ? fragments.join('') : null;
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
  let optionState = parseScoreboardOptionState(html);

  if (seasonQuery) {
    const targetSeason = findOptionByLabel(optionState.seasons, seasonQuery);

    if (!targetSeason) {
      throw new Error(`Season "${seasonQuery}" not found on scoreboard page.`);
    }

    if (!targetSeason.selected) {
      const partial = await submitJSFForm(SCOREBOARD_URL, session, {
        'j_id_4c:j_id_4jInner': targetSeason.value,
        'j_id_4c:j_id_4mInner': '0',
        'j_id_4c:j_id_4pInner': '0',
        'j_id_4c_SUBMIT': '1',
      });

      const updatedHtml = extractUpdatedFormHtml(partial);
      if (updatedHtml) {
        optionState = parseScoreboardOptionState(updatedHtml);
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
        'j_id_4c:j_id_4jInner': currentSeason?.value || '0',
        'j_id_4c:j_id_4mInner': targetSchedule.value,
        'j_id_4c:j_id_4pInner': '0',
        'j_id_4c_SUBMIT': '1',
      });

      const updatedHtml = extractUpdatedFormHtml(partial);
      if (updatedHtml) {
        optionState = parseScoreboardOptionState(updatedHtml);
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
        'j_id_4c:j_id_4jInner': currentSeason?.value || '0',
        'j_id_4c:j_id_4mInner': currentSchedule?.value || '0',
        'j_id_4c:j_id_4pInner': targetTeam.value,
        'j_id_4c_SUBMIT': '1',
      });

      const updatedHtml = extractUpdatedFormHtml(partial);
      if (updatedHtml) {
        optionState = parseScoreboardOptionState(updatedHtml);
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
  const { html } = await initJSFSession(STATS_CENTRAL_URL);
  const $ = cheerio.load(html);

  const players: PlayerStats[] = [];

  // Parse player stats table
  // Columns: #, Name, Team, GP, G, A, Pts, PIMS
  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 8) {
      const number = $(cells[0]).text().trim();
      const name = $(cells[1]).text().trim();
      const team = $(cells[2]).text().trim();

      // Skip header rows
      if (number && name && name !== 'Name') {
        // Filter by team if specified
        if (!teamSlug || teamNamesMatch(team, teamSlug)) {
          players.push({
            number,
            name,
            team,
            gp: parseInt($(cells[3]).text().trim(), 10) || 0,
            g: parseInt($(cells[4]).text().trim(), 10) || 0,
            a: parseInt($(cells[5]).text().trim(), 10) || 0,
            pts: parseInt($(cells[6]).text().trim(), 10) || 0,
            pims: parseInt($(cells[7]).text().trim(), 10) || 0,
          });
        }
      }
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
      players.find((p) => normalizeTeamName(p.name) === normalizedSearch) || null
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
