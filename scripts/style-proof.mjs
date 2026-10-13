import {split,extract} from './art-extract.mjs';
import sharp from 'sharp';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from '@playwright/test';
const out='/tmp/ninja-style-proof';await mkdir(out,{recursive:true});
const hero=await split('docs/art-source/v2/style-proof-hero.png',4,5),world=await split('docs/art-source/v2/style-proof-world.png',2,3);
for(let i=0;i<20;i++){
 const f=await extract(hero,i),m=await sharp(f.png).metadata(),scale=90/(hero.bounds[0].bottom-hero.bounds[0].y+1);
 const png=await sharp(f.png).resize({width:Math.round(m.width*scale)}).png().toBuffer();await writeFile(`${out}/hero${i}.png`,png);
}
for(let i=0;i<6;i++)await writeFile(`${out}/world${i}.png`,(await extract(world,i)).png);
const html=`<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#142b3b;display:flex;justify-content:center}canvas{height:800px;width:480px}</style><canvas width="480" height="800"></canvas><script>
const c=document.querySelector('canvas'),x=c.getContext('2d');const imgs={};Promise.all([...Array(20)].map((_,i)=>load('hero'+i)).concat([...Array(6)].map((_,i)=>load('world'+i)))).then(()=>requestAnimationFrame(draw));function load(n){return new Promise(r=>{let im=new Image;im.onload=()=>{imgs[n]=im;r()};im.src='/'+n+'.png'})}function image(n,a,b,w,h){x.drawImage(imgs[n],a,b,w,h)}function draw(t){const f=Math.floor(t/140)%4;const g=x.createLinearGradient(0,0,0,800);g.addColorStop(0,'#f9dca3');g.addColorStop(1,'#83a9aa');x.fillStyle=g;x.fillRect(0,0,480,800);image('world4',-20,60,520,320);image('world5',0,0,480,800);x.fillStyle='rgba(249,239,215,.42)';x.fillRect(55,0,370,800);for(let a=0;a<5;a++){const y=175+a*124;image(a%2?'world3':'world2',110,y,270,58);const im=imgs['hero'+(a*4+f)],h=im.height,w=im.width;image('hero'+(a*4+f),240-w*.5,y-h+8,w,h)}image('world0',335,56,65,90);x.fillStyle='#163e48';x.font='bold 15px Arial';x.fillText('STYLE PROOF · REAL GAME SCALE',22,28);requestAnimationFrame(draw)}
</script>`;
await writeFile(`${out}/index.html`,html);
const server=createServer(async(req,res)=>{try{const file=req.url==='/'?'index.html':req.url.slice(1);res.setHeader('Content-Type',file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(out+'/'+file));}catch{res.statusCode=404;res.end();}}).listen(4175,'127.0.0.1');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:480,height:800}});await page.goto('http://127.0.0.1:4175');await page.waitForTimeout(700);await page.screenshot({path:'docs/screenshots/v2-visual-pass/style-proof.png'});for(let i=0;i<4;i++){await page.waitForTimeout(140);await page.screenshot({path:`docs/screenshots/v2-visual-pass/style-proof-${i}.png`});}}finally{await browser.close();server.close();}
