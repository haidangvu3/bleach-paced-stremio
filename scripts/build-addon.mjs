import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { load } from 'cheerio';
import { parse } from 'csv-parse/sync';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERIES = 'cb_bleach_paced';
export const SHEETS = {
  cb: '1bz-Ye4yAXmX31K_abAV7kNUq3lwOBg6aiOxAHaFDRl8',
  hb2: '1-ipC6DpZw4GlmMnUw4fOsIWXCbK0s0St2vbsMPr6WfI',
  hb3: '1E8h5WKvbYc_15ImxzFqU5P2VBqZ9fyWizOEVpV95Uu0',
};
export const FOLDERS = [
  ['cb', '1VupbYqbi6Emf0kSBgnQ6Knvs6yOFf6Cr'],
  ['cb', '1l_tbvF5UFj0nNYsglDFrYoinh0aIeEmF'],
  ['cb', '1oU5affNaIftsJnvTXeYeDYHgeFQmSkaY'],
  ['cb', '1SfWvymu8GTCT3TnPrlHt0T9jxz8yhzUo'],
  ['cb', '18V_VFzfRPWfLfFv_Nge5cBnCyKCwXDG0'],
  ['cb', '1RE_3_E6yyXF9HYs8onWx9fjmqm9UDU50'],
  ['hb-special', '1BQ2STVVDgtULuC9CwtKEYfSs8NPIIj0B'],
  ['hb3', '1z7QNvitQ6vN_U_OHC9Wxt321zVxHha4-'],
  ['hb2-sub', '1F20hXdUMZYozPCpE77vdsbVRaN92kOrd'],
  ['hb2-sub', '16QcaWIAV1dhbphU_WltGNla3uK4Za_VM'],
  ['hb2-dub', '1OCLWJwRmmuEnpnEHYR63IPv7RIXCOX6S'],
  ['hb2-dub', '1CnR0_PgLmb7d0j7TNWP2BPjLHaNCwdVp'],
  ['hb2', '1zBfNvZuzVyydiRUQ3brixL_K4ykIENHH'],
  ['hb2', '15EIpp2j9rXfuoAPJlXF8ep74LABgMH2U'],
];
const PIXEL = [['cb-sub', 'rwPVCu7Z'], ['cb-dub', 'goCGsiJG'], ['hb2-sub', '9spuTVX2'], ['hb2-dub', 'y1AECf9N']];
const VIDEO = /\.(mkv|mp4|webm)$/i;
const validId = value => /^[\w-]{10,100}$/.test(value);

export function parseSheet(csv, project) {
  const rows = parse(csv, { bom: true, relax_column_count: true, skip_empty_lines: true });
  const header = rows.shift().map(s => s.trim());
  for (const key of ['Ep #', 'Title', 'Chapters']) if (!header.includes(key)) throw new Error(`Invalid ${project} CSV: missing ${key}`);
  let section = project;
  return rows.flatMap((cells, index) => {
    if (project === 'hb3' && cells.some(c => /^V3 EPISODES$/i.test(c.trim()))) section = 'hb3-active';
    const row = Object.fromEntries(header.map((key, i) => [key, cells[i]?.trim() || '']));
    if (!/^(?:SP\d+|\d+(?:\.\d+)?(?:\s*\(.*\))?)$/i.test(row['Ep #'])) return [];
    if (project === 'hb3' && section !== 'hb3-active') return [];
    let ep = row['Ep #'];
    if (project === 'cb' && ep === '0') ep = '35.5';
    if (project === 'cb' && ep === '0.8') ep = '65.5';
    if (project === 'hb2' && ep === '0.8') ep = '29.5';
    ep = /^SP/i.test(ep) ? ep.toUpperCase() : String(Number.parseFloat(ep)).padStart(2, '0');
    return [{ project, ep, title: row.Title, chapters: row.Chapters, length: row.Length, released: row['Release Date'], notes: row['Episode Notes'] || '', order: index }];
  });
}

