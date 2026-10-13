import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {RunModel} from '../../src/game/RunModel';
import {spawnEnemy} from '../../src/game/level';
import {freshProgress,SAVE_KEY} from '../../src/systems/ProgressStore';
import {mkdir,rename,readdir,unlink} from 'node:fs/promises';
const folder='docs/screenshots/v2-visual-pass';
test.beforeAll(async()=>{await mkdir(folder,{recursive:true});});
async function fixture(page:Page,height=0,wall=false){
 const r=new RunModel(undefined,42,{height,tutorialComplete:true});
 r.state.enemies=[];r.state.coins=[];
 if(wall){r.state.walls=[{id:20,x:42,y:160,width:28,height:500,grip:true,hazard:false}];r.state.platforms=[];r.state.topY=-10000;Object.assign(r.state.player,{x:85,y:450,grounded:null,wallId:20,wallSide:-1,clingLeft:.38,lastWall:20,motion:'wall_cling'});}
 const p={...freshProgress(),coins:500,ownedSkins:['ember','jade','moon'],tutorialComplete:true,activeRun:r.snapshot()};
 await page.addInitScript(({p,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));},{p,key:SAVE_KEY});
}
test('production art: three biomes, real movement, wall-jump, dash and portrait',async({browser})=>{
 test.setTimeout(90000);
 const contexts:BrowserContext[]=[];const errors:string[]=[];
 const makePage=async()=>{const context=await browser.newContext({viewport:{width:480,height:800},recordVideo:{dir:folder+'/motion-video',size:{width:480,height:800}}});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page;};
 const finish=async(page:Page,name:string)=>{const path=await page.video()!.path();await page.context().close();await rename(path,folder+`/motion-video/${name}.webm`);};
 for(const [index,zone]of ['sky','night','inferno'].entries()){
  const page=await makePage();await fixture(page,index*360);await page.goto('/');await page.locator('#start').waitFor();
  if(!index)await page.screenshot({path:folder+'/menu.png'});
  await page.locator('#start').click();await page.waitForTimeout(450);await page.screenshot({path:folder+`/biome-${zone}.png`});
  if(!index){
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(130);await page.screenshot({path:folder+'/climbing.png'});await page.keyboard.up('ArrowRight');
   await page.keyboard.down('Space');await page.waitForTimeout(70);await page.screenshot({path:folder+'/jump.png'});await page.keyboard.up('Space');
   await page.keyboard.press('j');await page.waitForTimeout(145);await page.screenshot({path:folder+'/air-attack.png'});
   await page.keyboard.down('ArrowUp');await page.keyboard.press('Shift');await page.waitForTimeout(45);await page.screenshot({path:folder+'/dash.png'});await page.keyboard.up('ArrowUp');
  }
  await finish(page,zone==='sky'?'idle-run-jump-dash-attack':zone);
 }
 const wallPage=await makePage();await fixture(wallPage,0,true);await wallPage.goto('/');await wallPage.locator('#start').click();await wallPage.keyboard.down('ArrowLeft');await wallPage.waitForTimeout(120);await wallPage.keyboard.down('Space');await expect.poll(()=>wallPage.evaluate(key=>JSON.parse(localStorage.getItem(key)!).activeRun.player.wallLock,SAVE_KEY),{intervals:[10]}).toBeGreaterThan(0);await wallPage.screenshot({path:folder+'/wall-jump.png'});await wallPage.keyboard.up('Space');await wallPage.keyboard.up('ArrowLeft');
 await finish(wallPage,'wall-jump');
 const bossPage=await makePage();const boss=new RunModel(undefined,42,{height:288,tutorialComplete:true});boss.state.platforms=[{...boss.state.platforms[0]!,kind:'arena',width:400}];boss.state.enemies=[];spawnEnemy(boss.state,'oni',310,672,0);boss.state.cameraY=250;boss.state.cameraTarget=250;boss.state.topY=-10000;
 await bossPage.addInitScript(({key,s})=>localStorage.setItem(key,JSON.stringify({...s,version:1,coins:0,ownedSkins:['ember'],selectedSkin:'ember',sound:false,tutorialComplete:true})),{key:SAVE_KEY,s:{activeRun:boss.snapshot()}});await bossPage.goto('/');await bossPage.locator('#start').click();await expect(bossPage.locator('#boss-phase')).toContainText('ПРИГОТОВЬСЯ');await bossPage.screenshot({path:folder+'/boss.png'});
 await finish(bossPage,'boss');expect(errors).toEqual([]);
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await mobile.newPage();await phone.goto('/');await phone.locator('#start').tap();await phone.locator('[data-control="jump"]').tap();await phone.screenshot({path:folder+'/portrait.png'});await mobile.close();
 for(const file of await readdir(folder+'/motion-video'))if(/^(?:page@)?[a-f0-9]{32}\.webm$/.test(file))await unlink(folder+'/motion-video/'+file);
});
test('production art: only selected full costume loads, previews stay compact and a failed costume retries',async({page})=>{
 const requested:string[]=[];page.on('request',r=>requested.push(new URL(r.url()).pathname));await fixture(page);await page.goto('/');await page.locator('#start').waitFor();
 expect(requested.some(p=>p.endsWith('/jade.png'))).toBe(false);expect(requested.some(p=>p.endsWith('/moon.png'))).toBe(false);
 await page.locator('#skins').click();await expect(page.locator('.skin-preview')).toHaveCount(3);
 await page.route('**/characters/jade.png',route=>route.abort());await page.locator('[data-skin="jade"]').click();await expect(page.locator('#toast')).toContainText('Не удалось загрузить облик');
 await page.locator('.dialog-close').click();await page.unroute('**/characters/jade.png');await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 await page.locator('#pause').click();await page.locator('#pause-menu').click();await page.reload();await expect(page.locator('#start')).toContainText('Продолжить');
 const p=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);expect(p.coins).toBe(500);expect(p.selectedSkin).toBe('jade');expect(p.activeRun.modelVersion).toBe(2);
});
test('production art: sentinel patrol plays a full alternating-leg cycle on a real platform',async({browser})=>{
 const context=await browser.newContext({viewport:{width:480,height:800},recordVideo:{dir:folder+'/motion-video',size:{width:480,height:800}}}),page=await context.newPage();
 const r=new RunModel(undefined,42,{tutorialComplete:true}),data={...freshProgress(),sound:false,tutorialComplete:true,activeRun:r.snapshot()};
 await page.addInitScript(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:SAVE_KEY,data});await page.goto('/');await page.locator('#start').click();await page.waitForTimeout(2200);await page.screenshot({path:folder+'/sentinel-patrol.png'});
 const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).activeRun,SAVE_KEY);expect(state.enemies[0].state).toBe('move');expect(state.enemies[0].x).not.toBe(r.state.enemies[0]!.x);expect(state.player.motion).toBe('idle');
 const path=await page.video()!.path();await context.close();await rename(path,folder+'/motion-video/sentinel-walk.webm');
});
