import { WEAPONS } from '../../../shared/weapons.js'
import { audioSettings } from './settings.js'

const tone=(frequency,end,duration,gain=0.1,delay=0,type='sine') => ({ frequency,end,duration,gain,delay,type })
const noise=(frequency,duration,gain=0.1,delay=0) => ({ noise:true,frequency,duration,gain,delay })
const melody=(notes,gain=0.08) => notes.map((frequency,i) => tone(frequency,frequency,0.16,gain,i*0.1,'triangle'))
const recipes = {
  pistol:[tone(880,130,0.17,0.14,0,'triangle'),noise(3400,0.055,0.07)],
  rifle:[tone(620,150,0.09,0.065,0,'square'),noise(2600,0.05,0.055)],
  shotgun:[tone(170,40,0.25,0.18,0,'sawtooth'),noise(1200,0.18,0.24)],
  blade:[tone(240,1250,0.19,0.075,0,'triangle'),noise(4500,0.17,0.08)],
  equip:[noise(900,0.045,0.07),tone(350,260,0.06,0.04)],
  'reload-start':[noise(1300,0.07,0.07,0.08),tone(130,100,0.09,0.06,0.08,'triangle'),tone(330,420,0.13,0.045,0.24)],
  'reload-end':[tone(600,600,0.08,0.065),tone(900,900,0.1,0.065,0.08)],
  dash:[noise(1800,0.18,0.13),tone(1050,180,0.19,0.07,0,'triangle')],
  shield:[tone(180,740,0.3,0.095),tone(370,1100,0.24,0.035)],
  scanner:[tone(920,920,0.12,0.065),tone(1380,1380,0.12,0.055,0.17)],
  emp:[tone(85,30,0.5,0.14,0,'sawtooth'),noise(600,0.4,0.15)],
  flashbang:[tone(1500,2100,0.15,0.05),noise(2100,0.12,0.09)],
  smoke:[noise(450,0.4,0.13),tone(220,70,0.3,0.06)],
  stun:[tone(400,1200,0.2,0.09,0,'triangle'),noise(1000,0.2,0.08)],
  ultimate:melody([330,494,660,988],0.1),
  hit:[tone(1550,1350,0.065,0.06)],
  headshot:[tone(1900,2100,0.09,0.07),tone(2600,2600,0.085,0.035,0.04)],
  elimination:melody([600,900,1200]),
  'shield-hit':[tone(420,120,0.13,0.08)],
  'shield-impact':[noise(1400,0.09,0.08),tone(140,80,0.13,0.08)],
  hurt:[tone(110,70,0.16,0.085,0,'triangle'),noise(800,0.07,0.06)],
  death:melody([180,120,65]),
  step:[noise(450,0.075,0.09),tone(95,55,0.07,0.08,0,'triangle')],
  countdown:[tone(800,800,0.085,0.065)],
  'round-start':[tone(1200,1400,0.17,0.08)],
  'round-win':melody([660,880]),'round-loss':melody([330,220]),draw:melody([440,440]),
  victory:melody([523,659,784,1046]),defeat:melody([392,330,261,196]),
  preview:melody([523,659,784]),
}

for (const [id,weapon] of Object.entries(WEAPONS)) {
  if (recipes[id]) continue
  const base=220+Number(weapon.number)*37
  recipes[id]=weapon.fireMode==='melee' ? [tone(180,1200,0.2,0.09,0,'triangle'),noise(weapon.model==='breaker' ? 150 : 2400,0.18,0.12,weapon.windup || 0)] : [tone(base,weapon.category==='SNIPER' ? 35 : 100,weapon.category==='SNIPER' ? 0.32 : 0.1,0.075,0,'triangle'),noise(weapon.pellets ? 900 : 2300,0.09,0.07)]
}
recipes['spin-up']=[tone(60,480,0.6,0.07,0,'sawtooth')]
for(let tier=2;tier<=5;tier++) {
  const root=330+tier*70,notes=[root,root*1.25,root*1.5,root*2].slice(0,tier===2 ? 3 : 4)
  recipes[`kill-combo-${tier}`]=[tone(95,38,0.25,0.12,0,'triangle'),...notes.map((frequency,i)=>tone(frequency,frequency*1.015,0.18,0.085,i*0.075,'triangle')),tone(root*2,root*2,0.28,0.045,0.24)]
}

