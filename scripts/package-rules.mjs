export const MAX_UNPACKED_BYTES = 100_000_000;
const allowed = /^(index\.html|favicon\.svg|assets\/[A-Za-z0-9_./-]+\.(js|css|svg|png|webp|jpg|jpeg|ogg|mp3|woff2))$/;
export function validateEntries(entries) {
  if (!entries.some(entry => entry.name === 'index.html')) throw new Error('index.html must be at ZIP root');
  let size = 0;
  const names = new Set();
  for (const entry of entries) {
    const { name } = entry;
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.startsWith('/') || name.split('/').some(part => part === '..' || !part)) throw new Error(`Invalid file name: ${name}`);
    const atlasMetadata=/^assets\/(characters\/(ember|jade|moon)|enemies\/(sentinel|moth|oni))\.json$/.test(name);
    if (name.startsWith('dist/') || (!allowed.test(name)&&!atlasMetadata)) throw new Error(`Unexpected release file: ${name}`);
    if (names.has(name)) throw new Error(`Duplicate file: ${name}`);
    names.add(name);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error(`Invalid size: ${name}`);
    size += entry.size;
  }
  if (size > MAX_UNPACKED_BYTES) throw new Error(`Unpacked size ${size} exceeds ${MAX_UNPACKED_BYTES}`);
  return size;
}
