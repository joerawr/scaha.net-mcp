import { parse } from 'date-fns';
import { TZDate } from '@date-fns/tz';

const PACIFIC_TZ = 'America/Los_Angeles';

/**
 * Normalize team names for consistent matching
 * Strips spaces, punctuation, and handles abbreviations
 */
export function normalizeTeamName(teamName: string): string {
  return teamName
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ')    // normalize spaces
    .trim();
}

/**
 * Parse date string in Pacific timezone
 * Returns both parsed Date and raw string for traceability
 */
export function parsePacificDate(dateStr: string, format: string = 'yyyy-MM-dd'): {
  date: Date;
  raw: string;
} {
  const parsed = parse(dateStr, format, new Date());
  const pacificDate = new TZDate(parsed, PACIFIC_TZ);

  return {
    date: pacificDate,
    raw: dateStr
  };
}

/**
 * Parse time string in Pacific timezone
 * Returns both parsed Date and raw string for traceability
 */
export function parsePacificTime(
  dateStr: string,
  timeStr: string
): {
  datetime: Date;
  raw: { date: string; time: string };
} {
  const datetimeStr = `${dateStr} ${timeStr}`;
  const parsed = parse(datetimeStr, 'yyyy-MM-dd HH:mm:ss', new Date());
  const pacificDateTime = new TZDate(parsed, PACIFIC_TZ);

  return {
    datetime: pacificDateTime,
    raw: { date: dateStr, time: timeStr }
  };
}

/**
 * Check if two team names match after normalization
 */
export function teamNamesMatch(name1: string, name2: string): boolean {
  return normalizeTeamName(name1) === normalizeTeamName(name2);
}

/**
 * Parse numeric score or return "--" for unplayed games
 */
export function parseScore(scoreStr: string): number | string {
  const trimmed = scoreStr.trim();
  if (trimmed === '--' || trimmed === '') {
    return '--';
  }
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? '--' : parsed;
}
