import { WEAPONS } from '../../../shared/weapons.js'

const tone=(frequency,end,duration,gain=.1,delay=0,type='sine',extra={})=>({frequency,end,duration,gain,delay,type,...extra})
const noise=(frequency,duration,gain=.1,delay=0,filter='bandpass',extra={})=>({noise:true,frequency,duration,gain,delay,filter,q:.7,...extra})
const melody=(notes,gain=.065)=>notes.map((frequency,i)=>tone(frequency,frequency*1.005,.18,gain,i*.1,'triangle'))

// Body, report, mechanism and energy resonance are tuned per weapon. Automatic
// weapons have short reports so a sustained burst leaves room for footsteps.
export const FIREARM_VOICES=Object.freeze({
  rifle:{body:145,end:48,crack:3100,mechanism:1850,accent:820,tail:.16,weight:1},
  astral:{body:178,end:65,crack:3900,mechanism:2600,accent:1260,tail:.13,weight:.87},
  hyperion:{body:105,end:30,crack:5600,mechanism:3200,accent:1560,tail:.36,weight:1.32,bolt:.19},
  railbreaker:{body:73,end:24,crack:2300,mechanism:1250,accent:410,tail:.48,weight:1.55,bolt:.28},
  nova:{body:205,end:78,crack:3400,mechanism:2300,accent:1080,tail:.09,weight:.72},
  striker:{body:236,end:92,crack:4600,mechanism:3100,accent:1420,tail:.075,weight:.68},
  titan:{body:118,end:39,crack:2600,mechanism:1420,accent:660,tail:.18,weight:1.16},
  omega:{body:97,end:42,crack:1950,mechanism:970,accent:520,tail:.10,weight:.94},
  shotgun:{body:86,end:28,crack:1550,mechanism:820,accent:340,tail:.30,weight:1.48,bolt:.24},
  executor:{body:65,end:23,crack:1300,mechanism:650,accent:270,tail:.34,weight:1.62},
  ravager:{body:112,end:36,crack:1850,mechanism:1150,accent:450,tail:.20,weight:1.19},
  pistol:{body:192,end:62,crack:3700,mechanism:2400,accent:1060,tail:.13,weight:.92},
  magnus:{body:98,end:31,crack:2800,mechanism:1680,accent:590,tail:.25,weight:1.38},
  volt:{body:254,end:89,crack:4200,mechanism:2850,accent:1840,tail:.11,weight:.74},
})

const cues={
  blade:[noise(4200,.16,.15,0,'bandpass',{end:950,attack:.025}),tone(1250,430,.19,.045,.015,'triangle'),noise(7100,.025,.045,.09,'highpass')],
  gravity:[tone(62,155,.37,.08,0,'triangle'),noise(430,.24,.055,.12),tone(95,26,.30,.25,.45),noise(750,.22,.22,.45,'lowpass'),noise(2400,.07,.08,.46)],
  fangs:[noise(5100,.11,.105,0,'bandpass',{end:1600,attack:.015}),tone(1700,650,.105,.035,.01,'triangle'),noise(6200,.022,.035,.055,'highpass')],
  dash:[noise(1100,.25,.16,0,'bandpass',{end:4200,attack:.014}),noise(5100,.12,.06,.05,'highpass'),tone(160,48,.20,.09)],
  shield:[tone(115,360,.34,.10),tone(225,730,.30,.055,.015,'triangle'),noise(2800,.15,.05,.04),tone(1100,1000,.25,.035,.14)],
  scanner:[...melody([880,1320],.055),noise(2600,.10,.035,.03),tone(1760,880,.28,.025,.22)],
  emp:[tone(75,24,.45,.18),noise(640,.38,.18,0,'lowpass'),noise(2100,.11,.065,.01),tone(410,63,.35,.04,0,'sawtooth')],
  flashbang:[noise(3600,.14,.16,0,'highpass'),tone(175,42,.18,.13),tone(1950,1700,.17,.025,.035)],
  smoke:[noise(5600,.08,.07,0,'highpass'),noise(1300,.46,.13,.04,'bandpass',{end:460,attack:.05}),tone(160,65,.24,.055,.03)],
  stun:[tone(110,45,.24,.14),noise(1750,.20,.13),tone(920,1400,.19,.05,.025,'sawtooth'),noise(3900,.055,.04,.14)],
  ultimate:[tone(80,40,.4,.15),noise(1000,.3,.07),...melody([330,494,660,988],.075)],
  hit:[noise(3200,.025,.045),tone(1450,1180,.052,.075,0,'triangle')],
  headshot:[noise(5700,.028,.065,0,'highpass'),tone(2100,1550,.09,.08),tone(2900,2350,.09,.03,.025)],
  elimination:[tone(110,45,.19,.12),...melody([600,900,1200],.075)],
  'shield-hit':[noise(2200,.06,.06),tone(640,170,.15,.095,.005,'triangle')],
  'shield-impact':[noise(1800,.10,.10),tone(150,50,.17,.12),tone(950,250,.13,.04)],
  hurt:[tone(105,43,.18,.11),noise(780,.10,.08),noise(3100,.025,.03)],
  death:[tone(90,26,.40,.12),noise(540,.30,.07),...melody([180,120,65],.06)],
  jump:[noise(1300,.12,.065,0,'bandpass',{end:3600,attack:.015}),tone(120,75,.075,.04),noise(5100,.06,.025,.025,'highpass')],
  countdown:[tone(900,900,.08,.065),tone(1800,1800,.05,.022)],
  'round-start':[noise(2200,.07,.045),...melody([880,1320],.07)],
  'round-win':melody([660,880]),'round-loss':melody([330,220]),draw:melody([440,440]),
  victory:[tone(100,45,.35,.10),...melody([523,659,784,1046])],defeat:melody([392,330,261,196]),
  preview:[noise(2400,.07,.06),...melody([523,659,784])],
  'spin-up':[tone(48,220,.57,.085,0,'sawtooth',{attack:.09}),tone(96,640,.6,.045,0,'triangle',{attack:.1}),noise(1150,.55,.065,0,'bandpass',{end:3300,attack:.12})],
}
for(let tier=2;tier<=5;tier++) {
  const root=330+tier*70,notes=[root,root*1.25,root*1.5,root*2].slice(0,tier===2 ? 3 : 4)
  cues[`kill-combo-${tier}`]=[tone(95,38,.25,.12,0,'triangle'),...notes.map((frequency,i)=>tone(frequency,frequency*1.015,.18,.085,i*.075,'triangle')),tone(root*2,root*2,.28,.045,.24)]
}

