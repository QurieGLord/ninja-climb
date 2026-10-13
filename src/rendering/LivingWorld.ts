import Phaser from 'phaser';
import {BIOME_LAYERS,parallaxY} from '../data/environment';
import {ZONES} from '../data/config';
import {ENV_CROPS} from '../data/environment-crops';
type Layer={image:Phaser.GameObjects.Image;zone:number;definition:typeof BIOME_LAYERS[number];copy:number};
type Mote={image:Phaser.GameObjects.Image;x:number;y:number;vx:number;vy:number;phase:number};
export class LivingWorld{
  private skies:Phaser.GameObjects.Image[]=[];
  private layers:Layer[]=[];
  private weights=[0,0,0];
  private mist:Phaser.GameObjects.Image[]=[];
  private motes:Mote[]=[];
  private water:Phaser.GameObjects.Image[]=[];
  private lanterns:Phaser.GameObjects.Image[]=[];
  private time=0;
  private initialized=false;
  constructor(scene:Phaser.Scene){
    ZONES.forEach((z,zone)=>{
      this.skies.push(scene.add.image(240,400,`bg-${z.id}`).setDisplaySize(480,800).setDepth(-12).setAlpha(0));
      for(const definition of BIOME_LAYERS)for(let copy=0;copy<2;copy++){
        const ranges=ENV_CROPS[`${z.id}-${definition.id}` as keyof typeof ENV_CROPS]??[{x:0,width:480}];
        for(const range of ranges){const image=scene.add.image(240,400,`env-${z.id}-${definition.id}`).setDisplaySize(definition.width,definition.height).setDepth(definition.depth).setVisible(false);image.setCrop(range.x,0,range.width,image.frame.realHeight);this.layers.push({image,zone,definition,copy});}
      }
    });
    for(let i=0;i<3;i++)this.mist.push(scene.add.image(120+i*140,160+i*250,'fx-mist').setDepth(-3).setAlpha(.10).setScale(1.8,1));
    for(let i=0;i<30;i++)this.motes.push({image:scene.add.image(0,0,'fx-dot').setDepth(i%3===0?4:-2).setScale(.12+i%3*.05),x:(i*137)%480,y:(i*193)%800,vx:6+i%5*2,vy:8+i%7,phase:i*2.7});
    for(let i=0;i<3;i++)this.water.push(scene.add.image(i%2?445:35,200+i*300,'fx-mist').setDepth(-6).setDisplaySize(8,190).setTint(0xc1e8eb));
    for(let i=0;i<4;i++)this.lanterns.push(scene.add.image(i%2?439:42,90+i*210,'fx-lantern').setDepth(-4));
  }
  render(index:number,cameraY:number,dt:number,player:{x:number;y:number;dashLeft:number}){
    this.time+=dt;const t=this.time;
    if(!this.initialized){this.weights[index]=1;this.initialized=true;}
    for(let i=0;i<3;i++){this.weights[i]=this.weights[i]!+(Number(i===index)-this.weights[i]!)*Math.min(1,dt*2.5);if(this.weights[i]!<.002)this.weights[i]=0;this.skies[i]!.setAlpha(this.weights[i]!);}
    for(const layer of this.layers){
      const weight=this.weights[layer.zone]!;layer.image.setVisible(weight>0);if(!weight)continue;
      const d=layer.definition;
      layer.image.setPosition(240+(d.id==='clouds'?Math.sin(t*.045+layer.copy)*70:d.id==='flora'?Math.sin(t*.5+layer.copy)*3:Math.sin(t*.08)*2),parallaxY(cameraY,d.factor,layer.copy,d.id==='clouds'?800:d.height)).setAlpha(weight*d.alpha).setRotation(d.id==='flora'?Math.sin(t*.6+layer.copy)*.008:0);
    }
    this.mist.forEach((m,i)=>m.setPosition(((t*(4+i*2)+i*197)%850)-150,150+i*270+Math.sin(t*.2+i)*14).setTint(ZONES[index]!.atmosphere));
    for(const p of this.motes){
      const dy=p.y-(player.y-cameraY),dx=p.x-player.x;
      if(player.dashLeft>0&&dx*dx+dy*dy<120*120){p.vx+=dx*dt*3;p.vy+=dy*dt*3;}
      p.x=(p.x+(p.vx+Math.sin(t+p.phase)*4)*dt+500)%500;p.y=(p.y+p.vy*dt+820)%820;
      p.vx+=(8-p.vx)*dt;p.vy+=((index===2?-13:10)-p.vy)*dt;
      p.image.setPosition(p.x-10,p.y-10).setTint(index===2?0xffbd82:index===1?0xc2e8ee:0xf5cdbd).setAlpha(p.x>100&&p.x<380?.16:.4).setRotation(t*.6+p.phase);
    }
    this.water.forEach((w,i)=>w.setVisible(index===1).setY(parallaxY(cameraY,.2,i%2,500)+Math.sin(t*2+i)*10).setAlpha(.14+Math.sin(t*3+i)*.05));
    this.lanterns.forEach((l,i)=>l.setPosition(i%2?439:42,parallaxY(cameraY,.3,i%2,420)+(i>1?210:0)).setVisible(index!==0).setAlpha(.4+Math.sin(t*2.1+i)*.09));
  }
}
