import {useEffect,useRef} from 'react'

export default function MultiplayerPicker({onChoose,onDismiss,anchorRef}) {
  const root=useRef(null)
  useEffect(()=>{
    root.current.querySelector('button').focus()
    const outside=event=>{if(!root.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) onDismiss(false)}
    document.addEventListener('pointerdown',outside)
    return ()=>document.removeEventListener('pointerdown',outside)
  },[anchorRef,onDismiss])
  return <div ref={root} className="multiplayer-picker" id="multiplayer-mode-picker" role="dialog" aria-label="Choose multiplayer mode" onKeyDown={event=>{
    if(event.key==='Escape') {event.preventDefault();event.stopPropagation();onDismiss(true);return}
    if(!['ArrowDown','ArrowUp','Tab'].includes(event.key)) return
    const buttons=[...root.current.querySelectorAll('button')],index=buttons.indexOf(document.activeElement)
    event.preventDefault();buttons[(index+(event.key==='ArrowUp' || event.shiftKey ? -1 : 1)+buttons.length)%buttons.length].focus()
  }}>
    <div className="mode-picker-heading">CHOOSE YOUR ARENA <span>01 / 02</span></div>
    <button type="button" onClick={()=>onChoose('casual')}><span className="mode-picker-symbol" aria-hidden="true">◇</span><span><strong>CASUAL</strong><small>PRIVATE DUELS + FREE PLAY</small></span><span aria-hidden="true">↗</span></button>
    <button type="button" className="ranked-choice" onClick={()=>onChoose('ranked')}><span className="mode-picker-symbol" aria-hidden="true">♜</span><span><strong>RANKED</strong><small>BEST OF THREE / ELO RATING</small></span><span aria-hidden="true">↗</span></button>
  </div>
}
