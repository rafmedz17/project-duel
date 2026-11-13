import { useEffect, useRef, useState } from 'react'
import { game,useGame } from '../game/store.js'
import { accounts,useAccount } from '../accounts/store.js'
import { audio } from '../audio/synth.js'
import TrainingOptions from '../game/training/TrainingOptions.jsx'
import Crosshair from '../game/hud/Crosshair.jsx'
import { ACTIONS,DEFAULT_BINDINGS,DEFAULT_PREFERENCES,bindingLabel,physicalCode,rebind,validBinding } from './preferences.js'
import { SENSITIVITY_CATEGORIES,DEFAULT_WEAPON_SENSITIVITY } from './sensitivity.js'
import './settings.css'

function Range({ label,value,onChange,min=0,max=1,step=.01,display,ariaLabel=label }) {
  return <label className="setting-row"><span>{label}<small>{display ?? `${Math.round(value*100)}%`}</small></span><input aria-label={ariaLabel} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>
}
function Choice({ label,value,onChange,options }) {
  return <label className="setting-row"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
}
function Toggle({ label,value,onChange }) {
  return <label className="setting-row"><span>{label}</span><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)}/></label>
}
export default function Settings({ onClose }) {
  const s=useGame(s=>s.settings),trainingOptions=useGame(s=>s.trainingOptions)
  const user=useAccount(s=>s.user),loading=useAccount(s=>s.loading)
  const [tab,setTab]=useState('General'),[binding,setBinding]=useState(null),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false)
  const dialog=useRef(),back=useRef()
  const set=patch=> { game.settings(patch);setNotice('') }
  const crosshair=patch=>set({ crosshair:{ ...s.crosshair,...patch } })
  useEffect(()=> {
    const previous=document.activeElement
    back.current?.focus()
    const key=event=> {
      if(event.key==='Escape') { event.preventDefault();onClose() }
      if(event.key==='Tab') {
        const elements=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')],first=elements[0],last=elements.at(-1)
        if(event.shiftKey && document.activeElement===first) { event.preventDefault();last?.focus() }
        else if(!event.shiftKey && document.activeElement===last) { event.preventDefault();first?.focus() }
      }
    }
    document.addEventListener('keydown',key)
    return ()=> { document.removeEventListener('keydown',key);previous?.focus() }
  },[onClose])
  useEffect(()=> {
    if(!binding) return
    const capture=event=> {
      event.preventDefault();event.stopImmediatePropagation()
      if(event.code==='Escape') { setBinding(null);return }
      const code=physicalCode(event)
      if(!validBinding(code) || event.metaKey || event.altKey) { setNotice('Choose a keyboard key or mouse button. Escape cancels.');return }
      const settings=game.get().settings,other=ACTIONS.find(([id])=>id!==binding && settings.bindings[id]===code)
      game.settings({ bindings:rebind(settings.bindings,binding,code) })
      setNotice(other ? `${other[1]} moved to ${bindingLabel(settings.bindings[binding])} to keep every control unique.` : 'Binding applied. Save your settings to sync your account.')
      setBinding(null)
    }
    document.addEventListener('keydown',capture,true);document.addEventListener('mousedown',capture,true)
    return ()=> { document.removeEventListener('keydown',capture,true);document.removeEventListener('mousedown',capture,true) }
  },[binding])
  const save=async ()=> {
    setSaving(true);setNotice('')
    try { await accounts.savePreferences(game.get().settings);setNotice(user ? 'Settings saved to your account.' : 'Settings saved on this device.') }
    catch(error) { setNotice(`Could not sync: ${error.message}. Your changes are still saved on this device. Try Save again.`) }
    finally { setSaving(false) }
  }
  return <div className="overlay modal settings-overlay"><section ref={dialog} className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div className="settings-heading"><div><div className="eyebrow">PILOT CONFIGURATION / PROJECT DUEL</div><h2 id="settings-title">SETTINGS</h2></div><span>{user ? 'ACCOUNT SYNC' : 'DEVICE PROFILE'}</span></div>
    <div className="settings-tabs" role="tablist" aria-label="Settings categories">{['General','Sensitivity','Controls','Graphics','Audio'].map(name=><button key={name} role="tab" id={`settings-tab-${name}`} aria-controls="settings-content" aria-selected={tab===name} onClick={()=> { setTab(name);setBinding(null);dialog.current.querySelector('.settings-scroll').scrollTo(0,0) }}>{name}</button>)}</div>
    <div className="settings-scroll"><fieldset className="settings-content" id="settings-content" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} disabled={saving || loading}>
      {tab==='General' && <>
        <h3>VIEW & AIM</h3>
        <Toggle label="Show FPS counter" value={s.fps} onChange={fps=>set({ fps })}/>
        <Range label="Field of view" value={s.fov} min={60} max={110} step={1} display={`${s.fov}°`} onChange={fov=>set({ fov })}/>
        <Choice label="Scope input" value={s.scopeMode} onChange={scopeMode=>set({ scopeMode })} options={[["hold","Hold to aim"],["tap","Tap to toggle"]]}/>
        <h3>HIT FEEDBACK</h3>
        <Toggle label="Damage numbers" value={s.damageNumbers} onChange={damageNumbers=>set({ damageNumbers })}/>
        <Range label="Damage opacity" value={s.damageOpacity} min={.1} onChange={damageOpacity=>set({ damageOpacity })}/>
        <Choice label="Damage style" value={s.damageStyle} onChange={damageStyle=>set({ damageStyle })} options={[["classic","Classic · separate hits"],["stacked","Stacked · running total"]]}/>
        <h3>CROSSHAIR EDITOR</h3><div className="crosshair-editor"><div className="crosshair-preview" aria-label="Crosshair preview"><span>LIVE PREVIEW</span><Crosshair settings={s}/></div><div>
          <Choice label="Crosshair shape" value={s.crosshair.style} onChange={style=>crosshair({ style })} options={[["cross","Cross"],["dot","Dot"],["circle","Circle"]]}/>
          <label className="setting-row"><span>Crosshair color</span><input aria-label="Crosshair color" type="color" value={s.crosshair.color} onChange={e=>crosshair({ color:e.target.value })}/></label>
          <Range label="Crosshair size" value={s.crosshair.size} min={3} max={24} step={1} display={`${s.crosshair.size}px`} onChange={size=>crosshair({ size })}/>
          <Range label="Crosshair gap" value={s.crosshair.gap} min={0} max={14} step={1} display={`${s.crosshair.gap}px`} onChange={gap=>crosshair({ gap })}/>
          <Range label="Crosshair thickness" value={s.crosshair.thickness} min={1} max={5} step={1} display={`${s.crosshair.thickness}px`} onChange={thickness=>crosshair({ thickness })}/>
          <Range label="Crosshair opacity" value={s.crosshair.opacity} min={.1} onChange={opacity=>crosshair({ opacity })}/>
          <Toggle label="Center dot" value={s.crosshair.dot} onChange={dot=>crosshair({ dot })}/>
        </div></div><p className="muted">Shotguns keep their dotted spread circle. Scoped weapons use their own optic reticle.</p>
        <h3>TRAINING</h3><TrainingOptions value={trainingOptions} onChange={game.setTrainingOptions}/>
      </>}
      {tab==='Sensitivity' && <>
        <h3>GENERAL SENSITIVITY</h3>
        <Range label="Mouse sensitivity" value={s.sensitivity} min={.2} max={3} step={.05} display={`${s.sensitivity.toFixed(2)}×`} onChange={sensitivity=>set({ sensitivity })}/>
        <p className="muted">General sensitivity scales every category. Look controls normal camera movement. ADS applies while aiming with right click. Firing takes priority while holding your fire input, including when aiming. Values of 1× keep your current feel.</p>
        <div className="sensitivity-grid">{SENSITIVITY_CATEGORIES.map(([id,name])=><section className="sensitivity-card" key={id} role="group" aria-label={`${name} sensitivity`}>
          <h4>{name}<small>{id==='MELEE' ? 'BLADES & HEAVY MELEE' : 'WEAPON CATEGORY'}</small></h4>
          {['look',...(id==='MELEE' ? [] : ['ads']),'firing'].map(mode=><Range key={mode} label={`${mode==='ads' ? 'ADS' : mode==='look' ? 'Look' : 'Firing'} sensitivity`} ariaLabel={`${name} ${mode==='ads' ? 'ADS' : mode} sensitivity`} value={s.weaponSensitivity[id][mode]} min={.1} max={3} step={.05} display={`${s.weaponSensitivity[id][mode].toFixed(2)}×`} onChange={value=>set({weaponSensitivity:{...s.weaponSensitivity,[id]:{...s.weaponSensitivity[id],[mode]:value}}})}/>) }
        </section>)}</div>
        <button onClick={()=> {set({sensitivity:1,weaponSensitivity:DEFAULT_WEAPON_SENSITIVITY});setNotice('Sensitivity defaults restored.')}}>RESET SENSITIVITY</button>
      </>}
      {tab==='Controls' && <><h3>KEYBOARD & MOUSE</h3><p className="muted">Click a binding, then press a key or mouse button. Duplicate bindings swap automatically. Escape cancels. Mouse movement controls your view.</p><div className="binding-grid">{ACTIONS.map(([id,label])=><div className="binding-row" key={id}><span>{label}</span><button type="button" aria-label={`Rebind ${label}`} aria-pressed={binding===id} className={binding===id ? 'listening' : ''} onClick={()=> { setBinding(id);setNotice('Press a key or mouse button. Escape cancels.') }}>{binding===id ? 'PRESS INPUT…' : bindingLabel(s.bindings[id])}</button></div>)}</div><div className="binding-row"><span>Pause / release mouse</span><kbd>ESC · FIXED</kbd></div><button onClick={()=> { set({ bindings:DEFAULT_BINDINGS });setNotice('Default controls restored.') }}>RESET CONTROLS</button></>}
      {tab==='Graphics' && <><h3>RENDERING</h3><Choice label="Render quality" value={s.quality} onChange={quality=>set({ quality })} options={['Low','Medium','High'].map(x=>[x,x])}/><p className="muted">Low reduces render resolution and lighting. High increases detail.</p><h3>COMBAT VISIBILITY</h3><Choice label="Flashbang color" value={s.flashColor} onChange={flashColor=>set({ flashColor })} options={[["white","White"],["black","Black"]]}/><Toggle label="Enemy body aura" value={s.enemyAura} onChange={enemyAura=>set({ enemyAura })}/><label className="setting-row"><span>Enemy aura color</span><input aria-label="Enemy aura color" type="color" value={s.enemyColor} onChange={e=>set({ enemyColor:e.target.value })}/></label><div className="aura-swatch" style={{ '--aura':s.enemyColor }}><i style={{ opacity:s.enemyAura ? 1 : .2 }}/><span>WHOLE BODY VISIBILITY</span></div><p className="muted">The aura highlights visible enemy armor. Flashbang color changes the visual only; duration and visibility stay the same.</p></>}
      {tab==='Audio' && <><h3>AUDIO MIX</h3><Range label="General audio" value={s.volume} onChange={volume=>set({ volume })}/><Range label="Sound effects" value={s.sfxVolume} onChange={sfxVolume=>set({ sfxVolume })}/><Range label="Background music" value={s.musicVolume} onChange={musicVolume=>set({ musicVolume })}/><Toggle label="Mute all audio" value={s.muted} onChange={muted=>set({ muted })}/><button disabled={s.muted || s.volume===0 || s.sfxVolume===0} onClick={async()=>setNotice(await audio.preview() ? 'Audio test played.' : 'Audio unavailable or blocked by the browser.')}>TEST AUDIO</button><p className="muted">Sound effects include weapons, steps, abilities, hit sounds and kill combos. Use headphones for positional audio. Music and effects have independent levels. Background music plays on the landing page only; training and multiplayer use sound effects.</p></>}
    </fieldset></div>
    {notice && <p className="settings-notice" role="status">{notice}</p>}
    <div className="settings-footer"><small>{user ? 'Changes apply immediately. Save to sync across devices.' : 'Changes save on this device. Sign in to sync across devices.'}</small><div><button disabled={saving || loading} onClick={()=> { set(DEFAULT_PREFERENCES);setNotice('Defaults restored. Save to sync your account.') }}>RESTORE DEFAULTS</button><button className="primary" disabled={saving || loading || Boolean(binding)} onClick={save}>{saving ? 'SAVING…' : user ? 'SAVE TO ACCOUNT' : 'SAVE ON DEVICE'}</button><button ref={back} disabled={saving} onClick={onClose}>BACK →</button></div></div>
  </section></div>
}
