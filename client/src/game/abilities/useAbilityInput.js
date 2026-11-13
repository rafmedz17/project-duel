import { useEffect } from 'react'
import { abilityForBinding } from '../../../../shared/abilities.js'
import { game } from '../store.js'
import { canonicalCode } from '../../settings/preferences.js'

export function useAbilityInput(body,keys,look,canvas) {
  useEffect(() => {
    const down = event => {
      if (event.repeat || game.get().mode !== 'playing' || document.pointerLockElement !== canvas || !body.current) return
      const id = abilityForBinding(game.get().loadout,canonicalCode(event,game.get().settings))
      if (!id) return
      event.preventDefault()
      const p = body.current.translation(), yaw = look.current.yaw
      let x = Number(keys.current.has('KeyD'))-Number(keys.current.has('KeyA'))
      let z = Number(keys.current.has('KeyS'))-Number(keys.current.has('KeyW'))
      if (x === 0 && z === 0) z = -1
      game.activateAbility(id,{ position:[p.x,p.y,p.z],yaw,pitch:look.current.pitch,direction:[x*Math.cos(yaw)+z*Math.sin(yaw),z*Math.cos(yaw)-x*Math.sin(yaw)] })
    }
    document.addEventListener('keydown',down);document.addEventListener('mousedown',down)
    return () => { document.removeEventListener('keydown',down);document.removeEventListener('mousedown',down) }
  },[body,keys,look,canvas])
}
