import {useEffect,useId,useRef} from 'react'
import {createPortal} from 'react-dom'

export default function LoadoutPickerDialog({title,subtitle,onClose,children}) {
  const root=useRef(),titleId=useId()
  useEffect(()=>{
    const previous=document.activeElement,parent=previous?.closest('[role="dialog"]'),wasInert=parent?.inert
    if(parent) parent.inert=true
    root.current.querySelector('button:not(:disabled)')?.focus()
    return ()=>{if(parent) parent.inert=wasInert;previous?.focus()}
  },[])
  return createPortal(<div className="loadout-picker-overlay" onMouseDown={event=>{if(event.target===event.currentTarget) onClose()}} onKeyDown={event=>{
    event.stopPropagation()
    if(event.key==='Escape') {event.preventDefault();onClose();return}
    if(event.key!=='Tab') return
    const items=[...root.current.querySelectorAll('button:not(:disabled),[tabindex="0"]')]
    if(event.shiftKey && document.activeElement===items[0]) {event.preventDefault();items.at(-1)?.focus()}
    else if(!event.shiftKey && document.activeElement===items.at(-1)) {event.preventDefault();items[0]?.focus()}
  }}><section ref={root} className="loadout-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <header className="loadout-picker-header"><div><span className="loadout-kicker">PROJECT DUEL / ARMORY</span><h2 id={titleId}>{title}</h2><p>{subtitle || 'Choose to equip. Your loadout saves automatically.'}</p></div><button type="button" className="loadout-close" aria-label="Close equipment picker" onClick={onClose}>×</button></header>
    {children}
  </section></div>,document.body)
}
