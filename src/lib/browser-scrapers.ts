import puppeteer, { type Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { SelectOption, ScoreboardOptionState, TeamStats, TeamRoster, PlayerStats, GoalieStats } from './types.js';
import { teamNamesMatch } from './utils.js';
import { escapeIdForSelector, parseScoreboardPage, parseStatsCentralPage } from './scaha-dom.js';

const BASE_URL = 'https://www.scaha.net';
const SCOREBOARD_URL = `${BASE_URL}/scaha/scoreboard.xhtml`;
const STATS_CENTRAL_URL = `${BASE_URL}/scaha/statscentral.xhtml`;

/**
 * Get browser executable path based on environment
 */
async function getBrowserConfig() {
  // In production (Vercel), use @sparticuz/chromium
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    };
  }

  // In development, use local Chrome/Chromium
  return {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  };
}

/**
 * Extract select options from a dropdown element
 */
async function extractSelectOptions(page: Page, selector: string): Promise<SelectOption[]> {
  return page.$$eval(selector, (options: Element[]) =>
    options.map(opt => {
      const htmlOpt = opt as HTMLOptionElement;
      return {
        value: htmlOpt.value,
        label: htmlOpt.textContent?.trim() || '',
        selected: htmlOpt.selected,
      };
    })
  );
}

function findOption(
  options: SelectOption[],
  query: string
): SelectOption | undefined {
  const normalizedQuery = query.toLowerCase().trim();
  return (
    options.find((opt) => opt.label.toLowerCase().trim() === normalizedQuery) ||
    options.find((opt) => opt.label.toLowerCase().includes(normalizedQuery))
  );
}

/**
 * Browser-based scoreboard navigation that executes JavaScript
 */
