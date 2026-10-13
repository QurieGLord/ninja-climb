import type {PlatformKind} from './config';
const variants={sky:['roof','stone','bamboo','temple','broken-roof'],night:['temple','roof','bamboo','stone'],inferno:['volcanic','broken-roof','temple']} as const;
export function terrainStyle(kind:PlatformKind,zone:keyof typeof variants,id:number){
  if(kind==='cloud')return'moving';if(kind==='fragile')return'fragile';if(kind==='arena')return'arena';
  const options=variants[zone];return options[Math.abs(id)%options.length]!;
}
