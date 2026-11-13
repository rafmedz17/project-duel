export const ULTIMATE_DURATION = 10
export const CHARACTERS = Object.freeze({
  vex:{ name:'VEX',title:'THE PHASE RUNNER',role:'MOBILITY',color:'#57f5ff',secondary:'#284ca9',armor:'#243d56',motif:'runner',number:'01',description:'A slipstream pilot rebuilt around a volatile phase core.',ultimate:'PHASE OVERDRIVE',effect:'dash',summary:'Unlimited Dash and +50% movement speed for 10 seconds.',detail:'Dash repeatedly without its normal cooldown and move 50% faster while walking or sprinting. Stuns still stop movement.' },
  aegis:{ name:'AEGIS',title:'THE ORBITAL WARDEN',role:'DEFENSE',color:'#ffcc72',secondary:'#dc6135',armor:'#4a3940',motif:'warden',number:'02',description:'A siege-frame sentinel carrying the last light of its orbital colony.',ultimate:'FORTRESS PROTOCOL',effect:'shield',summary:'+200 temporary shield for 10 seconds.',detail:'Gain a separate 200-point shield on top of your general Shield. Remaining bonus shield expires after 10 seconds.' },
  ion:{ name:'ION',title:'THE INFINITE ENGINE',role:'SUSTAIN',color:'#b39aff',secondary:'#6136e3',armor:'#34304f',motif:'engine',number:'03',description:'A living reactor that turns unstable energy into an endless ammunition feed.',ultimate:'INFINITE CIRCUIT',effect:'ammo',summary:'No reload for 10 seconds.',detail:'Refill your magazines, cancel the current reload and fire without consuming ammunition for 10 seconds.' },
  raze:{ name:'RAZE',title:'THE REDLINE HUNTER',role:'ASSAULT',color:'#ff7089',secondary:'#ff9e61',armor:'#4b2b3d',motif:'hunter',number:'04',description:'A precision hunter who trades reactor stability for overwhelming force.',ultimate:'REDLINE SURGE',effect:'power',summary:'+50% fire rate and damage for 10 seconds.',detail:'Weapon damage and attack speed increase by 50%. Range and regional damage rules still apply.' },
})
export const CHARACTER_IDS = Object.keys(CHARACTERS)
export const getCharacter = id => CHARACTERS[id] || CHARACTERS.vex
export function ultimateModifiers(state,time = state.time || 0) {
  const ultimate = state.abilities?.get ? state.abilities.get('ultimate') : state.abilities?.ultimate
  const active = state.hp>0 && time<(ultimate?.activeUntil || 0)
  const effect = active ? getCharacter(state.characterId || state.loadout?.character).effect : ''
  return { active,effect,unlimitedDash:effect==='dash',movement:effect==='dash' ? 1.5 : 1,noReload:effect==='ammo',damage:effect==='power' ? 1.5 : 1,fireRate:effect==='power' ? 1.5 : 1 }
}