export async function getScoreboardOptionsWithBrowser(
  seasonQuery?: string,
  scheduleQuery?: string,
  teamQuery?: string
): Promise<ScoreboardOptionState> {
  const browserConfig = await getBrowserConfig();
  const browser = await puppeteer.launch(browserConfig);

  try {
    const page = await browser.newPage();

    // Set a reasonable viewport and user agent
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // Navigate to scoreboard
    await page.goto(SCOREBOARD_URL, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const initialMarkup = await page.content();
    const parsed = parseScoreboardPage(initialMarkup);
    const { dom } = parsed;
    const seasonSelector = `${escapeIdForSelector(dom.seasonSelectId)} option`;
    const scheduleSelector = `${escapeIdForSelector(dom.scheduleSelectId)} option`;
    const teamSelector = `${escapeIdForSelector(dom.teamSelectId)} option`;

    // Extract initial seasons
    let seasons = parsed.options.seasons.length
      ? parsed.options.seasons
      : await extractSelectOptions(page, seasonSelector);

    // Select season if requested
    if (seasonQuery) {
      const targetSeason = seasons.find(s =>
        s.label.toLowerCase().includes(seasonQuery.toLowerCase())
      );

      if (!targetSeason) {
        throw new Error(`Season "${seasonQuery}" not found`);
      }

      if (!targetSeason.selected) {
        await page.select(escapeIdForSelector(dom.seasonSelectId), targetSeason.value);
        await page.waitForNetworkIdle({ timeout: 10000 });

        // Re-extract seasons to get updated state
        seasons = await extractSelectOptions(page, seasonSelector);
      }
    }

    // Extract schedules (now populated based on season)
    let schedules = parsed.options.schedules.length
      ? parsed.options.schedules
      : await extractSelectOptions(page, scheduleSelector);

    // Select schedule if requested
    if (scheduleQuery) {
      const targetSchedule = schedules.find(s =>
        s.label.toLowerCase().includes(scheduleQuery.toLowerCase())
      );

      if (!targetSchedule) {
        throw new Error(`Schedule "${scheduleQuery}" not found`);
      }

      if (!targetSchedule.selected) {
        await page.select(escapeIdForSelector(dom.scheduleSelectId), targetSchedule.value);
        // Wait for the AJAX call to populate teams - this is the key!
        await page.waitForNetworkIdle({ timeout: 10000 });

        // Re-extract schedules to get updated state
        schedules = await extractSelectOptions(page, scheduleSelector);
      }
    }

    // Extract teams (NOW populated by JavaScript!)
    let teams = parsed.options.teams.length
      ? parsed.options.teams
      : await extractSelectOptions(page, teamSelector);

    // Select team if requested
    if (teamQuery) {
      const targetTeam = teams.find(t =>
        t.label.toLowerCase().includes(teamQuery.toLowerCase())
      );

      if (!targetTeam) {
        throw new Error(`Team "${teamQuery}" not found`);
      }

      if (!targetTeam.selected) {
        await page.select(escapeIdForSelector(dom.teamSelectId), targetTeam.value);
        await page.waitForNetworkIdle({ timeout: 10000 });

        // Re-extract teams to get updated state
        teams = await extractSelectOptions(page, teamSelector);
      }
    }

    return {
      seasons,
      schedules,
      teams,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Extract standings table for a given season/schedule (all teams)
 */
export async function getStandingsWithBrowser(
  season: string,
  schedule: string
): Promise<TeamStats[]> {
  const browserConfig = await getBrowserConfig();
  const browser = await puppeteer.launch(browserConfig);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto(SCOREBOARD_URL, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const initialMarkup = await page.content();
    const parsed = parseScoreboardPage(initialMarkup);
    const { dom } = parsed;
    const seasonSelector = `${escapeIdForSelector(dom.seasonSelectId)} option`;
    const scheduleSelector = `${escapeIdForSelector(dom.scheduleSelectId)} option`;
    const standingsSelector = `${escapeIdForSelector(`${dom.formId}:parts`)} tbody tr`;

    const normalizeSeasonQuery = (value: string) =>
      value.replace(/-/g, '/').replace(/\s+/g, ' ').trim();

    const normalizedSeason = normalizeSeasonQuery(season);
    const seasonQueries = [
      season,
      normalizedSeason,
      `SCAHA ${normalizedSeason}`,
      `SCAHA ${normalizedSeason} Season`,
    ].filter(Boolean) as string[];

    let seasons = parsed.options.seasons.length
      ? parsed.options.seasons
      : await extractSelectOptions(page, seasonSelector);
    const seasonOption =
      seasonQueries
        .map((query) => findOption(seasons, query))
        .find((opt): opt is SelectOption => Boolean(opt)) ??
      seasons.find((opt) => opt.selected);

    if (!seasonOption) {
      throw new Error(`Season "${season}" not found on scoreboard page`);
    }

    if (!seasonOption.selected) {
      await page.select(escapeIdForSelector(dom.seasonSelectId), seasonOption.value);
      await page.waitForNetworkIdle({ timeout: 15000 });
      seasons = await extractSelectOptions(page, seasonSelector);
    }

    const normalizeScheduleQuery = (value: string) =>
      value.replace(/regular season/gi, '').trim();

    const scheduleQueries = [
      `${schedule} Regular Season`,  // Try "14U B Regular Season" first
      schedule,                        // Then try "14U B"
      `${schedule} Season`,
      normalizeScheduleQuery(schedule),
    ].filter(Boolean) as string[];

    let schedules = parsed.options.schedules.length
      ? parsed.options.schedules
      : await extractSelectOptions(page, scheduleSelector);
    const scheduleOption =
      scheduleQueries
        .map((query) => findOption(schedules, query))
        .find((opt): opt is SelectOption => Boolean(opt)) ??
      schedules.find((opt) => opt.selected);

    if (!scheduleOption) {
      throw new Error(`Schedule "${schedule}" not found for season "${season}"`);
    }

    if (!scheduleOption.selected) {
      await page.select(escapeIdForSelector(dom.scheduleSelectId), scheduleOption.value);
      await page.waitForNetworkIdle({ timeout: 15000 });
      schedules = await extractSelectOptions(page, scheduleSelector);
    }

    await page.waitForFunction(
      (selector: string) => {
        const rows = document.querySelectorAll(selector);
        return Array.from(rows).some((row) => row.querySelectorAll('td').length >= 10);
      },
      { timeout: 15000 },
      standingsSelector
    );

    const standings = await page.$$eval(standingsSelector, (rows) => {
      const results = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
          (cell.textContent || '').trim()
        );

        if (cells.length < 10 || !cells[1]) {
          continue;
        }

        const gp = Number.parseInt(cells[2], 10);
        const w = Number.parseInt(cells[3], 10);
        const l = Number.parseInt(cells[4], 10);
        const t = Number.parseInt(cells[5], 10);
        const points = Number.parseInt(cells[6], 10);
        const gf = Number.parseInt(cells[7], 10);
        const ga = Number.parseInt(cells[8], 10);
        const gd = Number.parseInt(cells[9], 10);

        results.push({
          team: cells[1],
          gp: Number.isNaN(gp) ? 0 : gp,
          w: Number.isNaN(w) ? 0 : w,
          l: Number.isNaN(l) ? 0 : l,
          t: Number.isNaN(t) ? 0 : t,
          points: Number.isNaN(points) ? 0 : points,
          gf: Number.isNaN(gf) ? 0 : gf,
          ga: Number.isNaN(ga) ? 0 : ga,
          gd: Number.isNaN(gd) ? 0 : gd,
        });
      }

      return results;
    });

    return standings;
  } finally {
    await browser.close();
  }
}

/**
 * Navigate to a specific team's schedule and download the CSV
 */
export async function downloadScheduleCSVWithBrowser(
  season: string,
  schedule: string,
  team: string
): Promise<string> {
  const browserConfig = await getBrowserConfig();
  const browser = await puppeteer.launch(browserConfig);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // Navigate and select options
    await page.goto(SCOREBOARD_URL, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const initialMarkup = await page.content();
    const parsed = parseScoreboardPage(initialMarkup);
    const { dom } = parsed;
    const seasonSelector = `${escapeIdForSelector(dom.seasonSelectId)} option`;
    const scheduleSelector = `${escapeIdForSelector(dom.scheduleSelectId)} option`;
    const teamSelector = `${escapeIdForSelector(dom.teamSelectId)} option`;

    // Select season
    const seasons = parsed.options.seasons.length
      ? parsed.options.seasons
      : await extractSelectOptions(page, seasonSelector);
    const targetSeason = seasons.find(s => s.label.toLowerCase().includes(season.toLowerCase()));
    if (!targetSeason) throw new Error(`Season "${season}" not found`);

    await page.select(escapeIdForSelector(dom.seasonSelectId), targetSeason.value);
    await page.waitForNetworkIdle({ timeout: 10000 });

    // Select schedule
    const schedules = parsed.options.schedules.length
      ? parsed.options.schedules
      : await extractSelectOptions(page, scheduleSelector);
    const targetSchedule = schedules.find(s => s.label.toLowerCase().includes(schedule.toLowerCase()));
    if (!targetSchedule) throw new Error(`Schedule "${schedule}" not found`);

    await page.select(escapeIdForSelector(dom.scheduleSelectId), targetSchedule.value);
    await page.waitForNetworkIdle({ timeout: 10000 });

    // Select team
    const teams = parsed.options.teams.length
      ? parsed.options.teams
      : await extractSelectOptions(page, teamSelector);
    const targetTeam = teams.find(t => t.label.toLowerCase().includes(team.toLowerCase()));
    if (!targetTeam) throw new Error(`Team "${team}" not found`);

    await page.select(escapeIdForSelector(dom.teamSelectId), targetTeam.value);
    await page.waitForNetworkIdle({ timeout: 10000 });

    // After selecting the team, the schedule table should be visible
    // Extract it immediately before any navigation happens
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief wait for table to populate

    let tableData: string | null = null;

    try {
      // Try to extract the schedule table data
      // The schedule table has columns like: Game #, Date, Time, Type, Status, Home, Away, Venue
      tableData = await page.evaluate(() => {
        // Find all tables and look for the one with schedule data
        const tables = Array.from(document.querySelectorAll('table'));
        let scheduleTable = null;

        for (const table of tables) {
          const headerText = Array.from(table.querySelectorAll('thead th'))
            .map(th => th.textContent?.trim().toLowerCase() || '')
            .join(' ');

          // Schedule table should have "game" and "date" columns
          if (headerText.includes('game') && headerText.includes('date')) {
            scheduleTable = table;
            break;
          }
        }

        if (!scheduleTable) return null;

        const rows: string[][] = [];

        // Get headers
        const headerCells = scheduleTable.querySelectorAll('thead th');
        if (headerCells.length > 0) {
          rows.push(Array.from(headerCells).map(cell => cell.textContent?.trim() || ''));
        }

        // Get body rows
        const bodyRows = scheduleTable.querySelectorAll('tbody tr');
        bodyRows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            rows.push(Array.from(cells).map(cell => cell.textContent?.trim() || ''));
          }
        });

        if (rows.length > 0) {
          return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        }
        return null;
      });
    } catch (error) {
      // Fallback: try to get the page content and parse with cheerio
      try {
        const content = await page.content();
        if (content && content.includes('<table')) {
          const cheerio = await import('cheerio');
          const $ = cheerio.load(content);
          const rows: string[][] = [];

          $('table thead th').each((_, el) => {
            if (rows.length === 0) rows.push([]);
            rows[0].push($(el).text().trim());
          });

          $('table tbody tr').each((_, row) => {
            const rowData: string[] = [];
            $(row).find('td').each((_, cell) => {
              rowData.push($(cell).text().trim());
            });
            if (rowData.length > 0) rows.push(rowData);
          });

          if (rows.length > 0) {
            tableData = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
          }
        }
      } catch (cheerioError) {
        throw new Error(`Failed to extract table data: ${error}`);
      }
    }

    if (tableData) {
      return tableData;
    }

    throw new Error('Could not find schedule table data after selecting team');
  } finally {
    await browser.close();
  }
}

