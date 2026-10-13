import { describe, expect, it } from 'vitest';
import { validateEntries, MAX_UNPACKED_BYTES } from '../scripts/package-rules.mjs';
const index = { name: 'index.html', size: 100 };
describe('Yandex release archive', () => {
  it('requires index.html at root and refuses an enclosing dist directory', () => {
    expect(() => validateEntries([{ name: 'dist/index.html', size: 100 }])).toThrow();
    expect(() => validateEntries([index, { name: 'dist/assets/game.js', size: 10 }])).toThrow();
  });
  it.each(['assets/игра.png', 'assets/my file.png', '../game.js', '/index.html', 'assets/../game.js', 'assets//game.js', 'assets\\game.js', 'src/main.ts', 'assets/game.js.map', 'tests/rules.js', 'Artworks/reference.jpeg'])('rejects invalid or non-runtime entry %s', name => {
    expect(() => validateEntries([index, { name, size: 10 }])).toThrow();
  });
  it('verifies unpacked rather than compressed size', () => {
    expect(() => validateEntries([index, { name: 'assets/game.js', size: MAX_UNPACKED_BYTES }])).toThrow();
    expect(validateEntries([index, { name: 'assets/game-12A.js', size: 1000 }])).toBe(1100);
  });
  it('rejects duplicate names and invalid sizes', () => {
    expect(() => validateEntries([index, index])).toThrow();
    expect(() => validateEntries([{ ...index, size: -1 }])).toThrow();
  });
  it('allows only the runtime actor metadata JSON, never arbitrary reports or debug data',()=>{
    expect(validateEntries([index,{name:'assets/characters/jade.json',size:100}])).toBe(200);
    expect(()=>validateEntries([index,{name:'assets/debug.json',size:100}])).toThrow();
    expect(()=>validateEntries([index,{name:'assets/characters/prompts.json',size:100}])).toThrow();
  });
});
