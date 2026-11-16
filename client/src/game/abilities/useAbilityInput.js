import { useEffect } from 'react'
import { ABILITIES,abilityForBinding } from '../../../../shared/abilities.js'
import { game } from '../store.js'
import { runtime } from '../runtime.js'
import { canonicalCode } from '../../settings/preferences.js'
import {beginThrow,cancelThrow,throwAim} from './throwAim.js'

export function useAbilityInput(body,keys,look,canvas) {
  useEffect(() => {
    const activate=id=>{
      if(game.get().mode!=='playing' || document.pointerLockElement!==canvas || !body.current) return
      const p = body.current.translation(), yaw = look.current.yaw
      let x = Number(keys.current.has('KeyD'))-Number(keys.current.has('KeyA'))
      let z = Number(keys.current.has('KeyS'))-Number(keys.current.has('KeyW'))
      if (x === 0 && z === 0) z = -1
      game.activateAbility(id,{ position:[p.x,p.y,p.z],yaw,pitch:look.current.pitch,crouched:runtime.crouched,direction:[x*Math.cos(yaw)+z*Math.sin(yaw),z*Math.cos(yaw)-x*Math.sin(yaw)] })
    }
    const down=event=>{
      if(event.repeat || game.get().mode!=='playing' || document.pointerLockElement!==canvas || !body.current) return
      const code=canonicalCode(event,game.get().settings),id=abilityForBinding(game.get().loadout,code)
      if(!id) return
      event.preventDefault()
      if(ABILITIES[id].fuse) {
        if(game.now()<game.get().abilities[id].readyAt || game.get().hp<=0) return
        game.cancelAttack();game.set({aiming:false});beginThrow(id,code,'training')
      } else activate(id)
    }
    const up=event=>{
      if(throwAim.scope==='training' && canonicalCode(event,game.get().settings)===throwAim.code) {const id=throwAim.id;cancelThrow();activate(id)}
    }
    const cancel=()=>cancelThrow()
    const unsubscribe=game.subscribe(()=>{if(throwAim.scope==='training' && (game.get().mode!=='playing' || game.get().hp<=0 || game.get().loadout.unique!==throwAim.id)) cancel()})
    const lock=()=>{if(document.pointerLockElement!==canvas) cancel()}
    document.addEventListener('keydown',down);document.addEventListener('mousedown',down)
    document.addEventListener('keyup',up);document.addEventListener('mouseup',up)
    document.addEventListener('pointerlockchange',lock);window.addEventListener('blur',cancel)
    return () => { unsubscribe();cancel();document.removeEventListener('keydown',down);document.removeEventListener('mousedown',down);document.removeEventListener('keyup',up);document.removeEventListener('mouseup',up);document.removeEventListener('pointerlockchange',lock);window.removeEventListener('blur',cancel) }
  },[body,keys,look,canvas])
}
