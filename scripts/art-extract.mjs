import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function split(path,columns,rows){
 
 const buffer=await readFile(path);
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
 const result={data,info,labels,bounds,seeds,sourceSha256:createHash('sha256').update(buffer).digest('hex')};return result;
}
export async function extract(sheet,index){const b=sheet.bounds[index];if(b.pixels<100)throw Error('Empty authored frame '+index);const w=b.right-b.x+1,h=b.bottom-b.y+1,pixels=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const original=(b.y+y)*sheet.info.width+b.x+x;if(sheet.labels[original]===index)sheet.data.copy(pixels,(y*w+x)*4,original*4,original*4+4);}return {png:await sharp(pixels,{raw:{width:w,height:h,channels:4}}).png().toBuffer(),bounds:b,seed:sheet.seeds[index]};}
