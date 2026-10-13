/** One menu clock shared by every costume, independent of load/animation restarts. */
export class IdleClock{
  private elapsed=0;
  private last:number|null=null;
  resetTimestamp(){this.last=null;}
  frame(timeMs:number,paused=false){
    const dt=this.last===null?0:Math.max(0,(timeMs-this.last)/1000);this.last=timeMs;
    if(!paused)this.elapsed+=Math.min(dt,.08);
    return Math.floor((this.elapsed+1e-8)*7)%8;
  }
}
