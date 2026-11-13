import { equipTime } from '../../../../shared/weapons.js'
const clamp=value=>Math.max(0,Math.min(1,value))
const ease=(a,b,value)=>{ const t=clamp((value-a)/(b-a));return t*t*(3-2*t) }
export function weaponAnimation(s,time,weapon) {
  const reload=s.reloading ? clamp((time-s.reloadStart)/(s.reloadEnd-s.reloadStart)) : 0
  const reloadPose=ease(0,0.18,reload)*(1-ease(0.82,1,reload))
  const drop=ease(0.15,0.36,reload)*(1-ease(0.57,0.8,reload))
  const elapsed=Math.max(0,time-s.lastShot),kick=Math.exp(-elapsed*(weapon.category==='SNIPER' ? 12 : 25))*Number(elapsed<0.7)
  const progress=clamp((time-s.lastSwing)/(weapon.swing || 0.4)),hit=weapon.windup ? ease(0.3,0.5,progress)*(1-ease(0.6,1,progress)) : Math.sin(progress*Math.PI)
  const windup=s.windupEnd>time ? clamp((time-s.windupStart)/(s.windupEnd-s.windupStart)) : 0
  return { reload,reloadPose,drop,kick,hit,windup,equip:1-clamp((time-s.lastSwitch)/equipTime(s.weapon)),bolt:Math.sin(Math.PI*ease(0.08,0.65,elapsed)),pump:weapon.model==='breach' ? Math.sin(Math.PI*ease(0.14,0.65,elapsed)) : 0,hinge:weapon.model==='executor' ? reloadPose*0.85 : 0,flash:elapsed<0.055 && s.hp>0,spin:s.spinning ? ease(0,weapon.spinUp || 0.6,time-s.spinStarted) : Math.exp(-Math.max(0,time-s.lastShot)*6) }
}
