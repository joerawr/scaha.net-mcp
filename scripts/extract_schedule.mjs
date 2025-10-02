import fs from 'node:fs';
import { load } from 'cheerio';

const INPUT = 'data/14u_b_jr_kings_partial.xml';
const OUTPUT = 'data/14u_b_jr_kings_schedule.csv';

const xml = fs.readFileSync(INPUT, 'utf8');
const cdataFragments = [...xml.matchAll(/<!\[CDATA\[(.*?)\]\]>/gs)].map(([, fragment]) => fragment);
if (!cdataFragments.length) {
  throw new Error('No HTML fragments found in partial response.');
}
const html = cdataFragments.join('');
const $ = load(html);

const table = $('#j_id_4c\\:games');
if (!table.length) {
  throw new Error('Could not locate schedule table (#j_id_4c:games).');
}

const headers = table.find('thead th').map((_, cell) => $(cell).text().trim()).get();
const rows = [];
table.find('tbody tr').each((_, row) => {
  const cells = $(row)
    .find('td')
    .map((_, cell) => $(cell).text().trim().replace(/\s+/g, ' '))
    .get();
  rows.push(cells);
});

function toCsv(data) {
  const escapeField = (value) => {
    const v = value ?? '';
    if (/[",\n]/.test(v)) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  return data.map((row) => row.map(escapeField).join(',')).join('\n');
}

const csv = toCsv([headers, ...rows]);
fs.writeFileSync(OUTPUT, csv);
console.log(`Wrote ${rows.length} rows to ${OUTPUT}`);
