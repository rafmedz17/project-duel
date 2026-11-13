import { ABILITIES } from '../../../../shared/abilities.js'
import { TRAINING_SOLIDS,TRAINING_TARGETS,targetPosition,targetYaw } from '../training/config.js'
import { ultimateModifiers } from '../../../../shared/characters.js'
import { launchGrenade,stepGrenade,flashDuration,blocked } from '../../../../shared/tactical.js'
import { WEAPONS } from '../../../../shared/weapons.js'

let grenades = []
export function resetTrainingAbilities() { grenades = [] }
export function activateTraining(s,time,id,{ position = [0,0,0],direction = [0,-1],yaw = 0,pitch = 0 } = {}) {
  const tuning = ABILITIES[id], previous = s.abilities[id], modifiers = ultimateModifiers(s,time)
  if (s.mode!=='playing' || !tuning || !s.loadout.abilities.includes(id) || (time<previous.readyAt && !(id==='dash' && modifiers.unlimitedDash))) return null
  if (!Array.isArray(position) || position.length!==3 || !position.every(Number.isFinite) || !Array.isArray(direction) || direction.length!==2 || !direction.every(Number.isFinite) || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return null
  if (id==='dash' && (time<s.rootedUntil || time<previous.activeUntil)) return null
  const length = Math.hypot(...direction) || 1
  const ability = { ...previous,readyAt:time+tuning.cooldown,activeUntil:time+tuning.duration,startedAt:time,uses:previous.uses+1,origin:[...position],direction:direction.map(value => value/length),result:0 }
  const patch = { time,abilities:{ ...s.abilities,[id]:ability } }
  if (id==='shield') patch.shieldCharge = tuning.capacity
  if (id==='ultimate') {
    const effect = ultimateModifiers({ ...s,...patch },time).effect
    if (effect==='shield') patch.ultimateShield = 200
    if (effect==='ammo') Object.assign(patch,{ reloading:false,reloadWeapon:null,reloadStart:0,reloadEnd:0,reloadReason:null,magazines:Object.fromEntries(Object.entries(WEAPONS).filter(([,weapon]) => weapon.magazine).map(([key,weapon]) => [key,weapon.magazine])) })
  }
  if (tuning.fuse) {
    const grenade = { ...launchGrenade(position,yaw,pitch),id }
    grenades.push(grenade)
    Object.assign(ability,{ activeUntil:0,flying:true,projectile:[...grenade.position] })
  }
  return patch
}
export function stepTrainingAbilities(s,time,dt,pose,publish) {
  if (!grenades.length) return null
  const abilities = { ...s.abilities }, patch = { abilities }, targets = s.targets.map(target => ({ ...target }))
  let detonated = false
  for (const grenade of grenades) {
    stepGrenade(grenade,dt,TRAINING_SOLIDS)
    const tuning = ABILITIES[grenade.id], ability = { ...abilities[grenade.id],projectile:[...grenade.position] }
    abilities[grenade.id] = ability
    if (grenade.age+1e-8<tuning.fuse) continue
    detonated = true; grenade.finished = true
    Object.assign(ability,{ flying:false,origin:[...grenade.position],activeUntil:time+tuning.duration,detonatedAt:time,result:0 })
    if (grenade.id==='flashbang') {
      const duration = flashDuration(grenade.position,pose,TRAINING_SOLIDS)
      if (duration>0) { patch.flashStarted = time; patch.flashUntil = Math.max(s.flashUntil,time+duration); ability.result++ }
    }
    if (grenade.id==='smoke') continue
    targets.forEach((target,index) => {
      if(TRAINING_TARGETS[index].kind!=='robot') return
      const [x,y,z]=targetPosition(index,target)
      if (targets[index].hp<=0) return
      if (grenade.id==='flashbang') {
        const duration = flashDuration(grenade.position,{ x,y,z,yaw:targetYaw(index,target,s.training,[pose.x,pose.y,pose.z]),pitch:0 },TRAINING_SOLIDS)
        if (duration>0) { targets[index].flashUntil = time+duration; ability.result++ }
      }
      if (grenade.id==='stun' && Math.hypot(x-grenade.position[0],y-grenade.position[1],z-grenade.position[2])<=tuning.radius && !blocked(grenade.position,[x,y,z],TRAINING_SOLIDS)) {
        targets[index].rootedUntil = time+tuning.duration; ability.result++
      }
    })
  }
  grenades = grenades.filter(grenade => !grenade.finished)
  if (detonated) patch.targets = targets
  return publish || detonated ? patch : null
}
