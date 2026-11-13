import { useEffect,useRef,useState } from 'react'
import CharacterLoadout from '../../accounts/CharacterLoadout.jsx'
import { game } from '../store.js'
import TrainingOptions from './TrainingOptions.jsx'

export default function TrainingArmory({ onClose }) {
  const close=useRef(),s={ bank:game.get().trainingBank,busy:false,loading:false,user:null }
  const [options,setOptions]=useState(game.get().trainingOptions)
  useEffect(()=> { close.current?.focus() },[])
  return <div className="overlay modal" onKeyDown={event=> {
    if(event.code==='Escape') { event.preventDefault();event.stopPropagation();onClose(false) }
    if(event.key!=='Tab') return
    const items=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
    if(event.shiftKey && document.activeElement===items[0]) { event.preventDefault();items.at(-1)?.focus() }
    else if(!event.shiftKey && document.activeElement===items.at(-1)) { event.preventDefault();items[0]?.focus() }
  }}><section className="dialog account-dialog field-armory" role="dialog" aria-modal="true" aria-labelledby="field-armory-title">
    <div className="eyebrow">TRAINING NEXUS / SIMULATION PAUSED</div><h2 id="field-armory-title">FIELD ARMORY</h2>
    <TrainingOptions value={options} onChange={setOptions}/>
    <CharacterLoadout s={s} training onSave={bank=> { if(game.applyTrainingBank(bank)) { game.setTrainingOptions(options);onClose(true) } }}/>
    <button ref={close} onClick={()=>onClose(true)}>CANCEL / RETURN TO TRAINING</button>
  </section></div>
}