export function soundLayers(name,{weapon,pace='walk',surface='metal',impact=1}={}) {
  const p=FIREARM_VOICES[name]
  if(p) return [
    noise(p.crack*1.65,.018,.065*p.weight,0,'highpass'),
    noise(p.crack,.075,.14*p.weight,0,'bandpass',{end:p.crack*.55}),
    tone(p.body,p.end,Math.min(.19,p.tail),.20*p.weight),
    tone(p.body*2.12,p.end*1.7,.075,.042*p.weight,0,'triangle'),
    noise(p.mechanism,.033,.055,.028,'bandpass',{q:2.2}),
    tone(p.accent,p.accent*.56,p.tail,.028,.018,'triangle'),
    noise(p.crack*.4,p.tail,.045,.025,'lowpass'),
    ...(p.bolt ? [noise(p.mechanism,.035,.07,p.bolt),noise(p.mechanism*1.6,.028,.05,p.bolt+.085)] : []),
  ]
  if(name==='equip' || name==='reload-start' || name==='reload-end') {
    const profile=FIREARM_VOICES[weapon] || FIREARM_VOICES.rifle,w=WEAPONS[weapon]
    const heavy=w?.category==='LMG' || w?.category==='SNIPER',metal=profile.mechanism,weight=heavy ? 1.15 : .9
    if(name==='equip') return [noise(metal,.045,.065*weight),noise(4200,.09,.04,.025,'highpass'),tone(160,85,.08,.04)]
    if(name==='reload-start') return [noise(metal*1.4,.035,.09),noise(720,.12,.08,.055,'bandpass',{end:360}),noise(3200,.1,.055,.11,'highpass'),tone(125,72,.12,.055,.06)]
    return [noise(metal,.045,.12*weight),tone(175,85,.10,.08),noise(metal*1.6,.035,.09,.075),tone(profile.accent,profile.accent*.8,.12,.028,.09,'triangle')]
  }
  if(name==='step' || name==='land') {
    const sprint=pace==='sprint',landing=name==='land',weight=landing ? Math.min(1.8,Math.max(.8,impact)) : sprint ? 1.1 : .75
    const metal=surface==='metal',body=landing ? 62 : sprint ? 87 : 112
    return [tone(body,38,landing ? .17 : .085,.17*weight),noise(metal ? 1100 : 740,landing ? .13 : .075,.13*weight),noise(3600,.045,.045*weight,.015,'highpass'),noise(1600,.12,.035*weight,.025,'bandpass',{end:600}),...(metal ? [tone(470,285,.075,.022*weight,.018,'triangle')] : [])]
  }
  return cues[name] || null
}

export const roomSend=name=>FIREARM_VOICES[name] ? Math.min(.2,FIREARM_VOICES[name].tail*.5) : ['step','land','gravity'].includes(name) ? .06 : 0
