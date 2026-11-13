import { ARENA_SOLIDS, PLAYER, ONLINE } from '../../../shared/arena.js'
import { WEAPONS, pelletDamage, freshMagazines, equipTime, isMelee, shotOffsets } from '../../../shared/weapons.js'
import { rayRobot, shotDirections, coverTransmission } from '../../../shared/ballistics.js'
import { DEFAULT_LOADOUT } from '../../../shared/loadout.js'
import { ABILITIES } from '../../../shared/abilities.js'
import { AbilityState } from '../rooms/LobbyState.js'
import { ultimateModifiers } from '../../../shared/characters.js'
import { enemies,blocked,launchGrenade,stepGrenade,flashDuration } from '../../../shared/tactical.js'
import { awardKill } from '../../../shared/killCombo.js'
import { trailDistance } from '../../../shared/bulletTrails.js'

export const RESPAWN_SECONDS = 5
const fields = new Set(['sequence','epoch','round','action','weapon','yaw','pitch','ability'])
export function validateCombat(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key => !fields.has(key))) return null
  if (!Number.isSafeInteger(value.sequence) || value.sequence<0 || value.sequence>2147483647 || !Number.isSafeInteger(value.epoch)) return null
  const extra = Object.hasOwn(value,'round') ? 1 : 0
  if (extra && (!Number.isSafeInteger(value.round) || value.round<0)) return null
  if (value.action==='fire' || value.action==='hold') {
    if (Object.keys(value).length!==5+extra || !Number.isFinite(value.yaw) || Math.abs(value.yaw)>1e6 || !Number.isFinite(value.pitch) || Math.abs(value.pitch)>ONLINE.maxPitch) return null
    return { ...value,yaw:Math.atan2(Math.sin(value.yaw),Math.cos(value.yaw)) }
  }
  if (value.action==='switch' && Object.keys(value).length===4+extra && typeof value.weapon==='string' && Object.hasOwn(WEAPONS,value.weapon)) return value
  if (value.action==='release' && Object.keys(value).length===3+extra) return value
  if (value.action==='reload' && Object.keys(value).length===3+extra) return value
  if (value.action==='ability' && typeof value.ability==='string' && Object.hasOwn(ABILITIES,value.ability)) {
    const aimed = Object.hasOwn(value,'yaw') || Object.hasOwn(value,'pitch')
    if (Object.keys(value).length!==4+extra+(aimed ? 2 : 0)) return null
    if (aimed && (!Number.isFinite(value.yaw) || Math.abs(value.yaw)>1e6 || !Number.isFinite(value.pitch) || Math.abs(value.pitch)>ONLINE.maxPitch)) return null
    return value
  }
  return null
}
export const ammoField = weapon => `${weapon}Ammo`
const clearReload = { reloading:false,reloadStart:0,reloadEnd:0,reloadReason:'' }
function resetLoadout(player) {
  Object.assign(player,{ killCombo:0,killAt:-10,killBadgeId:0,killHeadshot:false })
  Object.assign(player,{ hp:100,weapon:player.startingWeapon || 'pistol',...Object.fromEntries(Object.entries(freshMagazines()).map(([id,ammo])=>[ammoField(id),ammo])),spinning:false,spinStarted:-10,windupStart:-10,windupEnd:0,...clearReload,attackReadyAt:0,lastSwitch:-10,lastShot:-10,lastSwing:-10,swings:0,shot:0,hit:-10,hitDamage:0,hitShieldDamage:0,hitDefeated:0,hitHeadshot:false,hurt:-10,respawnAt:0,shieldCharge:0,ultimateShield:0,shieldHit:-10,disabledUntil:0,flashUntil:0,flashStarted:0,rootedUntil:0,rooted:false })
}

