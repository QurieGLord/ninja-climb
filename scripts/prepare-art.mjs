import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'docs/art-source'),output=resolve(root,'public/assets');
const audit=[],cache=new Map();
const actions=['idle','running','jumping','rising','falling','landing','wall_cling','wall_slide','wall_jump','dashing','attacking','hurt','dead'];

// Alpha-aware extraction avoids clipping AI-authored poses to the nominal grid.
// Multi-source geodesic labels separate adjacent silhouettes at narrow alpha bridges.
// No poses, limbs, clothing or weapon pixels are drawn or interpolated here.
async function split(name,columns,rows){
 if(cache.has(name))return cache.get(name);
 const path=resolve(source,name+'.png'),buffer=await readFile(path);
 const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,cw=w/columns,ch=h/rows;
 const mask=new Uint8Array(w*h),prefix=new Uint32Array((w+1)*(h+1));
 for(let y=0;y<h;y++){let sum=0;for(let x=0;x<w;x++){const i=y*w+x;mask[i]=Number(data[i*4+3]>=64);sum+=mask[i];prefix[(y+1)*(w+1)+x+1]=prefix[y*(w+1)+x+1]+sum;}}
 const density=(x,y)=>{const x0=Math.max(0,x-12),y0=Math.max(0,y-12),x1=Math.min(w,x+13),y1=Math.min(h,y+13);return prefix[y1*(w+1)+x1]-prefix[y0*(w+1)+x1]-prefix[y1*(w+1)+x0]+prefix[y0*(w+1)+x0];};
 const labels=new Int16Array(w*h).fill(-1),queue=new Int32Array(w*h),seeds=[];let head=0,tail=0;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  let best=-1,bx=0,by=0;
  for(let y=Math.floor((row+0.10)*ch);y<Math.min(h,(row+0.94)*ch);y+=2)for(let x=Math.floor((col+0.12)*cw);x<Math.min(w,(col+0.94)*cw);x+=2){
   if(!mask[y*w+x])continue;const d=density(x,y);const score=d-0.006*((x-(col+0.63)*cw)**2+(y-(row+0.58)*ch)**2);
   if(score>best){best=score;bx=x;by=y;}
  }
  const id=row*columns+col;
  if(best<140){seeds[id]=null;continue;}
  seeds[id]={x:bx,y:by};labels[by*w+bx]=id;queue[tail++]=by*w+bx;
 }
 while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w),id=labels[p];for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]&&labels[q]===-1){labels[q]=id;queue[tail++]=q;}}
 const bounds=seeds.map(()=>({x:w,y:h,right:-1,bottom:-1,pixels:0}));
 for(let i=0;i<labels.length;i++){const id=labels[i];if(id<0)continue;const b=bounds[id],x=i%w,y=Math.floor(i/w);b.x=Math.min(b.x,x);b.y=Math.min(b.y,y);b.right=Math.max(b.right,x);b.bottom=Math.max(b.bottom,y);b.pixels++;}
 const result={data,info,labels,bounds,seeds,sourceSha256:createHash('sha256').update(buffer).digest('hex')};cache.set(name,result);return result;
}
async function frame(sheet,index,scale){
 const b=sheet.bounds[index],seed=sheet.seeds[index];
 if(!seed||b.pixels<500)throw Error(`Missing real pose ${index}`);
 const w=b.right-b.x+1,h=b.bottom-b.y+1,pixels=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const original=(b.y+y)*sheet.info.width+b.x+x;if(sheet.labels[original]===index)sheet.data.copy(pixels,(y*w+x)*4,original*4,original*4+4);}
 const width=Math.round(w*scale),height=Math.round(h*scale);
 if(width>382||height>234)throw Error(`Pose exceeds frame: ${index}, ${width}x${height}`);
 const left=Math.round(192-(seed.x-b.x)*scale),top=235-height;
 if(left<0||left+width>384)throw Error(`Weapon exceeds frame ${index}: ${left}+${width}`);
 const png=await sharp(pixels,{raw:{width:w,height:h,channels:4}}).resize(width,height).png().toBuffer();
 return {png,left,top,bounds:b,pivot:seed,sha256:createHash('sha256').update(png).digest('hex')};
}
async function pack(name,directory,count,select){
 const pages=count>32?[{suffix:'',start:0,count:32},{suffix:'-combat',start:32,count:count-32}]:[{suffix:'',start:0,count}];
 for(const page of pages){
  const pieces=[],frames=[];
  for(let local=0;local<page.count;local++){
   const i=page.start+local,{sheet,index,scale,sourceName}=await select(i),f=await frame(sheet,index,scale);
   pieces.push({input:f.png,left:(local%4)*384+f.left,top:Math.floor(local/4)*256+f.top});
   frames.push({frame:local,globalFrame:i,source:sourceName,sourceFrame:index,bounds:f.bounds,pivot:f.pivot,sha256:f.sha256});
  }
  await mkdir(resolve(output,directory),{recursive:true});
  const image=await sharp({create:{width:1536,height:Math.ceil(page.count/4)*256,channels:4,background:'#00000000'}}).composite(pieces).png({compressionLevel:9}).toBuffer();
  await writeFile(resolve(output,directory,name+page.suffix+'.png'),image);
  audit.push({name:name+page.suffix,actor:name,path:`assets/${directory}/${name}${page.suffix}.png`,width:1536,height:Math.ceil(page.count/4)*256,frameWidth:384,frameHeight:256,count:page.count,globalStart:page.start,alpha:true,frames});
 }
}
for(const name of ['ember','jade','moon']){
 const original=await split(name,8,7),critical=await split(name+'-actions',4,4);
 const scaleBase=180/(original.bounds[0].bottom-original.bounds[0].y+1),scaleCritical=180/(critical.bounds[12].bottom-critical.bounds[12].y+1);
 await pack(name,'characters',52,async i=>{
  if(i>=32&&i<44)return{sheet:critical,index:i-32,scale:scaleCritical,sourceName:name+'-actions'};
  if(i>=48)return{sheet:critical,index:i-36,scale:scaleCritical,sourceName:name+'-actions'};
  return{sheet:original,index:i,scale:scaleBase,sourceName:name};
 });
}
for(const name of ['sentinel','moth','oni']){
 const original=await split(name,4,7),critical=name==='oni'?await split('oni-actions',4,4):null;
 const scaleBase=180/(original.bounds[0].bottom-original.bounds[0].y+1),scaleCritical=critical?Math.min(180/(critical.bounds[0].bottom-critical.bounds[0].y+1),232/Math.max(...critical.bounds.map(b=>b.bottom-b.y+1))):0;
 await pack(name,'enemies',28,async i=>{
  if(critical&&i>=8&&i<20)return{sheet:critical,index:i-8,scale:scaleCritical,sourceName:'oni-actions'};
  if(critical&&i>=24)return{sheet:critical,index:i-12,scale:scaleCritical,sourceName:'oni-actions'};
  return{sheet:original,index:i,scale:scaleBase,sourceName:name};
 });
}
for(const name of ['sky','night','inferno'])await sharp(resolve(source,name+'.png')).resize(720,1200).webp({quality:87}).toFile(resolve(output,'backgrounds',name+'.webp'));
const terrain=await split('terrain',4,2),names=['stone','fragile','moving','gate','wall','electric','volcanic','arena'];
for(let i=0;i<8;i++){
 const b=terrain.bounds[i],width=b.right-b.x+1,height=b.bottom-b.y+1,rgba=Buffer.alloc(width*height*4);
 if(b.pixels<500)throw Error('Missing terrain silhouette '+names[i]);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const pixel=(b.y+y)*terrain.info.width+b.x+x;if(terrain.labels[pixel]===i)terrain.data.copy(rgba,(y*width+x)*4,pixel*4,pixel*4+4);}
 await sharp(rgba,{raw:{width,height,channels:4}}).png().toFile(resolve(output,'platforms',names[i]+'.png'));
}
const anchors={};
for(const name of ['stone','fragile','moving','arena']){
 const {data,info}=await sharp(resolve(output,'platforms',name+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let top=0;
 for(let y=0;y<info.height;y++){
  let count=0,total=0;for(let x=Math.floor(info.width*.4);x<info.width*.6;x++){total++;if(data[(y*info.width+x)*4+3]>180)count++;}
  if(count/total>.8){top=y;break;}
 }
 anchors[name]=Number((top/info.height).toFixed(5));
}
await writeFile(resolve(root,'src/data/terrain.ts'),'// Generated by assets:prepare. Collision planes meet the painted top surface.\nexport const TERRAIN_TOP = '+JSON.stringify(anchors,null,2)+' as const;\n');
await writeFile(resolve(root,'docs/ART_FRAME_AUDIT.json'),JSON.stringify({generator:'built-in image_gen',actions,notes:'240 hand-drawn animation frames; alpha-aware technical separation and common foot anchors. No pose synthesis or interpolation.',atlases:audit},null,2));
console.log('Prepared 240 genuine animation frames, 3 distinct backgrounds, 8 terrain images.');
