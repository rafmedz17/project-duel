import { WEAPONS } from '../config.js'
import './combatFeedback.css'
import { useState } from 'react'
import { useGame } from '../store.js'
import { advanceDamageFeed,emptyDamageFeed } from '../../settings/damageFeed.js'

export default function CombatFeedback({ state: s }) {
  const settings=useGame(s=>s.settings)
  const [stored,setStored]=useState(emptyDamageFeed)
  const feed=advanceDamageFeed(stored,s)
  if(feed!==stored) setStored(feed)
  const defeated = s.hitDefeated > 0
  const absorbed = s.hitShieldDamage || 0
  const shieldOnly = absorbed>0 && !s.hitDamage
  const label = shieldOnly ? (s.hitHeadshot ? 'HEADSHOT / SHIELD' : 'SHIELD HIT') : s.hitHeadshot ? (defeated ? 'HEADSHOT / ELIMINATED' : 'HEADSHOT') : defeated ? 'ELIMINATED' : 'HIT'
  const hitVisible = s.time-s.hit < (defeated ? 0.6 : 0.36)
  const progress = s.reloading ? Math.min(1,Math.max(0,(s.time-s.reloadStart)/(s.reloadEnd-s.reloadStart))) : 0
  return <>
    {hitVisible && <div key={`${s.generation}-${s.hitId}`} className={`hit-feedback ${defeated ? 'defeat' : ''} ${s.hitHeadshot ? 'headshot' : ''} ${shieldOnly ? 'shield-hit' : ''} ${s.mode !== 'playing' ? 'feedback-paused' : ''}`} data-testid="hit-feedback" data-damage={s.hitDamage} data-shield-damage={absorbed} data-headshot={s.hitHeadshot} data-defeated={defeated} aria-hidden="true">
      <div className="hit-strokes">{[0,1,2,3].map(index => <i key={index} style={{ '--angle':`${45+index*90}deg` }} />)}</div>
      {settings.damageNumbers && <div className="damage-numbers" data-testid="damage-numbers" data-style={settings.damageStyle} style={{ opacity:settings.damageOpacity }}>
        {settings.damageStyle==='stacked' ? <span className="hit-damage">{feed.total}<small>{label}{absorbed>0 && !shieldOnly ? ` / ${Math.round(absorbed)} SHIELD` : ''}</small></span> : feed.entries.filter(hit=>s.time-hit.time<.8).reverse().map((hit,index)=><span key={hit.id} className="hit-damage classic-damage" style={{ top:-18-index*30,opacity:Math.max(.1,1-(s.time-hit.time)/.8) }}>{hit.amount}{index===0 && <small>{label}</small>}</span>)}
      </div>}
    </div>}
    {s.reloading && <div className="reload-notice" role="status" aria-live="polite" aria-atomic="true">
      <div className="reload-title"><span className="reload-symbol" aria-hidden="true">↻</span><strong>RELOADING</strong><span>{s.reloadReason === 'auto' ? 'AUTO · EMPTY MAGAZINE' : WEAPONS[s.reloadWeapon].shortName}</span></div>
      <div className="reload-track" role="progressbar" aria-label="Reload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><i style={{ width:`${progress*100}%` }} /></div>
      <div className="reload-detail"><span>{s.mode === 'paused' ? 'PAUSED' : 'REPLACING ENERGY CELL'}</span><span>{Math.max(0,s.reloadEnd-s.time).toFixed(1)}s</span></div>
    </div>}
  </>
}
