import { ULTIMATE_DURATION } from './characters.js'

export const ABILITIES = Object.freeze({
  dash:{ name:'DASH',key:'E',binding:'KeyE',category:'general',cooldown:3,duration:0.36,speed:20,color:'#57f5ff' },
  shield:{ name:'SHIELD',key:'F',binding:'KeyF',category:'general',cooldown:9,duration:3.5,capacity:50,color:'#74b9ff' },
  flashbang:{ name:'FLASHBANG',key:'C',binding:'KeyC',category:'unique',cooldown:14,duration:3,radius:10,fuse:0.9,color:'#fff2bb',description:'Blind yourself and enemies in sight. Teammates are immune.' },
  smoke:{ name:'SPECTRAL SMOKE',key:'C',binding:'KeyC',category:'unique',cooldown:18,duration:8,radius:4,fuse:0.9,color:'#8ce9d5',description:'Deploy smoke and see enemy silhouettes through your own cloud.' },
  stun:{ name:'GRAVITY SNARE',key:'C',binding:'KeyC',category:'unique',cooldown:16,duration:3,radius:6,fuse:0.9,color:'#c4a0ff',description:'A stun grenade roots enemies in place. You and teammates are immune.' },
  scanner:{ name:'GLOBAL SCAN',key:'C',binding:'KeyC',category:'unique',cooldown:18,duration:5,range:1000,color:'#a5ff9b',description:'Reveal enemies anywhere on the map, including behind cover.' },
  ultimate:{ name:'ULTIMATE',key:'X',binding:'KeyX',category:'ultimate',cooldown:45,duration:ULTIMATE_DURATION,color:'#ffbc74' },
})
export const UNIQUE_SKILLS = ['flashbang','smoke','stun','scanner']
export function abilityForBinding(loadout,code) {
  return code==='KeyE' ? 'dash' : code==='KeyF' ? 'shield' : code==='KeyC' ? loadout.unique : code==='KeyX' ? 'ultimate' : null
}
export function freshAbility() {
  return { readyAt:0,activeUntil:0,startedAt:-10,uses:0,result:0,origin:[0,0,0],direction:[0,-1],flying:false,projectile:[0,0,0],detonatedAt:-10 }
}