// One lazy AudioContext, bounded voices and one reused noise buffer. Nothing is
// downloaded. Creation/resume happens from user interaction, never page load.
export function createSynth() {
  let context,master,compressor,analyser,noiseBuffer,active=false,settings=audioSettings(),unavailable=false
  let played=0,spatial=0,peakRms=0,lastSpatial=null
  const counts={},voices=new Set(),events=[],samples=new Float32Array(512)
  function create() {
    if (context || unavailable) return
    const Audio=globalThis.AudioContext || globalThis.webkitAudioContext
    if (!Audio) { unavailable=true; return }
    try {
      context=new Audio({ latencyHint:'interactive' })
      compressor=context.createDynamicsCompressor()
      compressor.threshold.value=-14; compressor.knee.value=8; compressor.ratio.value=8; compressor.attack.value=0.003; compressor.release.value=0.1
      master=context.createGain(); analyser=context.createAnalyser(); analyser.fftSize=512
      compressor.connect(master); master.connect(analyser); analyser.connect(context.destination)
      master.gain.value=settings.muted ? 0 : settings.volume**2*0.65
      noiseBuffer=context.createBuffer(1,Math.ceil(context.sampleRate*0.6),context.sampleRate)
      const data=noiseBuffer.getChannelData(0)
      let seed=731
      for (let i=0;i<data.length;i++) { seed=(1664525*seed+1013904223)>>>0; data[i]=seed/2147483648-1 }
    } catch { unavailable=true }
  }
  function stop() { for (const voice of [...voices]) voice.stop() }
  const synth = {
    async unlock() {
      create()
      if (!context) return false
      try {
        if (context.state!=='running' && context.state!=='closed' && active) await context.resume()
        else if (!active && context.state==='running') await context.suspend()
        // Capture can become active while the browser is still suspending.
        if (active && context.state==='suspended') await context.resume()
        return context.state!=='closed'
      }
      catch { return false }
    },
    configure(value) {
      settings=audioSettings(value)
      if (master) {
        master.gain.cancelScheduledValues(context.currentTime)
        master.gain.setValueAtTime(settings.muted ? 0 : settings.volume**2*0.65,context.currentTime)
      }
      if (settings.muted || settings.volume===0) stop()
    },
    setActive(value) {
      if (active===value) return
      active=value
      if (!active) synth.pause()
      else if (context && context.state!=='running' && context.state!=='closed') void context.resume().catch(() => {})
    },
    pause() {
      stop()
      if (context?.state==='running') void context.suspend().then(() => { if (active && context?.state==='suspended') return context.resume() }).catch(() => {})
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
    play(name,{ position=null,gain=1,preview=false }={}) {
      if (!context || unavailable || (!active && !preview) || context.state!=='running' || settings.muted || settings.volume===0 || !recipes[name]) return false
      if (voices.size>=32) voices.values().next().value.stop()
      const mix=context.createGain(),sources=[],nodes=[mix]
      mix.gain.value=Math.max(0,Math.min(1,gain))
      if (position) {
        const panner=context.createPanner()
        panner.panningModel='HRTF'; panner.distanceModel='inverse'; panner.refDistance=8; panner.maxDistance=50; panner.rolloffFactor=1.2
        panner.positionX.value=position[0]; panner.positionY.value=position[1]; panner.positionZ.value=position[2]
        mix.connect(panner); panner.connect(compressor); nodes.push(panner)
        spatial++; lastSpatial=[...position]
      } else mix.connect(compressor)
      let remaining=recipes[name].length,stopped=false
      const finish=() => {
        if (stopped) return
        stopped=true; voices.delete(voice)
        for (const node of nodes) node.disconnect()
        if (!active && voices.size===0 && context.state==='running') synth.pause()
      }
      const voice={ stop() { for (const source of sources) { source.onended=null; try { source.stop() } catch { /* Already ended. */ } }; finish() } }
      voices.add(voice)
      for (const part of recipes[name]) {
        const start=context.currentTime+0.006+(part.delay || 0),end=start+part.duration
        const source=part.noise ? context.createBufferSource() : context.createOscillator(),envelope=context.createGain()
        if (part.noise) {
          source.buffer=noiseBuffer
          const filter=context.createBiquadFilter()
          filter.type='lowpass'; filter.frequency.value=part.frequency
          source.connect(filter); filter.connect(envelope); nodes.push(filter)
        } else {
          source.type=part.type; source.frequency.setValueAtTime(part.frequency,start)
          source.frequency.exponentialRampToValueAtTime(part.end,end)
          source.connect(envelope)
        }
        envelope.gain.setValueAtTime(0.0001,start)
        envelope.gain.exponentialRampToValueAtTime(part.gain,start+0.005)
        envelope.gain.exponentialRampToValueAtTime(0.0001,end)
        envelope.connect(mix); nodes.push(source,envelope); sources.push(source)
        source.onended=() => { if (--remaining===0) finish() }
        source.start(start); source.stop(end+0.01)
      }
      played++; counts[name]=(counts[name] || 0)+1
      events.push({ name,spatial:Boolean(position) }); if (events.length>24) events.shift()
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
      return { state:unavailable ? 'unavailable' : context?.state || 'locked',active,voices:voices.size,played,spatial,counts:{ ...counts },events:[...events],lastSpatial:lastSpatial && [...lastSpatial],peakRms,rms,volume:settings.volume,muted:settings.muted }
    },
    dispose() { stop(); if (context) void context.close().catch(() => {}); context=null },
  }
  return synth
}

export const audio=createSynth()
