import { OPPONENT } from '../config.js'

export function freshOpponent(enabled = false) {
  return { enabled,hp:OPPONENT.health,disabledUntil:0,hit:-10,resetAt:0,phase:enabled ? 'patrol' : 'offline',defeats:0,respawns:0,attacks:0,hits:0 }
}

export function damageOpponent(opponent,amount,time) {
  if (!opponent.enabled || opponent.hp <= 0 || amount <= 0) return { opponent,damage:0,defeated:0 }
  const damage = Math.min(opponent.hp,amount), hp = opponent.hp-damage
  return { damage,defeated:hp === 0 ? 1 : 0,opponent:{ ...opponent,hp,hit:time,
    ...(hp === 0 ? { phase:'defeated',defeats:opponent.defeats+1,resetAt:Math.max(time+OPPONENT.respawn,opponent.disabledUntil) } : {}),
  } }
}

export function freshBrain(time = 0) {
  return { phase:'patrol',nextAttackAt:time+OPPONENT.grace,windupUntil:0,aim:null,fireAt:null }
}

// Pure decision logic. Physics handles travel, visibility and projectile hits.
export function stepBrain(brain,{ time,distance,visible,alive,disabledUntil,playerPosition }) {
  const next = { ...brain,fireAt:null }
  if (!alive) return { ...next,phase:'defeated',aim:null,windupUntil:0 }
  if (time<disabledUntil) return { ...next,phase:'jammed',aim:null,windupUntil:0,nextAttackAt:Math.max(next.nextAttackAt,disabledUntil+OPPONENT.grace) }
  const canEngage = visible && distance<=OPPONENT.range
  if (brain.phase === 'windup') {
    if (!canEngage) return { ...next,phase:'patrol',aim:null,windupUntil:0,nextAttackAt:time+0.5 }
    if (time>=brain.windupUntil) return { ...next,phase:'recovering',fireAt:[...brain.aim],aim:null,windupUntil:0,nextAttackAt:time+OPPONENT.attackInterval }
    return next
  }
  if (canEngage && time>=next.nextAttackAt) return { ...next,phase:'windup',aim:[...playerPosition],windupUntil:time+OPPONENT.windup }
  return { ...next,phase:canEngage ? 'recovering' : 'patrol',aim:null }
}
