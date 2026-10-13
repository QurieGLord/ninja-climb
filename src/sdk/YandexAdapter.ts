import type { PlatformAdapter, YandexPlayer, YandexSDK, AdCallbacks } from './types';
import type { PauseManager } from '../systems/PauseManager';

export function withTimeout<T>(promise: Promise<T>, milliseconds = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SDK timeout')), milliseconds);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

export class YandexAdapter implements PlatformAdapter {
  private sdk?: YandexSDK;
  private player?: YandexPlayer;
  private active = false;
  private adInFlight = false;
  status = 'Локальное сохранение';
  get available() { return !!this.sdk; }
  get cloudAvailable() { return !!this.player; }
  constructor(private pause: PauseManager, private local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !new URLSearchParams(location.search).has('yandex')) {}

  async init() {
    if (this.local && !window.YaGames) return;
    try {
      if (!window.YaGames) await withTimeout(new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/sdk.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => { script.remove(); reject(new Error('SDK load failed')); };
        document.head.append(script);
      }));
      if (!window.YaGames) throw new Error('SDK not available');
      this.sdk = await withTimeout(window.YaGames.init());
      this.sdk.on('game_api_pause', () => this.pause.set('sdk', true));
      this.sdk.on('game_api_resume', () => this.pause.set('sdk', false));
      try { this.player = await withTimeout(this.sdk.getPlayer()); }
      catch { this.status = 'Облако недоступно · прогресс на устройстве'; }
      if (this.player) this.status = 'Облако подключено';
    } catch { this.status = 'SDK недоступен · прогресс на устройстве'; }
  }
  async load() {
    if (!this.player) return null;
    return (await withTimeout(this.player.getData(['ninjaClimb']))).ninjaClimb;
  }
  async save(data: unknown) {
    if (!this.player) return;
    await withTimeout(this.player.setData({ ninjaClimb: data }, true));
  }
  ready() { this.sdk?.features.LoadingAPI?.ready(); }
  gameplay(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    if (active) this.sdk?.features.GameplayAPI?.start(); else this.sdk?.features.GameplayAPI?.stop();
  }
  fullscreen() {
    if (matchMedia('(pointer: coarse)').matches) void this.sdk?.screen?.fullscreen.request().catch(() => {});
  }
  async rewarded(grant: () => void): Promise<'rewarded' | 'closed' | 'error' | 'unavailable'> {
    if (!this.sdk || this.adInFlight) return 'unavailable';
    this.adInFlight = true;
    this.pause.set('ad', true);
    return new Promise(resolve => {
      let settled = false, rewarded = false, opened = false;
      const finish = (result: 'rewarded' | 'closed' | 'error') => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.adInFlight = false;
        this.pause.set('ad', false);
        resolve(result);
      };
      // Recover a request with no callbacks; never resume beneath an opened ad.
      const timer = setTimeout(() => { if (!opened) finish('error'); }, 12000);
      const callbacks: AdCallbacks = {
        onOpen: () => { if (!settled) { opened = true; clearTimeout(timer); } },
        onRewarded: () => {
          if (!settled && !rewarded) { rewarded = true; grant(); }
        },
        onClose: () => finish(rewarded ? 'rewarded' : 'closed'),
        onError: () => finish(rewarded ? 'rewarded' : 'error'),
      };
      try { this.sdk!.adv.showRewardedVideo({ callbacks }); } catch { finish('error'); }
    });
  }
}
