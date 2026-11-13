import { useEffect,useRef,useState } from 'react'
import CharacterLoadout from '../../accounts/CharacterLoadout.jsx'
import { game } from '../store.js'
import TrainingOptions from './TrainingOptions.jsx'
import { accounts,useAccount } from '../../accounts/store.js'

export default function TrainingArmory({ onClose }) {
  const account=useAccount(),close=useRef(),savingRef=useRef(false)
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  const s={...account,bank:game.get().trainingBank,busy:saving || account.busy}
  const [options,setOptions]=useState(game.get().trainingOptions)
  useEffect(()=> { close.current?.focus() },[])
  const save=async bank=>{
    if(savingRef.current || s.busy || s.loading) return
    savingRef.current=true;setSaving(true);setError('')
    const generation=game.get().generation
    try {
      if(!await accounts.saveBank(bank)) {setError(accounts.get().error || 'Your loadout could not be saved. Please try again.');return}
      if(game.get().generation===generation && game.applyTrainingBank(bank)) {
        game.setTrainingOptions(options);onClose(true)
      }
    } finally {savingRef.current=false;setSaving(false)}
  }
  return <div className="overlay modal" onKeyDown={event=> {
    if(event.code==='Escape') { event.preventDefault();event.stopPropagation();if(!s.busy) onClose(false) }
    if(event.key!=='Tab') return
    const items=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
    if(event.shiftKey && document.activeElement===items[0]) { event.preventDefault();items.at(-1)?.focus() }
    else if(!event.shiftKey && document.activeElement===items.at(-1)) { event.preventDefault();items[0]?.focus() }
  }}><section className="dialog account-dialog field-armory" role="dialog" aria-modal="true" aria-labelledby="field-armory-title">
    <div className="eyebrow">TRAINING NEXUS / SIMULATION PAUSED</div><h2 id="field-armory-title">FIELD ARMORY</h2>
    {error && <p role="alert" className="error">{error}</p>}
    <TrainingOptions value={options} onChange={setOptions} disabled={s.busy || s.loading}/>
    <CharacterLoadout s={s} training onSave={save}/>
    <button ref={close} disabled={s.busy} onClick={()=>onClose(true)}>CANCEL / RETURN TO TRAINING</button>
  </section></div>
}
