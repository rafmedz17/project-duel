import { WEAPONS,equipTime } from '../../../../shared/weapons.js'

export const REFLEX_LENS_POSITION=[0,0.3,-0.08]
export const REFLEX_AIM_POSITION=[0,-0.3,-0.52]
export const REFLEX_PROFILES=Object.freeze({
  RIFLE:{ variant:'angular',name:'PHASE HOLO',fov:50,zoom:'1.5×' },
  SMG:{ variant:'compact',name:'VECTOR REFLEX',fov:56,zoom:'1.3×' },
  LMG:{ variant:'reinforced',name:'SENTINEL REFLEX',fov:52,zoom:'1.4×' },
})
export const reflexProfile=weapon=>REFLEX_PROFILES[weapon?.category] || null
export function activeOptic(state,time,aiming) {
  const weapon=WEAPONS[state.weapon]
  if(!aiming || !weapon || state.hp<=0 || state.reloading || time-(state.lastSwitch ?? -10)<equipTime(state.weapon)) return null
  return weapon.scope ? 'precision' : reflexProfile(weapon) ? 'reflex' : null
}
export function aimFov(state,time,aiming,dashing=false,baseFov=70) {
  const optic=activeOptic(state,time,aiming)
  return optic==='precision' ? 32 : optic==='reflex' ? reflexProfile(WEAPONS[state.weapon]).fov : dashing ? Math.min(117,baseFov+7) : baseFov
}
