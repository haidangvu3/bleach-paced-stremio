import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './build-addon.mjs';
const meta = JSON.parse(await readFile(path.join(ROOT, 'dist/meta/series/cb_bleach_paced.json'), 'utf8')).meta;
const selected = process.argv.includes('--all') ? meta.videos : meta.videos.filter(v => [1, 2, 3, 4].some(s => v.season === s && v.episode === 1) || v.title.includes('HB SP') || v.title.includes('[HB 22]'));
let failures = 0;
for (const video of selected) {
  const { streams } = JSON.parse(await readFile(path.join(ROOT, `dist/stream/series/${video.id}.json`), 'utf8'));
  for (const stream of streams.slice(0, process.argv.includes('--backups') ? undefined : 1)) {
    try {
      const r = await fetch(stream.url, { headers: { Range: 'bytes=0-1023' }, signal: AbortSignal.timeout(20000) });
      const type = r.headers.get('content-type') || '';
      const ok = r.ok && !/html|json|text\//i.test(type);
      await r.body?.cancel();
      console.log(`${ok ? 'OK' : 'FAIL'} ${video.id} ${stream.name}: HTTP ${r.status}, ${type}, ranges=${r.headers.get('accept-ranges') || 'unknown'}`);
      if (!ok) failures++;
    } catch (e) { failures++; console.log(`FAIL ${video.id}: ${e.message}`); }
  }
}
if (failures) { console.error(`${failures} endpoints did not return video; try the backup provider or retry later.`); process.exitCode = 1; }
