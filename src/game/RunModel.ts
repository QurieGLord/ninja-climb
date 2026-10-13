import { ENEMY_TYPES, PLATFORM_TYPES, RULES, VIEW, zoneAt, type EnemyKind, type PlatformKind } from '../data/config';

export interface Platform { id: number; x: number; y: number; kind: PlatformKind; baseX: number; broken: boolean }
export interface Enemy { id: number; x: number; y: number; baseX: number; kind: EnemyKind; hp: number; hitAt: number }
export interface Coin { id: number; x: number; y: number }
export interface RunSnapshot {
  id: string; seed: number; nextId: number; elapsed: number;
  player: { x: number; y: number; vx: number; vy: number; facing: number; invincible: number };
  platforms: Platform[]; enemies: Enemy[]; coins: Coin[];
  cameraY: number; topY: number; generated: number; nextBoss: number;
  height: number; score: number; earned: number; kills: number; combo: number; bestCombo: number;
  comboLeft: number; attackLeft: number; cooldown: number; ended: boolean; cause: string;
}
export type RunEvent =
  | { type: 'jump' | 'attack' | 'hurt' | 'end'; x: number; y: number }
  | { type: 'coin' | 'kill' | 'boss'; x: number; y: number; amount: number; combo?: number };
export interface Controls { direction: number; targetX: number | null; attack: boolean }

export function landsOn(previousBottom: number, bottom: number, x: number, platform: Platform): boolean {
  return !platform.broken && previousBottom <= platform.y && bottom >= platform.y
    && Math.abs(x - platform.x) <= PLATFORM_TYPES[platform.kind].width / 2 + RULES.playerRadius - 3;
}

export class RunModel {
  state: RunSnapshot;
  events: RunEvent[] = [];

  constructor(snapshot?: RunSnapshot, seed = Date.now() >>> 0) {
    this.state = snapshot ? structuredClone(snapshot) : {
      id: `${Date.now().toString(36)}-${seed.toString(36)}`, seed, nextId: 1, elapsed: 0,
      player: { x: 240, y: 682, vx: 0, vy: -RULES.jumpSpeed, facing: 1, invincible: 1 },
      platforms: [{ id: 0, x: 240, y: 710, baseX: 240, kind: 'stone', broken: false }],
      enemies: [], coins: [], cameraY: 0, topY: 710, generated: 0, nextBoss: 420,
      height: 0, score: 0, earned: 0, kills: 0, combo: 0, bestCombo: 0,
      comboLeft: 0, attackLeft: 0, cooldown: 0, ended: false, cause: '',
    };
    this.generate();
  }

  private random(): number {
    this.state.seed = (Math.imul(this.state.seed, 1664525) + 1013904223) >>> 0;
    return this.state.seed / 4294967296;
  }

  private generate() {
    const s = this.state;
    while (s.topY > s.cameraY - 380) {
      const height = Math.max(0, (710 - s.topY) * RULES.heightScale);
      const zone = zoneAt(height);
      const last = s.platforms.at(-1)!;
      const gap = s.generated < 5 ? 104 : zone.gap + this.random() * 12;
      s.topY -= gap;
      s.generated++;
      const scripted = [290, 170, 310, 210, 130];
      const x = scripted[s.generated - 1] ?? Math.max(78, Math.min(402, last.baseX + (this.random() > 0.5 ? 1 : -1) * (65 + this.random() * 80)));
      const roll = this.random();
      const kind: PlatformKind = s.generated < 6 ? 'stone' : roll < 0.16 ? 'fragile' : roll < 0.33 ? 'cloud' : 'stone';
      s.platforms.push({ id: s.nextId++, x, baseX: x, y: s.topY, kind, broken: false });
      if (s.generated % 2 === 1) s.coins.push({ id: s.nextId++, x, y: s.topY - 42 });
      if (s.generated % zone.enemyEvery === 0) {
        s.enemies.push({ id: s.nextId++, x, baseX: x, y: s.topY - 57, kind: 'wisp', hp: ENEMY_TYPES.wisp.health, hitAt: -10 });
        // A second mask above the first makes an attainable air-combo route.
        const chainX = Math.max(65, Math.min(415, x + (s.generated % 2 === 0 ? 55 : -55)));
        s.enemies.push({ id: s.nextId++, x: chainX, baseX: chainX, y: s.topY - 57 - RULES.chainGap, kind: 'wisp', hp: ENEMY_TYPES.wisp.health, hitAt: -10 });
      }
      if (height >= s.nextBoss) {
        s.enemies.push({ id: s.nextId++, x: 240, baseX: 240, y: s.topY - 62, kind: 'oni', hp: ENEMY_TYPES.oni.health, hitAt: -10 });
        s.nextBoss += 420;
      }
    }
  }