// Signed ranges matter: the Pendulum flashback uses chapters -108 through -97.
export function chapterBounds(chapters) {
  const numbers = (chapters.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  // A hyphen between unsigned values is a range separator, not a minus sign.
  const normalized = chapters.replace(/(\d)\s*[-–]\s*(?=\d)/g, '$1 to ');
  const values = (normalized.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  if (!numbers.length) return null;
  const positive = values.filter(n => n >= 1);
  if (positive.length) return { start: Math.min(...positive), end: Math.max(...positive) };
  if (values.includes(0.8)) return { start: 315.5, end: 315.5 };
  const negative = values.filter(n => n <= -97 && n >= -108);
  if (negative.length) return { start: 315 + (Math.min(...negative) + 109) / 100, end: 315 + (Math.max(...negative) + 109) / 100 };
  return null;
}

export function parseDrive(html) {
  const $ = load(html), found = new Map();
  $('.flip-entry[id^="entry-"]').each((_, element) => {
    const el = $(element), id = el.attr('id').slice(6);
    const name = el.find('.flip-entry-title').text().trim();
    const href = el.find('a').first().attr('href') || '';
    if (validId(id) && name) found.set(id, { id, name, folder: /\/folders\//.test(href) });
  });
  $('tr[data-id][data-selectable]').each((_, element) => {
    const el = $(element), id = el.attr('data-id');
    let name = el.find('[data-column-field="6"] [data-tooltip]').first().attr('data-tooltip');
    if (!name) name = el.find('[data-column-field="6"] [aria-label]').map((_, e) => $(e).attr('aria-label')).get().find(s => /\.(mkv|mp4|webm)/i.test(s));
    if (name) name = name.replace(/\s+(Video|Shared)(?:\s+Shared)?$/g, '').trim();
    if (validId(id || '') && name && VIDEO.test(name)) found.set(id, { id, name, folder: false });
  });
  const expected = Number($('[aria-rowcount]').first().attr('aria-rowcount') || 0);
  if (expected > found.size + 1) throw new Error(`Drive HTML is truncated (${found.size}/${expected} entries)`);
  if (!found.size && !/empty|no files|flip-entries|flip-entry|Item List/i.test(html)) throw new Error('Unrecognized Drive folder HTML (possibly a sign-in or consent page)');
  return [...found.values()];
}

export function identifyFile(file) {
  if (!VIDEO.test(file.name)) return null;
  const cb = file.group.startsWith('cb');
  // The CB root also links comparison clips; those are not full episodes.
  if (cb && file.provider === 'drive' && !/\.mkv$/i.test(file.name)) return null;
  const match = file.name.match(cb ? /^(?:Concentrated Bleach\s*)?(\d+(?:\.\d+)?)/i : /(?:Hollowed\s+Bleach\s*(?:v3\s*)?)(SP\d+|\d+(?:\.\d+)?)/i);
  if (!match) return null;
  let ep = match[1].toUpperCase();
  if (cb && ep === '0') ep = '35.5';
  if (cb && ep === '0.8') ep = '65.5';
  if (!ep.startsWith('SP')) ep = String(Number(ep)).padStart(2, '0');
  const v3 = file.group === 'hb3' || /Bleach\s+v3\b/i.test(file.name);
  return { ...file, project: cb ? 'cb' : v3 ? 'hb3' : 'hb2', ep,
    extra: /\bEX\b/i.test(file.name), language: /sub/i.test(file.group) || /\(sub\)/i.test(file.name) ? 'Sub' : /dub/i.test(file.group) || /\(dub\)/i.test(file.name) ? 'Dub' : 'Dual Audio' };
}

function seedFiles(seed) {
  return [
    ...seed.cb.map(f => ({ id: f.gdriveId, name: f.fileName, group: 'cb' })),
    ...Object.entries(seed.hbSpecials).map(([key, f]) => ({ id: f.id, name: f.name, group: key.startsWith('v3') ? 'hb3' : 'hb2' })),
    ...seed.hbLostAgent.map(f => ({ id: f.id, name: f.name, group: 'hb2' })),
    ...Object.values(seed.hbV2).flatMap(pair => Object.entries(pair).filter(([, f]) => f).map(([language, f]) => ({ id: f.id, name: f.name, group: `hb2-${language}` }))),
  ].map(f => ({ ...f, provider: 'drive' }));
}

export function makeStreams(files) {
  // A dedicated subbed MP4 works without an embedded-track selector. Prefer it
  // for Nuvio, retaining the full-quality MKV and English dub as alternatives.
  const rank = file => (file.extra ? 100 : 0) + ({ Sub: 0, 'Dual Audio': 10, Dub: 20 }[file.language] ?? 30);
  const sorted = [...files].sort((a, b) => rank(a) - rank(b) || (a.provider === 'drive' ? 0 : 1) - (b.provider === 'drive' ? 0 : 1));
  return [...new Map(sorted.map(file => {
    const url = file.provider === 'drive' ? `https://drive.usercontent.google.com/download?id=${encodeURIComponent(file.id)}&export=download&confirm=t` : `https://pixeldrain.com/api/filesystem/${file.path.replace(/^\//, '').split('/').map(encodeURIComponent).join('/')}`;
    const format = /\.mkv$/i.test(file.name) ? 'MKV' : 'MP4';
    const extra = file.extra ? file.ep === '62' ? ' [HB EX - Original Anime Ending]' : ' [HB EX - Movie-length]' : '';
    const provider = file.provider === 'drive' ? 'Google Drive' : 'Pixeldrain';
    const language = file.language === 'Sub' ? 'Japanese audio + English subtitles' : file.language === 'Dub' ? 'English dub' : 'Dual audio + embedded subtitles';
    const note = file.language === 'Sub' ? 'English subtitles are burned into the video; no subtitle switch needed.' : file.language === 'Dual Audio' ? 'Full-quality MKV. Select Japanese audio and the full English subtitle track in your player.' : 'English audio.';
    return [url, { name: `${language} · ${provider} [${file.language} ${format}]${extra}`, title: `${file.name}\n${note}`, description: `${file.name}\n${note}`, url, behaviorHints: { notWebReady: format === 'MKV', filename: file.name, bingeGroup: `bleach-paced-${file.language.replaceAll(' ', '-').toLowerCase()}-${file.provider}${file.extra ? '-ex' : ''}` } }];
  })).values()];
}

function sourceDate(value) {
  const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return undefined;
  return `${match[3].length === 2 ? '20' : ''}${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}T00:00:00.000Z`;
}

export function buildCatalog(sheets, rawFiles) {
  const files = rawFiles.map(identifyFile).filter(Boolean);
  const forEpisode = (row, extra = false) => {
    const matched = files.filter(f => f.project === row.project && f.ep === row.ep && f.extra === extra);
    return matched.filter(f => f.provider !== 'drive' || f.discovered || !matched.some(other => other.provider === 'drive' && other.discovered && other.language === f.language));
  };
  const available = rows => rows.filter(r => forEpisode(r).length);
  const cb = available(sheets.cb).sort((a, b) => a.order - b.order);
  if (!cb.length) throw new Error('No Concentrated Bleach episodes found');
  const hb2 = available(sheets.hb2), hb3 = available(sheets.hb3);
  const seasons = [[], [], [], []];
  for (const row of cb) {
    const bounds = chapterBounds(row.chapters);
    const season = Number(row.ep) <= 9 ? 0 : Number(row.ep) <= 35.5 ? 1 : bounds?.start >= 424 ? 3 : 2;
    if (bounds?.start >= 480) continue; // TYBW is outside this requested four-season catalog.
    seasons[season].push({ ...row, files: [...forEpisode(row), ...forEpisode(row, true)] });
  }
  // The baseline v2 numbering is kept for matching EX files and watch-guide references.
  // Use chapter coverage for v3: v3 21 is v2 22, not v2 21.
  for (const season of [2, 3]) {
    const cbRows = seasons[season];
    const cutoff = Math.max(season === 2 ? 182 : 423, ...cbRows.map(r => chapterBounds(r.chapters)?.end || 0));
    const continuation = hb2.filter(r => !r.ep.startsWith('SP') && (season === 2 ? Number(r.ep) < 51 : Number(r.ep) >= 51))
      .map(r => ({ ...r, bounds: chapterBounds(r.chapters), files: [...forEpisode(r), ...forEpisode(r, true)] }))
      .filter(r => r.bounds && r.bounds.end > cutoff);
    const replacements = hb3.filter(r => !r.ep.startsWith('SP')).map(r => ({ ...r, bounds: chapterBounds(r.chapters), files: [...forEpisode(r), ...forEpisode(r, true)] }))
      .filter(r => r.bounds && r.bounds.end > cutoff && (season === 2 ? r.bounds.start < 424 : r.bounds.start >= 424));
    const merged = [];
    for (const row of [...replacements, ...continuation].sort((a, b) => a.bounds.start - b.bounds.start || (a.project === 'hb3' ? -1 : 1))) {
      if (row.project === 'hb2' && replacements.some(v => v.bounds.start <= row.bounds.start && v.bounds.end >= row.bounds.end)) continue;
      // For resegmented v3 releases, keep partially overlapping v2 material to avoid losing chapters.
      const overlapping = merged.find(v => v.bounds.end > row.bounds.start && v.bounds.end < row.bounds.end && v.project !== row.project);
      if (overlapping) row.notes = `Chapter coverage overlaps the previous episode; no precise skip time has been verified. ${row.notes}`;
      merged.push(row);
    }
    const first = merged[0];
    if (first && cbRows.length && first.bounds.start <= cutoff) {
      first.watchNote = cutoff === 286 && first.project === 'hb2' && first.ep === '22'
        ? '⚠️ Watch Note: Start at 05:28 (picking up right after CB 57). '
        : `⚠️ Watch Note: The previous CB episode ends at chapter ${cutoff}. This episode overlaps it; a precise skip time has not been verified. `;
    }
    seasons[season].push(...merged);
  }
  for (const [after, special, display] of [['45', 'SP01', '45.5'], ['50', 'SP02', '50.5']]) {
    const index = seasons[2].findIndex(r => r.project === 'cb' && r.ep === after);
    const row = [...hb3, ...hb2].find(r => r.ep === special);
    if (index >= 0 && row) seasons[2].splice(index + 1, 0, { ...row, display, files: forEpisode(row) });
    if (after === '50' && index >= 0) seasons[2][index].watchNote = '⚠️ Watch Note: Pause at 16:15, watch Episode 50.5 [HB SP02 - Forest of Menos], then resume CB 50. ';
  }
  const videos = [], responses = {}, episodeMap = [];
  for (let s = 0; s < seasons.length; s++) for (const [i, row] of seasons[s].entries()) {
    const id = `cb_s${String(s + 1).padStart(2, '0')}e${String(i + 1).padStart(2, '0')}`;
    let badge = row.project === 'cb' ? `CB ${row.ep}` : `${row.project === 'hb3' ? 'HB v3' : 'HB'} ${row.ep}`;
    if (row.display) badge = `CB ${row.display} / HB ${row.ep}`;
    let title = row.title;
    if (row.ep === 'SP01') title += ' (Canon Movie 1 Edit)';
    if (row.watchNote?.includes('Start at 05:28')) title += ' (Start at 05:28)';
    const overview = `${row.watchNote || ''}${row.project === 'cb' ? 'Concentrated Bleach by Gabby' : 'Hollowed Bleach by Knight'}. Original episode ${row.ep}${row.ep === '35.5' ? ' (0)' : row.ep === '29.5' ? ' (0.8)' : ''}. Manga chapters: ${row.chapters}. ${row.notes}`.trim();
    const released = sourceDate(row.released);
    videos.push({ id, title: `[${badge}] ${title}`, season: s + 1, episode: i + 1, overview, ...(released ? { released } : {}) });
    const streams = makeStreams(row.files);
    if (!streams.length || !streams.some(s => s.url.startsWith('https://drive.usercontent.google.com/'))) throw new Error(`Episode ${badge} lacks a Drive stream`);
    responses[id] = { streams };
    episodeMap.push({ id, season: s + 1, episode: i + 1, project: row.project, originalEpisode: row.ep, chapters: row.chapters, title: row.title, streamCount: streams.length });
  }
  if (seasons[0].length !== 9 || seasons[1].length !== 28 || seasons[2].length < 24 || seasons[3].length < 1) throw new Error('Incomplete catalog: refusing to replace existing output');
  return { videos, responses, episodeMap, seasonCounts: seasons.map(s => s.length) };
}

async function readJSON(filename, fallback) {
  try { return JSON.parse(await readFile(filename, 'utf8')); } catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}

export async function fetchText(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'bleach-paced-stremio/1.0 public-catalog-builder' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 15_000_000) throw new Error('Response unexpectedly large');
      return body;
    } catch (error) { last = error; if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1))); }
  }
  throw last;
}

