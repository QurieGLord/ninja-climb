import type { RunSnapshot } from '../game/types';
const mix=(previous:number,current:number,alpha:number)=>previous+(current-previous)*Math.max(0,Math.min(1,alpha));
/** Previous fixed-step positions only; never writes into the simulation/save. */
export class RenderInterpolation {
  private player={x:240,y:686};
  private camera=0;
  private platforms=new Map<number,number>();
  private enemyX=new Map<number,number>();
  private enemyY=new Map<number,number>();
  capture(s:RunSnapshot){
    this.player.x=s.player.x;this.player.y=s.player.y;this.camera=s.cameraY;
    this.platforms.clear();this.enemyX.clear();this.enemyY.clear();
    for(const p of s.platforms)this.platforms.set(p.id,p.x);
    for(const e of s.enemies){this.enemyX.set(e.id,e.x);this.enemyY.set(e.id,e.y);}
  }
  playerX(s:RunSnapshot,a:number){return mix(this.player.x,s.player.x,a);}
  playerY(s:RunSnapshot,a:number){return mix(this.player.y,s.player.y,a);}
  cameraY(s:RunSnapshot,a:number){return mix(this.camera,s.cameraY,a);}
  platformX(id:number,current:number,a:number){return mix(this.platforms.get(id)??current,current,a);}
  x(id:number,current:number,a:number){return mix(this.enemyX.get(id)??current,current,a);}
  y(id:number,current:number,a:number){return mix(this.enemyY.get(id)??current,current,a);}
}
