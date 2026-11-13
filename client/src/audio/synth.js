import { audioSettings } from './settings.js'
import { roomSend,soundLayers } from './profiles.js'
import {MENU_THEME} from './menuTheme.js'

// One lazy AudioContext, bounded effects voices and one cached menu music loop.
// Context creation/resume happens from user interaction, never page load.
export function createSynth() {
  let context,master,compressor,analyser,noiseBuffer,sfx,music,room,musicActive=false,ambient=null,active=false,settings=audioSettings(),unavailable=false
  let played=0,spatial=0,peakRms=0,lastSpatial=null,menuBuffer=null,menuLoading=null,musicFailed=false
  const counts={},voices=new Set(),events=[],samples=new Float32Array(512)
  function create() {
    if (context || unavailable) return
    const Audio=globalThis.AudioContext || globalThis.webkitAudioContext
    if (!Audio) { unavailable=true; return }
    try {
      context=new Audio({ latencyHint:'interactive' })
      compressor=context.createDynamicsCompressor()
      compressor.threshold.value=-16; compressor.knee.value=10; compressor.ratio.value=5; compressor.attack.value=0.002; compressor.release.value=0.12
      master=context.createGain(); analyser=context.createAnalyser(); analyser.fftSize=512
      sfx=context.createGain();sfx.gain.value=settings.sfxVolume**2;sfx.connect(compressor)
      music=context.createGain();music.gain.value=settings.musicVolume**2;music.connect(compressor)
      compressor.connect(master); master.connect(analyser); analyser.connect(context.destination)
      master.gain.value=settings.muted ? 0 : settings.volume**2*0.65
      noiseBuffer=context.createBuffer(1,Math.ceil(context.sampleRate*0.6),context.sampleRate)
      const data=noiseBuffer.getChannelData(0)
      let seed=731
      for (let i=0;i<data.length;i++) { seed=(1664525*seed+1013904223)>>>0; data[i]=seed/2147483648-1 }
      // One short, shared room response gives reports a small acoustic tail.
      // It is not a looping ambience track and follows the sound-effects bus.
      room=context.createConvolver()
      const impulse=context.createBuffer(2,Math.ceil(context.sampleRate*.28),context.sampleRate)
      for(let channel=0;channel<2;channel++) {
        const samples=impulse.getChannelData(channel)
        for(let i=0;i<samples.length;i++) { seed=(1664525*seed+1013904223)>>>0;samples[i]=(seed/2147483648-1)*Math.exp(-i/(context.sampleRate*.055))*.45 }
      }
      room.buffer=impulse;room.connect(sfx)
    } catch { unavailable=true }
  }
  function stop() { for (const voice of [...voices]) voice.stop() }
  function syncMusic() {
    const enabled=musicActive && !settings.muted && settings.volume>0 && settings.musicVolume>0
    if(!context || !enabled) {
      if(ambient) { for(const node of ambient.sources) { try { node.stop() } catch { /* Already stopped. */ } };for(const node of ambient.nodes) node.disconnect();ambient=null }
      return
    }
    if(ambient) return
    if(!menuBuffer) {
      if(!menuLoading && !musicFailed) {
        const owner=context
        menuLoading=fetch(new URL('./limit-break.wav',import.meta.url)).then(response=>{
          if(!response.ok) throw new Error('Menu theme unavailable')
          return response.arrayBuffer()
        }).then(data=>owner.decodeAudioData(data)).then(buffer=>{
          if(context!==owner) return
          menuBuffer=buffer;syncMusic()
        }).catch(()=>{musicFailed=true}).finally(()=>{menuLoading=null})
      }
      return
    }
    const source=context.createBufferSource(),level=context.createGain()
    source.buffer=menuBuffer;source.loop=true
    level.gain.setValueAtTime(0,context.currentTime);level.gain.linearRampToValueAtTime(1,context.currentTime+.6)
    source.connect(level);level.connect(music);source.start()
    ambient={sources:[source],nodes:[source,level]}
  }
  const synth = {
    async unlock() {
      create()
      if (!context) return false
      try {
        syncMusic()
        if (context.state!=='running' && context.state!=='closed' && (active || musicActive)) await context.resume()
        else if (!active && !musicActive && context.state==='running') await context.suspend()
        // Capture can become active while the browser is still suspending.
        if ((active || musicActive) && context.state==='suspended') await context.resume()
        return context.state!=='closed'
      }
      catch { return false }
    },
    configure(value) {
      settings=audioSettings(value)
      if (master) {
        master.gain.cancelScheduledValues(context.currentTime)
        master.gain.setValueAtTime(settings.muted ? 0 : settings.volume**2*0.65,context.currentTime)
        sfx.gain.setTargetAtTime(settings.sfxVolume**2,context.currentTime,.025)
        music.gain.setTargetAtTime(settings.musicVolume**2,context.currentTime,.08)
      }
      if (settings.muted || settings.volume===0) stop()
      syncMusic()
    },
    setMusicActive(value) {
      const changed=musicActive!==value
      musicActive=value;syncMusic()
      if(changed && ambient && context?.state==='suspended') void context.resume().catch(()=>{})
      if(changed && !musicActive && !active) synth.pause()
    },
    setActive(value) {
      if (active===value) return
      active=value
      if (!active) synth.pause()
      else if (context && context.state!=='running' && context.state!=='closed') void context.resume().catch(() => {})
    },
    pause() {
      stop()
      if (musicActive && ambient) return
      if (context?.state==='running') void context.suspend().then(() => { if ((active || musicActive) && context?.state==='suspended') return context.resume() }).catch(() => {})
    },
    listener(position,yaw=0,pitch=0) {
      if (!context) return
      const listener=context.listener,now=context.currentTime
      const forward=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]
      const up=[Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)]
      if (listener.positionX) {
        for (const [i,axis] of ['X','Y','Z'].entries()) {
          listener[`position${axis}`].setValueAtTime(position[i],now)
          listener[`forward${axis}`].setValueAtTime(forward[i],now)
          listener[`up${axis}`].setValueAtTime(up[i],now)
        }
      } else { listener.setPosition(...position); listener.setOrientation(...forward,...up) }
    },
    play(name,{ position=null,gain=1,preview=false,weapon,pace,surface,impact,pan=0 }={}) {
      if (!context || unavailable || (!active && !preview) || context.state!=='running' || settings.muted || settings.volume===0 || settings.sfxVolume===0) return false
      const layers=soundLayers(name,{weapon,pace,surface,impact})
      if(!layers) return false
      if (voices.size>=32) voices.values().next().value.stop()
      const mix=context.createGain(),sources=[],nodes=[mix]
      mix.gain.value=Math.max(0,Math.min(1,gain))
      if (position) {
        const panner=context.createPanner()
        panner.panningModel='HRTF'; panner.distanceModel='inverse'; panner.refDistance=8; panner.maxDistance=50; panner.rolloffFactor=1.2
        panner.positionX.value=position[0]; panner.positionY.value=position[1]; panner.positionZ.value=position[2]
        mix.connect(panner); panner.connect(sfx); nodes.push(panner)
        if(roomSend(name)>0) { const send=context.createGain();send.gain.value=roomSend(name);panner.connect(send);send.connect(room);nodes.push(send) }
        spatial++; lastSpatial=[...position]
      } else {
        const stereo=context.createStereoPanner();stereo.pan.value=Math.max(-1,Math.min(1,pan));mix.connect(stereo);stereo.connect(sfx);nodes.push(stereo)
        if(roomSend(name)>0) { const send=context.createGain();send.gain.value=roomSend(name);stereo.connect(send);send.connect(room);nodes.push(send) }
      }
      let remaining=layers.length,stopped=false
      const finish=() => {
        if (stopped) return
        stopped=true; voices.delete(voice)
        for (const node of nodes) node.disconnect()
        if (!active && voices.size===0 && context.state==='running') synth.pause()
      }
      const voice={ stop() { for (const source of sources) { source.onended=null; try { source.stop() } catch { /* Already ended. */ } }; finish() } }
      voices.add(voice)
      const variation=1+Math.sin((played+1)*2.399963)*.025
      for (const [index,part] of layers.entries()) {
        const start=context.currentTime+0.006+(part.delay || 0),end=start+part.duration
        const source=part.noise ? context.createBufferSource() : context.createOscillator(),envelope=context.createGain()
        if (part.noise) {
          source.buffer=noiseBuffer;source.playbackRate.value=variation
          const filter=context.createBiquadFilter()
          filter.type=part.filter || 'lowpass'; filter.Q.value=part.q ?? .7
          filter.frequency.setValueAtTime(Math.min(context.sampleRate*.45,part.frequency*variation),start)
          if(part.end) filter.frequency.exponentialRampToValueAtTime(part.end*variation,end)
          source.connect(filter); filter.connect(envelope); nodes.push(filter)
        } else {
          source.type=part.type; source.frequency.setValueAtTime(part.frequency*variation,start)
          source.frequency.exponentialRampToValueAtTime(part.end*variation,end)
          source.connect(envelope)
        }
        envelope.gain.setValueAtTime(0.0001,start)
        envelope.gain.exponentialRampToValueAtTime(part.gain,start+Math.min(part.duration*.4,part.attack || .0025))
        envelope.gain.exponentialRampToValueAtTime(0.0001,end)
        envelope.connect(mix); nodes.push(source,envelope); sources.push(source)
        source.onended=() => { if (--remaining===0) finish() }
        if(part.noise) source.start(start,((played*137+index*71)%1000)/1000*.08)
        else source.start(start)
        source.stop(end+0.01)
      }
      played++; counts[name]=(counts[name] || 0)+1
      events.push({ name,spatial:Boolean(position),weapon:weapon || null,pace:pace || null,surface:surface || null,pan,layers:layers.length }); if (events.length>24) events.shift()
      return true
    },
    async preview() {
      if (settings.muted || settings.volume===0 || !await synth.unlock()) return false
      try { await context.resume(); return synth.play('preview',{ preview:true }) }
      catch { return false }
    },
    diagnostics() {
      let rms=0
      if (context?.state==='running') { analyser.getFloatTimeDomainData(samples); rms=Math.sqrt(samples.reduce((total,v) => total+v*v,0)/samples.length); peakRms=Math.max(peakRms,rms) }
      return { state:unavailable ? 'unavailable' : context?.state || 'locked',active,voices:voices.size,musicPlaying:Boolean(ambient),musicTrack:ambient ? MENU_THEME.title : null,musicSources:ambient?.sources.length || 0,sfxVolume:settings.sfxVolume,musicVolume:settings.musicVolume,played,spatial,counts:{ ...counts },events:[...events],lastSpatial:lastSpatial && [...lastSpatial],peakRms,rms,volume:settings.volume,muted:settings.muted }
    },
    dispose() { musicActive=false;syncMusic();stop(); if (context) void context.close().catch(() => {}); context=null;menuBuffer=null },
  }
  return synth
}

export const audio=createSynth()