export class ArenaCombat {
  equipLoadout(id,loadout) {
    const player=this.players.get(id)
    this.cancelFiring(id)
    Object.assign(player,{ startingWeapon:loadout.startingWeapon,weapon:loadout.startingWeapon,characterId:loadout.character,uniqueSkill:loadout.unique,secondaryWeapon:loadout.secondary,meleeWeapon:loadout.melee,allowedWeapons:[...loadout.weapons],allowedAbilities:[...loadout.abilities] })
  }
  constructor(players,simulation,epoch,{ respawn = true,round = 0 } = {}) {
    this.players = players; this.simulation = simulation; this.epoch = epoch; this.time = 0
    simulation.combatTime=()=>this.time
    this.allowRespawn = respawn; this.round = round
    this.sequences = new Map()
    this.grenades = new Map()
    this.attacks = new Map()
    this.held = new Map()
    this.trailSequences = new Map()
    this.onShot = () => {}
    for (const player of players.values()) {
      if (!player.startingWeapon) {
        player.startingWeapon = DEFAULT_LOADOUT.startingWeapon
        player.allowedWeapons = [...DEFAULT_LOADOUT.weapons]
        player.allowedAbilities = [...DEFAULT_LOADOUT.abilities]
      }
      resetLoadout(player)
      player.characterId ||= 'vex'
      player.uniqueSkill ||= 'flashbang'
      player.teamId ||= String(player.slot)
      Object.assign(player,{ kills:0,deaths:0,hitId:0 })
      player.abilities ??= new Map()
      for (const id of Object.keys(ABILITIES)) player.abilities.set(id,new AbilityState())
    }
  }
  resetRound(round) {
    this.grenades.clear(); this.attacks.clear(); this.held.clear()
    this.round = round
    for (const [id,player] of this.players) {
      this.cancelEffects(id)
      resetLoadout(player)
      for (const abilityId of Object.keys(ABILITIES)) player.abilities.set(abilityId,new AbilityState())
      this.simulation.respawn(id)
    }
  }
  cancelFiring(id) {
    this.attacks.delete(id); this.held.delete(id)
    const player=this.players.get(id)
    Object.assign(player,{ spinning:false,spinStarted:-10,windupEnd:0 })
  }
  cancelEffects(id) {
    this.cancelFiring(id)
    const player = this.players.get(id)
    player.abilities.forEach(ability => { ability.activeUntil = 0; ability.flying = false })
    player.shieldCharge = 0; player.ultimateShield = 0
    this.grenades.delete(id)
    this.simulation.cancelDash(id)
  }
  applyDamage(attackerId,targetId,amount) {
    const player = this.players.get(attackerId), other = this.players.get(targetId)
    if (!other?.connected || other.hp<=0 || amount<=0) return { damage:0,absorbed:0,defeated:0 }
    const bonus = ultimateModifiers(other,this.time).effect==='shield' ? Math.min(other.ultimateShield,amount) : 0
    const normal = this.time<other.abilities.get('shield').activeUntil ? Math.min(other.shieldCharge,amount-bonus) : 0
    const absorbed = bonus+normal
    other.ultimateShield -= bonus; other.shieldCharge -= normal
    if (absorbed) other.shieldHit = this.time
    const damage = Math.min(other.hp,amount-absorbed)
    other.hp -= damage
    if (damage) other.hurt = this.time
    const defeated = other.hp===0 ? 1 : 0
    if (defeated) {
      Object.assign(other,{ killCombo:0,killAt:-10 })
      other.deaths++; player.kills++
      Object.assign(other,{ ...clearReload,respawnAt:this.allowRespawn ? this.time+RESPAWN_SECONDS : 0 })
      this.cancelEffects(targetId)
      this.simulation.setAlive(targetId,false)
    }
    return { damage,absorbed,defeated }
  }
  feedback(player,damage,absorbed,defeated,headshot = false) {
    Object.assign(player,awardKill(player,this.time,defeated,headshot))
    if (damage+absorbed>0) Object.assign(player,{ hit:this.time,hitId:player.hitId+1,hitDamage:damage,hitShieldDamage:absorbed,hitDefeated:defeated,hitHeadshot:headshot })
  }
  activate(id,abilityId,aim = {}) {
    const player = this.players.get(id)
    if (player.allowedAbilities && !player.allowedAbilities.includes(abilityId)) return false
    const ability = player.abilities.get(abilityId), tuning = ABILITIES[abilityId]
    const modifiers = ultimateModifiers(player,this.time)
    if ((this.time+1e-8<ability.readyAt && !(abilityId==='dash' && modifiers.unlimitedDash)) || this.time<player.disabledUntil) return false
    if (abilityId==='dash' && (player.rooted || this.time<ability.activeUntil)) return false
    Object.assign(ability,{ readyAt:this.time+tuning.cooldown,activeUntil:this.time+tuning.duration,startedAt:this.time,uses:ability.uses+1,result:0,originX:player.x,originY:player.y,originZ:player.z })
    if (abilityId==='dash') {
      const direction = this.simulation.startDash(id)
      ability.directionX = direction[0]; ability.directionZ = direction[1]
    }
    if (abilityId==='shield') player.shieldCharge = tuning.capacity
    if (abilityId==='ultimate') {
      const effect = ultimateModifiers(player,this.time).effect
      if (effect==='shield') player.ultimateShield = 200
      if (effect==='ammo') { Object.assign(player,clearReload); for (const weapon of Object.keys(WEAPONS)) if (WEAPONS[weapon].magazine) player[ammoField(weapon)] = WEAPONS[weapon].magazine }
    }
    if (tuning.fuse) {
      const grenade = launchGrenade([player.x,player.y,player.z],aim.yaw ?? player.yaw,aim.pitch ?? player.pitch)
      this.grenades.set(id,{ ...grenade,abilityId })
      Object.assign(ability,{ activeUntil:0,flying:true,projectileX:grenade.position[0],projectileY:grenade.position[1],projectileZ:grenade.position[2] })
    }
    return true
  }
  reload(player,reason) {
    const weapon = WEAPONS[player.weapon]
    if (ultimateModifiers(player,this.time).noReload || !weapon.magazine || player.reloading || player[ammoField(player.weapon)]>=weapon.magazine || this.time-player.lastSwitch<equipTime(player.weapon)-1e-8) return false
    const id=[...this.players].find(([,p])=>p===player)?.[0]; this.cancelFiring(id)
    Object.assign(player,{ reloading:true,reloadStart:this.time,reloadEnd:this.time+weapon.reload,reloadReason:reason })
    return true
  }
  receive(id,payload) {
    const intent = validateCombat(payload), player = this.players.get(id)
    if (!player || !intent || intent.epoch!==this.epoch || intent.sequence<=(this.sequences.get(id) ?? -1)) return false
    if (this.round>0 ? intent.round!==this.round : intent.round!==undefined && intent.round!==0) return false
    this.sequences.set(id,intent.sequence)
    player.combatSequence = intent.sequence
    if (!player.connected || player.hp<=0) return false
    if (intent.action==='release') { this.cancelFiring(id); return true }
    if (intent.action==='ability') return this.activate(id,intent.ability,intent)
    const now = this.time
    if (intent.action==='reload') return this.reload(player,'manual')
    if (intent.action==='switch') {
      if (!(player.allowedWeapons || DEFAULT_LOADOUT.weapons).includes(intent.weapon) || player.weapon===intent.weapon || now-player.lastSwitch<equipTime(player.weapon)-1e-8 || (isMelee(player.weapon) && now-player.lastSwing<WEAPONS[player.weapon].swing)) return false
      this.cancelFiring(id)
      Object.assign(player,{ weapon:intent.weapon,...clearReload,lastSwitch:now,attackReadyAt:Math.max(player.attackReadyAt,now+equipTime(intent.weapon)) })
      return true
    }
    const weapon=WEAPONS[player.weapon], modifiers=ultimateModifiers(player,now)
    const automatic=intent.action==='hold'
    if (automatic && weapon.fireMode!=='auto') return false
    if (automatic && this.held.has(id)) { this.held.set(id,performance.now()); return true }
    if (player.reloading || now+1e-8<player.attackReadyAt || this.attacks.has(id) || (weapon.magazine && !modifiers.noReload && player[ammoField(player.weapon)]<=0)) return false
    if (automatic) this.held.set(id,performance.now())
    player.yaw=intent.yaw; player.pitch=intent.pitch
    if (weapon.spinUp && !player.spinning) {
      Object.assign(player,{ spinning:true,spinStarted:now,windupStart:now,windupEnd:now+weapon.spinUp,attackReadyAt:now+weapon.spinUp })
      this.attacks.set(id,{ weapon:player.weapon,times:[now+weapon.spinUp],auto:automatic })
      return true
    }
    player.attackReadyAt=now+weapon.cooldown/modifiers.fireRate
    const times=shotOffsets(weapon,modifiers.fireRate).map(offset=>now+offset)
    if (isMelee(player.weapon)) player.lastSwing=now
    if (weapon.windup) Object.assign(player,{ windupStart:now,windupEnd:times[0] })
    if (times[0]<=now) { times.shift(); this.fireShot(id,intent) }
    if (automatic && !times.length) times.push(player.attackReadyAt)
    if (times.length && !player.reloading) this.attacks.set(id,{ weapon:player.weapon,times,auto:automatic })
    return true
  }
  fireShot(id,aim) {
    const player=this.players.get(id), weapon=WEAPONS[player.weapon], melee=isMelee(player.weapon), now=this.time, modifiers=ultimateModifiers(player,now)
    if (player.hp<=0 || !player.connected || player.reloading || (!melee && !modifiers.noReload && player[ammoField(player.weapon)]<=0)) return false
    const intent=aim || { yaw:player.yaw,pitch:player.pitch }
    if (melee) player.swings++
    else { if (!modifiers.noReload) player[ammoField(player.weapon)]--; player.lastShot=now; player.shot++ }
    if (weapon.spinUp) player.attackReadyAt=now+weapon.cooldown/modifiers.fireRate
    player.windupEnd=0
    const origin = [player.x,player.y+PLAYER.eye,player.z], damage = new Map(),ends=[]
    const solids=this.simulation.map?.solids || ARENA_SOLIDS
    for (const direction of shotDirections(intent.yaw,intent.pitch,weapon,player.shot)) {
      let limit = weapon.range, hit = null
      for (const [otherId,other] of this.players) {
        if (otherId===id || other.hp<=0 || !other.connected) continue
        const candidate = rayRobot(origin,direction,other)
        if (candidate && candidate.distance<limit) { limit = candidate.distance; hit = { ...candidate,id:otherId } }
      }
      if (!melee) {
        const distance=trailDistance(origin,direction,limit,solids,weapon)
        ends.push(origin.map((n,i)=>n+direction[i]*distance))
      }
      if (hit) {
        const previous = damage.get(hit.id) || { amount:0,headshot:false }
        const transmission=coverTransmission(origin,direction,hit.distance,this.simulation.map?.solids || ARENA_SOLIDS,weapon)
        const amount = Math.round(pelletDamage(weapon,hit.distance,hit.region)*modifiers.damage*transmission)
        damage.set(hit.id,{ amount:previous.amount+amount,headshot:previous.headshot || (amount>0 && hit.region==='head') })
      }
    }
    let actual = 0, absorbed = 0, defeated = 0, headshot = false
    for (const [otherId,result] of damage) {
      const resolved = this.applyDamage(id,otherId,result.amount)
      actual += resolved.damage; absorbed += resolved.absorbed; defeated += resolved.defeated
      if (resolved.damage+resolved.absorbed>0) {
        headshot ||= result.headshot
        if (weapon.knockback && !resolved.defeated) this.simulation.knockback(otherId,shotDirections(intent.yaw,0,weapon)[0],weapon.knockback)
      }
    }
    this.feedback(player,actual,absorbed,defeated,headshot)
    if (!melee) {
      // Animation/spread counters reset on respawn; cosmetic event IDs must not.
      const trailId=(this.trailSequences.get(id) || 0)+1
      this.trailSequences.set(id,trailId)
      this.onShot({ epoch:this.epoch,round:this.round,id,shot:player.shot,trailId,weapon:player.weapon,origin,ends })
    }
    if (!melee && player[ammoField(player.weapon)]===0) this.reload(player,'auto')
    return true
  }
  step() {
    this.time += 1/ONLINE.tickRate
    for (const [id,attack] of this.attacks) {
      const player=this.players.get(id)
      if (!player?.connected || player.hp<=0 || player.weapon!==attack.weapon || player.reloading) { this.cancelFiring(id); continue }
      if (attack.auto && performance.now()-(this.held.get(id) ?? -Infinity)>300) { this.cancelFiring(id); continue }
      if (attack.times[0]<=this.time+1e-8) {
        const scheduled=attack.times.shift(); this.fireShot(id)
        if (attack.auto && !player.reloading) {
          const next=scheduled+WEAPONS[player.weapon].cooldown/ultimateModifiers(player,this.time).fireRate
          attack.times.push(next); player.attackReadyAt=next
        }
      }
      if (!attack.times.length) this.attacks.delete(id)
    }
    const solids = this.simulation.map?.solids || ARENA_SOLIDS
    for (const [id,grenade] of this.grenades) {
      const owner = this.players.get(id), ability = owner?.abilities.get(grenade.abilityId), tuning = ABILITIES[grenade.abilityId]
      if (!owner || owner.hp<=0) { this.grenades.delete(id); if (ability) ability.flying = false; continue }
      stepGrenade(grenade,1/ONLINE.tickRate,solids)
      Object.assign(ability,{ projectileX:grenade.position[0],projectileY:grenade.position[1],projectileZ:grenade.position[2] })
      if (grenade.age+1e-8<tuning.fuse) continue
      this.grenades.delete(id)
      const [x,y,z] = grenade.position
      Object.assign(ability,{ flying:false,detonatedAt:this.time,activeUntil:this.time+tuning.duration,originX:x,originY:y,originZ:z })
      if (grenade.abilityId==='smoke') continue
      for (const [otherId,other] of this.players) {
        if (other.hp<=0 || !other.connected) continue
        const hostile = enemies({ id,teamId:owner.teamId },{ id:otherId,teamId:other.teamId })
        if (grenade.abilityId==='flashbang' && (otherId===id || hostile)) {
          const duration = flashDuration(grenade.position,other,solids)
          if (duration>0) { other.flashStarted = this.time; other.flashUntil = Math.max(other.flashUntil,this.time+duration); ability.result++ }
        }
        if (grenade.abilityId==='stun' && hostile && Math.hypot(other.x-x,other.y-y,other.z-z)<=tuning.radius && !blocked(grenade.position,[other.x,other.y,other.z],solids)) {
          other.rootedUntil = Math.max(other.rootedUntil,this.time+tuning.duration)
          other.rooted = true; this.simulation.cancelDash(otherId); ability.result++
        }
      }
    }
    for (const [id,player] of this.players) {
      if (player.hp<=0) {
        if (this.allowRespawn && this.time+1e-8>=player.respawnAt) {
          resetLoadout(player)
          this.simulation.respawn(id)
        }
        continue
      }
      if (this.time>=player.abilities.get('shield').activeUntil) player.shieldCharge = 0
      if (this.time>=player.abilities.get('ultimate').activeUntil) player.ultimateShield = 0
      player.rooted = this.time<player.rootedUntil
      if (player.reloading && this.time+1e-8>=player.reloadEnd) {
        player[ammoField(player.weapon)] = WEAPONS[player.weapon].magazine
        Object.assign(player,clearReload)
      } else if (!player.reloading && WEAPONS[player.weapon].magazine && player[ammoField(player.weapon)]===0) this.reload(player,'auto')
    }
  }
}
