import { useEffect } from 'react'
import { game } from '../game/store.js'
import { runtime } from '../game/runtime.js'
import { lobby } from '../multiplayer/lobby.js'
import { arenaView,latestPose } from '../multiplayer/poses.js'
import { PLAYER } from '../../../shared/arena.js'
import { audio } from './synth.js'
import { combatCues,matchCues,Footsteps } from './cues.js'
import { targetPosition } from '../game/training/config.js'

export function useGameAudio() {
  useEffect(() => {
    let previousGame=game.get(),previousLobby=lobby.get(),scope='',wasActive=false,focused=document.hasFocus(),frameId
    const steps=new Footsteps()
    function sync() {
      const local=game.get(),online=lobby.get(),room=online.room
      const inArena=Boolean(room?.arenaActive)
      const nextScope=inArena ? `${room.code}:${room.arenaEpoch}` : `training:${local.generation}`
      const active=focused && !document.hidden && (inArena ? online.status==='connected' && room.phase==='arena' : ['playing','dead'].includes(local.mode))
      audio.configure(local.settings)
      audio.setActive(active)
      if (!active || !wasActive || scope!==nextScope) steps.clear()
      if (active && wasActive && scope===nextScope) {
        if (inArena) {
          for (const player of room.players) {
            const previous=previousLobby.room?.players.find(p => p.id===player.id)
            const self=player.id===online.sessionId,pose=latestPose(player.id)
            if (!self && !pose) continue
            if (room.roundId===previousLobby.room?.roundId) for (const cue of combatCues(previous?.combat,player.combat,self)) audio.play(cue,self ? {} : { position:[pose.x,pose.y,pose.z],gain:0.85 })
          }
          for (const cue of matchCues(previousLobby.room,room,online.sessionId)) audio.play(cue)
        } else {
          for (const cue of combatCues(previousGame,local)) audio.play(cue)
          local.targets.forEach((target,index)=> { if(target.shots>(previousGame.targets[index]?.shots || 0)) audio.play('rifle',{ position:targetPosition(index,target),gain:0.35 }) })
        }
      }
      scope=nextScope; wasActive=active; previousGame=local; previousLobby=online
    }
    function frame() {
      if (wasActive) {
        const online=lobby.get(),local=game.get(),inArena=Boolean(online.room?.arenaActive)
        const view=inArena ? arenaView : runtime,position=view.position
        audio.listener([position[0],position[1]+PLAYER.eye,position[2]],view.yaw,view.pitch)
        const now=performance.now()/1000
        if (inArena) {
          const live=online.room.format!=='duel' || online.room.matchPhase==='live'
          for (const player of online.room.players) {
            const pose=latestPose(player.id)
            if (!pose) continue
            const self=player.id===online.sessionId,p=[pose.x,pose.y,pose.z]
            const grounded=live && pose.grounded && player.combat.hp>0 && online.room.time>=player.combat.abilities.dash.activeUntil
            if (steps.step(player.id,p,grounded,now)) audio.play('step',self ? { gain:0.4 } : { position:p,gain:0.7 })
          }
        } else if (steps.step('self',position,runtime.grounded && local.hp>0 && local.time>=local.abilities.dash.activeUntil,now)) audio.play('step',{ gain:0.4 })
        audio.diagnostics()
      }
      frameId=requestAnimationFrame(frame)
    }
    function gesture(event) {
      if (!event.isTrusted) return
      focused=document.hasFocus()
      sync()
      void audio.unlock()
    }
    function focus() { focused=true; sync() }
    function blur() { focused=false; sync(); audio.pause() }
    function visibility() { if (document.hidden) blur(); else { focused=document.hasFocus(); sync() } }
    const unsubscribeGame=game.subscribe(sync),unsubscribeLobby=lobby.subscribe(sync)
    document.addEventListener('pointerdown',gesture,true); document.addEventListener('keydown',gesture,true)
    window.addEventListener('focus',focus); window.addEventListener('blur',blur); document.addEventListener('visibilitychange',visibility)
    sync(); frameId=requestAnimationFrame(frame)
    return () => {
      unsubscribeGame(); unsubscribeLobby(); cancelAnimationFrame(frameId)
      document.removeEventListener('pointerdown',gesture,true); document.removeEventListener('keydown',gesture,true)
      window.removeEventListener('focus',focus); window.removeEventListener('blur',blur); document.removeEventListener('visibilitychange',visibility)
      audio.setActive(false); audio.pause()
    }
  },[])
}
