import { ARENA_SOLIDS, PLAYER, ONLINE } from '../../../shared/arena.js'
import { WEAPONS, WEAPON_SWITCH, pelletDamage } from '../../../shared/weapons.js'
import { rayBox, rayRobot, shotDirections } from '../../../shared/ballistics.js'
import { ABILITIES } from '../../../shared/abilities.js'
import { AbilityState } from '../rooms/LobbyState.js'

export const RESPAWN_SECONDS = 3
const fields = new Set(['sequence','epoch','round','action','weapon','yaw','pitch','ability'])
export function validateCombat(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key => !fields.has(key))) return null
  if (!Number.isSafeInteger(value.sequence) || value.sequence<0 || value.sequence>2147483647 || !Number.isSafeInteger(value.epoch)) return null
  const extra = Object.hasOwn(value,'round') ? 1 : 0
  if (extra && (!Number.isSafeInteger(value.round) || value.round<0)) return null
  if (value.action==='fire') {
    if (Object.keys(value).length!==5+extra || !Number.isFinite(value.yaw) || Math.abs(value.yaw)>1e6 || !Number.isFinite(value.pitch) || Math.abs(value.pitch)>ONLINE.maxPitch) return null
    return { ...value,yaw:Math.atan2(Math.sin(value.yaw),Math.cos(value.yaw)) }
  }
  if (value.action==='switch' && Object.keys(value).length===4+extra && typeof value.weapon==='string' && Object.hasOwn(WEAPONS,value.weapon)) return value
  if (value.action==='reload' && Object.keys(value).length===3+extra) return value
  if (value.action==='ability' && Object.keys(value).length===4+extra && typeof value.ability==='string' && Object.hasOwn(ABILITIES,value.ability)) return value
  return null
}
export const ammoField = weapon => `${weapon}Ammo`
const clearReload = { reloading:false,reloadStart:0,reloadEnd:0,reloadReason:'' }
function resetLoadout(player) {
  Object.assign(player,{ hp:100,weapon:'pistol',pistolAmmo:12,rifleAmmo:30,shotgunAmmo:6,...clearReload,attackReadyAt:0,lastSwitch:-10,lastShot:-10,lastSwing:-10,shot:0,hit:-10,hitDamage:0,hitShieldDamage:0,hitDefeated:0,hitHeadshot:false,hurt:-10,respawnAt:0,shieldCharge:0,shieldHit:-10,disabledUntil:0 })
}

