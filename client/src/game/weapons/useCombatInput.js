import { useEffect } from 'react'
import { Euler } from 'three'
import { createWeaponTracer } from './traceWeapon.js'
import { WEAPONS } from '../config.js'
import { weaponForBinding,weaponSlots } from '../../../../shared/loadout.js'
import { game } from '../store.js'
import { canonicalCode } from '../../settings/preferences.js'

export function useCombatInput(camera,canvas,scene,look) {
  useEffect(()=> {
    const trace=createWeaponTracer(),rotation=new Euler(0,0,0,'YXZ')
    const active=()=>game.get().mode==='playing' && document.pointerLockElement===canvas
    const readTrace=()=> {
      camera.quaternion.setFromEuler(rotation.set(look.current.pitch,look.current.yaw,0,'YXZ'))
      scene.updateMatrixWorld(true); camera.updateMatrixWorld()
      return trace(scene,camera,WEAPONS[game.get().weapon],game.get().shot+1)
    }
    const interrupt=()=> { game.cancelAttack(); if (game.get().aiming) game.set({ aiming:false }) }
    const key=event=> {
      if (!active() || event.repeat) return
      const code=canonicalCode(event,game.get().settings)
      if(code==='Mouse0') { event.preventDefault();game.trigger(readTrace,WEAPONS[game.get().weapon].fireMode==='auto');return }
      if(code==='Mouse2') { event.preventDefault();game.set({ aiming:game.get().settings.scopeMode==='tap' ? !game.get().aiming : true });return }
      if (code==='KeyT') { event.preventDefault();game.set({ inspectAt:game.now() }); return }
      const selection=weaponForBinding(game.get().loadout,code)
      if (code!=='KeyR' && code!=='KeyQ' && !selection) return
      event.preventDefault(); interrupt()
      if (code==='KeyR') game.reload()
      else { const slots=weaponSlots(game.get().loadout); game.switchWeapon(selection || slots[(slots.indexOf(game.get().weapon)+1)%slots.length]) }
    }
    const up=event=> { const code=canonicalCode(event,game.get().settings);if (code==='Mouse0') game.releaseTrigger();if (code==='Mouse2' && game.get().settings.scopeMode==='hold') game.set({ aiming:false }) }
    const context=event=> { if (active()) event.preventDefault() }
    document.addEventListener('keydown',key);document.addEventListener('keyup',up); document.addEventListener('mousedown',key); document.addEventListener('mouseup',up)
    document.addEventListener('contextmenu',context); document.addEventListener('pointerlockchange',interrupt); document.addEventListener('visibilitychange',interrupt); window.addEventListener('blur',interrupt)
    return ()=> {
      interrupt(); document.removeEventListener('keydown',key);document.removeEventListener('keyup',up); document.removeEventListener('mousedown',key); document.removeEventListener('mouseup',up)
      document.removeEventListener('contextmenu',context); document.removeEventListener('pointerlockchange',interrupt); document.removeEventListener('visibilitychange',interrupt); window.removeEventListener('blur',interrupt)
    }
  },[camera,canvas,scene,look])
}
