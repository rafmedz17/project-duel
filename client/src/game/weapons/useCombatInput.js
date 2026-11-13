import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Euler } from 'three'
import { createWeaponTracer } from './traceWeapon.js'
import { WEAPONS } from '../config.js'
import { weaponForBinding,weaponSlots } from '../../../../shared/loadout.js'
import { game } from '../store.js'

export function useCombatInput(camera, canvas, scene, look) {
  const heldWeapon = useRef(null), fire = useRef(null)
  useFrame(() => {
    if (!heldWeapon.current) return
    const s = game.get()
    if (s.mode !== 'playing' || document.pointerLockElement !== canvas || s.weapon !== heldWeapon.current || s.reloading || !s.magazines[s.weapon]) {
      heldWeapon.current = null
      return
    }
    // One shot per frame at most: never replay missed frames as a burst.
    fire.current?.()
  },-1.5)
  useEffect(() => {
    const trace = createWeaponTracer(), rotation = new Euler(0,0,0,'YXZ')
    const active = () => game.get().mode === 'playing' && document.pointerLockElement === canvas
    const key = event => {
      if (!active() || event.repeat) return
      const selection = weaponForBinding(game.get().loadout,event.code)
      if (event.code !== 'KeyR' && event.code !== 'KeyQ' && !selection) return
      event.preventDefault()
      heldWeapon.current = null
      if (event.code === 'KeyR') game.reload()
      else { const slots = weaponSlots(game.get().loadout); game.switchWeapon(selection || slots[(slots.indexOf(game.get().weapon)+1)%slots.length]) }
    }
    const shoot = () => {
      if (!active() || !game.canAttack()) return
      camera.quaternion.setFromEuler(rotation.set(look.current.pitch,look.current.yaw,0,'YXZ'))
      // Both melee and projectiles use the first visible solid surface. Cover
      // blocks melee too; a target beyond blade range cannot receive damage.
      scene.updateMatrixWorld(true)
      camera.updateMatrixWorld()
      game.attack(trace(scene,camera,WEAPONS[game.get().weapon]))
    }
    fire.current = shoot
    const release = () => { heldWeapon.current = null }
    const attack = event => {
      if (event.button !== 0 || !active()) return
      const s = game.get()
      if (s.reloading) return
      heldWeapon.current = WEAPONS[s.weapon].fireMode === 'auto' ? s.weapon : null
      shoot()
    }
    const up = event => { if (event.button === 0) release() }
    document.addEventListener('keydown',key)
    document.addEventListener('mousedown',attack)
    document.addEventListener('mouseup',up)
    document.addEventListener('pointerlockchange',release)
    document.addEventListener('visibilitychange',release)
    window.addEventListener('blur',release)
    return () => {
      release(); fire.current = null
      document.removeEventListener('keydown',key); document.removeEventListener('mousedown',attack)
      document.removeEventListener('mouseup',up); document.removeEventListener('pointerlockchange',release)
      document.removeEventListener('visibilitychange',release); window.removeEventListener('blur',release)
    }
  },[camera,canvas,scene,look])
}
