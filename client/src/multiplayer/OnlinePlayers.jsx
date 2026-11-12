import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler } from 'three'
import { canPlayArena } from '../../../shared/match.js'
import { PLAYER, ONLINE } from '../../../shared/arena.js'
import RobotModel from '../game/characters/RobotModel.jsx'
import WeaponView from '../game/weapons/WeaponView.jsx'
import { ABILITIES } from '../../../shared/abilities.js'
import OnlineEffects from './OnlineEffects.jsx'
import { WEAPONS, WEAPON_IDS } from '../../../shared/weapons.js'
import { onlineWeapon } from './onlineWeapon.js'
import { game } from '../game/store.js'
import { lobby, useLobby } from './lobby.js'
import { arenaView, latestPose, samplePose, subscribePoses } from './poses.js'

function LocalCamera({ id }) {
  const { gl } = useThree()
  const keys = useRef(new Set()), jump = useRef(false), look = useRef(null), initialized = useRef(false)
  const phase = useLobby(s => s.room?.phase), status = useLobby(s => s.status)
  const matchPhase = useLobby(s => s.room?.matchPhase)
  const roundId = useLobby(s => s.room?.roundId)
  const seenRound = useRef(-1)
  const clearInput = useRef(null), held = useRef(false), nextFire = useRef(0), wasDead = useRef(false)
  useEffect(() => {
    const canvas = gl.domElement
    const active = () => document.pointerLockElement === canvas && lobby.get().status === 'connected' && canPlayArena(lobby.get().room)
    const send = () => {
      const captured = active(), pressed = keys.current, pose = latestPose(id)
      const aim = look.current || { yaw:pose?.yaw || 0,pitch:pose?.pitch || 0 }
      lobby.move({ x:captured ? Number(pressed.has('KeyD'))-Number(pressed.has('KeyA')) : 0,z:captured ? Number(pressed.has('KeyS'))-Number(pressed.has('KeyW')) : 0,yaw:aim.yaw,pitch:aim.pitch,sprint:captured && (pressed.has('ShiftLeft') || pressed.has('ShiftRight')),jump:captured && jump.current,active:captured })
      jump.current = false
    }
    const clear = () => { held.current = false; keys.current.clear(); jump.current = false; send() }
    clearInput.current = clear
    const down = event => {
      if (!active() || lobby.self()?.hp<=0) return
      const ability = Object.keys(ABILITIES).find(id => ABILITIES[id].binding===event.code)
      if (ability) {
        event.preventDefault()
        if (!event.repeat) { send(); lobby.combat('ability',{ ability }) }
        return
      }
      const weapon = WEAPON_IDS.find(id => WEAPONS[id].binding===event.code)
      if (weapon || event.code==='KeyQ' || event.code==='KeyR') {
        event.preventDefault()
        if (event.repeat) return
        held.current = false
        if (event.code==='KeyR') lobby.combat('reload')
        else lobby.combat('switch',{ weapon:weapon || WEAPON_IDS[(WEAPON_IDS.indexOf(lobby.self().weapon)+1)%WEAPON_IDS.length] })
        return
      }
      if (!['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(event.code)) return
      event.preventDefault()
      keys.current.add(event.code)
      if (event.code === 'Space' && !event.repeat) jump.current = true
    }
    const up = event => { keys.current.delete(event.code); if (active()) send() }
    const move = event => {
      if (!active() || !look.current) return
      const sensitivity = PLAYER.sensitivity*game.get().settings.sensitivity
      look.current.yaw = Math.atan2(Math.sin(look.current.yaw-event.movementX*sensitivity),Math.cos(look.current.yaw-event.movementX*sensitivity))
      look.current.pitch = Math.max(-ONLINE.maxPitch,Math.min(ONLINE.maxPitch,look.current.pitch-event.movementY*sensitivity))
    }
    const fire = event => {
      if (event.button!==0 || !active() || lobby.self()?.hp<=0 || lobby.self()?.reloading || !look.current) return
      held.current = true
      nextFire.current = performance.now()+WEAPONS[lobby.self().weapon].cooldown*1000+10
      lobby.combat('fire',look.current)
    }
    const release = event => { if (event.button===0) held.current = false }
    const lock = () => { clear(); lobby.setCaptured(document.pointerLockElement===canvas && lobby.get().room?.phase==='arena') }
    const blur = () => { clear(); if (document.pointerLockElement === canvas) document.exitPointerLock() }
    const visibility = () => { if (document.hidden) blur() }
    const error = () => lobby.setCaptured(false)
    document.addEventListener('mousedown',fire); document.addEventListener('mouseup',release)
    document.addEventListener('keydown',down); document.addEventListener('keyup',up); document.addEventListener('mousemove',move)
    document.addEventListener('pointerlockchange',lock); document.addEventListener('pointerlockerror',error)
    window.addEventListener('blur',blur); document.addEventListener('visibilitychange',visibility)
    const interval = setInterval(send,1000/ONLINE.inputRate)
    return () => {
      clearInterval(interval); clear()
      document.removeEventListener('mousedown',fire); document.removeEventListener('mouseup',release)
      document.removeEventListener('keydown',down); document.removeEventListener('keyup',up); document.removeEventListener('mousemove',move)
      document.removeEventListener('pointerlockchange',lock); document.removeEventListener('pointerlockerror',error)
      window.removeEventListener('blur',blur); document.removeEventListener('visibilitychange',visibility)
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      lobby.setCaptured(false)
    }
  },[gl,id])
  useEffect(() => {
    clearInput.current?.()
    if (phase !== 'arena' || status !== 'connected' || matchPhase==='finished') {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
    }
  },[phase,status,matchPhase,roundId,gl])
  useFrame(({ camera },delta) => {
    const pose = latestPose(id)
    if (!pose) return
    const dead = lobby.self()?.hp===0
    if (!initialized.current || (wasDead.current && !dead) || seenRound.current!==roundId) {
      camera.position.set(pose.x,pose.y+PLAYER.eye,pose.z)
      look.current = { yaw:pose.yaw,pitch:pose.pitch }
      initialized.current = true
      seenRound.current = roundId
    }
    if (dead) { held.current = false; keys.current.clear(); jump.current = false }
    if (lobby.self()?.reloading) held.current = false
    wasDead.current = dead
    if (held.current && document.pointerLockElement===gl.domElement && lobby.get().status==='connected' && canPlayArena(lobby.get().room) && !dead) {
      const self = lobby.self()
      if (self.weapon==='rifle' && !self.reloading && performance.now()>=nextFire.current) {
        lobby.combat('fire',look.current)
        nextFire.current = performance.now()+WEAPONS.rifle.cooldown*1000+10
      }
    }
    const alpha = 1-Math.exp(-24*Math.min(delta,0.1))
    camera.position.x += (pose.x-camera.position.x)*alpha
    camera.position.y += (pose.y+PLAYER.eye-camera.position.y)*alpha
    camera.position.z += (pose.z-camera.position.z)*alpha
    camera.quaternion.setFromEuler(new Euler(look.current.pitch,look.current.yaw,0,'YXZ'))
    arenaView.position = [camera.position.x,camera.position.y-PLAYER.eye,camera.position.z]
    arenaView.yaw = look.current.yaw; arenaView.pitch = look.current.pitch
  },-2)
  return null
}

function RemotePlayer({ player }) {
  const root = useRef(), head = useRef()
  useFrame(() => {
    const pose = samplePose(player.id)
    if (!pose || !root.current) return
    root.current.visible = player.combat.hp>0
    root.current.position.set(pose.x,pose.y,pose.z)
    root.current.rotation.y = pose.yaw
    head.current.rotation.x = pose.pitch
    arenaView.remotes[player.id] = { position:[pose.x,pose.y,pose.z],yaw:pose.yaw,pitch:pose.pitch }
  })
  const color = player.slot === 0 ? '#58dcff' : '#ffb95c'
  return <group ref={root} name={`remote-player-${player.id}`}>
    <RobotModel headRef={head} color={player.connected ? color : '#728599'} />
  </group>
}

export default function OnlinePlayers() {
  const id = useLobby(s => s.sessionId), players = useLobby(s => s.room?.players)
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => subscribePoses(invalidate),[invalidate])
  return <>
    <LocalCamera id={id} />
    <WeaponView source={onlineWeapon} />
    <OnlineEffects />
    {players?.filter(player => player.id !== id).map(player => <RemotePlayer key={player.id} player={player} />)}
  </>
}
