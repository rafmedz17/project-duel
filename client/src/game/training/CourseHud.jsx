import { useGame } from '../store.js'
import { COURSES,AIM_SECONDS,TRAINING_TARGETS } from './config.js'
import './training.css'

export default function CourseHud() {
  const s=useGame(),t=s.training,c=COURSES[t.course],aim=t.aim,combat=t.combat
  const standing=TRAINING_TARGETS.filter((def,i)=>def.course==='static' && s.targets[i].hp>0).length
  const accuracy=aim.shots ? Math.round((aim.successfulShots || 0)/aim.shots*100) : 0
  return <aside className="course-hud" style={{ '--course-color':c.color }} aria-label="Training course" data-testid="training-course">
    <div className="course-heading"><span>COURSE / {c.number}</span><b>{t.course==='combat' && combat.active ? 'LIVE' : 'TRAINING'}</b></div>
    <h3>{c.name}</h3><p>{c.description}</p>
    <div className="course-map" aria-label="Four training courses">
      {Object.entries(COURSES).map(([id,course])=><span key={id} className={`${id} ${t.course===id ? 'current' : ''}`} style={{ '--zone':course.color }}>{id==='hub' ? 'NEXUS' : `${course.number} ${id==='static' ? 'RANGE' : id==='aim' ? 'REFLEX' : id==='moving' ? 'TRACK' : 'COMBAT'}`}</span>)}
    </div>
    {t.course==='hub' ? <div className="course-readout">AHEAD / RANGE · RIGHT / REFLEX<br/>BEHIND / TRACK · LEFT / COMBAT</div> : t.course==='static' ? <div className="course-readout">{standing} / 10 ROBOTS STANDING<br/><kbd>G</kbd> RESET ALL TEN ROBOTS</div> : t.course==='moving' ? <div className="course-readout">{t.moving ? 'STRAFING / ACTIVE' : 'MOVEMENT / PAUSED'}<br/><kbd>G</kbd> {t.moving ? 'PAUSE MOVEMENT' : 'RESTART TRACKING'}</div> : t.course==='aim' ? <div className="course-readout" data-testid="reflex-readout"><strong>{Math.ceil(AIM_SECONDS-aim.elapsed)}<small> SEC</small><span>{aim.hits} HITS</span></strong>{aim.shots} SHOTS · {accuracy}% ACCURACY<br/>{aim.status==='complete' ? 'RUN COMPLETE / ' : ''}<kbd>G</kbd> {aim.active ? 'STOP CHALLENGE' : 'START CHALLENGE'}</div> : <div className="course-readout" data-testid="combat-readout"><strong>{combat.kills}<small> / 5 CLEARED</small><span>{combat.elapsed.toFixed(1)}s</span></strong>{combat.status==='cleared' ? 'COURSE CLEARED' : combat.active ? 'ROBOTS ARMED / BREAK LINE OF SIGHT' : 'ROBOTS DISARMED'}<br/><kbd>G</kbd> {combat.active ? 'DISARM COURSE' : 'START COURSE'}</div>}
    <div className="field-armory-hint"><kbd>B</kbd> CHARACTER / WEAPONS / SKILLS</div>
  </aside>
}
