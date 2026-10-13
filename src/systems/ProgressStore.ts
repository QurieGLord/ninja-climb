import { SKINS, type SkinId } from '../data/config';
import type { RunSnapshot } from '../game/RunModel';
import type { PlatformAdapter } from '../sdk/types';

export const SAVE_KEY = 'ninja-climb.progress.v1';
export interface Progress {
  version: 1; updatedAt: number; revision: number;
  coins: number; bestHeight: number; bestScore: number; totalRuns: number;
  ownedSkins: SkinId[]; selectedSkin: SkinId; sound: boolean;
  activeRun: RunSnapshot | null;
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const freshProgress = (): Progress => ({
  version: 1, updatedAt: 0, revision: 0, coins: 0, bestHeight: 0, bestScore: 0, totalRuns: 0,
  ownedSkins: ['ember'], selectedSkin: 'ember', sound: true, activeRun: null,
});
const integer = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1e9, Math.floor(n))) : 0;
const skinExists = (id: unknown): id is SkinId => SKINS.some(s => s.id === id);

// Reject malformed checkpoints instead of booting into an invalid simulation.
export function validRun(value: unknown): value is RunSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as RunSnapshot;
  const nums = [s.seed, s.nextId, s.elapsed, s.cameraY, s.topY, s.generated, s.nextBoss, s.height, s.score, s.earned, s.kills, s.combo, s.bestCombo, s.comboLeft, s.attackLeft, s.cooldown];
  if (!nums.every(Number.isFinite) || typeof s.id !== 'string' || typeof s.ended !== 'boolean' || s.ended || !s.player) return false;
  if (![s.player.x, s.player.y, s.player.vx, s.player.vy, s.player.facing, s.player.invincible].every(Number.isFinite)) return false;
  return Array.isArray(s.platforms) && s.platforms.length < 80 && s.platforms.every(p => p && ['stone', 'cloud', 'fragile'].includes(p.kind) && [p.id, p.x, p.y, p.baseX].every(Number.isFinite))
    && Array.isArray(s.enemies) && s.enemies.length < 80 && s.enemies.every(e => e && ['wisp', 'oni'].includes(e.kind) && [e.id, e.x, e.y, e.baseX, e.hp, e.hitAt].every(Number.isFinite))
    && Array.isArray(s.coins) && s.coins.length < 80 && s.coins.every(c => c && [c.id, c.x, c.y].every(Number.isFinite));
}

export function normalizeProgress(value: unknown): Progress {
  const defaults = freshProgress();
  if (!value || typeof value !== 'object') return defaults;
  const raw = value as Partial<Progress>;
  if (raw.version !== 1) return defaults;
  const owned = [...new Set(['ember' as SkinId, ...(Array.isArray(raw.ownedSkins) ? raw.ownedSkins.filter(skinExists) : [])])];
  return {
    ...defaults, updatedAt: integer(raw.updatedAt), revision: integer(raw.revision),
    coins: integer(raw.coins), bestHeight: integer(raw.bestHeight), bestScore: integer(raw.bestScore), totalRuns: integer(raw.totalRuns),
    // Timestamps exceed the counters' cap.
    ...(typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? { updatedAt: Math.max(0, raw.updatedAt) } : {}),
    ownedSkins: owned, selectedSkin: skinExists(raw.selectedSkin) && owned.includes(raw.selectedSkin) ? raw.selectedSkin : 'ember',
    sound: typeof raw.sound === 'boolean' ? raw.sound : true,
    activeRun: validRun(raw.activeRun) ? structuredClone(raw.activeRun) : null,
  };
}
export function mergeProgress(local: Progress, cloud: Progress): Progress {
  // Use one complete wallet transaction history; max(balance) would undo purchases.
  const latest = local.updatedAt >= cloud.updatedAt ? local : cloud;
  return normalizeProgress({ ...latest,
    bestHeight: Math.max(local.bestHeight, cloud.bestHeight), bestScore: Math.max(local.bestScore, cloud.bestScore),
    ownedSkins: [...new Set([...local.ownedSkins, ...cloud.ownedSkins])],
    totalRuns: Math.max(local.totalRuns, cloud.totalRuns),
  });
}

export class ProgressStore {
  data: Progress;
  status = 'Прогресс на устройстве';
  private listeners = new Set<() => void>();
  private dirty = false;
  private inFlight = false;
  private timer?: ReturnType<typeof setTimeout>;
  private lastSync = 0;
  constructor(private storage: StorageLike, private platform: PlatformAdapter) {
    try { this.data = normalizeProgress(JSON.parse(storage.getItem(SAVE_KEY) ?? 'null')); }
    catch { this.data = freshProgress(); }
  }
  async loadCloud() {
    try {
      const cloud = await this.platform.load();
      if (cloud) this.data = mergeProgress(this.data, normalizeProgress(cloud));
      this.persist(false);
    } catch { this.status = 'Облако недоступно · сохранено на устройстве'; }
  }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private persist(changed = true) {
    if (changed) { this.data.revision++; this.data.updatedAt = Date.now(); }
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.status = this.platform.cloudAvailable ? 'Сохранено на устройстве · синхронизация…' : this.platform.status;
    }
    catch { this.status = 'Хранилище устройства недоступно'; }
    this.dirty = true;
    this.listeners.forEach(fn => fn());
    this.scheduleCloud();
  }
  private scheduleCloud() {
    if (!this.platform.cloudAvailable || this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.flushCloud(); }, Math.max(5000, 5000 - (Date.now() - this.lastSync)));
  }
  async flushCloud() {
    if (!this.platform.cloudAvailable || !this.dirty || this.inFlight) return;
    if (Date.now() - this.lastSync < 5000) { this.scheduleCloud(); return; }
    this.inFlight = true;
    this.lastSync = Date.now();
    const revision = this.data.revision;
    try {
      await this.platform.save(structuredClone(this.data));
      if (this.data.revision === revision) this.dirty = false;
      this.status = this.dirty ? 'Сохранено на устройстве · синхронизация…' : 'Прогресс синхронизирован';
    } catch { this.status = 'Облако недоступно · сохранено на устройстве'; }
    finally {
      this.inFlight = false;
      this.listeners.forEach(fn => fn());
      if (this.dirty) this.scheduleCloud();
    }
  }
  beginRun(snapshot: RunSnapshot) { this.data.activeRun = snapshot; this.data.totalRuns++; this.persist(); }
  checkpoint(snapshot: RunSnapshot, coins = 0) {
    this.data.activeRun = snapshot.ended ? null : snapshot;
    this.data.coins += Math.max(0, Math.floor(coins));
    this.data.bestHeight = Math.max(this.data.bestHeight, snapshot.height);
    this.data.bestScore = Math.max(this.data.bestScore, snapshot.height * 10 + snapshot.score);
    this.persist();
  }
  addCoins(amount: number) { this.data.coins += Math.max(0, Math.floor(amount)); this.persist(); }
  selectSkin(id: SkinId): boolean {
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return false;
    if (!this.data.ownedSkins.includes(id)) {
      if (this.data.coins < skin.price) return false;
      this.data.coins -= skin.price;
      this.data.ownedSkins.push(id);
    }
    this.data.selectedSkin = id;
    this.persist();
    return true;
  }
  toggleSound() { this.data.sound = !this.data.sound; this.persist(); }
}
