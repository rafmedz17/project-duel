import {WEAPONS} from '../../../shared/weapons.js'
import {KILL_FEED_LIFETIME} from './killFeed.js'
import './killFeed.css'

function WeaponIcon({weaponId}) {
  const weapon=WEAPONS[weaponId],category=weapon.category
  const path=category==='MELEE' ? 'M12 24 44 4 38 19 21 29M16 25l8 9M19 30l-8 8-5-5 8-8' : category==='PISTOL' ? 'M5 11h34l5 4v7H24l-4 14H9l5-16H5ZM24 22v6h5l3-6M10 7h23' : category==='SNIPER' ? 'M3 18h33v-4h7v6h14M3 18v12l11-7h17l-3 12h8l4-12h11v-5M20 14V8h15v6M17 8h21' : category==='SHOTGUN' ? 'M3 17h46v6H15L3 31ZM27 23l-4 12h9l4-12M40 15h14v3M36 25h14' : category==='LMG' ? 'M3 17h40v-4h6v5h9M3 17v12l12-7h7v5M23 29a7 7 0 1 0 14 0 7 7 0 1 0-14 0M38 22h13M17 13h19' : category==='SMG' ? 'M5 15h35v8H24l-3 13h-8l4-13H5ZM40 18h12M29 24l-1 9h7l2-10M10 11h16' : 'M3 17h37v-4h6v6h12M3 17v13l12-8h11l-2 13h9l4-13h14M17 13h16M39 25l6 7'
  return <svg className="kill-feed-weapon" viewBox="0 0 60 42" role="img" aria-label={weapon.name}><title>{weapon.name}</title><path d={path}/></svg>
}

export default function KillFeed({entries=[],selfId}) {
  return <ol className="kill-feed" aria-label="Recent eliminations" aria-live="polite" aria-relevant="additions">
    {[...entries].reverse().map(row=><li key={row.key} data-testid="kill-feed-entry" className={row.attackerId===selfId ? 'your-kill' : row.targetId===selfId ? 'your-death' : ''} style={{animationDuration:`${KILL_FEED_LIFETIME}ms`}}>
      <span className="kill-feed-attacker">{row.attacker}</span><WeaponIcon weaponId={row.weapon}/>
      {row.headshot && <svg className="kill-feed-headshot" viewBox="0 0 20 20" role="img" aria-label="Headshot"><circle cx="10" cy="10" r="5"/><path d="M10 1v5m0 8v5M1 10h5m8 0h5"/></svg>}
      <span className="kill-feed-target">{row.target}</span>
    </li>)}
  </ol>
}
