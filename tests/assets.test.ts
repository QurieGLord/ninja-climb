import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
describe('real game art and frame contracts',()=>{
 it('nine transparent atlas pages have nonempty distinct frames for every required action',async()=>{
  const audit=JSON.parse(await readFile('docs/ART_FRAME_AUDIT.json','utf8'));
  expect(audit.atlases).toHaveLength(9);
  for(const atlas of audit.atlases){
   const path='public/'+atlas.path,meta=await sharp(path).metadata();
   expect(meta.width).toBe(1536);expect(meta.height).toBe(atlas.height);expect(meta.height).toBeLessThanOrEqual(2048);expect(meta.hasAlpha).toBe(true);
   const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const unique=new Set<string>();
   for(let frame=0;frame<atlas.count;frame++){
    const col=frame%4,row=Math.floor(frame/4),alpha:number[]=[];
    for(let y=row*256;y<(row+1)*256;y++)for(let x=col*384;x<(col+1)*384;x++)alpha.push(data[(y*info.width+x)*4+3]!);
    expect(alpha.filter(a=>a>128).length,`${atlas.name}:${frame}`).toBeGreaterThan(500);
    expect(alpha.filter(a=>a===0).length).toBeGreaterThan(alpha.length/2);
    unique.add(atlas.frames[frame].sha256);
   }
   expect(unique.size).toBe(atlas.count);
  }
 });
 it('three environments are separate authored images and not reused references',async()=>{
  const hashes=new Set();for(const name of ['sky','night','inferno']){const bytes=await readFile(`public/assets/backgrounds/${name}.webp`);hashes.add(createHash('sha256').update(bytes).digest('hex'));const m=await sharp(bytes).metadata();expect(m.width).toBe(720);expect(m.height).toBe(1200);}
  expect(hashes.size).toBe(3);
 });
});
