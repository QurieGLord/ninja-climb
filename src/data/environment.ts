export const BIOME_LAYERS=[
  {id:'clouds',factor:.04,width:600,height:180,depth:-10,alpha:.35},
  {id:'mountains',factor:.10,width:500,height:520,depth:-9,alpha:.62},
  {id:'temples',factor:.23,width:480,height:580,depth:-7,alpha:.60},
  {id:'flora',factor:.43,width:480,height:700,depth:-5,alpha:.55},
  {id:'edges',factor:.72,width:480,height:820,depth:2,alpha:.72},
] as const;
/** Correct for ascent (negative cameraY), descent and restored large camera values. */
export function parallaxY(cameraY:number,factor:number,index:number,period:number){
  return ((-cameraY*factor+index*period)%(period*2)+period*2)%(period*2)-period*.5;
}
