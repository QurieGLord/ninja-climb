import { describe, expect, it } from 'vitest';
import { RunModel, landsOn, type Controls, type Platform } from '../src/game/RunModel';
import { RULES, PLATFORM_TYPES } from '../src/data/config';
const idle: Controls = { direction: 0, targetX: null, attack: false };
function airborne() {
  const run = new RunModel(undefined, 42);
  Object.assign(run.state, { platforms: [], enemies: [], coins: [], cameraY: 0, topY: -2000 });
  Object.assign(run.state.player, { x: 240, y: 300, vx: 0, vy: 0, invincible: 0 });
  return run;
}
function advance(run: RunModel, seconds: number, controls = idle) {
  for (let i = 0; i < Math.ceil(seconds * 120); i++) run.step(1 / 120, controls);
}
describe('one-way platforms and movement', () => {
  it('jumps automatically on the first crossed surface and never falls through at speed', () => {
    const run = airborne();
    run.state.player.vy = 1400;
    run.state.platforms = [
      { id: 1, x: 240, baseX: 240, y: 341, kind: 'stone', broken: false },
      { id: 2, x: 240, baseX: 240, y: 330, kind: 'stone', broken: false },
    ];
    run.step(1 / 30, idle);
    expect(run.state.player.y).toBe(330 - RULES.playerHalfHeight);
    expect(run.state.player.vy).toBe(-RULES.jumpSpeed);
  });
  it('passes through from below', () => {
    const run = airborne();
    run.state.player.vy = -500;
    run.state.platforms = [{ id: 1, x: 240, baseX: 240, y: 310, kind: 'stone', broken: false }];
    run.step(1 / 120, idle);
    expect(run.state.player.vy).toBeGreaterThan(-500);
    expect(run.drainEvents()).toEqual([]);
  });
  it('breaks fragile platforms after exactly one bounce', () => {
    const run = airborne();
    const platform: Platform = { id: 1, x: 240, baseX: 240, y: 327, kind: 'fragile', broken: false };
    run.state.platforms = [platform]; run.state.player.vy = 600;
    run.step(1 / 120, idle);
    expect(platform.broken).toBe(true);
    expect(landsOn(320, 330, 240, platform)).toBe(false);
  });
  it('keeps player inside the field and releases motion when no input remains', () => {
    const run = airborne();
    run.state.player.x = 25;
    advance(run, 0.1, { ...idle, direction: -1 });
    expect(run.state.player.x).toBe(22);
    run.step(1 / 120, idle);
    expect(run.state.player.vx).toBe(0);
  });
  it('has a reachable first route and deterministic procedural generation', () => {
    const a = new RunModel(undefined, 42), b = new RunModel(undefined, 42);
    expect(a.state.platforms).toEqual(b.state.platforms);
    const platforms = a.state.platforms;
    for (let i = 1; i < platforms.length; i++) {
      const previous = platforms[i - 1]!, next = platforms[i]!;
      const gap = previous.y - next.y;
      const flight = (RULES.jumpSpeed + Math.sqrt(RULES.jumpSpeed ** 2 - 2 * RULES.gravity * gap)) / RULES.gravity;
      expect(gap).toBeLessThan(RULES.jumpSpeed ** 2 / (2 * RULES.gravity));
      expect(Math.abs(next.x - previous.x)).toBeLessThan(RULES.moveSpeed * flight + PLATFORM_TYPES[next.kind].width / 2);
    }
  });
  it('keeps higher generated routes reachable, includes air chains and spawns bosses', () => {
    const run = new RunModel(undefined, 49);
    let bosses = 0, pairs = 0;
    const seen = new Set<number>();
    for (let chunk = 0; chunk < 35; chunk++) {
      run.state.cameraY = -chunk * 450;
      run.state.player.y = run.state.cameraY + 350;
      run.state.player.vy = 0;
      run.step(1 / 120, idle);
      const platforms = run.state.platforms;
      expect(platforms.length).toBeLessThan(20);
      for (let i = 1; i < platforms.length; i++) {
        const a = platforms[i - 1]!, b = platforms[i]!;
        const gap = a.y - b.y;
        const flight = (RULES.jumpSpeed + Math.sqrt(RULES.jumpSpeed ** 2 - 2 * RULES.gravity * gap)) / RULES.gravity;
        const worstDrift = Number(a.kind === 'cloud') * 28 + Number(b.kind === 'cloud') * 28;
        expect(Math.abs(a.baseX - b.baseX) + worstDrift).toBeLessThan(RULES.moveSpeed * flight + PLATFORM_TYPES[b.kind].width / 2 - 5);
      }
      for (const enemy of run.state.enemies) {
        if (seen.has(enemy.id)) continue;
        seen.add(enemy.id);
        if (enemy.kind === 'oni') bosses++;
        if (run.state.enemies.some(e => e.id !== enemy.id && Math.abs(e.y - enemy.y) === RULES.chainGap)) pairs++;
      }
    }
    expect(bosses).toBeGreaterThan(3); expect(pairs).toBeGreaterThan(10);
  });
});
describe('air combat and run rules', () => {
  it('an air hit grants coins once and boosts the player', () => {
    const run = airborne();
    run.state.enemies = [{ id: 3, x: 290, baseX: 290, y: 300, kind: 'wisp', hp: 1, hitAt: -10 }];
    run.step(1 / 120, { ...idle, attack: true });
    expect(run.state.player.vy).toBe(-RULES.comboBoost);
    expect(run.state.earned).toBe(3);
    expect(run.state.score).toBe(100);
    expect(run.state.combo).toBe(1);
    advance(run, 0.15, { ...idle, attack: true });
    expect(run.state.earned).toBe(3);
    expect(run.state.enemies).toHaveLength(0);
  });
  it('chains airborne kills and expires the combo window', () => {
    const run = airborne();
    const enemy = (id: number) => ({ id, x: 270, baseX: 270, y: run.state.player.y, kind: 'wisp' as const, hp: 1, hitAt: -10 });
    run.state.enemies.push(enemy(1)); run.step(1 / 120, { ...idle, attack: true });
    advance(run, 0.4);
    run.state.enemies.push(enemy(2)); run.step(1 / 120, { ...idle, attack: true });
    expect(run.state.combo).toBe(2); expect(run.state.score).toBe(300);
    for (let i = 0; i < 300; i++) {
      run.state.player.y = run.state.cameraY + 350;
      run.state.player.vy = 0;
      run.step(1 / 120, idle);
    }
    expect(run.state.combo).toBe(0);
    expect(run.state.bestCombo).toBe(2);
  });
  it('requires three separate swings to defeat a boss', () => {
    const run = airborne();
    run.state.enemies = [{ id: 1, x: 260, baseX: 260, y: 300, kind: 'oni', hp: 3, hitAt: -10 }];
    for (let i = 0; i < 3; i++) {
      const enemy = run.state.enemies[0]!;
      enemy.y = run.state.player.y;
      run.step(1 / 120, { ...idle, attack: true });
      if (i < 2) { expect(enemy.hp).toBe(2 - i); advance(run, 0.4); }
    }
    expect(run.state.enemies).toHaveLength(0);
    expect(run.state.earned).toBe(25);
    expect(run.state.score).toBe(800);
  });
  it('does not hit a distant enemy and applies contact knockback', () => {
    const run = airborne();
    run.state.enemies = [{ id: 1, x: 450, baseX: 450, y: 300, kind: 'wisp', hp: 1, hitAt: -10 }];
    run.step(1 / 120, { ...idle, attack: true });
    expect(run.state.kills).toBe(0);
    run.state.attackLeft = 0;
    run.state.enemies[0]!.baseX = 240;
    run.step(1 / 120, idle);
    expect(run.state.player.invincible).toBeGreaterThan(0);
    expect(run.state.player.vy).toBe(285);
  });
  it('collects each coin once, records peak height and ends after falling below the camera', () => {
    const run = airborne(); run.state.coins = [{ id: 1, x: 240, y: 300 }];
    run.step(1 / 120, idle); const height = run.state.height;
    expect(run.state.earned).toBe(1); expect(run.state.coins).toHaveLength(0);
    advance(run, 2);
    expect(run.state.earned).toBe(1); expect(run.state.height).toBe(height);
    expect(run.state.ended).toBe(true);
    const snapshot = run.snapshot(); run.step(1 / 120, { ...idle, attack: true });
    expect(run.snapshot()).toEqual(snapshot);
  });
  it('resumes a checkpoint with identical future physics and without shared mutable arrays', () => {
    const a = new RunModel(undefined, 42); advance(a, 0.2, { ...idle, direction: 1 });
    const b = new RunModel(a.snapshot());
    advance(a, 0.4); advance(b, 0.4);
    expect(b.snapshot()).toEqual(a.snapshot());
    b.state.platforms[0]!.broken = true;
    expect(a.state.platforms[0]!.broken).toBe(false);
  });
});
