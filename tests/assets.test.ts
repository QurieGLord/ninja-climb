import {describe,expect,it} from 'vitest';
import sharp from 'sharp';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BIOME_LAYERS} from '../src/data/environment';
import {TERRAIN_TOP,TERRAIN_SPAN} from '../src/data/terrain';
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
describe('authored art, packed alpha and release contracts',()=>{
 it('guard patrol has two contact poses and single planted feet in both passing phases',async()=>{
  const atlas=JSON.parse(await readFile('public/assets/enemies/sentinel.json','utf8'));
  const contacts:number[]=[];
  for(const i of [0,2,4,6]){const f=atlas.frames[`move-${i}`].frame,{data,info}=await sharp('public/assets/enemies/sentinel.png').extract({left:f.x,top:f.y,width:f.w,height:f.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});let groups=0,on=false;for(let x=0;x<info.width;x++){let foot=false;for(let y=info.height-4;y<info.height;y++)if(data[(y*info.width+x)*4+3]!>128)foot=true;if(foot&&!on)groups++;on=foot;}contacts.push(groups);}
  expect(contacts).toEqual([2,1,2,1]);
 });
 it('idle soles stay planted within one pixel in gameplay and large lobby for every costume',async()=>{
  for(const name of ['ember','jade','moon']){
   const atlas=JSON.parse(await readFile(`public/assets/characters/${name}.json`,'utf8'));
   for(const menu of [false,true]){
    const centers:number[]=[],floors:number[]=[];
    for(let i=0;i<8;i++){
     const entry=atlas.frames[`idle-${i}`],f=menu?{x:i%4*320,y:Math.floor(i/4)*224,w:320,h:224}:entry.frame;
     const {data,info}=await sharp(`public/assets/characters/${name}${menu?'-menu':''}.png`).extract({left:f.x,top:f.y,width:f.w,height:f.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
     let floor=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]!>128)floor=y;
     let lo=info.width,hi=-1;for(let y=floor-(menu?9:4);y<=floor;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]!>128){lo=Math.min(lo,x);hi=Math.max(hi,x);}
     centers.push((lo+hi)/2+(menu?0:entry.spriteSourceSize.x));floors.push(floor+(menu?0:entry.spriteSourceSize.y));
    }
    expect(Math.max(...centers)-Math.min(...centers),`${name}/${menu?'menu':'game'} foot drift`).toBeLessThanOrEqual(1);
    expect(Math.max(...floors)-Math.min(...floors)).toBeLessThanOrEqual(1);
   }
  }
 });
 it('466 real unique frames have valid trimmed rectangles and a shared logical foot pivot',async()=>{
  const audit=JSON.parse(await readFile('docs/ART_FRAME_AUDIT.json','utf8'));expect(audit.totalFrames).toBe(466);expect(audit.atlases).toHaveLength(6);let total=0;
  for(const atlas of audit.atlases){
   const path='public/'+atlas.path,meta=await sharp(path).metadata(),json=JSON.parse(await readFile(path.replace('.png','.json'),'utf8'));
   expect(meta.width).toBe(1024);expect(meta.height).toBeLessThanOrEqual(2048);expect(meta.hasAlpha).toBe(true);expect(Object.keys(json.frames)).toHaveLength(atlas.count);
   const hashes=new Set<string>(),actions=new Map<string,number>();
   for(const [name,entry]of Object.entries<any>(json.frames)){
    const f=entry.frame;expect(f.x+f.w).toBeLessThanOrEqual(meta.width!);expect(f.y+f.h).toBeLessThanOrEqual(meta.height!);expect(entry.sourceSize).toEqual({w:256,h:160});expect(entry.spriteSourceSize.y+f.h).toBe(146);expect(entry.spriteSourceSize.x).toBeGreaterThanOrEqual(0);expect(entry.spriteSourceSize.x+f.w).toBeLessThanOrEqual(256);
    const png=await sharp(path).extract({left:f.x,top:f.y,width:f.w,height:f.h}).ensureAlpha().raw().toBuffer();
    let opaque=0,soft=0;for(let i=3;i<png.length;i+=4){if(png[i]!>128)opaque++;if(png[i]!>0&&png[i]!<255)soft++;}expect(opaque,name).toBeGreaterThan(200);expect(soft,name).toBeGreaterThan(0);hashes.add(digest(png));
    const action=name.replace(/-\d+$/,'');actions.set(action,(actions.get(action)??0)+1);total++;
   }
   expect(hashes.size).toBe(atlas.count);
   for(const count of actions.values())expect(count).toBe(atlas.name==='moth'||atlas.name==='oni'?7:8);
   expect(actions.size).toBe(['ember','jade','moon'].includes(atlas.name)?13:7);
  }
  expect(total).toBe(466);expect(audit.totalRgbaBytes).toBeLessThan(20*1048576);
 });
 it('all three biomes have five independent transparent layers with seam-safe vertical boundaries',async()=>{
  const unique=new Set();for(const zone of ['sky','night','inferno']){
   const sky=await readFile(`public/assets/backgrounds/${zone}.webp`);unique.add(digest(sky));
   for(const layer of BIOME_LAYERS){const path=`public/assets/backgrounds/${zone}-${layer.id}.webp`,{data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});unique.add(digest(data));expect(info.width).toBe(480);let empty=0;for(let x=0;x<info.width;x++){expect(data[x*4+3]).toBe(0);expect(data[((info.height-1)*info.width+x)*4+3]).toBe(0);}for(let i=3;i<data.length;i+=4)if(data[i]===0)empty++;expect(empty/(info.width*info.height)).toBeGreaterThan(.15);}
  }expect(unique.size).toBe(18);
 });
 it('every terrain contact has opaque painted surface near its anchor, no physics bound to transparent gutters',async()=>{
  for(const [name,top]of Object.entries(TERRAIN_TOP)){
   expect(top).toBeGreaterThanOrEqual(0);expect(top).toBeLessThan(1);expect(TERRAIN_SPAN[name as keyof typeof TERRAIN_SPAN]).toBeGreaterThan(.5);
   if(['wall','electric','gate'].includes(name))continue; // vertical/solid faces do not use the platform landing anchor
   const {data,info}=await sharp(`public/assets/platforms/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),y=Math.round(top*info.height);let painted=0;
   for(let x=Math.floor(info.width*.4);x<info.width*.6;x++)for(let dy=0;dy<4;dy++)if(data[((Math.min(info.height-1,y+dy))*info.width+x)*4+3]!>128){painted++;break;}
   expect(painted/info.width,name).toBeGreaterThan(.15);
  }
  expect(await readdir('public/assets/platforms')).toHaveLength(12);expect(await readdir('public/assets/characters')).toHaveLength(12);
 });
});
