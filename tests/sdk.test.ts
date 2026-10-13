import { afterEach, describe, expect, it, vi } from 'vitest';
import { PauseManager } from '../src/systems/PauseManager';
import { YandexAdapter } from '../src/sdk/YandexAdapter';
import type { AdCallbacks, YandexSDK } from '../src/sdk/types';

async function setup(show?: (options: { callbacks: AdCallbacks }) => void) {
  let callbacks: AdCallbacks;
  const events: Record<string, () => void> = {};
  const sdk: YandexSDK = {
    features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
    getPlayer: async () => ({ getData: async () => ({ ninjaClimb: { value: 1 } }), setData: vi.fn().mockResolvedValue(undefined) }),
    on: (event, cb) => { events[event] = cb; }, off: () => {},
    adv: { showRewardedVideo: show ?? (options => { callbacks = options.callbacks; }) },
  };
  vi.stubGlobal('window', { YaGames: { init: async () => sdk } });
  const pause = new PauseManager(), adapter = new YandexAdapter(pause, false);
  await adapter.init();
  return { adapter, pause, sdk, events, callbacks: () => callbacks! };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('SDK and independent pause reasons', () => {
  it('only resumes when every pause reason has been released', () => {
    const p = new PauseManager(), listener = vi.fn(); p.subscribe(listener);
    p.set('manual', true); p.set('ad', true); p.set('ad', false); expect(p.paused).toBe(true);
    p.set('manual', false); expect(p.paused).toBe(false);
    expect(listener.mock.calls.map(call => call[0])).toEqual([true, true, true, false]);
  });
  it('handles platform events and emits gameplay markup without duplicate calls', async () => {
    const { adapter, events, pause, sdk } = await setup();
    events.game_api_pause!(); expect(pause.paused).toBe(true); events.game_api_resume!(); expect(pause.paused).toBe(false);
    adapter.ready(); adapter.gameplay(true); adapter.gameplay(true); adapter.gameplay(false);
    expect(sdk.features.LoadingAPI!.ready).toHaveBeenCalledOnce(); expect(sdk.features.GameplayAPI!.start).toHaveBeenCalledOnce();
    expect(await adapter.load()).toEqual({ value: 1 });
  });
  it('never grants a fake reward when SDK is unavailable', async () => {
    vi.stubGlobal('window', {});
    const adapter = new YandexAdapter(new PauseManager(), true), grant = vi.fn(); await adapter.init();
    expect(await adapter.rewarded(grant)).toBe('unavailable'); expect(grant).not.toHaveBeenCalled();
  });
  it('grants only onRewarded, only once, and stays paused until onClose', async () => {
    const { adapter, pause, callbacks } = await setup(); const grant = vi.fn();
    const request = adapter.rewarded(grant); callbacks().onOpen();
    expect(pause.paused).toBe(true); expect(grant).not.toHaveBeenCalled();
    callbacks().onRewarded!(); callbacks().onRewarded!(); expect(grant).toHaveBeenCalledOnce(); expect(pause.paused).toBe(true);
    callbacks().onClose(); expect(await request).toBe('rewarded'); expect(pause.paused).toBe(false);
  });
  it('handles closed-without-reward, SDK errors, and synchronous exceptions', async () => {
    const { adapter, pause, callbacks } = await setup(); const grant = vi.fn();
    let result = adapter.rewarded(grant); callbacks().onClose(false); expect(await result).toBe('closed');
    pause.set('manual', true); result = adapter.rewarded(grant); callbacks().onError(Error());
    expect(await result).toBe('error'); expect(pause.paused).toBe(true); expect(grant).not.toHaveBeenCalled();
    const thrown = await setup(() => { throw Error(); });
    expect(await thrown.adapter.rewarded(grant)).toBe('error'); expect(thrown.pause.paused).toBe(false);
  });
  it('recovers a silent request and ignores late callbacks', async () => {
    vi.useFakeTimers(); const { adapter, pause, callbacks } = await setup(); const grant = vi.fn();
    const result = adapter.rewarded(grant); await vi.advanceTimersByTimeAsync(12000);
    expect(await result).toBe('error'); callbacks().onRewarded!(); expect(grant).not.toHaveBeenCalled(); expect(pause.paused).toBe(false);
  });
  it('keeps an open long ad paused and prevents concurrent requests', async () => {
    vi.useFakeTimers(); const { adapter, pause, callbacks } = await setup(); const grant = vi.fn();
    const request = adapter.rewarded(grant); callbacks().onOpen(); await vi.advanceTimersByTimeAsync(60000);
    expect(pause.paused).toBe(true); expect(await adapter.rewarded(grant)).toBe('unavailable'); callbacks().onClose(); await request;
  });
});
