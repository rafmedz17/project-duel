import { useEffect } from 'react'
import { Euler } from 'three'
import { createWeaponTracer } from './traceWeapon.js'
import { WEAPONS } from '../config.js'
import { weaponForBinding,weaponSlots } from '../../../../shared/loadout.js'
import { game } from '../store.js'

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
      if (event.code==='KeyT') { game.set({ inspectAt:game.now() }); return }
      const selection=weaponForBinding(game.get().loadout,event.code)
      if (event.code!=='KeyR' && event.code!=='KeyQ' && !selection) return
      event.preventDefault(); interrupt()
      if (event.code==='KeyR') game.reload()
      else { const slots=weaponSlots(game.get().loadout); game.switchWeapon(selection || slots[(slots.indexOf(game.get().weapon)+1)%slots.length]) }
    }
    const down=event=> {
      if (!active()) return
      if (event.button===2) { game.set({ aiming:true }); return }
      if (event.button===0) game.trigger(readTrace,WEAPONS[game.get().weapon].fireMode==='auto')
    }
    const up=event=> { if (event.button===0) game.releaseTrigger(); if (event.button===2) game.set({ aiming:false }) }
    const context=event=> { if (active()) event.preventDefault() }
    document.addEventListener('keydown',key); document.addEventListener('mousedown',down); document.addEventListener('mouseup',up)
    document.addEventListener('contextmenu',context); document.addEventListener('pointerlockchange',interrupt); document.addEventListener('visibilitychange',interrupt); window.addEventListener('blur',interrupt)
    return ()=> {
      interrupt(); document.removeEventListener('keydown',key); document.removeEventListener('mousedown',down); document.removeEventListener('mouseup',up)
      document.removeEventListener('contextmenu',context); document.removeEventListener('pointerlockchange',interrupt); document.removeEventListener('visibilitychange',interrupt); window.removeEventListener('blur',interrupt)
    }
  },[camera,canvas,scene,look])
}