/**
 * Get team roster with all players and goalies from Stats Central
 */
export async function getTeamRosterWithBrowser(
  season: string,
  division: string,
  teamSlug: string
): Promise<TeamRoster> {
  const browserConfig = await getBrowserConfig();
  const browser = await puppeteer.launch(browserConfig);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto(STATS_CENTRAL_URL, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const initialMarkup = await page.content();
    const parsed = parseStatsCentralPage(initialMarkup);
    let { dom, seasons, schedules } = parsed;
    const seasonSelector = `[id="${dom.seasonSelectId}"] option`;
    const scheduleSelector = `[id="${dom.scheduleSelectId}"] option`;
    const seasonControl = `[id="${dom.seasonSelectId}"]`;
    const scheduleControl = `[id="${dom.scheduleSelectId}"]`;
    const playersButtonSelector = `[id="${dom.playersButtonId}"]`;
    const goaliesButtonSelector = `[id="${dom.goaliesButtonId}"]`;
    const playersTableSelector = `[id="${dom.playersTableId}"] tbody tr`;
    const goaliesTableSelector = `[id="${dom.goaliesTableId}"] tbody tr`;

    // Helper function to normalize season queries
    const normalizeSeasonQuery = (value: string) =>
      value.replace(/-/g, '/').replace(/\s+/g, ' ').trim();

    const normalizedSeason = normalizeSeasonQuery(season);
    const seasonQueries = [
      season,
      normalizedSeason,
      `SCAHA ${normalizedSeason}`,
      `SCAHA ${normalizedSeason} Season`,
    ].filter(Boolean) as string[];

    // Extract and select season
    seasons = seasons.length
      ? seasons
      : await extractSelectOptions(page, seasonSelector);
    const seasonOption =
      seasonQueries
        .map((query) => findOption(seasons, query))
        .find((opt): opt is SelectOption => Boolean(opt)) ??
      seasons.find((opt) => opt.selected);

    if (!seasonOption) {
      throw new Error(`Season "${season}" not found on stats central page`);
    }

    if (!seasonOption.selected) {
      await page.select(seasonControl, seasonOption.value);
      await page.waitForNetworkIdle({ timeout: 15000 });
      seasons = await extractSelectOptions(page, seasonSelector);
    }

    // Helper function to normalize schedule queries
    const normalizeScheduleQuery = (value: string) =>
      value.replace(/regular season/gi, '').trim();

    const scheduleQueries = [
      `${division} Regular Season`,
      division,
      `${division} Season`,
      normalizeScheduleQuery(division),
    ].filter(Boolean) as string[];

    // Extract and select schedule/division
    schedules = schedules.length
      ? schedules
      : await extractSelectOptions(page, scheduleSelector);
    const scheduleOption =
      scheduleQueries
        .map((query) => findOption(schedules, query))
        .find((opt): opt is SelectOption => Boolean(opt)) ??
      schedules.find((opt) => opt.selected);

    if (!scheduleOption) {
      throw new Error(`Division "${division}" not found for season "${season}"`);
    }

    if (!scheduleOption.selected) {
      await page.select(scheduleControl, scheduleOption.value);
      await page.waitForNetworkIdle({ timeout: 15000 });
      schedules = await extractSelectOptions(page, scheduleSelector);
    }

    // Click Players button to load player stats
    await page.click(playersButtonSelector);
    await page.waitForNetworkIdle({ timeout: 15000 });

    // Wait for player stats table to appear
    await page.waitForSelector(playersTableSelector, { timeout: 15000 });

    // Extract player stats
    const players = await page.$$eval(playersTableSelector, (rows) => {
      const results: PlayerStats[] = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
          (cell.textContent || '').trim()
        );

        if (cells.length < 8 || !cells[0] || !cells[1] || cells[1] === 'Name') {
          continue;
        }

        results.push({
          number: cells[0],
          name: cells[1],
          team: cells[2],
          gp: Number.parseInt(cells[3], 10) || 0,
          g: Number.parseInt(cells[4], 10) || 0,
          a: Number.parseInt(cells[5], 10) || 0,
          pts: Number.parseInt(cells[6], 10) || 0,
          pims: Number.parseInt(cells[7], 10) || 0,
        });
      }

      return results;
    });

    // Click Goalies button to load goalie stats
    await page.click(goaliesButtonSelector);
    await page.waitForNetworkIdle({ timeout: 15000 });

    // Wait for goalie stats table to appear
    await page.waitForSelector(goaliesTableSelector, { timeout: 15000 });

    // Extract goalie stats
    const goalies = await page.$$eval(goaliesTableSelector, (rows) => {
      const results: GoalieStats[] = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
          (cell.textContent || '').trim()
        );

        if (cells.length < 9 || !cells[0] || !cells[1] || cells[1] === 'Name') {
          continue;
        }

        const parseFloatOrNull = (value: string) => {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : null;
        };

        results.push({
          number: cells[0],
          name: cells[1],
          team: cells[2],
          gp: Number.parseInt(cells[3], 10) || 0,
          mins: Number.parseInt(cells[4], 10) || 0,
          shots: Number.parseInt(cells[5], 10) || 0,
          saves: Number.parseInt(cells[6], 10) || 0,
          sv_pct: parseFloatOrNull(cells[7]),
          gaa: parseFloatOrNull(cells[8]),
        });
      }

      return results;
    });

    // Filter by team
    const filteredPlayers = players.filter((p) => teamNamesMatch(p.team, teamSlug));
    const filteredGoalies = goalies.filter((g) => teamNamesMatch(g.team, teamSlug));

    if (filteredPlayers.length === 0 && filteredGoalies.length === 0) {
      throw new Error(`No roster data found for team "${teamSlug}" in division "${division}"`);
    }

    // Determine the actual team name from the first player/goalie found
    const actualTeamName = filteredPlayers[0]?.team || filteredGoalies[0]?.team || teamSlug;

    return {
      team: actualTeamName,
      division,
      season,
      players: filteredPlayers,
      goalies: filteredGoalies,
    };
  } finally {
    await browser.close();
  }
}
