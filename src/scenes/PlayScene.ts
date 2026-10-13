import Phaser from 'phaser';
import { RunModel, type RunSnapshot } from '../game/RunModel';
import type { Controls } from '../game/types';
import type { Services } from '../game/Services';
import { WorldView } from '../rendering/WorldView';
import {RenderInterpolation} from '../rendering/interpolation';
export class PlayScene extends Phaser.Scene {
  model!:RunModel;
  private world!:WorldView;
  private services!:Services;
  private accumulator=0;
  private checkpointTime=0;
  private bestHeight=0;
  private lastScore=0;
  private pending={jump:false,dash:false,attack:false};
  private interpolation=new RenderInterpolation();
  constructor(){super('Play');}
  create(data:{snapshot?:RunSnapshot}){
    this.services=this.registry.get('services') as Services;
    this.model=new RunModel(data.snapshot,undefined,{tutorialComplete:this.services.store.data.tutorialComplete});
    this.accumulator=0;this.checkpointTime=0;this.bestHeight=this.services.store.data.bestHeight;this.lastScore=this.model.state.score;
    this.pending={jump:false,dash:false,attack:false};
    this.world=new WorldView(this,this.services.store.data.selectedSkin);
    if(!data.snapshot)this.services.store.beginRun(this.model.snapshot());
    this.interpolation.capture(this.model.state);this.world.render(this.model.state);this.services.onRunUpdate(this.model.state);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.save());
  }
  save(){if(this.model)this.services.store.checkpoint(this.model.snapshot());}
  resetTiming(){this.accumulator=0;this.pending={jump:false,dash:false,attack:false};if(this.model)this.interpolation.capture(this.model.state);}
  update(_time:number,delta:number){
    const paused=this.services.pause.paused;
    this.model.setPaused(paused);this.world.setPaused(paused||this.model.state.hitStop>0);
    if(paused||this.model.state.ended){this.accumulator=0;this.interpolation.capture(this.model.state);this.pending={jump:false,dash:false,attack:false};this.tweens.timeScale=0;return;}
    this.tweens.timeScale=this.model.state.hitStop>0?0:1;
    this.accumulator+=Math.min(delta/1000,0.08);
    const controls:Controls=this.services.input.read();
    for(const key of ['jump','dash','attack'] as const){this.pending[key] ||= controls[key];controls[key]=this.pending[key];}
    while(this.accumulator>=1/120){
      this.interpolation.capture(this.model.state);
      this.model.step(1/120,controls);
      controls.jump=false;controls.dash=false;controls.attack=false;
      this.pending={jump:false,dash:false,attack:false};this.accumulator-=1/120;
    }
    let earned=0;
    for(const event of this.model.drainEvents()){
      const y=event.y;
      const sound=event.type==='land'||event.type==='wall'?'jump':event.type==='dash'||event.type==='block'?'attack':event.type==='hit'?'kill':event.type==='warning'?null:event.type;
      if(sound)this.services.audio.play(sound);
      if('amount'in event){
        earned+=event.amount;
        this.world.burst(event.x,y,event.type==='coin'?0xefca7f:0xe78571);
        this.world.floating(event.x,y-22,event.type==='boss'?`СТРАЖ ПОВЕРЖЕН  +${event.amount}`:`+${event.amount}`);
      }else if(['land','wall'].includes(event.type))this.world.burst(event.x,y,0xc3d6bc);
      else if(event.type==='hit'){this.world.burst(event.x,y,0xf7da9d);this.cameras.main.shake(55,0.002);}
      else if(event.type==='block'){this.world.burst(event.x,y,0xb1d5de);this.world.floating(event.x,y-30,'ДОЖДИСЬ ОКНА','#b8d9dd');}
      else if(event.type==='hurt'){this.cameras.main.shake(120,0.007);this.world.burst(event.x,y,0xef8e78);}
    }
    const s=this.model.state;
    if(earned>0||s.height>this.bestHeight||s.score!==this.lastScore||s.elapsed-this.checkpointTime>0.75||s.ended){
      this.services.store.checkpoint(this.model.snapshot(),earned);this.checkpointTime=s.elapsed;this.bestHeight=Math.max(this.bestHeight,s.height);this.lastScore=s.score;
    }
    this.world.render(s,this.interpolation,this.accumulator/(1/120),s.hitStop>0?0:Math.min(delta/1000,.05));this.services.onRunUpdate(s);
    if(s.ended)this.services.onRunEnd(s);
  }
}
