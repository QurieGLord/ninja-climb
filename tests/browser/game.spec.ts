import { test, expect, type Page } from '@playwright/test';
import { RunModel } from '../../src/game/RunModel';
import { freshProgress, SAVE_KEY } from '../../src/systems/ProgressStore';
import { RULES } from '../../src/data/config';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const save = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), SAVE_KEY);
test.beforeAll(async () => { await mkdir('docs/screenshots', { recursive: true }); });
async function seedCombat(page: Page, balance = 0, chain = false) {
  const model = new RunModel(undefined, 42);
  Object.assign(model.state.player, { x: 240, y: 420, vy: -100, invincible: 1 });
  model.state.enemies = [{ id: 99, x: 285, baseX: 285, y: 420, kind: 'wisp', hp: 1, hitAt: -10 }];
  if (chain) model.state.enemies.push({ id: 100, x: 285, baseX: 285, y: 420 - RULES.chainGap, kind: 'wisp', hp: 1, hitAt: -10 });
  model.state.coins = [];
  const progress = { ...freshProgress(), coins: balance, updatedAt: Date.now(), activeRun: model.snapshot() };
  await page.addInitScript(({ key, data }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data)); }, { key: SAVE_KEY, data: progress });
}
test('production: menu, keyboard, pause, fall, retry, and no browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/menu.png' });
  await page.locator('#help').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await save(page)).activeRun.player.x).toBeGreaterThan(270);
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: 'docs/screenshots/gameplay.png' });
  await page.keyboard.press('KeyP'); await expect(page.locator('#pause-overlay')).toBeVisible();
  const paused = (await save(page)).activeRun;
  await page.waitForTimeout(250);
  expect((await save(page)).activeRun.elapsed).toBe(paused.elapsed);
  await page.locator('#resume').click();
  await page.keyboard.press('Space');
  await expect.poll(() => page.locator('[data-control="attack"]').evaluate(element => parseFloat((element as HTMLElement).style.getPropertyValue('--cooldown')))).toBeGreaterThan(0);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await save(page)).activeRun?.player.x ?? 480).toBeGreaterThan(430);
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
  expect((await save(page)).activeRun).toBeNull();
  await page.locator('#retry').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.locator('#pause').click(); await page.locator('#pause-menu').click();
  await expect(page.locator('#start')).toContainText('Продолжить');
  await expect(page.locator('#play-hint')).toBeHidden();
  expect(errors).toEqual([]);
});

test('production: two real air attacks form a combo and preserve earned currency', async ({ page }) => {
  await seedCombat(page, 0, true);
  await page.goto('/'); await page.locator('#start').click();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await save(page)).coins).toBe(3);
  // Read the live control: a persisted checkpoint can predate the current fall.
  await expect.poll(() => page.locator('[data-control="attack"]').evaluate(element => parseFloat((element as HTMLElement).style.getPropertyValue('--cooldown'))), { intervals: [25] }).toBe(0);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await save(page)).coins).toBe(6);
  expect((await save(page)).activeRun.combo).toBe(2);
  expect((await save(page)).activeRun.score).toBe(300);
  await page.locator('#stage').screenshot({ path: 'docs/screenshots/combo.png' });
});

test('production: mouse air attack, earned coins, skin purchase and reload', async ({ page }) => {
  await seedCombat(page, 78);
  await page.goto('/'); await page.locator('#start').click();
  const field = await page.locator('#stage').boundingBox();
  await page.mouse.click(field!.x + field!.width * 0.55, field!.y + field!.height * 0.52);
  await expect.poll(async () => (await save(page)).coins).toBe(81);
  await expect.poll(async () => (await save(page)).activeRun.kills).toBe(1);
  await page.locator('#pause').click(); await page.locator('#pause-menu').click();
  const before = await save(page);
  await page.reload(); await expect(page.locator('#start')).toContainText('Продолжить');
  expect((await save(page)).coins).toBe(before.coins);
  expect((await save(page)).activeRun.id).toBe(before.activeRun.id);
  await page.locator('#skins').click(); await page.locator('[data-skin="jade"]').click();
  expect((await save(page)).coins).toBe(1);
  await page.reload();
  expect((await save(page)).selectedSkin).toBe('jade'); expect((await save(page)).coins).toBe(1);
});

test('production: touch steering, simultaneous attack, release and rotation without scroll', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await seedCombat(page);
  await page.goto('/'); await page.locator('#start').tap();
  const right = (await page.locator('[data-control="right"]').boundingBox())!;
  const attack = (await page.locator('[data-control="attack"]').boundingBox())!;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 }, { x: attack.x + attack.width / 2, y: attack.y + attack.height / 2, id: 2 }] });
  await page.waitForTimeout(220);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await save(page)).coins).toBe(3);
  await page.waitForTimeout(120);
  await page.locator('#pause').tap(); await page.locator('#pause-menu').tap();
  await expect(page.locator('#play-hint')).toBeHidden();
  expect((await save(page)).activeRun.player.x).toBeGreaterThan(260);
  expect((await save(page)).activeRun.player.vx).toBe(0);
  await page.screenshot({ path: 'docs/screenshots/mobile.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  const dimensions = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
  expect(dimensions.sw).toBeLessThanOrEqual(dimensions.w); expect(dimensions.sh).toBeLessThanOrEqual(dimensions.h);
  await expect(page.locator('#start')).toBeInViewport();
  await context.close();
});

