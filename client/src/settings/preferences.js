import { audioSettings, DEFAULT_AUDIO } from '../audio/settings.js'

export const ACTIONS = [
  ['forward','Move forward','KeyW'],['backward','Move backward','KeyS'],['left','Strafe left','KeyA'],['right','Strafe right','KeyD'],
  ['jump','Jump','Space'],['sprint','Sprint','ShiftLeft'],['fire','Fire / melee','Mouse0'],['aim','Aim / scope','Mouse2'],
  ['reload','Reload','KeyR'],['primary','Primary weapon','Digit1'],['secondary','Secondary pistol','Digit2'],['melee','Melee weapon','Digit3'],
  ['cycle','Cycle weapons','KeyQ'],['inspect','Inspect weapon','KeyT'],['dash','Dash','KeyE'],['shield','Shield','KeyF'],
  ['unique','Unique skill','KeyC'],['ultimate','Ultimate','KeyX'],['armory','Training armory','KeyB'],['course','Start / stop training course','KeyG'],
  ['scoreboard','Hold scoreboard','Tab'],
]
export const DEFAULT_BINDINGS=Object.freeze(Object.fromEntries(ACTIONS.map(([id,,code])=>[id,code])))
export const DEFAULT_PREFERENCES=Object.freeze({ sensitivity:1,fps:false,fov:70,scopeMode:'hold',damageNumbers:true,damageOpacity:1,damageStyle:'classic',quality:'Medium',flashColor:'white',enemyAura:true,enemyColor:'#ff5876',crosshair:{ style:'cross',color:'#d6faff',size:10,gap:4,thickness:2,opacity:1,dot:true },bindings:DEFAULT_BINDINGS,...DEFAULT_AUDIO })
const clamp=(value,min,max,fallback)=>typeof value==='number' && Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback
const color=(value,fallback)=>typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
export const validBinding=code=>typeof code==='string' && /^(Key[A-Z]|Digit[0-9]|F[1-9]|F1[0-2]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Tab|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|Mouse[0-4])$/.test(code)
export function cleanBindings(value) {
  const result={ ...DEFAULT_BINDINGS }
  if(!value || typeof value!=='object') return result
  // Swap collisions so every action always retains a distinct usable binding.
  for(const [id] of ACTIONS) if(validBinding(value[id])) Object.assign(result,rebind(result,id,value[id]))
  return result
}
export function rebind(bindings,id,code) {
  if(!Object.hasOwn(DEFAULT_BINDINGS,id) || !validBinding(code)) return bindings
  const other=Object.keys(bindings).find(key=>key!==id && bindings[key]===code)
  return { ...bindings,[id]:code,...(other ? { [other]:bindings[id] } : {}) }
}
export function cleanPreferences(value={}) {
  const v=value && typeof value==='object' ? value : {}, d=DEFAULT_PREFERENCES,c=v.crosshair || {}
  return { sensitivity:clamp(v.sensitivity,.2,3,d.sensitivity),fps:v.fps===true,fov:clamp(v.fov,60,110,d.fov),scopeMode:v.scopeMode==='tap' ? 'tap' : 'hold',damageNumbers:v.damageNumbers!==false,damageOpacity:clamp(v.damageOpacity,.1,1,1),damageStyle:v.damageStyle==='stacked' ? 'stacked' : 'classic',quality:['Low','Medium','High'].includes(v.quality) ? v.quality : d.quality,flashColor:v.flashColor==='black' ? 'black' : 'white',enemyAura:v.enemyAura!==false,enemyColor:color(v.enemyColor,d.enemyColor),crosshair:{ style:['cross','dot','circle'].includes(c.style) ? c.style : 'cross',color:color(c.color,d.crosshair.color),size:clamp(c.size,3,24,10),gap:clamp(c.gap,0,14,4),thickness:clamp(c.thickness,1,5,2),opacity:clamp(c.opacity,.1,1,1),dot:c.dot!==false },bindings:cleanBindings(v.bindings),...audioSettings(v) }
}
export function bindingLabel(code) {
  return ({ Mouse0:'LEFT CLICK',Mouse1:'MIDDLE CLICK',Mouse2:'RIGHT CLICK',Mouse3:'MOUSE 4',Mouse4:'MOUSE 5',Space:'SPACE',ShiftLeft:'L SHIFT',ShiftRight:'R SHIFT',ControlLeft:'L CTRL',ControlRight:'R CTRL',Backquote:'`' })[code] || code?.replace(/^Key|^Digit/,'').replace(/([a-z])([A-Z])/g,'$1 $2').toUpperCase() || '—'
}
export const physicalCode=event=>event.type?.includes('mouse') ? `Mouse${event.button}` : event.code
export function canonicalCode(event,settings) {
  const code=physicalCode(event),bindings=settings.bindings
  const action=ACTIONS.find(([id])=>bindings[id]===code)
  if(!action && code==='ShiftRight' && bindings.sprint==='ShiftLeft') return 'ShiftRight'
  return action?.[2] || null
}
export const abilityKey=(id,settings)=>bindingLabel(settings.bindings[['dash','shield','ultimate'].includes(id) ? id : 'unique'])
