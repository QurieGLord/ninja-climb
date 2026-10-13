export interface YandexPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}
export interface AdCallbacks {
  onOpen: () => void; onClose: (wasShown?: boolean) => void;
  onError: (error: unknown) => void; onRewarded?: () => void;
}
export interface YandexSDK {
  features: { LoadingAPI?: { ready(): void }; GameplayAPI?: { start(): void; stop(): void } };
  getPlayer(): Promise<YandexPlayer>;
  on(event: 'game_api_pause' | 'game_api_resume', cb: () => void): void;
  off(event: 'game_api_pause' | 'game_api_resume', cb: () => void): void;
  adv: { showRewardedVideo(options: { callbacks: AdCallbacks }): void };
  screen?: { fullscreen: { request(): Promise<void> } };
}
declare global { interface Window { YaGames?: { init(): Promise<YandexSDK> } } }
export interface PlatformAdapter {
  readonly available: boolean;
  readonly cloudAvailable: boolean;
  readonly status: string;
  init(): Promise<void>;
  load(): Promise<unknown>;
  save(data: unknown): Promise<void>;
  ready(): void;
  gameplay(active: boolean): void;
  rewarded(grant: () => void): Promise<'rewarded' | 'closed' | 'error' | 'unavailable'>;
  fullscreen(): void;
}
