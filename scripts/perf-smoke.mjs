import { chromium } from '@playwright/test';
import { build,preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {existsSync} from 'node:fs';

// Test fixtures and the controller live here, never in the shipped application.
const label=process.env.PERF_LABEL||(process.env.PERF_DIAGNOSTIC?'diagnostic-backgrounds':process.argv.includes('--baseline')?'baseline':'final');
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'docs/performance'),{recursive:true});
await build({root,configFile:false,build:{ssr:'src/game/RunModel.ts',outDir:'/tmp/ninja-perf-model',emptyOutDir:true,minify:false,rollupOptions:{output:{entryFileNames:'RunModel.mjs'}}}});
const {RunModel}=await import('/tmp/ninja-perf-model/RunModel.mjs?'+Date.now());
const model=new RunModel(undefined,42,{height:330,tutorialComplete:true}),s=model.state;
s.platforms=[];s.enemies=[];s.coins=[];s.walls=[];s.topY=-20000;s.nextId=1000;
s.player.invincible=999; // Survive a repeatable stress fixture; no alteration to production rules.
for(let i=0;i<80;i++){
 const y=710-i*110,id=i+1;
 s.platforms.push({id,x:240,baseX:240,y,width:400,kind:i%5===0?'cloud':i%7===0?'arena':'stone',broken:false,crumble:0,dx:0});
 if(i%2===0){
  const kind=i%8===0?'oni':i%4===0?'moth':'wisp';
  s.enemies.push({id:100+i,x:285,y:y-(kind==='oni'?38:26),baseX:285,baseY:y-38,kind,hp:kind==='oni'?4:2,facing:-1,vx:0,vy:0,platformId:id,state:'idle',stateTime:0,reactionLeft:0,cycle:0,targetX:240,targetY:y-26,rewarded:false});
 }
 s.coins.push({id:300+i,x:240,y:y-45});
}
s.player.grounded=1;
s.walls=[{id:900,x:0,y:-10000,width:28,height:11000,grip:true,hazard:false},{id:901,x:452,y:-10000,width:28,height:11000,grip:true,hazard:false}];
const profile={version:1,coins:0,bestHeight:0,bestScore:0,totalRuns:0,totalCoins:0,ownedSkins:['ember'],selectedSkin:'ember',sound:false,tutorialComplete:true,updatedAt:Date.now(),activeRun:s};
const headed=process.env.PERF_HEADLESS!=='1';
const browser=await chromium.launch({headless:!headed,executablePath:process.env.CHROME_PATH||(existsSync('/opt/google/chrome/chrome')?'/opt/google/chrome/chrome':undefined),args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle',...(process.env.PERF_SOFTWARE==='1'?['--use-angle=swiftshader']:[]),'--disable-background-timer-throttling','--disable-renderer-backgrounding']});
let server=null;
try{
 server=process.env.PERF_URL?null:await preview({root,preview:{port:4176,strictPort:true,host:'127.0.0.1'}});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(profile=>localStorage.setItem('ninja-climb.progress.v1',JSON.stringify(profile)),profile);
 await page.addInitScript(()=>{
  window.perfFrameIndex=0;window.perfDrawFrames=new Set();window.perfDrawCalls=0;window.perfMeasure=false;
  const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const context=getContext.apply(this,args);if(context&&typeof context.getParameter==='function')window.perfGL=context;return context;};
  for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext])for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
   if(!type||typeof type.prototype[method]!=='function')continue;const original=type.prototype[method];type.prototype[method]=function(...args){if(window.perfMeasure){window.perfDrawFrames.add(window.perfFrameIndex);window.perfDrawCalls++;}return original.apply(this,args);};
  }
 });
 if(process.env.PERF_DIAGNOSTIC)await page.route('**/backgrounds/*-*.webp',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
 await page.goto(process.env.PERF_URL||'http://127.0.0.1:4176/');await page.locator('#start').waitFor();await page.bringToFront();
 await page.screenshot({path:resolve(root,`docs/screenshots/v2-visual-pass/${label==='baseline'?'baseline/':''}menu.png`)});
 await page.locator('#start').click();
 await page.evaluate(()=>{
  const fire=(code,down)=>document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));
  let tick=0;window.perfController=setInterval(()=>{
   tick++;
   // Warm up without damaging the first boss. The measured first ten seconds
   // cover actual phase I -> II combat, followed by fifty seconds of climbing.
   const climbing=tick>150,attacking=tick>50;
   fire('Space',climbing&&tick%6<3);fire('KeyJ',attacking&&tick%4===0);fire('ArrowUp',climbing);fire('ShiftLeft',climbing&&tick%9===0);
   fire('ArrowRight',climbing&&tick%24<6);fire('ArrowLeft',climbing&&tick%24>=12&&tick%24<18);
  },100);
 });
 await page.waitForTimeout(5000);
 const initialElapsed=await page.evaluate(()=>JSON.parse(localStorage.getItem('ninja-climb.progress.v1')).activeRun?.elapsed??0);
 await page.evaluate(()=>{
  window.perfSamples=[];window.perfLong=[];window.perfVisibility=[];window.perfTelemetry=[];window.perfMeasure=true;
  const start=performance.now();let last=0;
  new PerformanceObserver(list=>window.perfLong.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});
  const frame=t=>{window.perfFrameIndex++;if(last)window.perfSamples.push(t-last);last=t;window.perfVisibility.push(document.visibilityState);if(window.perfFrameIndex%60===0){const s=JSON.parse(localStorage.getItem('ninja-climb.progress.v1')).activeRun;if(s)window.perfTelemetry.push({height:s.height,motion:s.player.motion,elapsed:s.elapsed,bosses:s.enemies.filter(e=>e.kind==='oni').map(e=>({hp:e.hp,state:e.state}))});}if(t-start<60000)requestAnimationFrame(frame);else{window.perfMeasure=false;window.perfDone=true;}};requestAnimationFrame(frame);
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const startMetrics=await cdp.send('Performance.getMetrics');
 console.log(`Measuring ${label}: 60 seconds after 5-second warmup; ${headed?'headed':'headless'} Chrome.`);
 await page.waitForTimeout(30000);console.log('Measurement halfway.');
 await page.waitForFunction(()=>window.perfDone,null,{timeout:40000});
 const report=await page.evaluate(()=>{
  clearInterval(window.perfController);
  const samples=window.perfSamples,sorted=[...samples].sort((a,b)=>a-b),sum=samples.reduce((a,b)=>a+b,0),progress=JSON.parse(localStorage.getItem('ninja-climb.progress.v1'));
  const gl=window.perfGL,ext=gl?.getExtension('WEBGL_debug_renderer_info');
  return {samples:samples.length,renderedFrames:window.perfDrawFrames.size,drawCalls:window.perfDrawCalls,durationMs:sum,averageMs:sum/samples.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),fps:1000*samples.length/sum,over25:samples.filter(t=>t>25).length,over25Percent:samples.filter(t=>t>25).length/samples.length*100,over50:samples.filter(t=>t>50).length,longTasks:window.perfLong,telemetry:window.perfTelemetry,visible:window.perfVisibility.every(v=>v==='visible'),focused:document.hasFocus(),height:progress.activeRun?.height,elapsed:progress.activeRun?.elapsed,kills:progress.activeRun?.kills,bestCombo:progress.activeRun?.bestCombo,ended:!progress.activeRun,memory:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize}:null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',userAgent:navigator.userAgent};
 });
 await page.screenshot({path:resolve(root,`docs/screenshots/v2-visual-pass/${label==='baseline'?'baseline/':''}perf-action.png`)});
 const endMetrics=await cdp.send('Performance.getMetrics'),metric=(m,name)=>m.metrics.find(x=>x.name===name)?.value??0;
 const bossPhaseII=report.telemetry.some(t=>t.bosses.some(b=>b.hp>0&&b.hp<=3));
 const output={label,date:new Date().toISOString(),mode:headed?'headed':'headless',measurement:'requestAnimationFrame intervals and WebGL-render frame count in visible focused production page; compositor cadence proxy, not physical display/GPU proof',fixture:'80 moving/static platforms, 40 enemies; measured 10s real boss phase I -> II combat, then 50s climbing through three biomes with jump/dash/air katana; invincibility only in saved test fixture',warmupSeconds:5,targetSeconds:60,...report,bossPhaseII,simulationSeconds:report.elapsed-initialElapsed,rendererTaskSeconds:metric(endMetrics,'TaskDuration')-metric(startMetrics,'TaskDuration'),scriptSeconds:metric(endMetrics,'ScriptDuration')-metric(startMetrics,'ScriptDuration'),targetMet:report.p95Ms<=18&&report.over25Percent<1,errors};
 await writeFile(resolve(root,`docs/performance/${label}.json`),JSON.stringify(output,null,2));
 console.log(JSON.stringify({...output,telemetry:output.telemetry.length,longTasks:output.longTasks.length,errors:[...new Set(errors)]},null,2));
 if(errors.length||!report.visible||!report.focused||report.ended||report.samples<1000||report.renderedFrames<1000||!bossPhaseII||report.height<900||output.simulationSeconds<50||output.simulationSeconds>66||(process.env.PERF_STRICT==='1'&&!output.targetMet))process.exitCode=1;
}finally{await browser.close();await new Promise(resolve=>server?server.httpServer.close(resolve):resolve());}
