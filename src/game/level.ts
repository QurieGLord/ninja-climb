import { ENEMY_TYPES, RULES, type EnemyKind, type PlatformKind } from '../data/config';
import type { Enemy, RunSnapshot } from './types';
export interface RoutePoint { x: number; up: number; kind: PlatformKind; width: number }
// Routes are templates, not independently randomized gaps. Mirroring preserves reachability.
export const CLIMB_ROUTE: RoutePoint[] = [
  { x: 125, up: 90, kind: 'stone', width: 168 },
  { x: 315, up: 195, kind: 'stone', width: 164 },
  { x: 160, up: 300, kind: 'cloud', width: 168 },
  { x: 320, up: 410, kind: 'fragile', width: 168 },
  { x: 220, up: 510, kind: 'stone', width: 180 },
  { x: 240, up: 600, kind: 'stone', width: 200 },
];
export const segmentReachable = (route = CLIMB_ROUTE) => {
  let previous = { x: 240, up: 0, width: 300 };
  for (const point of route) {
    const rise = point.up - previous.up;
    if (rise > RULES.jumpSpeed ** 2 / (2 * RULES.gravity)) return false;
    const time = (RULES.jumpSpeed + Math.sqrt(RULES.jumpSpeed ** 2 - 2 * RULES.gravity * rise)) / RULES.gravity;
    const drift = point.kind === 'cloud' ? 22 : 0;
    if (Math.abs(point.x - previous.x) + drift > RULES.moveSpeed * time + point.width / 2 - 18) return false;
    previous = point;
  }
  return true;
};
export function spawnEnemy(s: RunSnapshot, kind: EnemyKind, x: number, y: number, platformId = -1): Enemy {
  const e: Enemy = { id: s.nextId++, kind, x, y, baseX: x, baseY: y, hp: ENEMY_TYPES[kind].health, facing: -1,
    vx: 0, vy: 0, platformId, state: 'idle', stateTime: 0, reactionLeft: 0, cycle: 0, targetX: x, targetY: y, rewarded: false };
  s.enemies.push(e); return e;
}
export function generateLevel(s: RunSnapshot) {
  while (s.topY > s.cameraY - 500) {
    const index = s.generated++, base = s.topY;
    s.topY -= 600;
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
    const mirror = index > 0 && (s.seed & 1) === 1;
    const bossSegment = index % 3 === 2;
    const route = bossSegment ? [
      { x: 240, up: 95, width: 220, kind: 'stone' as const },
      { x: 240, up: 240, width: 400, kind: 'arena' as const },
      { x: 110, up: 345, width: 152, kind: 'stone' as const },
      { x: 330, up: 450, width: 152, kind: 'stone' as const },
      { x: 240, up: 600, width: 200, kind: 'stone' as const },
    ] : CLIMB_ROUTE;
    const made = route.map((point, i) => {
      const x = mirror ? 480 - point.x : point.x;
      const kind = index === 0 && point.kind === 'fragile' ? 'stone' : point.kind;
      const p = { id: s.nextId++, x, baseX: x, y: base - point.up, width: point.width, kind, broken: false, crumble: 0, dx: 0 };
      s.platforms.push(p);
      if (!bossSegment && i % 2 === 0) s.coins.push({ id: s.nextId++, x, y: p.y - 39 });
      return p;
    });
    // Both corridor faces are functional geometry, not decorative screen bounds.
    s.walls.push({ id: s.nextId++, x: 0, y: base - 600, width: 28, height: 602, grip: true, hazard: false });
    s.walls.push({ id: s.nextId++, x: 452, y: base - 600, width: 28, height: 602, grip: true, hazard: false });
    if (index > 0 && !bossSegment) s.walls.push({ id: s.nextId++, x: mirror ? 434 : 28, y: base - 365, width: 18, height: 85, grip: false, hazard: true });
    // A reachable practice wall inside the first safe segment.
    if (index === 0) s.walls.push({ id: s.nextId++, x: 42, y: base - 420, width: 28, height: 245, grip: true, hazard: false });
    if (bossSegment) {
      const arena = made[1]!;
      const boss = spawnEnemy(s, 'oni', 330, arena.y - 38, arena.id);
      // Breakable gate prevents silently bypassing the boss; side ledges offer dodge routes.
      s.walls.push({ id: s.nextId++, x: 28, y: base - 555, width: 424, height: 20, grip: false, hazard: false, gateFor: boss.id });
    } else {
      const guard = made[index === 0 ? 3 : 1]!;
      spawnEnemy(s, 'wisp', guard.x + 22, guard.y - 26, guard.id);
      if (index > 0) spawnEnemy(s, 'moth', made[3]!.x - 55, made[3]!.y - 88);
    }
  }
  const cutoff = s.cameraY + 1050;
  s.platforms = s.platforms.filter(p => p.y < cutoff);
  s.walls = s.walls.filter(w => w.y < cutoff && (!w.gateFor || s.enemies.some(e => e.id === w.gateFor && e.hp > 0)));
  s.coins = s.coins.filter(c => c.y < cutoff);
  s.enemies = s.enemies.filter(e => e.y < cutoff && !(e.state === 'dying' && e.stateTime > 0.65));
}
