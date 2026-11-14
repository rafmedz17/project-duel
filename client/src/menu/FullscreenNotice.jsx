import {useEffect,useRef,useState} from 'react'
import './fullscreen-notice.css'

export default function FullscreenNotice({onDismiss}) {
  const dialog=useRef(null),decline=useRef(null)
  const [pending,setPending]=useState(false),[error,setError]=useState('')
  useEffect(()=>{
    const element=dialog.current
    element.showModal()
    decline.current.focus()
    return ()=>element.close()
  },[])

  async function agree() {
    if(pending) return
    if(document.fullscreenElement) {onDismiss();return}
    if(!document.documentElement.requestFullscreen) {
      setError('Fullscreen is unavailable in this browser. Try F11 on desktop, or choose No, thanks to continue.')
      return
    }
    setPending(true);setError('')
    try {
      // Keep this call inside the click handler: fullscreen requires a gesture.
      // Fullscreen the document so menus, dialogs and the game stay together.
      await document.documentElement.requestFullscreen({navigationUI:'hide'})
      onDismiss()
    } catch {
      setError('Your browser couldn’t enter fullscreen. Try F11 on desktop, or choose No, thanks to continue.')
      setPending(false)
    }
  }

  function keepFocus(event) {
    if(event.key!=='Tab') return
    const buttons=[...dialog.current.querySelectorAll('button:not(:disabled)')]
    const first=buttons[0],last=buttons.at(-1)
    if(!first) {event.preventDefault();return}
    if(event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus()}
    else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus()}
  }

  return <dialog ref={dialog} className="fullscreen-notice" aria-modal="true" aria-labelledby="fullscreen-notice-title" aria-describedby="fullscreen-notice-description" onKeyDown={keepFocus} onCancel={event=>{event.preventDefault();onDismiss()}}>
    <div className="fullscreen-notice-heading"><span className="fullscreen-warning-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 5 45 41H3L24 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M24 17v11" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><circle cx="24" cy="34" r="1.8" fill="currentColor"/></svg></span><div><div className="fullscreen-eyebrow">PROJECT DUEL / BEFORE YOU DEPLOY</div><h2 id="fullscreen-notice-title">HI, PLAYERS.</h2></div></div>
    <p id="fullscreen-notice-description">For the best gaming experience, we recommend playing in <strong>fullscreen</strong>. More room for the action. Fewer distractions.</p>
    <div className="fullscreen-desktop-tip"><span aria-hidden="true">↗</span> On desktop, use <kbd>F11</kbd> to toggle browser fullscreen.</div>
    {error && <p className="fullscreen-notice-error" role="alert">{error}</p>}
    <div className="fullscreen-notice-actions"><span>READY TO GO FULLSCREEN?</span><div><button ref={decline} type="button" disabled={pending} onClick={onDismiss}>NO, THANKS</button><button type="button" className="fullscreen-agree" disabled={pending} onClick={()=>void agree()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>{pending ? 'ENTERING FULLSCREEN…' : 'I AGREE'}</button></div></div>
  </dialog>
}
