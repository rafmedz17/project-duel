import { AIM_SECONDS,TRAINING_TARGETS,TRAINING_SOLIDS,courseAt,targetPosition } from './config.js'
import { blocked,throughSmoke } from '../../../../shared/tactical.js'

export const freshTarget=(index)=>({ hp:TRAINING_TARGETS[index].kind==='orb' ? 1 : 100,hit:-10,resetAt:0,disabledUntil:0,motionTime:0,relocations:0,seenAt:-1,nextShot:0,shots:0 })
export const freshTraining=()=>({ course:'hub',moving:true,aim:{ active:false,run:0,startedAt:0,hits:0,successfulShots:0,shots:0,elapsed:0,status:'ready' },combat:{ active:false,run:0,startedAt:0,elapsed:0,kills:0,shots:0,status:'ready' } })
export const targetEnabled=(index,training)=>TRAINING_TARGETS[index].kind!=='orb' || training.aim.active
export function toggleCourse(s,time,position) {
  const course=courseAt(position),training=structuredClone(s.training),targets=s.targets.map(t=>({ ...t }))
  if(course==='hub') return null
  training.course=course
  if(course==='moving') training.moving=!training.moving
  if(course==='aim' || course==='combat') {
    const old=training[course]
    training[course]=old.active ? { ...old,active:false,elapsed:time-old.startedAt,status:'stopped' } : { active:true,run:old.run+1,startedAt:time,hits:0,successfulShots:0,shots:0,kills:0,elapsed:0,status:'running' }
  }
  if(course==='static' || course==='moving' && training.moving || training[course]?.active) TRAINING_TARGETS.forEach((def,i)=> { if(def.course===course) targets[i]=freshTarget(i) })
  return { training,targets }
}
export function recordCourseShot(training,weapon,defeated,position) {
  const next={ ...training },course=courseAt(position)
  if(training.aim.active && course==='aim') next.aim={ ...training.aim,shots:training.aim.shots+(weapon.magazine ? 1 : 0),hits:training.aim.hits+defeated.aim,successfulShots:(training.aim.successfulShots || 0)+(defeated.aim>0 && weapon.magazine ? 1 : 0) }
  if(training.combat.active) next.combat={ ...training.combat,kills:training.combat.kills+defeated.combat }
  return next
}
// Uses the same solid boxes as rendered collision, shots, and grenade bounces.
export function stepCourses(s,time,dt,position) {
  const course=courseAt(position),training={ ...s.training,course },shots=[]
  if(training.aim.active) {
    const elapsed=Math.min(AIM_SECONDS,time-training.aim.startedAt),active=elapsed<AIM_SECONDS && course==='aim'
    training.aim={ ...training.aim,elapsed,active,status:active ? 'running' : elapsed>=AIM_SECONDS ? 'complete' : 'left' }
  }
  if(training.combat.active) {
    const cleared=TRAINING_TARGETS.every((def,i)=>def.course!=='combat' || s.targets[i].hp<=0)
    const active=!cleared && course==='combat'
    training.combat={ ...training.combat,elapsed:time-training.combat.startedAt,active,status:cleared ? 'cleared' : active ? 'running' : 'left' }
  }
  const targets=s.targets.map((old,i)=> {
    const def=TRAINING_TARGETS[i],t={ ...old }
    if(t.hp<=0 && time>=t.resetAt && time>=t.disabledUntil && def.course!=='combat') return { ...freshTarget(i),motionTime:t.motionTime,relocations:(t.relocations || 0)+1 }
    if(def.course==='moving' && training.moving && t.hp>0 && time>=(t.rootedUntil || 0)) t.motionTime+=dt
    if(def.course!=='combat') return t
    const origin=targetPosition(i,t).map((v,k)=>v+(k===1 ? 0.4 : 0)),aim=position.map((v,k)=>v+(k===1 ? 0.25 : 0))
    const smoke=s.abilities.smoke,clouds=time<smoke.activeUntil ? [{ origin:smoke.origin.map((v,k)=>v+(k===1 ? 1 : 0)),radius:4 }] : []
    const sees=training.combat.active && t.hp>0 && time>=(t.flashUntil || 0) && Math.hypot(...origin.map((v,k)=>v-aim[k]))<28 && !blocked(origin,aim,TRAINING_SOLIDS) && !throughSmoke(origin,aim,clouds)
    if(!sees) return { ...t,seenAt:-1,tracking:false }
    if(t.seenAt<0) { t.seenAt=time;t.nextShot=time+0.85+(i%3)*0.12 }
    t.tracking=true
    if(time>=t.nextShot) { t.shots++;t.firedAt=time;t.nextShot=time+1.5;shots.push({ index:i,shot:t.shots,origin,ends:[aim],damage:8 }) }
    return t
  })
  if(shots.length) training.combat={ ...training.combat,shots:training.combat.shots+shots.length }
  return { training,targets,shots }
}
