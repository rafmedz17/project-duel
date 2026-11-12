import { TARGET } from './config.js'

export { pelletDamage } from '../../../shared/weapons.js'

// Resolve a batch atomically: multiple pellets can never award the same defeat twice.
export function damageTargets(targets, damageById, time) {
  let damage = 0, defeated = 0, affected = 0
  const next = targets.map((target,id) => {
    const amount = damageById.get(id) || 0
    if (target.hp <= 0 || amount <= 0) return target
    const hp = Math.max(0,target.hp-amount)
    damage += target.hp-hp; affected++
    if (hp === 0) defeated++
    return { ...target,hp,hit:time,resetAt:hp === 0 ? Math.max(time+TARGET.reset,target.disabledUntil || 0) : target.resetAt }
  })
  return { targets:next,damage,defeated,affected }
}
