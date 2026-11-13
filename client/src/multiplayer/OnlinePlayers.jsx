import { ultimateModifiers } from '../../../shared/characters.js'
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler } from 'three'
import { useRapier } from '@react-three/rapier'
import { Prediction } from './Prediction.js'
import { canPlayArena } from '../../../shared/match.js'
import { PLAYER, ONLINE } from '../../../shared/arena.js'
import { eyeHeight } from '../../../shared/stance.js'
import RobotModel from '../game/characters/RobotModel.jsx'
import WeaponView from '../game/weapons/WeaponView.jsx'
import { abilityForBinding } from '../../../shared/abilities.js'
import { weaponForBinding,weaponSlots } from '../../../shared/loadout.js'
import { movementMultiplier } from '../../../shared/weapons.js'
import { throughSmoke,blocked } from '../../../shared/tactical.js'
import { getMap } from '../../../shared/maps.js'
import OnlineEffects from './OnlineEffects.jsx'
import { WEAPONS } from '../../../shared/weapons.js'
import { canonicalCode } from '../settings/preferences.js'
import { lookMultiplier } from '../settings/sensitivity.js'
import { onlineWeapon } from './onlineWeapon.js'
import { game } from '../game/store.js'
import { lobby, useLobby } from './lobby.js'
import { arenaView, latestPose, samplePose, subscribePoses } from './poses.js'

