import { readdir, readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
import { validateEntries, MAX_UNPACKED_BYTES } from './package-rules.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const files = {};
async function walk(directory) {
  for (const name of (await readdir(directory)).sort()) {
    const path = resolve(directory, name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error(`Symlink forbidden: ${path}`);
    if (stat.isDirectory()) await walk(path);
    else if (stat.isFile()) files[relative(dist, path).split('\\').join('/')] = new Uint8Array(await readFile(path));
    else throw new Error(`Unsupported file: ${path}`);
  }
}
await walk(dist);
const entries = Object.entries(files).map(([name, bytes]) => ({ name, size: bytes.length }));
const unpackedBytes = validateEntries(entries);
const zip = zipSync(files, { level: 9 });
const unpacked = unzipSync(zip);
validateEntries(Object.entries(unpacked).map(([name, bytes]) => ({ name, size: bytes.length })));
if (Object.keys(files).length !== Object.keys(unpacked).length) throw new Error('ZIP manifest mismatch');
for (const [name, bytes] of Object.entries(files)) {
  if (!Buffer.from(bytes).equals(Buffer.from(unpacked[name]))) throw new Error(`ZIP verification failed: ${name}`);
}
const output = resolve(root, 'release');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'ninja-climb-yandex.zip'), zip);
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
  createdAt: new Date().toISOString(), archive: 'ninja-climb-yandex.zip',
  sha256: createHash('sha256').update(zip).digest('hex'),
  zipBytes: zip.length, unpackedBytes, limit: MAX_UNPACKED_BYTES, files: entries,
}, null, 2));
console.log(`Yandex ZIP verified: ${entries.length} files, ${(unpackedBytes / 1e6).toFixed(2)} MB unpacked, ${(zip.length / 1e6).toFixed(2)} MB ZIP. index.html is at root.`);