export class ArenaCombat {
  constructor(players,simulation,epoch,{ respawn = true,round = 0 } = {}) {
    this.players = players; this.simulation = simulation; this.epoch = epoch; this.time = 0
    this.allowRespawn = respawn; this.round = round
    this.sequences = new Map()
    for (const player of players.values()) {
      resetLoadout(player)
      Object.assign(player,{ kills:0,deaths:0,hitId:0 })
      player.abilities ??= new Map()
      for (const id of Object.keys(ABILITIES)) player.abilities.set(id,new AbilityState())
    }
  }
  resetRound(round) {
    this.round = round
    for (const [id,player] of this.players) {
      this.cancelEffects(id)
      resetLoadout(player)
      for (const abilityId of Object.keys(ABILITIES)) player.abilities.set(abilityId,new AbilityState())
      this.simulation.respawn(id)
    }
  }
  cancelEffects(id) {
    const player = this.players.get(id)
    player.abilities.forEach(ability => { ability.activeUntil = 0 })
    player.shieldCharge = 0
    this.simulation.cancelDash(id)
  }
  applyDamage(attackerId,targetId,amount) {
    const player = this.players.get(attackerId), other = this.players.get(targetId)
    if (!other?.connected || other.hp<=0 || amount<=0) return { damage:0,absorbed:0,defeated:0 }
    const absorbed = this.time<other.abilities.get('shield').activeUntil ? Math.min(other.shieldCharge,amount) : 0
    other.shieldCharge -= absorbed
    if (absorbed) other.shieldHit = this.time
    const damage = Math.min(other.hp,amount-absorbed)
    other.hp -= damage
    if (damage) other.hurt = this.time
    const defeated = other.hp===0 ? 1 : 0
    if (defeated) {
      other.deaths++; player.kills++
      Object.assign(other,{ ...clearReload,respawnAt:this.allowRespawn ? this.time+RESPAWN_SECONDS : 0 })
      this.cancelEffects(targetId)
      this.simulation.setAlive(targetId,false)
    }
    return { damage,absorbed,defeated }
  }
  feedback(player,damage,absorbed,defeated,headshot = false) {
    if (damage+absorbed>0) Object.assign(player,{ hit:this.time,hitId:player.hitId+1,hitDamage:damage,hitShieldDamage:absorbed,hitDefeated:defeated,hitHeadshot:headshot })
  }
  activate(id,abilityId) {
    const player = this.players.get(id), ability = player.abilities.get(abilityId), tuning = ABILITIES[abilityId]
    if (this.time+1e-8<ability.readyAt || this.time<player.disabledUntil) return false
    Object.assign(ability,{ readyAt:this.time+tuning.cooldown,activeUntil:this.time+tuning.duration,startedAt:this.time,uses:ability.uses+1,result:0,originX:player.x,originY:player.y,originZ:player.z })
    if (abilityId==='dash') {
      const direction = this.simulation.startDash(id)
      ability.directionX = direction[0]; ability.directionZ = direction[1]
    }
    if (abilityId==='shield') player.shieldCharge = tuning.capacity
    if (abilityId==='emp') {
      let damage = 0, defeated = 0
      for (const [otherId,other] of this.players) {
        if (otherId===id || !other.connected || other.hp<=0 || Math.hypot(other.x-player.x,other.y-player.y,other.z-player.z)>tuning.radius) continue
        this.cancelEffects(otherId)
        other.disabledUntil = this.time+tuning.duration
        const result = this.applyDamage(id,otherId,tuning.damage)
        damage += result.damage; defeated += result.defeated; ability.result++
      }
      this.feedback(player,damage,0,defeated)
    }
    return true
  }
  reload(player,reason) {
    const weapon = WEAPONS[player.weapon]
    if (!weapon.magazine || player.reloading || player[ammoField(player.weapon)]>=weapon.magazine || this.time-player.lastSwitch<WEAPON_SWITCH-1e-8) return false
    Object.assign(player,{ reloading:true,reloadStart:this.time,reloadEnd:this.time+weapon.reload,reloadReason:reason })
    return true
  }
  receive(id,payload) {
    const intent = validateCombat(payload), player = this.players.get(id)
    if (!player || !intent || intent.epoch!==this.epoch || intent.sequence<=(this.sequences.get(id) ?? -1)) return false
    if (this.round>0 ? intent.round!==this.round : intent.round!==undefined && intent.round!==0) return false
    this.sequences.set(id,intent.sequence)
    if (!player.connected || player.hp<=0) return false
    if (intent.action==='ability') return this.activate(id,intent.ability)
    const now = this.time
    if (intent.action==='reload') return this.reload(player,'manual')
    if (intent.action==='switch') {
      if (player.weapon===intent.weapon || now-player.lastSwitch<WEAPON_SWITCH-1e-8 || (player.weapon==='blade' && now-player.lastSwing<WEAPONS.blade.swing)) return false
      Object.assign(player,{ weapon:intent.weapon,...clearReload,lastSwitch:now,attackReadyAt:Math.max(player.attackReadyAt,now+WEAPON_SWITCH) })
      return true
    }
    const weapon = WEAPONS[player.weapon], melee = !weapon.magazine
    if (player.reloading || now+1e-8<player.attackReadyAt || (!melee && player[ammoField(player.weapon)]<=0)) return false
    player.yaw = intent.yaw; player.pitch = intent.pitch
    player.attackReadyAt = now+weapon.cooldown
    if (melee) player.lastSwing = now
    else { player[ammoField(player.weapon)]--; player.lastShot = now; player.shot++ }
    const origin = [player.x,player.y+PLAYER.eye,player.z], damage = new Map()
    for (const direction of shotDirections(intent.yaw,intent.pitch,weapon)) {
      let limit = weapon.range, hit = null
      for (const solid of ARENA_SOLIDS) {
        const distance = rayBox(origin,direction,solid.position,solid.size)
        if (distance!==null && distance<=limit) limit = distance
      }
      for (const [otherId,other] of this.players) {
        if (otherId===id || other.hp<=0 || !other.connected) continue
        const candidate = rayRobot(origin,direction,other)
        if (candidate && candidate.distance<limit) { limit = candidate.distance; hit = { ...candidate,id:otherId } }
      }
      if (hit) {
        const previous = damage.get(hit.id) || { amount:0,headshot:false }
        const amount = pelletDamage(weapon,hit.distance,hit.region)
        damage.set(hit.id,{ amount:previous.amount+amount,headshot:previous.headshot || (amount>0 && hit.region==='head') })
      }
    }
    let actual = 0, absorbed = 0, defeated = 0, headshot = false
    for (const [otherId,result] of damage) {
      const resolved = this.applyDamage(id,otherId,result.amount)
      actual += resolved.damage; absorbed += resolved.absorbed; defeated += resolved.defeated
      if (resolved.damage+resolved.absorbed>0) headshot ||= result.headshot
    }
    this.feedback(player,actual,absorbed,defeated,headshot)
    if (!melee && player[ammoField(player.weapon)]===0) this.reload(player,'auto')
    return true
  }
  step() {
    this.time += 1/ONLINE.tickRate
    for (const [id,player] of this.players) {
      if (player.hp<=0) {
        if (this.allowRespawn && this.time+1e-8>=player.respawnAt) {
          resetLoadout(player)
          this.simulation.respawn(id)
        }
        continue
      }
      if (this.time>=player.abilities.get('shield').activeUntil) player.shieldCharge = 0
      if (player.reloading && this.time+1e-8>=player.reloadEnd) {
        player[ammoField(player.weapon)] = WEAPONS[player.weapon].magazine
        Object.assign(player,clearReload)
      } else if (!player.reloading && WEAPONS[player.weapon].magazine && player[ammoField(player.weapon)]===0) this.reload(player,'auto')
    }
  }
}
