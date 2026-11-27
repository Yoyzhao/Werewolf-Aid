import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('../', import.meta.url));
const distDir = join(appDir, 'dist');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = (await walk(distDir))
  .map((file) => relative(distDir, file).split(sep).join('/'))
  .filter(
    (file) =>
      !file.endsWith('.map') && file !== 'sw.js' && file !== 'precache.js' && file !== 'index.html',
  )
  .sort();

const assets = ['/', '/index.html', ...files.map((file) => `/${file}`)];
const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);

await writeFile(
  join(distDir, 'precache.js'),
  `self.__PRECACHE_VERSION__ = ${JSON.stringify(version)};\n` +
    `self.__PRECACHE_ASSETS__ = ${JSON.stringify(assets)};\n`,
);

const template = await readFile(join(appDir, 'public', 'sw.js'), 'utf8');
await writeFile(join(distDir, 'sw.js'), `${template}\n// lrs-sw-version: ${version}\n`);

console.log(`PWA precache: ${assets.length} assets, version ${version}`);
