import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { SelectOption, ScoreboardOptionState } from './types';

const BASE_URL = 'https://www.scaha.net';
const SCOREBOARD_URL = `${BASE_URL}/scaha/scoreboard.xhtml`;

/**
 * Get browser executable path based on environment
 */
async function getBrowserConfig() {
  // In production (Vercel), use @sparticuz/chromium
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
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
async function extractSelectOptions(page: puppeteer.Page, selector: string): Promise<SelectOption[]> {
  return page.$$eval(selector, (options: HTMLOptionElement[]) =>
    options.map(opt => ({
      value: opt.value,
      label: opt.textContent?.trim() || '',
      selected: opt.selected,
    }))
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

    // Extract initial seasons
    let seasons = await extractSelectOptions(page, '#j_id_4c\\:j_id_4jInner option');

    // Select season if requested
    if (seasonQuery) {
      const targetSeason = seasons.find(s =>
        s.label.toLowerCase().includes(seasonQuery.toLowerCase())
      );

      if (!targetSeason) {
        throw new Error(`Season "${seasonQuery}" not found`);
      }

      if (!targetSeason.selected) {
        await page.select('#j_id_4c\\:j_id_4jInner', targetSeason.value);
        await page.waitForNetworkIdle({ timeout: 10000 });

        // Re-extract seasons to get updated state
        seasons = await extractSelectOptions(page, '#j_id_4c\\:j_id_4jInner option');
      }
    }

    // Extract schedules (now populated based on season)
    let schedules = await extractSelectOptions(page, '#j_id_4c\\:j_id_4mInner option');

    // Select schedule if requested
    if (scheduleQuery) {
      const targetSchedule = schedules.find(s =>
        s.label.toLowerCase().includes(scheduleQuery.toLowerCase())
      );

      if (!targetSchedule) {
        throw new Error(`Schedule "${scheduleQuery}" not found`);
      }

      if (!targetSchedule.selected) {
        await page.select('#j_id_4c\\:j_id_4mInner', targetSchedule.value);
        // Wait for the AJAX call to populate teams - this is the key!
        await page.waitForNetworkIdle({ timeout: 10000 });

        // Re-extract schedules to get updated state
        schedules = await extractSelectOptions(page, '#j_id_4c\\:j_id_4mInner option');
      }
    }

    // Extract teams (NOW populated by JavaScript!)
    let teams = await extractSelectOptions(page, '#j_id_4c\\:j_id_4pInner option');

    // Select team if requested
    if (teamQuery) {
      const targetTeam = teams.find(t =>
        t.label.toLowerCase().includes(teamQuery.toLowerCase())
      );

      if (!targetTeam) {
        throw new Error(`Team "${teamQuery}" not found`);
      }

      if (!targetTeam.selected) {
        await page.select('#j_id_4c\\:j_id_4pInner', targetTeam.value);
        await page.waitForNetworkIdle({ timeout: 10000 });

        // Re-extract teams to get updated state
        teams = await extractSelectOptions(page, '#j_id_4c\\:j_id_4pInner option');
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

    // Select season
    const seasons = await extractSelectOptions(page, '#j_id_4c\\:j_id_4jInner option');
    const targetSeason = seasons.find(s => s.label.toLowerCase().includes(season.toLowerCase()));
    if (!targetSeason) throw new Error(`Season "${season}" not found`);

    await page.select('#j_id_4c\\:j_id_4jInner', targetSeason.value);
    await page.waitForNetworkIdle({ timeout: 10000 });

    // Select schedule
    const schedules = await extractSelectOptions(page, '#j_id_4c\\:j_id_4mInner option');
    const targetSchedule = schedules.find(s => s.label.toLowerCase().includes(schedule.toLowerCase()));
    if (!targetSchedule) throw new Error(`Schedule "${schedule}" not found`);

    await page.select('#j_id_4c\\:j_id_4mInner', targetSchedule.value);
    await page.waitForNetworkIdle({ timeout: 10000 });

    // Select team
    const teams = await extractSelectOptions(page, '#j_id_4c\\:j_id_4pInner option');
    const targetTeam = teams.find(t => t.label.toLowerCase().includes(team.toLowerCase()));
    if (!targetTeam) throw new Error(`Team "${team}" not found`);

    await page.select('#j_id_4c\\:j_id_4pInner', targetTeam.value);
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
