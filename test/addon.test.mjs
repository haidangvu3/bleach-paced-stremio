import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog, parseSheet, parseDrive, chapterBounds, makeStreams, identifyFile } from '../scripts/build-addon.mjs';
const snapshot = JSON.parse(await readFile(new URL('../scripts/source-snapshot.json', import.meta.url), 'utf8'));
const sheets = () => Object.fromEntries(Object.entries(snapshot.sheets).map(([key, csv]) => [key, parseSheet(csv, key)]));

test('the complete watch guide preserves all specials, flashbacks, and EX streams', () => {
  const catalog = buildCatalog(sheets(), snapshot.files);
  assert.deepEqual(catalog.seasonCounts, [9, 28, 54, 12]);
  const episode = (s, e) => catalog.videos.find(v => v.season === s && v.episode === e);
  assert.match(episode(2, 19).title, /CB 27\.5/);
  assert.match(episode(2, 28).title, /CB 35\.5/);
  assert.match(episode(3, 11).title, /CB 45\.5 \/ HB SP01/);
  assert.match(episode(3, 16).overview, /Pause at 16:15/);
  assert.match(episode(3, 17).title, /HB SP02/);
  assert.match(episode(3, 25).title, /HB 22.*Start at 05:28/);
  assert.match(episode(3, 33).title, /HB 29\.5/);
  for (const ep of ['27', '62']) {
    const row = catalog.episodeMap.find(r => r.project === 'hb2' && r.originalEpisode === ep);
    assert(catalog.responses[row.id].streams.some(s => /HB EX/.test(s.name)));
  }
});

test('a released CB 58 replaces HB 22 and removes its obsolete timestamp', () => {
  const catalog = buildCatalog(sheets(), [...snapshot.files, { provider: 'drive', group: 'cb', id: 'example_new_cb58', name: '58 - The Bad Joke.mkv', discovered: true }]);
  assert(catalog.videos.some(v => /CB 58/.test(v.title)));
  assert(!catalog.videos.some(v => /\[HB 22\]/.test(v.title)));
  assert(!catalog.videos.some(v => /Start at 05:28/.test(v.overview)));
  assert(catalog.videos.some(v => /HB 27\]/.test(v.title)));
});

test('v3 numbering is matched by coverage: v3 21 replaces v2 22', () => {
  const catalog = buildCatalog(sheets(), [...snapshot.files, { provider: 'drive', group: 'hb3', id: 'example_new_hb_v3_21', name: 'Hollowed Bleach v3 21 - THE BAD JOKE.mkv', discovered: true }]);
  assert(catalog.videos.some(v => /HB v3 21/.test(v.title)));
  assert(!catalog.videos.some(v => /\[HB 22\]/.test(v.title)));
  const first = catalog.videos.find(v => /HB v3 21/.test(v.title));
  assert(!first.overview.includes('05:28'));
  assert.match(first.overview, /precise skip time has not been verified/);
});

test('negative chapter numbers retain narrative order and ordinary ranges parse correctly', () => {
  assert.deepEqual(chapterBounds('279-286'), { start: 279, end: 286 });
  assert.deepEqual(chapterBounds('264-265, 270-272'), { start: 264, end: 272 });
  assert.deepEqual(chapterBounds('-108 to -104'), { start: 315.01, end: 315.05 });
  assert.deepEqual(chapterBounds('0.8'), { start: 315.5, end: 315.5 });
  assert.equal(chapterBounds('N/A'), null);
});

test('folder HTML decodes entities, finds nested folders, and rejects login pages', () => {
  const result = parseDrive('<div class="flip-entry" id="entry-example_video_id"><a href="/file/d/example_video_id/view"><div class="flip-entry-title">A &amp; B.mkv</div></a></div><div class="flip-entry" id="entry-example_folder_id"><a href="/drive/folders/example_folder_id"><div class="flip-entry-title">More</div></a></div>');
  assert.equal(result[0].name, 'A & B.mkv');
  assert.equal(result[1].folder, true);
  assert.throws(() => parseDrive('<html>Please sign in</html>'));
  assert.throws(() => parseSheet('<html>Sign in</html>', 'cb'));
});

test('streams encode nested paths and keep all Drive variants before backups', () => {
  const files = [
    { provider: 'pixeldrain', group: 'hb2-sub', name: 'Hollowed Bleach 22 - A & B (sub).mp4', path: '/publicdir/Arc #1/A & B.mp4' },
    { provider: 'drive', group: 'hb2-dub', name: 'Hollowed Bleach 22 - A (dub).mp4', id: 'public_drive_id_dub' },
    { provider: 'drive', group: 'hb2-sub', name: 'Hollowed Bleach 22 - A (sub).mp4', id: 'public_drive_id_sub' },
  ].map(identifyFile);
  const streams = makeStreams(files);
  assert.match(streams[0].name, /Google Drive \[Sub MP4\]/);
  assert.match(streams[1].name, /Google Drive \[Dub MP4\]/);
  assert.match(streams[2].url, /Arc%20%231\/A%20%26%20B.mp4/);
});

test('CB comparison clips cannot be mistaken for full episode streams', () => {
  assert.equal(identifyFile({ provider: 'drive', group: 'cb', id: 'example_comparison_id', name: '01 - remove filler references.mp4' }), null);
});
