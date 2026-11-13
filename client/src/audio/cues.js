import { killTier } from '../../../shared/killCombo.js'
// Read accepted state transitions. Never replay a backlog of missed shots.
export function combatCues(previous,current,self = true) {
  if (!previous || !current) return []
  const cues=[]
  if (current.shot>previous.shot) cues.push(current.weapon)
  if (current.lastSwing>previous.lastSwing) cues.push(current.weapon)
  if (current.weapon!==previous.weapon) cues.push('equip')
  if (current.reloading && (!previous.reloading || current.reloadStart!==previous.reloadStart)) cues.push('reload-start')
  if (previous.reloading && !current.reloading && current.weapon===previous.weapon && current.magazines[current.weapon]>previous.magazines[current.weapon]) cues.push('reload-end')
  for (const [id,ability] of Object.entries(current.abilities || {})) if (ability.uses>(previous.abilities?.[id]?.uses ?? ability.uses)) cues.push(id)
  if (current.spinning && !previous.spinning) cues.push('spin-up')
  if (self) {
    if (current.hitId>previous.hitId) cues.push(current.hitDefeated ? (current.killCombo>1 ? `kill-combo-${killTier(current.killCombo)}` : 'elimination') : current.hitHeadshot ? 'headshot' : current.hitShieldDamage && !current.hitDamage ? 'shield-hit' : 'hit')
    if (current.hp<previous.hp) cues.push(current.hp<=0 ? 'death' : 'hurt')
    if (current.shieldHit>previous.shieldHit) cues.push('shield-impact')
  }
  return cues
}

export function matchCues(previous,current,selfId) {
  if (!previous || !current || previous.arenaEpoch!==current.arenaEpoch) return []
  if (current.matchPhase==='finished' && previous.matchPhase!=='finished') return [current.winnerId===selfId ? 'victory' : 'defeat']
  if (current.matchPhase==='roundOver' && previous.matchPhase!=='roundOver') return [current.roundWinnerId ? current.roundWinnerId===selfId ? 'round-win' : 'round-loss' : 'draw']
  if (current.matchPhase==='live' && previous.matchPhase==='countdown') return ['round-start']
  if (current.matchPhase==='countdown' && Math.ceil(current.phaseRemaining)!==Math.ceil(previous.phaseRemaining)) return ['countdown']
  return []
}

export class Footsteps {
  samples = new Map()
  clear() { this.samples.clear() }
  update(id,position,grounded,now,{speed=0,verticalSpeed=0,enabled=true}={}) {
    const previous=this.samples.get(id)
    const sample={ position:[...position],grounded,time:now,enabled,distance:0,last:previous?.last ?? now,side:previous?.side ?? -1,airTime:0,peak:position[1] }
    this.samples.set(id,sample)
    if (!previous || !enabled || !previous.enabled) return []
    const dt=now-previous.time
    const distance=Math.hypot(position[0]-previous.position[0],position[2]-previous.position[2])
    // Spawn/round teleports, dash, and stale frames never become a rush of steps.
    if(dt<=0 || dt>.5 || distance>2.5 || Math.abs(position[1]-previous.position[1])>2.5) return []
    if(!grounded) {
      sample.airTime=previous.airTime+dt;sample.peak=Math.max(previous.peak,position[1])
      return previous.grounded && verticalSpeed>1 ? [{name:'jump'}] : []
    }
    if(!previous.grounded) {
      const drop=previous.peak-position[1]
      return previous.airTime>.1 && drop>.15 ? [{name:'land',impact:Math.min(1.8,.8+drop*.3)}] : []
    }
    const pace=speed>6.3 ? 'sprint' : 'walk',stride=pace==='sprint' ? 2.05 : 1.65
    sample.distance=previous.distance+distance
    if(sample.distance<stride || now-sample.last<.17) return []
    sample.distance%=stride;sample.last=now;sample.side=-previous.side
    return [{name:'step',pace,pan:sample.side*.12}]
  }
}
