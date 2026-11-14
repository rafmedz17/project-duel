// Visual dimensions only, in the gun's local coordinates (muzzle points -Z).
// One profile drives the receiver, barrel, moving parts and hand attachments.
const profile=(muzzle,rear,width,extra={})=>({muzzle,rear,width,front:-.24,pumpZ:-.33,boltZ:-.02,cell:[0,-.19,-.065],grip:[0,-.23,.15],support:[-.035,-.18,-.29],sightZ:-.10,hipZ:-.78,...extra})
export const MODEL_PROFILES=Object.freeze({
  phantom:profile(-.65,.38,.075,{front:-.27,support:[-.035,-.18,-.32],hipZ:-.79}),
  astral:profile(-.54,.40,.082,{front:-.24,cell:[0,-.17,.28],support:[-.035,-.17,-.27],sightZ:-.15,hipZ:-.76,bullpup:true}),
  hyperion:profile(-.89,.40,.069,{front:-.29,support:[-.025,-.17,-.36],hipZ:-.84}),
  railbreaker:profile(-.96,.39,.085,{front:-.30,support:[-.025,-.18,-.36],hipZ:-.86}),
  nova:profile(-.40,.29,.067,{front:-.22,cell:[0,-.18,-.09],support:[-.025,-.16,-.20],sightZ:-.065,hipZ:-.72}),
  striker:profile(-.45,.31,.074,{front:-.23,cell:[0,-.19,-.10],support:[-.03,-.17,-.23],sightZ:-.085,hipZ:-.73}),
  titan:profile(-.73,.37,.10,{front:-.30,cell:[0,-.20,-.055],support:[-.03,-.20,-.34],hipZ:-.81}),
  omega:profile(-.73,.34,.105,{front:-.24,cell:[0,-.21,.035],support:[-.035,-.21,-.24],sightZ:-.07,hipZ:-.82}),
  breach:profile(-.70,.36,.081,{front:-.25,pumpZ:-.39,support:[-.035,-.16,-.39],hipZ:-.80}),
  executor:profile(-.49,.33,.081,{front:-.19,pumpZ:-.28,support:[-.035,-.15,-.26],hipZ:-.74}),
  ravager:profile(-.59,.34,.092,{front:-.26,pumpZ:-.32,support:[-.035,-.18,-.30],hipZ:-.77}),
  echo:profile(-.235,.135,.052,{front:-.12,grip:[0,-.19,.09],support:[-.035,-.17,.075],cell:[0,-.20,.09],hipZ:-.65}),
  magnus:profile(-.38,.14,.052,{front:-.17,grip:[0,-.21,.105],support:[-.04,-.17,.08],cell:[0,-.065,-.045],hipZ:-.68,revolver:true}),
  volt:profile(-.27,.14,.055,{front:-.14,grip:[0,-.19,.10],support:[-.035,-.17,.085],cell:[0,-.20,.10],hipZ:-.66}),
})
export const modelProfile=weapon=>MODEL_PROFILES[weapon?.model] || MODEL_PROFILES.phantom
export const SIGHT_MODEL_SCALE=.92
