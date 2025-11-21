import * as cheerio from 'cheerio';
import { SelectOption, ScoreboardOptionState } from './types';

export interface ScoreboardDomIds {
  formId: string;
  submitField: string;
  seasonSelectId: string;
  seasonField: string;
  scheduleSelectId: string;
  scheduleField: string;
  teamSelectId: string;
  teamField: string;
}

export interface StatsCentralDomIds {
  formId: string;
  submitField: string;
  seasonSelectId: string;
  seasonField: string;
  scheduleSelectId: string;
  scheduleField: string;
  playersButtonId: string;
  goaliesButtonId: string;
  playersTableId: string;
  goaliesTableId: string;
}

function parseOptionsFromSelect(
  $: cheerio.CheerioAPI,
  element: any
): SelectOption[] {
  const options: SelectOption[] = [];

  $(element)
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

function detectScoreboardDom(html: string) {
  const $ = cheerio.load(html);
  const selectNodes = $('select')
    .toArray()
    .map((el) => ({
      id: $(el).attr('id') ?? '',
      name: $(el).attr('name') ?? '',
      formId: $(el).closest('form').attr('id') ?? '',
      options: parseOptionsFromSelect($, el),
    }));

  const seasonSelect =
    selectNodes.find((sel) =>
      sel.options.some((opt) => /\d{4}[/-]\d{2}/.test(opt.label))
    ) ?? selectNodes[0];

  const scheduleSelect =
    selectNodes.find(
      (sel) =>
        sel !== seasonSelect &&
        sel.options.some((opt) =>
          /regular season|schedule/i.test(opt.label || '')
        )
    ) ??
    selectNodes.find((sel, idx) => idx === 1 && sel !== seasonSelect) ??
    selectNodes[0];

  const teamSelect =
    selectNodes.find((sel) => sel !== seasonSelect && sel !== scheduleSelect) ??
    selectNodes[selectNodes.length - 1];

  const formId =
    seasonSelect?.formId ||
    scheduleSelect?.formId ||
    teamSelect?.formId ||
    'j_id_4d';

  const dom: ScoreboardDomIds = {
    formId,
    submitField: `${formId}_SUBMIT`,
    seasonSelectId: seasonSelect?.id || `${formId}:j_id_4kInner`,
    seasonField:
      seasonSelect?.name || seasonSelect?.id || `${formId}:j_id_4kInner`,
    scheduleSelectId: scheduleSelect?.id || `${formId}:j_id_4nInner`,
    scheduleField:
      scheduleSelect?.name || scheduleSelect?.id || `${formId}:j_id_4nInner`,
    teamSelectId: teamSelect?.id || `${formId}:j_id_4qInner`,
    teamField: teamSelect?.name || teamSelect?.id || `${formId}:j_id_4qInner`,
  };

  return { dom, selectNodes };
}

export function parseScoreboardPage(html: string): {
  dom: ScoreboardDomIds;
  options: ScoreboardOptionState;
} {
  const { dom, selectNodes } = detectScoreboardDom(html);

  const seasons =
    selectNodes.find((sel) => sel.id === dom.seasonSelectId)?.options || [];
  const schedules =
    selectNodes.find((sel) => sel.id === dom.scheduleSelectId)?.options || [];
  const teams =
    selectNodes.find((sel) => sel.id === dom.teamSelectId)?.options || [];

  return {
    dom,
    options: { seasons, schedules, teams },
  };
}

function detectStatsCentralDom(html: string) {
  const $ = cheerio.load(html);
  const selectNodes = $('select')
    .toArray()
    .map((el) => ({
      id: $(el).attr('id') ?? '',
      name: $(el).attr('name') ?? '',
      formId: $(el).closest('form').attr('id') ?? '',
      options: parseOptionsFromSelect($, el),
    }));

  const seasonSelect =
    selectNodes.find((sel) =>
      sel.options.some((opt) => /\d{4}[/-]\d{2}/.test(opt.label))
    ) ?? selectNodes[0];

  const scheduleSelect =
    selectNodes.find(
      (sel) =>
        sel !== seasonSelect &&
        sel.options.some((opt) =>
          /regular season|schedule/i.test(opt.label || '')
        )
    ) ??
    selectNodes.find((sel, idx) => idx === 1 && sel !== seasonSelect) ??
    selectNodes[selectNodes.length - 1];

  const buttonNodes = $('button, input[type="submit"]')
    .toArray()
    .map((el) => ({
      id: $(el).attr('id') || $(el).attr('name') || '',
      text: ($(el).text() || $(el).attr('value') || '').trim(),
    }));

  const playersButton =
    buttonNodes.find((btn) => btn.text.toLowerCase().includes('players')) ||
    buttonNodes[0];
  const goaliesButton =
    buttonNodes.find((btn) => btn.text.toLowerCase().includes('goalies')) ||
    buttonNodes[1] ||
    buttonNodes[0];

  const formId =
    seasonSelect?.formId ||
    scheduleSelect?.formId ||
    'j_id_4d';

  const playersTableId =
    $('table[id*="playertotals"]').first().attr('id') ||
    `${formId}:playertotals`;
  const goaliesTableId =
    $('table[id*="goalietotals"]').first().attr('id') ||
    `${formId}:goalietotals`;

  const dom: StatsCentralDomIds = {
    formId,
    submitField: `${formId}_SUBMIT`,
    seasonSelectId: seasonSelect?.id || `${formId}:j_id_4kInner`,
    seasonField:
      seasonSelect?.name || seasonSelect?.id || `${formId}:j_id_4kInner`,
    scheduleSelectId: scheduleSelect?.id || `${formId}:schedulelistInner`,
    scheduleField:
      scheduleSelect?.name || scheduleSelect?.id || `${formId}:schedulelistInner`,
    playersButtonId: playersButton?.id || `${formId}:j_id_4w`,
    goaliesButtonId: goaliesButton?.id || `${formId}:j_id_4x`,
    playersTableId,
    goaliesTableId,
  };

  return { dom, selectNodes };
}

export function parseStatsCentralPage(html: string): {
  dom: StatsCentralDomIds;
  seasons: SelectOption[];
  schedules: SelectOption[];
} {
  const { dom, selectNodes } = detectStatsCentralDom(html);

  const seasons =
    selectNodes.find((sel) => sel.id === dom.seasonSelectId)?.options || [];
  const schedules =
    selectNodes.find((sel) => sel.id === dom.scheduleSelectId)?.options || [];

  return { dom, seasons, schedules };
}

export function extractFormUpdate(partialResponse: string, formId: string): string | null {
  const escapedFormId = formId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const targetedMatch = partialResponse.match(
    new RegExp(`<update id="${escapedFormId}"><!\\[CDATA\\[(.*?)\\]\\]></update>`, 's')
  );

  if (targetedMatch && targetedMatch[1]) {
    return targetedMatch[1];
  }

  const fragments = [...partialResponse.matchAll(/<!\[CDATA\[(.*?)\]\]>/gs)].map(
    ([, fragment]) => fragment
  );

  return fragments.length ? fragments.join('') : null;
}