  step(dt: number, controls: Controls) {
    const s = this.state;
    if (s.ended) return;
    // Fixed steps are supplied by the scene; cap defensively for callers.
    dt = Math.min(dt, 1 / 30);
    s.elapsed += dt;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.attackLeft = Math.max(0, s.attackLeft - dt);
    s.comboLeft = Math.max(0, s.comboLeft - dt);
    s.player.invincible = Math.max(0, s.player.invincible - dt);
    if (s.comboLeft === 0) s.combo = 0;
    let direction = Math.max(-1, Math.min(1, controls.direction));
    if (controls.targetX !== null && direction === 0) direction = Math.max(-1, Math.min(1, (controls.targetX - s.player.x) / 35));
    s.player.vx = direction * RULES.moveSpeed;
    if (direction !== 0) s.player.facing = Math.sign(direction);
    if (controls.attack && s.cooldown === 0) {
      s.attackLeft = RULES.attackDuration;
      s.cooldown = RULES.attackCooldown;
      this.events.push({ type: 'attack', x: s.player.x, y: s.player.y });
    }
    const previousBottom = s.player.y + RULES.playerHalfHeight;
    s.player.vy += RULES.gravity * dt;
    s.player.x = Math.max(22, Math.min(VIEW.width - 22, s.player.x + s.player.vx * dt));
    s.player.y += s.player.vy * dt;
    for (const platform of s.platforms) {
      if (PLATFORM_TYPES[platform.kind].moves) platform.x = platform.baseX + Math.sin(s.elapsed * 1.2 + platform.id) * 28;
    }
    // Choose the first crossed surface, independent of generation/array order.
    if (s.player.vy >= 0) {
      const landing = s.platforms.filter(p => landsOn(previousBottom, s.player.y + RULES.playerHalfHeight, s.player.x, p)).sort((a, b) => a.y - b.y)[0];
      if (landing) {
        s.player.y = landing.y - RULES.playerHalfHeight;
        s.player.vy = -RULES.jumpSpeed;
        s.combo = 0;
        s.comboLeft = 0;
        if (PLATFORM_TYPES[landing.kind].fragile) landing.broken = true;
        this.events.push({ type: 'jump', x: s.player.x, y: landing.y });
      }
    }
    for (const enemy of s.enemies) {
      const spec = ENEMY_TYPES[enemy.kind];
      enemy.x = enemy.baseX + Math.sin(s.elapsed * 1.5 + enemy.id) * spec.speed;
      const distance = Math.hypot(s.player.x - enemy.x, s.player.y - enemy.y);
      if (s.attackLeft > 0 && distance < RULES.attackRadius + spec.radius && s.elapsed - enemy.hitAt > RULES.attackCooldown) {
        enemy.hp--;
        enemy.hitAt = s.elapsed;
        s.player.vy = -RULES.comboBoost;
        s.player.invincible = 0.45;
        if (enemy.hp <= 0) {
          s.combo++;
          s.bestCombo = Math.max(s.bestCombo, s.combo);
          s.comboLeft = RULES.comboWindow;
          s.kills++;
          s.earned += spec.coins;
          s.score += (enemy.kind === 'oni' ? RULES.bossScore : RULES.enemyScore) * Math.min(s.combo, 5);
          this.events.push({ type: enemy.kind === 'oni' ? 'boss' : 'kill', x: enemy.x, y: enemy.y, amount: spec.coins, combo: s.combo });
        }
      } else if (enemy.hp > 0 && s.player.invincible === 0 && distance < spec.radius + 15) {
        s.player.invincible = 1.4;
        s.player.vy = 285;
        s.player.x = Math.max(22, Math.min(458, s.player.x + (s.player.x < enemy.x ? -42 : 42)));
        s.combo = 0;
        this.events.push({ type: 'hurt', x: s.player.x, y: s.player.y });
      }
    }
    s.enemies = s.enemies.filter(e => e.hp > 0 && e.y < s.cameraY + VIEW.height + 100);
    s.coins = s.coins.filter(coin => {
      if (Math.hypot(s.player.x - coin.x, s.player.y - coin.y) < 35) {
        s.earned++;
        s.score += RULES.coinScore;
        this.events.push({ type: 'coin', x: coin.x, y: coin.y, amount: 1 });
        return false;
      }
      return coin.y < s.cameraY + VIEW.height + 100;
    });
    s.height = Math.max(s.height, Math.floor((682 - s.player.y) * RULES.heightScale));
    s.cameraY = Math.min(s.cameraY, s.player.y - 350);
    s.platforms = s.platforms.filter(p => p.y < s.cameraY + VIEW.height + 110);
    this.generate();
    if (s.player.y > s.cameraY + VIEW.height + 65) {
      s.ended = true;
      s.cause = 'Туман поймал тебя. Вершина всё ещё ждёт.';
      this.events.push({ type: 'end', x: s.player.x, y: s.player.y });
    }
  }

  snapshot(): RunSnapshot { return structuredClone(this.state); }
  drainEvents(): RunEvent[] { return this.events.splice(0); }
}
