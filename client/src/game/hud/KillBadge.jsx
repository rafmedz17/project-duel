import { KILL_BADGE_SECONDS,KILL_TIERS,killTier } from '../../../../shared/killCombo.js'
import './killBadge.css'

export default function KillBadge({ state:s }) {
  const age=s.time-s.killAt,tier=killTier(s.killCombo)
  if(!s.killCombo || age<0 || age>=KILL_BADGE_SECONDS) return null
  return <div key={`${s.generation}-${s.killBadgeId}`} className={`kill-badge tier-${tier} ${s.mode==='paused' ? 'kill-badge-paused' : ''}`} role="status" aria-live="polite" aria-atomic="true" data-testid="kill-badge" data-combo={s.killCombo}>
    <div className="kill-badge-rays" aria-hidden="true">{Array.from({ length:8 },(_,i)=><i key={i} style={{ '--ray':`${i*45}deg` }}/>)}</div>
    <div className="kill-badge-emblem" aria-hidden="true">
      <svg viewBox="0 0 100 100"><path className="badge-frame" d="M50 3 89 25v43L50 96 11 68V25Z"/><path className="badge-inner" d="m50 12 31 18v34L50 86 19 64V30Z"/><path className="badge-wings" d="M3 43 18 49M3 54l15 6m79-17-15 6m15 5-15 6"/><path className="badge-skull" d="M34 35h32l7 12-7 16h-9v10H43V63h-9l-7-16Zm2 12 8 3m20-3-8 3M48 59h4"/>{tier>=3 && <path className="badge-crown" d="m34 27-5-12 14 7 7-12 7 12 14-7-5 12Z"/>}</svg>
      <span className="kill-badge-count">{s.killCombo>1 ? `×${s.killCombo}` : '+'}</span>
    </div>
    <div className="kill-badge-copy"><small>CONFIRMED {s.killHeadshot ? '/ HEADSHOT' : '/ ELIMINATION'}</small><strong>{KILL_TIERS[tier-1]}</strong><span className="kill-badge-pips" aria-hidden="true">{[1,2,3,4,5].map(n=><i key={n} className={n<=tier ? 'lit' : ''}/>)}</span></div>
  </div>
}