function LocalCamera({ id }) {
  const { gl } = useThree()
  const { rapier } = useRapier()
  const mapId = useLobby(s => s.room?.mapId)
  const prediction = useRef(null), accumulator = useRef(0), correction = useRef([0,0,0])
  const keys = useRef(new Set()), jump = useRef(false), look = useRef(null), initialized = useRef(false)
  const phase = useLobby(s => s.room?.phase), status = useLobby(s => s.status)
  const matchPhase = useLobby(s => s.room?.matchPhase)
  const roundId = useLobby(s => s.room?.roundId)
  const seenRound = useRef(-1), seenShot=useRef(0),fpsFrames=useRef({ count:0,time:0 })
  const clearInput = useRef(null), held = useRef(false),fireInput=useRef(false),nextFire = useRef(0), wasDead = useRef(false)
  useEffect(() => {
    const engine = new Prediction(rapier,mapId)
    prediction.current = engine
    return () => { prediction.current = null; engine.free() }
  },[rapier,mapId])
  useEffect(() => {
    const canvas = gl.domElement
    let requestedMenu=false
    const active = () => document.pointerLockElement === canvas && lobby.get().status === 'connected' && canPlayArena(lobby.get().room)
    const send = () => {
      const captured = active(), pressed = keys.current, pose = latestPose(id)
      const aim = look.current || { yaw:pose?.yaw || 0,pitch:pose?.pitch || 0 }
      const packet = lobby.move({ x:captured ? Number(pressed.has('KeyD'))-Number(pressed.has('KeyA')) : 0,z:captured ? Number(pressed.has('KeyS'))-Number(pressed.has('KeyW')) : 0,yaw:aim.yaw,pitch:aim.pitch,sprint:captured && (pressed.has('ShiftLeft') || pressed.has('ShiftRight')),crouch:captured && (pressed.has('ControlLeft') || pressed.has('ControlRight')),jump:captured && jump.current,active:captured })
      prediction.current?.command(packet)
      jump.current = false
    }
    const clear = () => { fireInput.current=false;lobby.combat('release'); game.set({ aiming:false }); held.current = false; keys.current.clear(); jump.current = false; send() }
    clearInput.current = clear
    const down = event => {
      if(event.code==='Escape') {
        requestedMenu=true;lobby.setBackground(false)
        if(document.pointerLockElement===canvas) document.exitPointerLock()
      }
      if (!active() || lobby.self()?.hp<=0) return
      const code=canonicalCode(event,game.get().settings)
      if(code==='Mouse0' || code==='Mouse2') { fire(event,code);return }
      if (code==='KeyT' && !event.repeat) { game.set({ inspectAt:lobby.get().room.time }); return }
      const ability = abilityForBinding(lobby.self().loadout,code)
      if (ability) {
        event.preventDefault()
        if (!event.repeat) { send(); lobby.combat('ability',{ ability,yaw:look.current?.yaw || 0,pitch:look.current?.pitch || 0 }) }
        return
      }
      const weapon = weaponForBinding(lobby.self().loadout,code)
      if (weapon || code==='KeyQ' || code==='KeyR') {
        event.preventDefault()
        if (event.repeat) return
        held.current = false;fireInput.current=false;game.set({ aiming:false }); lobby.combat('release')
        if (code==='KeyR') lobby.combat('reload')
        else {
          const equipped = weaponSlots(lobby.self().loadout)
          lobby.combat('switch',{ weapon:weapon || equipped[(equipped.indexOf(lobby.self().weapon)+1)%equipped.length] })
        }
        return
      }
      if (!['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight'].includes(code)) return
      event.preventDefault()
      keys.current.add(code)
      if (code === 'Space' && !event.repeat) jump.current = true
      if (!event.repeat) send()
    }
    const up = event => { const code=canonicalCode(event,game.get().settings);keys.current.delete(code);release(event,code);if (active()) send() }
    const move = event => {
      if (!active() || !look.current) return
      const settings=game.get().settings,sensitivity=PLAYER.sensitivity*lookMultiplier(settings,lobby.self(),lobby.get().room.time,{aiming:game.get().aiming,firing:fireInput.current})
      look.current.yaw = Math.atan2(Math.sin(look.current.yaw-event.movementX*sensitivity),Math.cos(look.current.yaw-event.movementX*sensitivity))
      look.current.pitch = Math.max(-ONLINE.maxPitch,Math.min(ONLINE.maxPitch,look.current.pitch-event.movementY*sensitivity))
    }
    const fire = (event,code) => {
      if (!active() || lobby.self()?.hp<=0 || lobby.self()?.reloading) return
      event.preventDefault()
      if (code==='Mouse2') { if(!event.repeat) game.set({ aiming:game.get().settings.scopeMode==='tap' ? !game.get().aiming : true });return }
      if (code!=='Mouse0' || event.repeat || !look.current) return
      fireInput.current=true
      const automatic=WEAPONS[lobby.self().weapon].fireMode==='auto'
      held.current=automatic; nextFire.current=performance.now()+100
      lobby.combat(automatic ? 'hold' : 'fire',look.current)
    }
    const release = (event,code) => {
      if (code==='Mouse2' && game.get().settings.scopeMode==='hold') game.set({ aiming:false })
      if(code==='Mouse0') fireInput.current=false
      if (code==='Mouse0' && held.current) { held.current=false; lobby.combat('release') }
    }
    const context=event=> { if (active()) event.preventDefault() }
    const lock = () => {
      const captured=document.pointerLockElement===canvas && lobby.get().room?.phase==='arena'
      if(!captured) clear()
      const live=canPlayArena(lobby.get().room) && lobby.self()?.hp>0
      lobby.setBackground(!captured && !requestedMenu && live)
      if(captured) requestedMenu=false
      lobby.setCaptured(captured)
    }
    const blur = () => {
      if(lobby.get().captured || document.pointerLockElement===canvas) { requestedMenu=false;lobby.setBackground(true) }
      clear();if(document.pointerLockElement===canvas) document.exitPointerLock()
    }
    const visibility = () => { if (document.hidden) blur() }
    const error = () => lobby.setCaptured(false)
    const recapture=event=> { if(event.target===canvas && !lobby.get().captured && lobby.get().background && !document.hidden) void lobby.capture() }
    document.addEventListener('contextmenu',context)
    document.addEventListener('mousedown',down); document.addEventListener('mouseup',up);canvas.addEventListener('click',recapture)
    document.addEventListener('keydown',down); document.addEventListener('keyup',up); document.addEventListener('mousemove',move)
    document.addEventListener('pointerlockchange',lock); document.addEventListener('pointerlockerror',error)
    window.addEventListener('blur',blur); document.addEventListener('visibilitychange',visibility)
    const interval = setInterval(send,1000/ONLINE.inputRate)
    const pose = latestPose(id)
    if (pose && !look.current) look.current = { yaw:pose.yaw,pitch:pose.pitch }
    lobby.setArenaReady(true)
    return () => {
      lobby.setArenaReady(false)
      clearInterval(interval); clear()
      document.removeEventListener('contextmenu',context)
      document.removeEventListener('mousedown',down); document.removeEventListener('mouseup',up);canvas.removeEventListener('click',recapture)
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
    fpsFrames.current.count++;fpsFrames.current.time+=delta
    if(fpsFrames.current.time>=.5) { game.set({ fps:Math.round(fpsFrames.current.count/fpsFrames.current.time) });fpsFrames.current={ count:0,time:0 } }
    const pose = latestPose(id)
    if (!pose) return
    const dead = lobby.self()?.hp===0
    const reset = !initialized.current || (wasDead.current && !dead) || seenRound.current!==roundId
    if (reset) {
      camera.position.set(pose.x,pose.y+eyeHeight(pose.crouched),pose.z)
      look.current = { yaw:pose.yaw,pitch:pose.pitch }
      seenShot.current=lobby.self()?.shot || 0
      initialized.current = true
      seenRound.current = roundId
    }
    if (dead) { held.current = false;fireInput.current=false;keys.current.clear(); jump.current = false }
    if (lobby.self()?.reloading) {held.current=false;fireInput.current=false}
    wasDead.current = dead
    if (held.current && document.pointerLockElement===gl.domElement && lobby.get().status==='connected' && canPlayArena(lobby.get().room) && !dead) {
      const self = lobby.self()
      if (WEAPONS[self.weapon].fireMode==='auto' && !self.reloading && performance.now()>=nextFire.current) {
        lobby.combat('hold',look.current)
        nextFire.current = performance.now()+100
      }
    }
    const self=lobby.self()
    if (self && self.shot>seenShot.current) {
      const weapon=WEAPONS[self.weapon],count=Math.min(3,self.shot-seenShot.current)
      if (lobby.get().captured) { look.current.pitch=Math.min(1.48,look.current.pitch+weapon.recoil*count); look.current.yaw+=Math.sin(self.shot*2.4)*weapon.recoil*0.3 }
      seenShot.current=self.shot
    }
    const engine = prediction.current
    if (engine) engine.entry.movement=movementMultiplier(self?.weapon)*ultimateModifiers(self || {},lobby.get().room?.time || 0).movement
    const predicting = !dead && performance.now()-pose.time<ONLINE.inputTimeoutMs+100 && document.pointerLockElement===gl.domElement && lobby.get().status==='connected' && canPlayArena(lobby.get().room)
    if (engine) {
      if (reset || !predicting) {
        engine.reset(pose); accumulator.current = 0; correction.current = [0,0,0]
      } else {
        const other = lobby.get().room.players.find(player => player.id!==id)
        const difference = engine.reconcile(pose,other ? { ...latestPose(other.id),hp:other.combat.hp } : null)
        if (Math.hypot(...difference)>1.5) correction.current = [0,0,0]
        else correction.current = correction.current.map((value,index) => value+difference[index])
        accumulator.current += Math.min(delta,0.1)
        while (accumulator.current>=1/ONLINE.tickRate) { engine.step(); accumulator.current -= 1/ONLINE.tickRate }
      }
      const position = engine.position(), decay = Math.exp(-16*Math.min(delta,0.1))
      correction.current = correction.current.map(value => value*decay)
      camera.position.set(position.x+correction.current[0],position.y+eyeHeight(engine.entry.crouched)+correction.current[1],position.z+correction.current[2])
    } else camera.position.set(pose.x,pose.y+eyeHeight(pose.crouched),pose.z)
    camera.quaternion.setFromEuler(new Euler(look.current.pitch,look.current.yaw,0,'YXZ'))
    const position=[camera.position.x,camera.position.y-eyeHeight(engine ? engine.entry.crouched : pose.crouched),camera.position.z]
    arenaView.motion=engine?.motion || {velocity:[pose.vx,pose.vy,pose.vz],grounded:pose.grounded,dashing:pose.dashRemaining>0,crouched:pose.crouched}
    arenaView.position = position
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
    arenaView.remotes[player.id] = { position:[pose.x,pose.y,pose.z],yaw:pose.yaw,pitch:pose.pitch,crouched:pose.crouched }
  })
  const reveal = () => {
    const self = lobby.self(), time = lobby.get().room.time, pose = samplePose(player.id)
    if (!self || self.hp<=0 || !pose) return false
    if (time<self.abilities.scanner.activeUntil) return true
    const smoke = self.abilities.smoke, origin = arenaView.position.map((v,i) => v+(i===1 ? eyeHeight(arenaView.motion.crouched) : 0)), target = [pose.x,pose.y,pose.z]
    return time<smoke.activeUntil && throughSmoke(origin,target,[{ origin:smoke.origin.map((v,i)=>v+(i===1 ? 1 : 0)),radius:4 }]) && !blocked(origin,target,getMap(lobby.get().room.mapId).solids)
  }
  return <group ref={root} name={`remote-player-${player.id}`}>
    <RobotModel enemy headRef={head} stance={()=>samplePose(player.id)?.crouched || false} characterId={player.combat.characterId} color={player.connected ? undefined : '#728599'} reveal={reveal} />
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
