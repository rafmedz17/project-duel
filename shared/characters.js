export const ULTIMATE_DURATION = 10
export const CHARACTERS = Object.freeze({
  vex:{ name:'VEX',title:'THE PHANTOM DASH',role:'MOBILITY',color:'#31d9ff',secondary:'#14577f',armor:'#34485f',trim:'#a1b5ce',cloth:'#101f36',motif:'runner',number:'01',description:'A hooded phantom in bladed titanium armor, traced with cyan phase circuitry.',ultimate:'UNLI DASH',effect:'dash',summary:'Unlimited Dash and +50% movement speed for 10 seconds.',detail:'Dash repeatedly without its normal cooldown and move 50% faster while moving. Stuns still stop movement.' },
  aegis:{ name:'SPECTRA',title:'THE SHIELD GUARDIAN',role:'DEFENSE',color:'#b56aff',secondary:'#53427f',armor:'#72768e',trim:'#bbc1d6',cloth:'#171326',motif:'warden',number:'02',description:'A violet guardian in layered silver armor, carrying a radiant crystalline reactor.',ultimate:'SUPER SHIELD',effect:'shield',summary:'+200 temporary shield for 10 seconds.',detail:'Gain a separate 200-point shield on top of your general Shield. Remaining bonus shield expires after 10 seconds.' },
  ion:{ name:'ZERO',title:'THE ENDLESS FIGHTER',role:'SUSTAIN',color:'#ffcd3d',secondary:'#8e6823',armor:'#343b47',trim:'#c99b35',cloth:'#141a23',motif:'engine',number:'03',description:'A gold-trimmed tactical fighter with a swept helmet and an inexhaustible reactor.',ultimate:'NO RELOAD',effect:'ammo',summary:'No reload for 10 seconds.',detail:'Refill your magazines, cancel the current reload and fire without consuming ammunition for 10 seconds.' },
  raze:{ name:'AXIOM',title:'THE FIRESTORM',role:'ASSAULT',color:'#ff454e',secondary:'#8e273b',armor:'#353540',trim:'#c54b55',cloth:'#201421',motif:'hunter',number:'04',description:'A crimson armored fighter in a split battle coat, built to dominate the firing line.',ultimate:'BOOST FIRE RATE + DMG',effect:'power',summary:'+50% fire rate and damage for 10 seconds.',detail:'Weapon damage and attack speed increase by 50%. Range and regional damage rules still apply.' },
})
export const CHARACTER_IDS = Object.keys(CHARACTERS)
export const getCharacter = id => CHARACTERS[id] || CHARACTERS.vex
export function ultimateModifiers(state,time = state.time || 0) {
  const ultimate = state.abilities?.get ? state.abilities.get('ultimate') : state.abilities?.ultimate
  const active = state.hp>0 && time<(ultimate?.activeUntil || 0)
  const effect = active ? getCharacter(state.characterId || state.loadout?.character).effect : ''
  return { active,effect,unlimitedDash:effect==='dash',movement:effect==='dash' ? 1.5 : 1,noReload:effect==='ammo',damage:effect==='power' ? 1.5 : 1,fireRate:effect==='power' ? 1.5 : 1 }
}
