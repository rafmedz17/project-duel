import {useEffect,useRef} from 'react'
import CharacterLoadout from '../../accounts/CharacterLoadout.jsx'
import {game,useGame} from '../store.js'
import TrainingOptions from './TrainingOptions.jsx'
import {accounts,useAccount} from '../../accounts/store.js'

export default function TrainingArmory({onClose}) {
  const account=useAccount(),close=useRef(),options=useGame(s=>s.trainingOptions)
  const s={...account,bank:game.get().trainingBank}
  useEffect(()=>{close.current?.focus()},[])
  const save=async bank=>{
    const generation=game.get().generation
    if(!await accounts.saveBank(bank)) return false
    return game.get().generation===generation && game.applyTrainingBank(bank)
  }
  return <div className="overlay modal" onKeyDown={event=>{
    if(event.code==='Escape') {event.preventDefault();event.stopPropagation();if(!s.busy) onClose(false)}
    if(event.key!=='Tab') return
    const items=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
    if(event.shiftKey && document.activeElement===items[0]) {event.preventDefault();items.at(-1)?.focus()}
    else if(!event.shiftKey && document.activeElement===items.at(-1)) {event.preventDefault();items[0]?.focus()}
  }}><section className="dialog account-dialog field-armory loadout-account-dialog" role="dialog" aria-modal="true" aria-labelledby="field-armory-title">
    <div className="eyebrow">TRAINING NEXUS / SIMULATION PAUSED</div><h2 id="field-armory-title">FIELD ARMORY</h2>
    <button ref={close} className="loadout-close" aria-label="Close field armory" disabled={s.busy} onClick={()=>onClose(true)}>×</button>
    <TrainingOptions value={options} onChange={game.setTrainingOptions} disabled={s.busy || s.loading}/>
    <CharacterLoadout s={s} training onSave={save}/>
    <button className="loadout-back" disabled={s.busy} onClick={()=>onClose(true)}>RETURN TO TRAINING →</button>
  </section></div>
}