export async function collectSources({ offline = false } = {}) {
  const snapshot = await readJSON(path.join(ROOT, 'scripts/source-snapshot.json'), { sheets: {}, files: [] });
  const cached = await readJSON(path.join(ROOT, '.cache/sources.json'), { sheets: {}, files: [] });
  const seed = await readJSON(path.join(ROOT, 'scripts/seed-gdrive-ids.json'));
  const rawSheets = { ...snapshot.sheets, ...cached.sheets }, files = new Map();
  for (const file of [...seedFiles(seed), ...snapshot.files, ...cached.files]) files.set(`${file.provider}:${file.id || file.path}`, file);
  const warnings = [], checks = [];
  async function check(label, job) {
    try { await job(); checks.push({ source: label, status: 'ok' }); }
    catch (error) { const message = `${label}: ${error.message}; retaining saved public source data`; warnings.push(message); checks.push({ source: label, status: 'fallback' }); console.warn(message); }
  }
  if (!offline) {
    await Promise.all(Object.entries(SHEETS).map(([name, id]) => check(`sheet:${name}`, async () => {
      const csv = await fetchText(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`);
      const rows = parseSheet(csv, name);
      if (rows.length < (name === 'cb' ? 59 : 40)) throw new Error('Unexpectedly short episode sheet');
      rawSheets[name] = csv;
    })));
    const visited = new Set();
    async function crawlDrive(group, id, depth = 0) {
      if (visited.has(id) || depth > 4) return;
      visited.add(id);
      let entries;
      try { entries = parseDrive(await fetchText(`https://drive.google.com/embeddedfolderview?id=${id}#list`)); }
      catch { entries = parseDrive(await fetchText(`https://drive.google.com/drive/folders/${id}`)); }
      for (const file of entries) {
        if (VIDEO.test(file.name)) files.set(`drive:${file.id}`, { ...file, group, provider: 'drive', discovered: true });
      }
      await Promise.all(entries.filter(f => f.folder).map(f => check(`drive:${f.id}`, () => crawlDrive(group, f.id, depth + 1))));
    }
    await Promise.all(FOLDERS.map(([group, id]) => check(`drive:${id}`, () => crawlDrive(group, id))));
    async function crawlPixel(group, pathname, depth = 0) {
      if (depth > 5) throw new Error('Pixeldrain folder nesting limit');
      const encoded = pathname.split('/').filter(Boolean).map(encodeURIComponent).join('/');
      const data = JSON.parse(await fetchText(`https://pixeldrain.com/api/filesystem/${encoded}?stat`));
      if (!Array.isArray(data.children)) throw new Error('Invalid Pixeldrain directory response');
      await Promise.all(data.children.map(async file => {
        if (file.type === 'dir') await check(`pixel:${file.path}`, () => crawlPixel(group, file.path, depth + 1));
        else if (VIDEO.test(file.name)) files.set(`pixeldrain:${file.path}`, { name: file.name, path: file.path, group, provider: 'pixeldrain' });
      }));
    }
    await Promise.all(PIXEL.map(([group, id]) => check(`pixel:${id}`, () => crawlPixel(group, id))));
  }
  for (const key of Object.keys(SHEETS)) if (!rawSheets[key]) throw new Error(`Missing ${key} metadata; run an online build first`);
  const data = { sheets: rawSheets, files: [...files.values()].filter(identifyFile), fetchedAt: new Date().toISOString() };
  await mkdir(path.join(ROOT, '.cache'), { recursive: true });
  await writeFile(path.join(ROOT, '.cache/sources.json'), JSON.stringify(data, null, 2) + '\n');
  return { ...data, warnings, checks, offline };
}

export async function build({ offline = false } = {}) {
  const data = await collectSources({ offline });
  const sheets = Object.fromEntries(Object.entries(data.sheets).map(([key, csv]) => [key, parseSheet(csv, key)]));
  const catalog = buildCatalog(sheets, data.files);
  const out = path.join(ROOT, 'dist.next');
  await rm(out, { recursive: true, force: true });
  async function write(relative, value) {
    const filename = path.join(out, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  }
  const summary = { id: SERIES, type: 'series', name: 'Bleach — Concentrated + Hollowed', genres: ['Anime', 'Action', 'Adventure'], description: 'Manga-paced Bleach: Concentrated Bleach by Gabby, followed by Hollowed Bleach by Knight, including the two recommended specials. Japanese audio with English subtitles preferred; dual audio and English dub alternatives. Four arcs in guide order. No API keys.' };
  await write('manifest.json', { id: 'community.bleach.paced.keyless', version: '1.0.1', name: 'Concentrated + Hollowed Bleach', description: summary.description, types: ['series'], idPrefixes: ['cb_'], resources: ['catalog', { name: 'meta', types: ['series'], idPrefixes: ['cb_'] }, { name: 'stream', types: ['series'], idPrefixes: ['cb_'] }], catalogs: [{ type: 'series', id: 'bleach_paced_catalog', name: 'Bleach Paced' }], behaviorHints: { adult: false, p2p: false, configurable: false } });
  await write('catalog/series/bleach_paced_catalog.json', { metas: [summary], cacheMaxAge: 3600 });
  await write(`meta/series/${SERIES}.json`, { meta: { ...summary, videos: catalog.videos }, cacheMaxAge: 3600 });
  for (const [id, response] of Object.entries(catalog.responses)) await write(`stream/series/${id}.json`, { ...response, cacheMaxAge: 300 });
  await write('episode-map.json', catalog.episodeMap);
  await write('build-report.json', { builtAt: data.fetchedAt, offline, seasonCounts: catalog.seasonCounts, episodeCount: catalog.videos.length, sources: data.checks, warnings: data.warnings, note: 'Source discovery is checked; video playback is not guaranteed by metadata generation.' });
  await write('.nojekyll', '');
  const dist = path.join(ROOT, 'dist'), previous = path.join(ROOT, 'dist.previous');
  await rm(previous, { recursive: true, force: true });
  try { await rename(dist, previous); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await rename(out, dist); } catch (error) { try { await rename(previous, dist); } catch {} throw error; }
  await rm(previous, { recursive: true, force: true });
  console.log(`Built ${catalog.videos.length} episodes; seasons ${catalog.seasonCounts.join('/')} (${data.warnings.length} source warnings).`);
  return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({ offline: process.argv.includes('--offline') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
