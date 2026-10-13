import sharp from 'sharp';
import {mkdir,readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {split,extract} from './art-extract.mjs';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'docs/art-source/v2'),output=resolve(root,'public/assets');
const actions=['idle','running','jumping','rising','falling','landing','wall_cling','wall_slide','wall_jump','dashing','attacking','hurt','dead'];
const enemyActions=['idle','move','windup','attack','recover','hurt','dying'];
const audit=[],crops={};
const hash=b=>createHash('sha256').update(b).digest('hex');
async function footCenter(png){
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let lo=info.width,hi=-1;
 for(let y=Math.max(0,info.height-Math.max(5,Math.round(info.height/18)));y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>128){lo=Math.min(lo,x);hi=Math.max(hi,x);}
 if(hi<lo)throw Error('Idle has no planted foot pixels');return(lo+hi)/2;
}
// Alpha-trimmed TexturePacker-compatible metadata preserves a COMMON logical
// foot pivot. Packing/resizing never invents or interpolates an authored pose.
async function actor(name,directory,sheets,states){
 const pieces=[],frames={},entries=[];let x=2,y=2,rowHeight=0;
 for(const spec of sheets){
  const columns=spec.columns??8,sheet=await split(resolve(source,spec.file+'.png'),columns,spec.rows);
  const reference=sheet.bounds[spec.reference??0],scale=90/(reference.bottom-reference.y+1);
  for(let i=0;i<spec.rows*columns;i++){
   if(spec.skipRows?.includes(Math.floor(i/columns)))continue;
   const f=await extract(sheet,i),w=Math.round((f.bounds.right-f.bounds.x+1)*scale),h=Math.round((f.bounds.bottom-f.bounds.y+1)*scale);
   const key=spec.action?`${spec.action}-${i}`:`${states[spec.start+Math.floor(i/columns)]}-${i%columns}`;
   const png=await sharp(f.png).resize(w,h).png().toBuffer();
   if(x+w+2>1024){x=2;y+=rowHeight+4;rowHeight=0;}
   const idle=key.startsWith('idle-')&&directory==='characters';
   const left=idle?Math.round(128-await footCenter(png)):Math.round(128-(f.seed.x-f.bounds.x)*scale),top=146-h;
   if(left<0||left+w>256||top<0)throw Error(`Authored pose exceeds logical frame: ${name}/${key}: ${left},${top},${w},${h}`);
   pieces.push({input:png,left:x,top:y});
   frames[key]={frame:{x,y,w,h},rotated:false,trimmed:true,spriteSourceSize:{x:left,y:top,w,h},sourceSize:{w:256,h:160}};
   entries.push({name:key,source:spec.file,sourceFrame:i,bounds:f.bounds,pivot:{x:128,y:146},anchor:idle?'planted-feet':'body',sha256:hash(png)});
   if(i===0&&spec.start===0&&directory==='characters')await sharp(f.png).resize({height:220}).png().toFile(resolve(output,directory,name+'-preview.png'));
   x+=w+4;rowHeight=Math.max(rowHeight,h);
  }
 }
 const height=Math.ceil((y+rowHeight+2)/4)*4;
 if(height>2048)throw Error('Texture page too high '+name);
 await sharp({create:{width:1024,height,channels:4,background:'#00000000'}}).composite(pieces).png({compressionLevel:9}).toFile(resolve(output,directory,name+'.png'));
 await writeFile(resolve(output,directory,name+'.json'),JSON.stringify({frames,meta:{app:'Ninja Climb original alpha-trim packer',version:'2.1',image:name+'.png',format:'RGBA8888',size:{w:1024,h:height},scale:'1'}},null,2));
 audit.push({name,path:`assets/${directory}/${name}.png`,width:1024,height,count:entries.length,rgbaBytes:1024*height*4,logicalFrame:{width:256,height:160,pivotX:128,pivotY:146},frames:entries});
}
// Only these generated runtime directories are replaced. Source generations stay in docs.
for(const directory of ['characters','enemies','backgrounds','platforms']){
 await mkdir(resolve(output,directory),{recursive:true});
 for(const file of await readdir(resolve(output,directory)))await unlink(resolve(output,directory,file));
}
for(const name of ['ember','jade','moon']){
 await actor(name,'characters',[{file:name+'-main',rows:7,start:0},{file:name+'-combat',rows:6,start:7,reference:32}],actions);
 const sheet=await split(resolve(source,name+'-main.png'),8,7),reference=sheet.bounds[0],scale=180/(reference.bottom-reference.y+1),pieces=[];
 for(let i=0;i<8;i++){const f=await extract(sheet,i),w=Math.round((f.bounds.right-f.bounds.x+1)*scale),h=Math.round((f.bounds.bottom-f.bounds.y+1)*scale),png=await sharp(f.png).resize(w,h).png().toBuffer();pieces.push({input:png,left:i%4*320+Math.round(160-await footCenter(png)),top:Math.floor(i/4)*224+205-h});}
 await sharp({create:{width:1280,height:448,channels:4,background:'#00000000'}}).composite(pieces).png({compressionLevel:9}).toFile(resolve(output,'characters',name+'-menu.png'));
}
await actor('sentinel','enemies',[{file:'sentinel',rows:6,start:0,skipRows:[1]},{file:'sentinel-walk',columns:4,rows:2,start:0,action:'move'},{file:'sentinel-hurt',columns:4,rows:2,start:0,action:'hurt'}],['idle','move','windup','attack','recover','dying']);
for(const name of ['moth','oni'])await actor(name,'enemies',[{file:name,columns:7,rows:7,start:0}],enemyActions);
const names=['stone','roof','broken-roof','temple','bamboo','moving','fragile','electric','wall','volcanic','arena','gate'];
const terrain=await split(resolve(source,'terrain-v2.png'),4,3),anchors={},widths={};
for(let i=0;i<names.length;i++){
 const name=names[i],f=await extract(terrain,i),png=await sharp(f.png).resize({width:name==='wall'||name==='electric'?100:512}).png().toBuffer();
 await writeFile(resolve(output,'platforms',name+'.png'),png);
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true}),tops=[];
 for(let x=Math.floor(info.width*.3);x<info.width*.7;x++){for(let y=0;y<info.height;y++)if(data[(y*info.width+x)*4+3]>180){tops.push(y);break;}}
 tops.sort((a,b)=>a-b);anchors[name]=Number(((tops[Math.floor(tops.length*.5)]??0)/info.height).toFixed(6));
 widths[name]=name==='roof'||name==='broken-roof'?.78:name==='bamboo'?.78:.92;
}
for(const name of ['sky','night','inferno']){
 const path=resolve(source,name+'-layers.png'),metadata=await sharp(path).metadata();
 // The opaque sky rectangle is cropped away from transparent panel gutters.
 await sharp(path).extract({left:30,top:38,width:710,height:280}).resize(480,800).removeAlpha().webp({quality:90}).toFile(resolve(output,'backgrounds',name+'.webp'));
 for(const [index,layer]of [[1,'mountains'],[2,'temples'],[3,'flora'],[4,'edges'],[5,'clouds']]){
  // Cell crop keeps BOTH disconnected sides and the authored empty center.
  const left=Math.floor(index%2*metadata.width/2),top=Math.floor(Math.floor(index/2)*metadata.height/3),width=Math.floor(metadata.width/2),height=Math.floor(metadata.height/3);
  const {data,info}=await sharp(path).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)data[(y*info.width+x)*4+3]=Math.round(data[(y*info.width+x)*4+3]*Math.min(1,y/24,(info.height-1-y)/24));
  const target=resolve(output,'backgrounds',name+'-'+layer+'.webp');
  await sharp(data,{raw:info}).resize(480,layer==='clouds'?180:640,{fit:'fill'}).webp({quality:90,alphaQuality:100}).toFile(target);
  if(layer==='flora'||layer==='edges'){
   const {data:pixels,info:size}=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   crops[name+'-'+layer]=[];
   for(let side=0;side<2;side++){let lo=480,hi=-1;for(let y=0;y<size.height;y++)for(let x=side*240;x<(side+1)*240;x++)if(pixels[(y*480+x)*4+3]>16){lo=Math.min(lo,x);hi=Math.max(hi,x);}lo=Math.max(0,lo-3);hi=Math.min(479,hi+3);crops[name+'-'+layer].push({x:lo,width:hi-lo+1});}
  }
 }
}
await writeFile(resolve(root,'src/data/terrain.ts'),'// Generated contact planes; physics never reads image dimensions.\nexport const TERRAIN_TOP = '+JSON.stringify(anchors,null,2)+' as const;\nexport const TERRAIN_SPAN = '+JSON.stringify(widths,null,2)+' as const;\n');
await writeFile(resolve(root,'src/data/environment-crops.ts'),'// Generated alpha bounds: do not shade empty center pixels.\nexport const ENV_CROPS = '+JSON.stringify(crops,null,2)+' as const;\n');
const totalRgbaBytes=audit.reduce((n,a)=>n+a.rgbaBytes,0);
const totalFrames=audit.reduce((n,a)=>n+a.count,0);
await writeFile(resolve(root,'docs/ART_FRAME_AUDIT.json'),JSON.stringify({generator:'built-in image_gen',version:'2.1',actions,enemyActions,totalFrames,totalRgbaBytes,notes:'Unique authored poses. Alpha-trim packing, common logical foot pivot. No pose synthesis; phase sampling of short actions preserves gameplay windows.',atlases:audit},null,2));
console.log(`Prepared ${totalFrames} frames, 6 trimmed atlases (${(totalRgbaBytes/1048576).toFixed(2)} MiB RGBA for all costumes), 18 background layers, 12 terrain objects.`);
