import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './build-addon.mjs';
const json = async p => JSON.parse(await readFile(path.join(ROOT, 'dist', p), 'utf8'));
const manifest = await json('manifest.json');
if (manifest.idPrefixes.join() !== 'cb_') throw new Error('Unexpected ID prefix');
const { meta } = await json('meta/series/cb_bleach_paced.json');
const ids = new Set();
for (const video of meta.videos) {
  if (!/^cb_s\d{2}e\d{2,}$/.test(video.id) || ids.has(video.id)) throw new Error('Invalid or duplicate video ID');
  ids.add(video.id);
  const { streams } = await json(`stream/series/${video.id}.json`);
  if (!streams.length || !streams[0].url.startsWith('https://drive.usercontent.google.com/')) throw new Error(`No primary stream: ${video.id}`);
  let backup = false;
  for (const stream of streams) {
    const url = new URL(stream.url);
    if (url.hostname === 'pixeldrain.com') backup = true;
    else if (backup) throw new Error('Drive stream follows a backup');
    if (url.hostname === 'drive.usercontent.google.com' && (url.searchParams.get('confirm') !== 't' || url.searchParams.has('key'))) throw new Error('Incorrect keyless Drive URL');
    if (/key=|token=|authorization=/i.test(url.search)) throw new Error('Credential in generated URL');
  }
}
const files = await readdir(path.join(ROOT, 'dist/stream/series'));
if (files.length !== ids.size || files.some(name => /[<>:"|?*]/.test(name))) throw new Error('Unexpected static filenames');
console.log(`Verified ${ids.size} episodes, stream ordering, keyless URLs, and static paths.`);
