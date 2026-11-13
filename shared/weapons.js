export const WEAPON_SWITCH = 0.25
const gun = (number,name,category,damage,rpm,magazine,reload,accuracy,extra={}) => ({ number,name,category,damage,rpm,magazine,reload,accuracy,cooldown:60/rpm,range:75,fireMode:'auto',movement:1,recoil:0.006,color:'#57f5ff',slot:'1',binding:'Digit1',shortName:name,available:true,...extra })
const sidearm = { category:'PISTOL',slot:'2',binding:'Digit2',fireMode:'semi',range:65 }
const melee = (number,name,damage,rpm,range,extra={}) => ({ number,name,shortName:name,category:'MELEE',damage,rpm,cooldown:60/rpm,range,swing:0.4,windup:0,recoil:0,fireMode:'melee',movement:1,color:'#57f5ff',slot:'3',binding:'Digit3',available:true,...extra })
export const WEAPONS = Object.freeze({
  rifle:gun('01','VXR-9 PHANTOM','RIFLE',24,600,30,2,82,{ description:'Stable recoil. A reliable medium-range all-rounder.',model:'phantom',recoil:0.004 }),
  astral:gun('02','ASTRAL-7 VANGUARD','RIFLE',18,900,27,2.2,91,{ description:'A precise three-round burst. Make every volley count.',model:'astral',fireMode:'burst',burst:3,burstInterval:60/900,cooldown:0.45,color:'#9eabff',recoil:0.003 }),
  hyperion:gun('03','HYPERION X','SNIPER',90,45,5,2.8,98,{ description:'90 body / 180 head. Precision bolt cycling and a long recovery.',model:'hyperion',fireMode:'semi',range:160,movement:0.93,equip:0.38,recoil:0.022,color:'#8cdbff',scope:true }),
  railbreaker:gun('04','RAILBREAKER-12','SNIPER',110,30,3,3.2,95,{ description:'110 body / 165 head. Penetrates up to 0.35m of thin cover at 70% damage.',model:'railbreaker',headMultiplier:1.5,penetration:0.35,penetrationDamage:0.7,fireMode:'semi',range:160,movement:0.85,equip:0.5,recoil:0.035,color:'#ffa66c',scope:true }),
  nova:gun('05','NOVA-9','SMG',15,900,36,1.7,70,{ description:'A mobile close-range SMG. Move 12% faster while equipped.',model:'nova',movement:1.12,range:45,color:'#8affc6',recoil:0.006 }),
  striker:gun('06','STRIKER-11','SMG',12,1100,40,2.1,62,{ description:'Blistering fire with strong recoil and rapid ammunition use.',model:'striker',range:40,color:'#ff779d',recoil:0.014 }),
  titan:gun('07','TITAN-60','LMG',22,550,60,3.4,73,{ description:'Sustained suppressive fire. Heavy handling and a slow reload.',model:'titan',movement:0.85,recoil:0.009,color:'#f8ca73' }),
  omega:gun('08','OMEGA-88','LMG',13,1000,100,4.5,58,{ description:'Six rotating barrels, 0.6s spin-up and a massive energy drum. Move 28% slower.',model:'omega',spinUp:0.6,movement:0.72,equip:0.45,recoil:0.01,color:'#ff9667' }),
  shotgun:gun('09','BREACH-12','SHOTGUN',12,70,6,2.5,68,{ description:'Ten-pellet pump-action burst. Devastating nearby, weak at distance.',model:'breach',fireMode:'semi',pellets:10,spread:0.058,fullDamageRange:5,minDamageMultiplier:0.1,range:24,recoil:0.027,color:'#ffcc72' }),
  executor:gun('10','EXECUTOR-2','SHOTGUN',16,100,2,2.6,60,{ description:'Two barrels, eight pellets each and rapid follow-up shots. Missing is expensive.',model:'executor',fireMode:'semi',pellets:8,spread:0.072,fullDamageRange:4,minDamageMultiplier:0.08,range:22,recoil:0.038,color:'#ff829b' }),
  ravager:gun('11','RAVAGER-8','SHOTGUN',8,180,8,3,55,{ description:'Automatic eight-pellet blasts. Wide spread and rapid follow-up shots.',model:'ravager',pellets:8,spread:0.09,fullDamageRange:4,minDamageMultiplier:0.08,range:20,recoil:0.019,color:'#b9a0ff' }),
  pistol:gun('12','ECHO-9','PISTOL',28,300,15,1.3,88,{ ...sidearm,description:'An accurate, reliable backup with a quick energy-cell reload.',model:'echo',recoil:0.006 }),
  magnus:gun('13','MAGNUS-45','PISTOL',48,180,8,1.8,78,{ ...sidearm,description:'Heavy single shots with strong kick and slower recovery.',model:'magnus',recoil:0.028,color:'#ffb86b' }),
  volt:gun('14','VOLT-3','PISTOL',14,900,24,1.6,75,{ ...sidearm,description:'A three-shot energy burst for quick finishing attacks.',model:'volt',fireMode:'burst',burst:3,burstInterval:60/900,cooldown:0.4,color:'#b39aff' }),
  blade:melee('15','PHANTOM EDGE',50,75,2.5,{ description:'A balanced energy blade with a quick, sweeping slash.',model:'edge',swing:0.38 }),
  gravity:melee('16','GRAVITY BREAKER',85,40,2.2,{ description:'A charged hammer impact with 0.45s wind-up and collision-safe knockback.',model:'breaker',windup:0.45,swing:0.9,knockback:0.9,color:'#c1a0ff' }),
  fangs:melee('17','VOID FANGS',28,130,1.8,{ description:'Alternating dual daggers. Fast combos reward close-range timing.',model:'fangs',swing:0.28,color:'#9cffe6' }),
})
export const PISTOL=WEAPONS.pistol, BLADE=WEAPONS.blade, RIFLE=WEAPONS.rifle, SHOTGUN=WEAPONS.shotgun
export const WEAPON_IDS = Object.keys(WEAPONS)
export const PRIMARY_IDS = WEAPON_IDS.filter(id=>WEAPONS[id].slot==='1')
export const SECONDARY_IDS = WEAPON_IDS.filter(id=>WEAPONS[id].slot==='2')
export const MELEE_IDS = WEAPON_IDS.filter(id=>WEAPONS[id].slot==='3')
export const isMelee = id => WEAPONS[id]?.fireMode==='melee'
export const equipTime = id => WEAPONS[id]?.equip || WEAPON_SWITCH
export const movementMultiplier = id => WEAPONS[id]?.movement || 1
export const freshMagazines = () => Object.fromEntries(WEAPON_IDS.filter(id=>WEAPONS[id].magazine).map(id=>[id,WEAPONS[id].magazine]))
export const shotOffsets = (weapon,rate=1) => Array.from({ length:weapon.burst || 1 },(_,index)=>((weapon.windup || 0)+index*(weapon.burstInterval || 0))/rate)
export const accuracySpread = weapon => weapon.fireMode==='melee' ? 0 : (100-(weapon.accuracy || 100))*0.00022
export const DAMAGE_MULTIPLIERS = Object.freeze({ head:2,body:1,limb:0.75,foot:0.5 })
export function pelletDamage(weapon,distance,region = 'body') {
  if (!Number.isFinite(distance) || distance<0 || distance>weapon.range || !Object.hasOwn(DAMAGE_MULTIPLIERS,region)) return 0
  const falloff = weapon.pellets ? Math.max(0,(distance-weapon.fullDamageRange)/(weapon.range-weapon.fullDamageRange)) : 0
  const base = Math.round(weapon.damage*(1-falloff*(1-(weapon.minDamageMultiplier ?? 1))))
  return Math.round(base*(region==='head' ? (weapon.headMultiplier ?? 2) : DAMAGE_MULTIPLIERS[region]))
}
