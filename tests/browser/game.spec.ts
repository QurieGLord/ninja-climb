import { test, expect, type Page } from '@playwright/test';
import { RunModel } from '../../src/game/RunModel';
import { spawnEnemy } from '../../src/game/level';
import { freshProgress, SAVE_KEY } from '../../src/systems/ProgressStore';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const saved=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'{}'),SAVE_KEY);
const meter=(page:Page)=>page.locator('[data-control="attack"]').evaluate(el=>parseFloat((el as HTMLElement).style.getPropertyValue('--cooldown')));
test.beforeAll(async()=>{await mkdir('docs/screenshots',{recursive:true});});
async function seed(page:Page,mode:'air'|'ground'|'boss'='air',balance=0){
 const r=new RunModel(undefined,42);r.state.enemies=[];r.state.coins=[];r.state.walls=[];r.state.topY=-10000;
 if(mode==='air'){
  r.state.platforms=[];Object.assign(r.state.player,{y:400,vy:0,grounded:null,coyote:0,invincible:1});
  spawnEnemy(r.state,'wisp',285,400).hp=1;spawnEnemy(r.state,'wisp',285,255).hp=1;
 }else if(mode==='ground')spawnEnemy(r.state,'wisp',285,684,0).hp=1;
 else { r.state.platforms=[{...r.state.platforms[0]!,kind:'arena',width:400}];r.state.cameraY=250;r.state.cameraTarget=250;r.state.heightOffset=288;r.state.height=288;r.state.tutorial=5;r.state.tutorialFlags=31;spawnEnemy(r.state,'oni',310,672,0); }
 const data={...freshProgress(),coins:balance,updatedAt:Date.now(),activeRun:r.snapshot()};
 await page.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));},{key:SAVE_KEY,data});
}
test('production: manual jump, keyboard, dash, pause, fall, retry and clean console',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await expect(page.locator('#start')).toBeVisible();await page.screenshot({path:'docs/screenshots/menu.png'});
 await page.locator('#help').click();await expect(page.getByRole('dialog')).toContainText('Space');await page.keyboard.press('Escape');
 await page.locator('#start').click();await page.waitForTimeout(300);expect((await saved(page)).activeRun.height).toBe(0);
 await page.keyboard.down('ArrowRight');await expect.poll(async()=>(await saved(page)).activeRun.player.x).toBeGreaterThan(275);await page.keyboard.up('ArrowRight');
 await page.keyboard.down('Space');await expect.poll(async()=>(await saved(page)).activeRun.height).toBeGreaterThan(10);await page.keyboard.up('Space');
 await page.keyboard.down('ArrowUp');await page.keyboard.press('Shift');await page.keyboard.up('ArrowUp');
 await expect(page.locator('[data-control="dash"]')).toHaveClass(/spent/);await page.screenshot({path:'docs/screenshots/gameplay.png'});
 await page.keyboard.press('p');await expect(page.locator('#pause-overlay')).toBeVisible();const paused=await saved(page);await page.waitForTimeout(200);expect((await saved(page)).activeRun.elapsed).toBe(paused.activeRun.elapsed);
 await page.locator('#resume').click();await page.keyboard.press('j');await expect.poll(()=>meter(page)).toBeGreaterThan(0);
 await page.keyboard.down('ArrowRight');await expect.poll(async()=>(await saved(page)).activeRun?.player.x??480).toBeGreaterThan(434);await page.keyboard.up('ArrowRight');
 await expect(page.locator('#result')).toBeVisible({timeout:12000});expect((await saved(page)).activeRun).toBeNull();
 await page.locator('#retry').click();await page.locator('#pause').click();await page.locator('#pause-menu').click();await expect(page.locator('#start')).toContainText('Продолжить');await expect(page.locator('#play-hint')).toBeHidden();
 expect(errors).toEqual([]);
});
test('production: directed air hit restores dash and a second real strike chains a combo',async({page})=>{
 await seed(page);await page.goto('/');await page.locator('#start').click();await page.keyboard.press('j');
 await expect.poll(async()=>(await saved(page)).coins,{intervals:[25]}).toBe(3);
 await page.keyboard.down('ArrowUp');await page.keyboard.press('Shift');await page.keyboard.up('ArrowUp');await expect(page.locator('[data-control="dash"]')).toHaveClass(/spent/);
 await expect.poll(()=>meter(page),{intervals:[25]}).toBe(0);await page.keyboard.press('j');
 await expect.poll(async()=>(await saved(page)).coins,{intervals:[25]}).toBe(6);
 expect((await saved(page)).activeRun.combo).toBe(2);expect((await saved(page)).activeRun.score).toBe(300);
 await page.locator('#stage').screenshot({path:'docs/screenshots/combo.png'});
});
test('production: mouse attack, wallet, costume and checkpoint survive reload',async({page})=>{
 await seed(page,'ground',78);await page.goto('/');await page.locator('#start').click();const box=(await page.locator('#stage').boundingBox())!;
 await page.mouse.click(box.x+box.width*0.65,box.y+box.height*0.80);await expect.poll(async()=>(await saved(page)).coins).toBe(81);
 await page.locator('#pause').click();await page.locator('#pause-menu').click();const before=await saved(page);await page.reload();await expect(page.locator('#start')).toContainText('Продолжить');
 expect((await saved(page)).activeRun.id).toBe(before.activeRun.id);expect((await saved(page)).coins).toBe(81);
 await page.locator('#skins').click();await page.locator('[data-skin="jade"]').click();await page.reload();expect((await saved(page)).coins).toBe(1);expect((await saved(page)).selectedSkin).toBe('jade');
});
test('production: multitouch, manual jump, cancellation and rotation without scroll',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await seed(page,'ground');
 await page.goto('/');await page.locator('#start').tap();
 const right=(await page.locator('[data-control="right"]').boundingBox())!,attack=(await page.locator('[data-control="attack"]').boundingBox())!;
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:right.x+right.width/2,y:right.y+right.height/2,id:1},{x:attack.x+attack.width/2,y:attack.y+attack.height/2,id:2}]});
 await expect.poll(async()=>(await saved(page)).coins).toBe(3);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(180);
 await page.locator('[data-control="jump"]').tap();await expect.poll(async()=>(await saved(page)).activeRun.height).toBeGreaterThan(5);
 const hint=await page.locator('#play-hint').boundingBox(),field=(await page.locator('#stage').boundingBox())!,checkpoint=(await saved(page)).activeRun;
 const feet=field.y+(checkpoint.player.y-checkpoint.cameraY+24)/800*field.height;
 if(hint)expect(hint.y+hint.height<feet-70/800*field.height||hint.y>feet).toBe(true);
 await page.screenshot({path:'docs/screenshots/mobile-gameplay.png'});
 await page.locator('#pause').tap();await page.locator('#pause-menu').tap();expect((await saved(page)).activeRun.player.vx).toBe(0);await expect(page.locator('#play-hint')).toBeHidden();
 await page.screenshot({path:'docs/screenshots/mobile.png'});await page.setViewportSize({width:844,height:390});await expect(page.locator('#start')).toBeInViewport();
 const d=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));expect(d.sw).toBeLessThanOrEqual(d.w);expect(d.sh).toBeLessThanOrEqual(d.h);await context.close();
});
test('production: boss telegraph, phase II, vulnerable windows and defeat',async({page})=>{
 await seed(page,'boss');await page.goto('/');await page.locator('#start').click();await expect(page.locator('#boss-phase')).toContainText('ПРИГОТОВЬСЯ');
 await page.keyboard.press('j');await page.waitForTimeout(180);expect((await saved(page)).activeRun.enemies[0].hp).toBe(6);
 await page.screenshot({path:'docs/screenshots/boss.png'});
 for(let cycle=0;cycle<3;cycle++){
  if((await saved(page)).coins>=30)break;
  await expect.poll(()=>page.locator('#boss-phase').evaluate(el=>parseFloat((el as HTMLElement).style.getPropertyValue('--charge'))),{intervals:[25]}).toBeGreaterThan(0.57);
  await page.keyboard.down('Space');await page.waitForTimeout(220);await page.keyboard.up('Space');
  await expect(page.locator('#boss-phase')).toContainText('ОКНО');
  for(let hit=0;hit<3;hit++){
   await expect.poll(()=>meter(page),{intervals:[25]}).toBe(0);await page.keyboard.press('j');await page.waitForTimeout(130);
   if((await saved(page)).coins>=30)break;
  }
 }
 await expect.poll(async()=>(await saved(page)).coins).toBe(30);expect((await saved(page)).activeRun.player.health).toBeGreaterThan(0);
});
test('production: real audio suspends on blur, manual pause and mute',async({page})=>{
 await page.addInitScript(()=>{const Original=window.AudioContext;window.AudioContext=class extends Original{constructor(){super();(window as any).audioTest=this;}};});
 await page.goto('/');await page.locator('#start').click();const state=()=>page.evaluate(()=>(window as any).audioTest.state);await expect.poll(state).toBe('running');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect.poll(state).toBe('suspended');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(state).toBe('running');
 await page.locator('#pause').click();await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});await expect.poll(state).toBe('suspended');await page.locator('#resume').click();await expect.poll(state).toBe('running');await page.locator('#sound').click();await expect.poll(state).toBe('suspended');
});
test('production: unavailable SDK keeps local checkpoint',async({page})=>{
 await page.route('**/sdk.js',r=>r.abort());await page.goto('/?yandex');await expect(page.locator('#save-status')).toContainText('SDK недоступен');await page.locator('#start').click();await page.locator('#pause').click();await page.locator('#pause-menu').click();expect((await saved(page)).activeRun.modelVersion).toBe(2);
});
test('production: a missing real character atlas stops loading with retry',async({page})=>{
 await page.route('**/characters/ember.png',r=>r.abort());await page.goto('/');await expect(page.locator('#reload')).toBeVisible();await expect(page.locator('#loader')).toContainText('Не удалось загрузить');
});
for(const resource of ['js','css'])test(`production: missing ${resource} has standalone retry`,async({page})=>{
 await page.route(`**/assets/index-*.${resource}`,r=>r.abort());await page.goto('/');await expect(page.locator('#critical-retry')).toBeVisible();
});
test('production: assets and animation work in nested iframe',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/iframe-host',r=>r.fulfill({contentType:'text/html',body:'<iframe title="Ninja" src="/embedded/index.html" style="width:100vw;height:100vh;border:0"></iframe>'}));
 await page.route('**/embedded/**',async r=>{const name=new URL(r.request().url()).pathname.slice('/embedded/'.length);const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};await r.fulfill({body:await readFile(resolve('dist',name)),contentType:types[extname(name)]??'application/octet-stream'});});
 await page.goto('/iframe-host');const frame=page.frameLocator('iframe');await frame.locator('#start').click();await expect(frame.locator('#hud')).toBeVisible();expect(errors).toEqual([]);
});
test('production: real SDK callback contract, early pause and no fabricated rewards',async({page})=>{
 await seed(page,'air');
 await page.addInitScript(()=>{const state={ready:0,events:{} as Record<string,()=>void>,callbacks:undefined as any,mode:'error'};(window as any).sdkTest=state;
  (window as any).YaGames={init:async()=>({features:{LoadingAPI:{ready:()=>state.ready++},GameplayAPI:{start:()=>{},stop:()=>{}}},getPlayer:async()=>({getData:async()=>{throw Error('offline');},setData:async()=>{throw Error('offline');}}),on:(event:string,cb:()=>void)=>{state.events[event]=cb;},off:()=>{},adv:{showRewardedVideo:({callbacks}:any)=>{state.callbacks=callbacks;if(state.mode==='error')callbacks.onError(Error());else callbacks.onOpen();}}})};
 });
 await page.goto('/');await expect(page.locator('#start')).toBeVisible();expect(await page.evaluate(()=>(window as any).sdkTest.ready)).toBe(1);
 await page.evaluate(()=>(window as any).sdkTest.events.game_api_pause());await page.locator('#start').click();await expect(page.locator('#pause-overlay')).toBeVisible();await page.evaluate(()=>(window as any).sdkTest.events.game_api_resume());await expect(page.locator('#pause-overlay')).toBeHidden();
 await expect(page.locator('#result')).toBeVisible({timeout:10000});const coins=(await saved(page)).coins;
 await page.locator('#reward').click();await expect(page.locator('#toast')).toContainText('Не удалось');expect((await saved(page)).coins).toBe(coins);
 await page.evaluate(()=>{(window as any).sdkTest.mode='reward';});await page.locator('#reward').click();await expect(page.locator('#reward')).toBeDisabled();
 await page.evaluate(()=>{(window as any).sdkTest.callbacks.onRewarded();(window as any).sdkTest.callbacks.onRewarded();});expect((await saved(page)).coins).toBe(coins+25);await page.evaluate(()=>(window as any).sdkTest.callbacks.onClose());await expect(page.locator('#reward')).toBeEnabled();
});
