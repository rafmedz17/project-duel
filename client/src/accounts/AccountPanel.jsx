import { useEffect, useRef, useState } from 'react'
import { accounts, useAccount } from './store.js'
import { WEAPONS } from '../../../shared/weapons.js'
import { ABILITIES } from '../../../shared/abilities.js'
import { getMap } from '../../../shared/maps.js'
import './accounts.css'

function PasswordRecovery({ s,onComplete }) {
  const [password,setPassword] = useState('')
  return <form onSubmit={async event => {
    event.preventDefault()
    await accounts.updatePassword(password)
    if (!accounts.get().recovery) onComplete()
  }}><p>Choose your new password.</p><label>NEW PASSWORD<input type="password" autoComplete="new-password" minLength={8} required value={password} disabled={s.busy} onChange={e => setPassword(e.target.value)} /></label><button className="primary" disabled={s.busy}>SAVE NEW PASSWORD</button></form>
}
function Profile({ s }) {
  const [method,setMethod] = useState('signin'), [email,setEmail] = useState(''), [password,setPassword] = useState('')
  const [callsign,setCallsign] = useState(s.profile?.callsign || '')
  const passwordRef = useRef(null)
  if (s.user) return <>
    <p>Signed in as <strong>{s.user.email}</strong></p>
    <form onSubmit={e => { e.preventDefault(); void accounts.saveProfile(callsign) }}><label>CALLSIGN<input value={callsign} required minLength={2} maxLength={18} autoComplete="nickname" onChange={e => setCallsign(e.target.value)} /></label><button className="primary" disabled={s.busy || s.loading}>SAVE CALLSIGN</button></form>
    <div className="profile-stats" aria-label="Player statistics">{[['RATING',s.stats?.rating ?? 1000],['MATCHES',s.stats?.games ?? 0],['WINS',s.stats?.wins ?? 0],['LOSSES',s.stats?.losses ?? 0],['KILLS',s.stats?.kills ?? 0],['DEATHS',s.stats?.deaths ?? 0]].map(([label,value]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}</div>
    <p className="muted">WIN RATE {s.stats?.games ? Math.round(s.stats.wins/s.stats.games*100) : 0}% · {s.stats?.ranked_games || 0} rated matches. Training and Free Play do not affect your record.</p>
    <button disabled={s.busy || s.loading} onClick={() => { void accounts.refresh() }}>RELOAD PROFILE</button><button disabled={s.busy} onClick={() => { void accounts.signOut() }}>SIGN OUT</button>
  </>
  return <>
    <div className="account-tabs">{[['signin','SIGN IN'],['signup','REGISTER'],['reset','RESET PASSWORD']].map(([id,label]) => <button key={id} type="button" aria-pressed={method===id} disabled={!s.configured || s.busy} onClick={() => { setMethod(id); setPassword(''); accounts.clear() }}>{label}</button>)}</div>
    <form onSubmit={event => { event.preventDefault(); const pending = method==='reset' ? accounts.resetPassword(email) : method==='signup' ? accounts.signUp(email,password) : accounts.signIn(email,password); void pending.then(() => { setPassword(''); passwordRef.current?.focus() }) }}>
      <label>EMAIL<input type="email" autoComplete="email" required value={email} disabled={!s.configured || s.busy} onChange={e => setEmail(e.target.value)} /></label>
      {method!=='reset' && <label>PASSWORD<input ref={passwordRef} type="password" autoComplete={method==='signin' ? 'current-password' : 'new-password'} minLength={method==='signup' ? 8 : 1} required value={password} disabled={!s.configured || s.busy} onChange={e => setPassword(e.target.value)} /></label>}
      <button className="primary" disabled={!s.configured || s.busy}>{s.busy ? 'PLEASE WAIT…' : method==='reset' ? 'SEND RESET LINK' : method==='signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
    </form>
  </>
}
function Loadout({ s }) {
  const [value,setValue] = useState(s.loadout)
  const toggle = (field,id) => setValue(old => {
    const items = old[field].includes(id) ? old[field].filter(item => item!==id) : [...old[field],id]
    if (field==='weapons' && !items.length) return old
    return { ...old,[field]:items,...(field==='weapons' && !items.includes(old.startingWeapon) ? { startingWeapon:items[0] } : {}) }
  })
  return <form onSubmit={e => { e.preventDefault(); void accounts.saveLoadout(value) }}>
    <p>Choose the weapons and abilities you want available. Your selection is locked when you join a room.</p>
    <fieldset disabled={s.busy || s.loading}><legend>WEAPONS / SELECT AT LEAST ONE</legend><div className="equipment-grid">{Object.entries(WEAPONS).map(([id,item]) => <label className="equipment" key={id}><input type="checkbox" checked={value.weapons.includes(id)} onChange={() => toggle('weapons',id)} /><span>{item.name}<small>KEY {item.slot}</small></span></label>)}</div>
    <label>STARTING WEAPON<select value={value.startingWeapon} onChange={e => setValue({ ...value,startingWeapon:e.target.value })}>{value.weapons.map(id => <option key={id} value={id}>{WEAPONS[id].name}</option>)}</select></label></fieldset>
    <fieldset disabled={s.busy || s.loading}><legend>ABILITIES</legend><div className="equipment-grid">{Object.entries(ABILITIES).map(([id,item]) => <label className="equipment" key={id}><input type="checkbox" checked={value.abilities.includes(id)} onChange={() => toggle('abilities',id)} /><span>{item.name}<small>KEY {item.key}</small></span></label>)}</div></fieldset>
    <p className="muted">{s.user ? 'Saved to your account for your next training session or room.' : 'Guest loadouts save on this device. Sign in to sync across devices.'}</p><button className="primary" disabled={s.busy || s.loading}>SAVE LOADOUT</button>
  </form>
}
function History({ s }) {
  useEffect(() => { if (accounts.get().user) void accounts.history() },[])
  if (!s.user) return <p>Sign in to view your match history.</p>
  return <><button disabled={s.busy} onClick={() => { void accounts.history() }}>REFRESH HISTORY</button>{!s.history.length && <p>{s.busy ? 'Loading matches…' : 'No saved matches yet. Finish a Best of Three match to begin your record.'}</p>}<div className="history-list">{s.history.map(match => {
    const slot = match.player_one===s.user.id ? 0 : 1
    const delta = slot===0 ? match.rating_delta_one : match.rating_delta_two
    return <article key={match.id}><div><strong className={match.winner_slot===slot ? 'history-win' : ''}>{match.winner_slot===slot ? 'VICTORY' : 'DEFEAT'}</strong><small>{new Date(match.ended_at).toLocaleString()}</small></div><p>{match.name_one} <b>{match.score_one} : {match.score_two}</b> {match.name_two}</p><small>{getMap(match.map_id).name} · {match.ranked ? `RANKED · ${delta>=0 ? '+' : ''}${delta} ELO` : 'CASUAL'} · {match.reason.toUpperCase()}</small></article>
  })}</div></>
}
function Leaderboard({ s }) {
  useEffect(() => { if (accounts.get().configured) void accounts.leaderboard() },[])
  return <><p>Top 50 players by Elo rating. Play ranked Best of Three matches to enter the standings.</p><button disabled={!s.configured || s.busy} onClick={() => { void accounts.leaderboard() }}>REFRESH STANDINGS</button>{!s.leaderboard.length ? <p>{s.busy ? 'Loading standings…' : 'No ranked results yet.'}</p> : <table className="leaderboard"><thead><tr><th>#</th><th>PLAYER</th><th>ELO</th><th>W / L</th></tr></thead><tbody>{s.leaderboard.map((row,index) => <tr key={row.user_id} className={row.user_id===s.user?.id ? 'self' : ''}><td>{index+1}</td><td>{row.profiles?.callsign || 'Pilot'}</td><td>{row.rating}</td><td>{row.wins} / {row.losses}</td></tr>)}</tbody></table>}</>
}
export default function AccountPanel({ initial='profile',onClose,onShowProfile }) {
  const s = useAccount(), [tab,setTab] = useState(initial)
  const closeRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    if (initial==='profile' && accounts.get().user && !accounts.get().loading) void accounts.refresh()
    return () => previous?.focus()
  },[initial])
  const current = s.recovery ? 'profile' : tab
  const titles = { profile:'PLAYER PROFILE',loadout:'LOADOUT',history:'MATCH HISTORY',leaderboard:'LEADERBOARD' }
  return <div className="overlay modal" onKeyDown={e => {
    if (e.key==='Escape') { e.preventDefault(); if (!s.recovery) onClose() }
    if (e.key!=='Tab') return
    const items = [...e.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
    if (e.shiftKey && document.activeElement===items[0]) { e.preventDefault(); items.at(-1)?.focus() }
    else if (!e.shiftKey && document.activeElement===items.at(-1)) { e.preventDefault(); items[0]?.focus() }
  }}><section className="dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title"><div className="eyebrow">PROJECT DUEL / PLAYER SERVICES</div><h2 id="account-title">{titles[current]}</h2><div className="account-tabs">{Object.entries(titles).map(([id,label]) => <button key={id} aria-pressed={current===id} disabled={s.busy} onClick={() => { setTab(id); accounts.clear() }}>{label}</button>)}</div>
    {!s.configured && <p className="cloud-notice">Cloud accounts and rankings are not enabled for this game yet. Guest play and device-saved loadouts are available.</p>}
    {s.error && <p className="error" role="alert">{s.error}</p>}{s.notice && <p className="account-notice" role="status">{s.notice}</p>}{s.loading && <p role="status">Loading your saved profile…</p>}
    {s.recovery ? <PasswordRecovery s={s} onComplete={onShowProfile} /> : current==='profile' ? <Profile key={`${s.user?.id || 'guest'}-${s.profile?.callsign || ''}`} s={s} /> : current==='loadout' ? <Loadout key={JSON.stringify(s.loadout)} s={s} /> : current==='history' ? <History s={s} /> : <Leaderboard s={s} />}
    <button ref={closeRef} disabled={s.recovery && s.busy} onClick={s.recovery ? () => { void accounts.signOut().then(() => { if (!accounts.get().recovery) onClose() }) } : onClose}>{s.recovery ? 'CANCEL PASSWORD RESET' : 'BACK'}</button>
  </section></div>
}
