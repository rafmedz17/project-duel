import { useEffect } from 'react'
import { ABILITIES } from '../config.js'
import { game } from '../store.js'

export function useAbilityInput(body,keys,look,canvas) {
  useEffect(() => {
    const down = event => {
      if (event.repeat || game.get().mode !== 'playing' || document.pointerLockElement !== canvas || !body.current) return
      const id = Object.keys(ABILITIES).find(key => ABILITIES[key].binding === event.code)
      if (!id) return
      event.preventDefault()
      const p = body.current.translation(), yaw = look.current.yaw
      let x = Number(keys.current.has('KeyD'))-Number(keys.current.has('KeyA'))
      let z = Number(keys.current.has('KeyS'))-Number(keys.current.has('KeyW'))
      if (x === 0 && z === 0) z = -1
      game.activateAbility(id,{ position:[p.x,p.y,p.z],direction:[x*Math.cos(yaw)+z*Math.sin(yaw),z*Math.cos(yaw)-x*Math.sin(yaw)] })
    }
    document.addEventListener('keydown',down)
    return () => document.removeEventListener('keydown',down)
  },[body,keys,look,canvas])
}
