import { chromium, type Page } from 'playwright-core';
import sparticuzChromium from '@sparticuz/chromium';
import { SelectOption, ScoreboardOptionState, TeamStats, TeamRoster, PlayerStats, GoalieStats } from './types.js';
import { teamNamesMatch } from './utils.js';
import { escapeIdForSelector, parseScoreboardPage, parseStatsCentralPage } from './scaha-dom.js';

const BASE_URL = 'https://www.scaha.net';
const SCOREBOARD_URL = `${BASE_URL}/scaha/scoreboard.xhtml`;
const STATS_CENTRAL_URL = `${BASE_URL}/scaha/statscentral.xhtml`;

/**
 * Get browser executable path based on environment
 */
async function getLaunchConfig() {
  // In production (Vercel), use @sparticuz/chromium
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    };
  }

  // In development, use local Chrome/Chromium
  return {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    headless: true,
  };
}

/**
 * Extract select options from a dropdown element
 */
async function extractSelectOptions(page: Page, selector: string): Promise<SelectOption[]> {
  const options = await page.locator(`${selector} option`).evaluateAll((opts) => 
    opts.map((opt) => {
      const htmlOpt = opt as HTMLOptionElement;
      return {
        value: htmlOpt.value,
        label: htmlOpt.textContent?.trim() || '',
        selected: htmlOpt.selected,
      };
    })
  );
  return options;
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
  const launchConfig = await getLaunchConfig();
  const browser = await chromium.launch(launchConfig);

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    
    // Optimize: Block images/css
    await context.route('**/*.{png,jpg,jpeg,svg,css,woff,woff2}', route => route.abort());

    const page = await context.newPage();

    // Navigate to scoreboard
    await page.goto(SCOREBOARD_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const initialMarkup = await page.content();
    const parsed = parseScoreboardPage(initialMarkup);
    const { dom } = parsed;
    const seasonSelector = escapeIdForSelector(dom.seasonSelectId);
    const scheduleSelector = escapeIdForSelector(dom.scheduleSelectId);
    const teamSelector = escapeIdForSelector(dom.teamSelectId);

    // Always read live options from the page so we see JSF/AJAX updates
    let seasons = await extractSelectOptions(page, seasonSelector);

    // 1. Select Season
    if (seasonQuery) {
      const targetSeason = seasons.find(s =>
        s.label.toLowerCase().includes(seasonQuery.toLowerCase())
      );

      if (!targetSeason) throw new Error(`Season "${seasonQuery}" not found`);

      if (!targetSeason.selected) {
        await page.selectOption(seasonSelector, targetSeason.value);
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        seasons = await extractSelectOptions(page, seasonSelector);
      }
    }

    // 2. Select Schedule
    let schedules = await extractSelectOptions(page, scheduleSelector);
    if (scheduleQuery) {
      const targetSchedule = schedules.find(s =>
        s.label.toLowerCase().includes(scheduleQuery.toLowerCase())
      );

      if (!targetSchedule) throw new Error(`Schedule "${scheduleQuery}" not found`);

      if (!targetSchedule.selected) {
        await page.selectOption(scheduleSelector, targetSchedule.value);
        // Robust wait for teams to populate
        await page.waitForFunction((sel) => {
          const select = document.querySelector(sel) as HTMLSelectElement;
          return select && select.options.length > 1;
        }, teamSelector, { timeout: 10000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        schedules = await extractSelectOptions(page, scheduleSelector);
      }
    }

    // 3. Select Team
    let teams = await extractSelectOptions(page, teamSelector);
    if (teamQuery) {
      const targetTeam = teams.find(t =>
        t.label.toLowerCase().includes(teamQuery.toLowerCase())
      );

      if (!targetTeam) throw new Error(`Team "${teamQuery}" not found`);

      if (!targetTeam.selected) {
        await page.selectOption(teamSelector, targetTeam.value);
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        teams = await extractSelectOptions(page, teamSelector);
      }
    }

    return { seasons, schedules, teams };
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
  const launchConfig = await getLaunchConfig();
  const browser = await chromium.launch(launchConfig);

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    
    await context.route('**/*.{png,jpg,jpeg,svg,css,woff,woff2}', route => route.abort());

    const page = await context.newPage();

    await page.goto(SCOREBOARD_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const initialMarkup = await page.content();
    const parsed = parseScoreboardPage(initialMarkup);
    const { dom } = parsed;
    const seasonSelector = escapeIdForSelector(dom.seasonSelectId);
    const scheduleSelector = escapeIdForSelector(dom.scheduleSelectId);
    const standingsSelector = `${escapeIdForSelector(`${dom.formId}:parts`)} tbody tr`;

    const normalizeSeasonQuery = (value: string) =>
      value.replace(/-/g, '/').replace(/\s+/g, ' ').trim();

    const normalizedSeason = normalizeSeasonQuery(season);
    const seasonQueries = [season, normalizedSeason, `SCAHA ${normalizedSeason}`, `SCAHA ${normalizedSeason} Season`].filter(Boolean) as string[];

    let seasons = await extractSelectOptions(page, seasonSelector);
    const seasonOption = seasonQueries.map((query) => findOption(seasons, query)).find((opt): opt is SelectOption => Boolean(opt)) ?? seasons.find((opt) => opt.selected);

    if (!seasonOption) throw new Error(`Season "${season}" not found`);

    if (!seasonOption.selected) {
      await page.selectOption(seasonSelector, seasonOption.value);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      seasons = await extractSelectOptions(page, seasonSelector);
    }

    const scheduleQueries = [`${schedule} Regular Season`, schedule, `${schedule} Season`].filter(Boolean) as string[];

    let schedules = await extractSelectOptions(page, scheduleSelector);
    const scheduleOption = scheduleQueries.map((query) => findOption(schedules, query)).find((opt): opt is SelectOption => Boolean(opt)) ?? schedules.find((opt) => opt.selected);

    if (!scheduleOption) throw new Error(`Schedule "${schedule}" not found`);

    if (!scheduleOption.selected) {
      await page.selectOption(scheduleSelector, scheduleOption.value);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      schedules = await extractSelectOptions(page, scheduleSelector);
    }

    await page.waitForFunction(
      (selector: string) => {
        const rows = document.querySelectorAll(selector);
        return Array.from(rows).some((row) => row.querySelectorAll('td').length >= 10);
      },
      standingsSelector,
      { timeout: 15000 }
    );

    const standings = await page.locator(standingsSelector).evaluateAll((rows) => {
      const results = [];
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent || '').trim());
        if (cells.length < 10 || !cells[1]) continue;
        results.push({
          team: cells[1],
          gp: parseInt(cells[2], 10) || 0,
          w: parseInt(cells[3], 10) || 0,
          l: parseInt(cells[4], 10) || 0,
          t: parseInt(cells[5], 10) || 0,
          points: parseInt(cells[6], 10) || 0,
          gf: parseInt(cells[7], 10) || 0,
          ga: parseInt(cells[8], 10) || 0,
          gd: parseInt(cells[9], 10) || 0,
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
  const launchConfig = await getLaunchConfig();
  const browser = await chromium.launch(launchConfig);

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    
    await context.route('**/*.{png,jpg,jpeg,svg,css,woff,woff2}', route => route.abort());
    const page = await context.newPage();

    await page.goto(SCOREBOARD_URL, { waitUntil: 'networkidle', timeout: 30000 });

    const initialMarkup = await page.content();
    const parsed = parseScoreboardPage(initialMarkup);
    const { dom } = parsed;
    const seasonSelector = escapeIdForSelector(dom.seasonSelectId);
    const scheduleSelector = escapeIdForSelector(dom.scheduleSelectId);
    const teamSelector = escapeIdForSelector(dom.teamSelectId);

    // 1. Select Season
    let seasons = await extractSelectOptions(page, seasonSelector);
    const targetSeason = seasons.find(s => s.label.toLowerCase().includes(season.toLowerCase()));
    if (!targetSeason) throw new Error(`Season "${season}" not found`);

    if (!targetSeason.selected) {
      await page.selectOption(seasonSelector, targetSeason.value);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    }

    // 2. Select Schedule
    let schedules = await extractSelectOptions(page, scheduleSelector);
    const targetSchedule = schedules.find(s => s.label.toLowerCase().includes(schedule.toLowerCase()));
    if (!targetSchedule) throw new Error(`Schedule "${schedule}" not found`);

    if (!targetSchedule.selected) {
      await page.selectOption(scheduleSelector, targetSchedule.value);
      // Robust wait for teams to populate
      await page.waitForFunction((sel) => {
        const select = document.querySelector(sel) as HTMLSelectElement;
        return select && select.options.length > 1;
      }, teamSelector, { timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    }

    // 3. Select Team
    let teams = await extractSelectOptions(page, teamSelector);
    const targetTeam = teams.find(t => t.label.toLowerCase().includes(team.toLowerCase()));
    if (!targetTeam) throw new Error(`Team "${team}" not found`);

    if (!targetTeam.selected) {
      await page.selectOption(teamSelector, targetTeam.value);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    }

    // After selecting the team, the schedule table should be visible
    await page.waitForTimeout(1000); 

    const tableData = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      let scheduleTable = null;
      for (const table of tables) {
        const headerText = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim().toLowerCase() || '').join(' ');
        if (headerText.includes('game') && headerText.includes('date')) {
          scheduleTable = table;
          break;
        }
      }
      if (!scheduleTable) return null;
      const rows: string[][] = [];
      const headerCells = scheduleTable.querySelectorAll('thead th');
      if (headerCells.length > 0) rows.push(Array.from(headerCells).map(cell => cell.textContent?.trim() || ''));
      const bodyRows = scheduleTable.querySelectorAll('tbody tr');
      bodyRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) rows.push(Array.from(cells).map(cell => cell.textContent?.trim() || ''));
      });
      return rows.length > 0 ? rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n') : null;
    });

    if (!tableData) throw new Error('Could not find schedule table data');
    return tableData;
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
  const launchConfig = await getLaunchConfig();
  const browser = await chromium.launch(launchConfig);

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    
    await context.route('**/*.{png,jpg,jpeg,svg,css,woff,woff2}', route => route.abort());
    const page = await context.newPage();

    await page.goto(STATS_CENTRAL_URL, { waitUntil: 'networkidle', timeout: 30000 });

    const initialMarkup = await page.content();
    const parsed = parseStatsCentralPage(initialMarkup);
    let { dom, seasons, schedules } = parsed;
    const seasonSelector = escapeIdForSelector(dom.seasonSelectId);
    const scheduleSelector = escapeIdForSelector(dom.scheduleSelectId);
    const playersButton = `[id="${dom.playersButtonId}"]`;
    const goaliesButton = `[id="${dom.goaliesButtonId}"]`;
    const playersTableSelector = `[id="${dom.playersTableId}"] tbody tr`;
    const goaliesTableSelector = `[id="${dom.goaliesTableId}"] tbody tr`;

    // 1. Season
    seasons = await extractSelectOptions(page, seasonSelector);
    const seasonOption = findOption(seasons, season) ?? seasons.find((opt) => opt.selected);
    if (!seasonOption) throw new Error(`Season "${season}" not found`);
    if (!seasonOption.selected) {
      await page.selectOption(seasonSelector, seasonOption.value);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    }

    // 2. Schedule
    schedules = await extractSelectOptions(page, scheduleSelector);
    const scheduleOption = findOption(schedules, division) ?? schedules.find((opt) => opt.selected);
    if (!scheduleOption) throw new Error(`Division "${division}" not found`);
    if (!scheduleOption.selected) {
      await page.selectOption(scheduleSelector, scheduleOption.value);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    }

    // 3. Extract Players
    await page.click(playersButton);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForSelector(playersTableSelector, { timeout: 15000 });
    const players = await page.locator(playersTableSelector).evaluateAll((rows) => {
      const results: PlayerStats[] = [];
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent || '').trim());
        if (cells.length < 8 || !cells[0] || !cells[1] || cells[1] === 'Name') continue;
        results.push({
          number: cells[0], name: cells[1], team: cells[2],
          gp: parseInt(cells[3], 10) || 0, g: parseInt(cells[4], 10) || 0,
          a: parseInt(cells[5], 10) || 0, pts: parseInt(cells[6], 10) || 0,
          pims: parseInt(cells[7], 10) || 0,
        });
      }
      return results;
    });

    // 4. Extract Goalies
    await page.click(goaliesButton);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForSelector(goaliesTableSelector, { timeout: 15000 });
    const goalies = await page.locator(goaliesTableSelector).evaluateAll((rows) => {
      const results: GoalieStats[] = [];
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent || '').trim());
        if (cells.length < 9 || !cells[0] || !cells[1] || cells[1] === 'Name') continue;
        results.push({
          number: cells[0], name: cells[1], team: cells[2],
          gp: parseInt(cells[3], 10) || 0, mins: parseInt(cells[4], 10) || 0,
          shots: parseInt(cells[5], 10) || 0, saves: parseInt(cells[6], 10) || 0,
          sv_pct: parseFloat(cells[7]) || null, gaa: parseFloat(cells[8]) || null,
        });
      }
      return results;
    });

    const filteredPlayers = players.filter((p) => teamNamesMatch(p.team, teamSlug));
    const filteredGoalies = goalies.filter((g) => teamNamesMatch(g.team, teamSlug));
    if (filteredPlayers.length === 0 && filteredGoalies.length === 0) throw new Error(`No roster found for team "${teamSlug}"`);

    return { team: filteredPlayers[0]?.team || filteredGoalies[0]?.team || teamSlug, division, season, players: filteredPlayers, goalies: filteredGoalies };
  } finally {
    await browser.close();
  }
}