test('production: actual audio context suspends on blur, manual pause, and mute', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor() { super(); (window as any).audioTest = this; }
    };
  });
  await page.goto('/'); await page.locator('#start').click();
  const audioState = () => page.evaluate(() => (window as any).audioTest.state);
  await expect.poll(audioState).toBe('running');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(audioState).toBe('suspended');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(audioState).toBe('running');
  await page.locator('#pause').click();
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  await expect.poll(audioState).toBe('suspended');
  await page.locator('#resume').click(); await expect.poll(audioState).toBe('running');
  await page.locator('#sound').click(); await expect.poll(audioState).toBe('suspended');
});

test('production: missing Yandex SDK falls back to local progress without a fake reward', async ({ page }) => {
  await page.route('**/sdk.js', route => route.abort());
  await page.goto('/?yandex');
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#save-status')).toContainText('SDK недоступен');
  await page.locator('#start').click(); await page.locator('#pause').click(); await page.locator('#pause-menu').click();
  expect((await save(page)).activeRun).toBeTruthy();
});

test('production: failed resources present a retry screen', async ({ page }) => {
  await page.route('**/assets/temple.svg', route => route.abort());
  await page.goto('/'); await expect(page.locator('#reload')).toBeVisible();
  await expect(page.locator('#loader')).toContainText('Не удалось загрузить');
});

for (const resource of ['js', 'css']) {
  test(`production: failed ${resource} presents a standalone retry screen`, async ({ page }) => {
    await page.route(`**/assets/index-*.${resource}`, route => route.abort());
    await page.goto('/'); await expect(page.locator('#critical-retry')).toBeVisible();
    await expect(page.locator('#critical-load-error')).toContainText('Не удалось загрузить');
  });
}

test('production: relative resources work inside an iframe under a nested path', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/iframe-host', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><iframe title="Ninja" src="/embedded/index.html" style="width:100vw;height:100vh;border:0"></iframe></body></html>' }));
  await page.route('**/embedded/**', async route => {
    const name = new URL(route.request().url()).pathname.slice('/embedded/'.length);
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    await route.fulfill({ body: await readFile(resolve('dist', name)), contentType: types[extname(name)] ?? 'application/octet-stream' });
  });
  await page.goto('/iframe-host');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#start')).toBeVisible();
  await frame.locator('#start').click(); await expect(frame.locator('#hud')).toBeVisible();
  expect(errors).toEqual([]);
});

test('production: SDK and ad errors, reward exactly once, pause and focus recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { ready: 0, starts: 0, stops: 0, callbacks: undefined as any, events: {} as Record<string, () => void>, mode: 'error' };
    (window as any).sdkTest = state;
    (window as any).YaGames = { init: async () => ({
      features: { LoadingAPI: { ready: () => state.ready++ }, GameplayAPI: { start: () => state.starts++, stop: () => state.stops++ } },
      getPlayer: async () => ({ getData: async () => { throw Error('cloud offline'); }, setData: async () => { throw Error('cloud offline'); } }),
      on: (event: string, cb: () => void) => { state.events[event] = cb; }, off: () => {},
      adv: { showRewardedVideo: ({ callbacks }: any) => {
        state.callbacks = callbacks;
        if (state.mode === 'error') callbacks.onError(Error('no fill')); else callbacks.onOpen();
      } },
    }) };
  });
  await page.goto('/'); await expect(page.locator('#start')).toBeVisible();
  expect(await page.evaluate(() => (window as any).sdkTest.ready)).toBe(1);
  await page.evaluate(() => { (window as any).sdkTest.events.game_api_pause(); });
  await page.locator('#start').click();
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await page.evaluate(() => { (window as any).sdkTest.events.game_api_resume(); });
  await expect(page.locator('#pause-overlay')).toBeHidden();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight');
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
  const balance = (await save(page)).coins;
  await page.locator('#reward').click(); await expect(page.locator('#toast')).toContainText('Не удалось');
  expect((await save(page)).coins).toBe(balance);
  await page.evaluate(() => { (window as any).sdkTest.mode = 'reward'; });
  await page.locator('#reward').click(); await expect(page.locator('#reward')).toBeDisabled();
  await page.evaluate(() => { (window as any).sdkTest.callbacks.onRewarded(); (window as any).sdkTest.callbacks.onRewarded(); });
  expect((await save(page)).coins).toBe(balance + 25);
  await page.evaluate(() => { (window as any).sdkTest.callbacks.onClose(); });
  await expect(page.locator('#reward')).toBeEnabled();
  await page.locator('#retry').click();
  await page.evaluate(() => { (window as any).sdkTest.events.game_api_pause(); });
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await page.evaluate(() => { (window as any).sdkTest.events.game_api_resume(); });
  await expect(page.locator('#pause-overlay')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#pause-overlay')).toBeHidden();
});
