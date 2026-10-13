import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressStore, SAVE_KEY, freshProgress, normalizeProgress, mergeProgress } from '../src/systems/ProgressStore';
import { RunModel, IDLE_INPUT } from '../src/game/RunModel';
import type { PlatformAdapter } from '../src/sdk/types';
const platform = (): PlatformAdapter => ({ available: false, cloudAvailable: false, status: 'local', init: async () => {}, load: async () => null, save: async () => {}, ready: () => {}, gameplay: () => {}, rewarded: async () => 'unavailable', fullscreen: () => {} });
const memory = () => { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } }; };

describe('persistent economy', () => {
  it('commits coins with the consumed entities so reload cannot collect the same coin again', () => {
    const storage = memory(), store = new ProgressStore(storage, platform()), run = new RunModel(undefined, 42);
    store.beginRun(run.snapshot());
    run.state.coins = [{ id: 99, x: 240, y: run.state.player.y }];
    run.step(1 / 120, IDLE_INPUT);
    store.checkpoint(run.snapshot(), 1);
    const reloaded = new ProgressStore(storage, platform());
    expect(reloaded.data.coins).toBe(1);
    expect(reloaded.data.activeRun!.coins.find(c => c.id === 99)).toBeUndefined();
    store.checkpoint(run.snapshot()); expect(store.data.coins).toBe(1);
  });
  it('purchases a skin once, persists selection, and refuses insufficient funds', () => {
    const storage = memory(), store = new ProgressStore(storage, platform());
    expect(store.selectSkin('jade')).toBe(false);
    store.addCoins(100); expect(store.selectSkin('jade')).toBe(true); expect(store.data.coins).toBe(20);
    store.selectSkin('ember'); store.selectSkin('jade'); expect(store.data.coins).toBe(20);
    const restored = new ProgressStore(storage, platform());
    expect(restored.data.selectedSkin).toBe('jade'); expect(restored.data.ownedSkins).toContain('jade');
  });
  it('records height and score during a run and clears finished checkpoints', () => {
    const store = new ProgressStore(memory(), platform()), run = new RunModel();
    run.state.height = 250; run.state.score = 400;
    store.checkpoint(run.snapshot(), 3);
    expect(store.data.bestHeight).toBe(250); expect(store.data.bestScore).toBe(2900);
    run.state.ended = true; store.checkpoint(run.snapshot());
    expect(store.data.activeRun).toBeNull(); expect(store.data.coins).toBe(3);
  });
  it('recovers corrupted saves and handles blocked storage without crashing', () => {
    const storage = memory(); storage.setItem(SAVE_KEY, '{broken');
    expect(new ProgressStore(storage, platform()).data).toEqual(freshProgress());
    const store = new ProgressStore({ getItem: () => { throw Error(); }, setItem: () => { throw Error(); } }, platform());
    expect(() => store.addCoins(5)).not.toThrow(); expect(store.data.coins).toBe(5);
    expect(store.status).toContain('недоступно');
  });
  it('validates malformed currency, unknown skins, and invalid simulation checkpoints', () => {
    const p = normalizeProgress({ ...freshProgress(), coins: -50, bestHeight: Infinity, selectedSkin: 'jade', ownedSkins: ['hacked'], activeRun: { id: 'broken' } });
    expect(p.coins).toBe(0); expect(p.bestHeight).toBe(0); expect(p.selectedSkin).toBe('ember'); expect(p.activeRun).toBeNull();
  });
  it('merges records but keeps the newest complete wallet instead of undoing a purchase', () => {
    const local = { ...freshProgress(), updatedAt: 200, coins: 20, bestHeight: 100, ownedSkins: ['ember', 'jade'] as const };
    const cloud = { ...freshProgress(), updatedAt: 100, coins: 100, bestHeight: 200 };
    const merged = mergeProgress({ ...local, ownedSkins: [...local.ownedSkins] }, cloud);
    expect(merged.coins).toBe(20); expect(merged.bestHeight).toBe(200); expect(merged.ownedSkins).toContain('jade');
  });
});
describe('cloud persistence', () => {
  beforeEach(() => vi.useRealTimers());
  it('retains local progress on read failure', async () => {
    const adapter = platform(); adapter.load = async () => { throw Error('offline'); };
    const store = new ProgressStore(memory(), adapter); store.addCoins(7); await store.loadCloud();
    expect(store.data.coins).toBe(7);
  });
  it('coalesces frequent updates and retries failures without exceeding rate limits', async () => {
    vi.useFakeTimers();
    const adapter = platform(); Object.defineProperty(adapter, 'cloudAvailable', { value: true });
    adapter.save = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined);
    const store = new ProgressStore(memory(), adapter);
    for (let i = 0; i < 30; i++) store.addCoins(1);
    await vi.advanceTimersByTimeAsync(5000); expect(adapter.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000); expect(adapter.save).toHaveBeenCalledTimes(2);
    expect(store.data.coins).toBe(30);
    vi.useRealTimers();
  });
});
