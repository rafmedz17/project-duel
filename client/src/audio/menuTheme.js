// Original menu score. Render once and loop one stereo buffer, so the soundtrack
// cannot accumulate oscillators, timers or scheduled voices during long sessions.
export const MENU_THEME=Object.freeze({title:'LIMIT BREAK',tempo:138,bars:16,sampleRate:22050})

export function composeMenuTheme(sampleRate=MENU_THEME.sampleRate) {
  const beat=60/MENU_THEME.tempo,duration=MENU_THEME.bars*4*beat,length=Math.round(duration*sampleRate)
  const left=new Float32Array(length),right=new Float32Array(length),tau=Math.PI*2
  let seed=57219
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1}
  const hz=midi=>440*2**((midi-69)/12)
  function voice(start,seconds,pan,render) {
    const offset=Math.round(start*sampleRate),count=Math.ceil(seconds*sampleRate)
    const l=Math.sqrt((1-pan)/2),r=Math.sqrt((1+pan)/2)
    for(let i=0;i<count;i++) {
      const value=render(i/sampleRate,i),at=(offset+i)%length
      left[at]+=value*l;right[at]+=value*r
    }
  }
  function kick(at,strength=1) {
    voice(at,.36,0,t=>{
      const phase=tau*(46*t+112*.023*(1-Math.exp(-t/.023)))
      return strength*(Math.sin(phase)*Math.exp(-t*15)*.68+noise()*Math.exp(-t*240)*.075)
    })
  }
  function snare(at,strength=1) {
    let low=0
    voice(at,.21,.06,t=>{
      const n=noise();low+=.18*(n-low)
      return strength*((n-low)*Math.exp(-t*25)*.23+Math.sin(tau*185*t)*Math.exp(-t*45)*.16)
    })
  }
  function hat(at,open=false,volume=1,pan=.25) {
    let previous=0
    voice(at,open ? .16 : .065,pan,t=>{
      const n=noise(),high=(n-previous)*.5;previous=n
      return high*Math.exp(-t*(open ? 27 : 75))*.075*volume
    })
  }
  function bass(at,midi,seconds,accent=1) {
    const f=hz(midi)
    voice(at,seconds,0,t=>{
      const attack=Math.min(1,t/.008),release=Math.min(1,(seconds-t)/.04)
      const phase=tau*f*t,bright=Math.exp(-t*13)
      const wave=Math.sin(phase)*.75+Math.sin(phase*2)*.2+Math.sin(phase*3)*bright*.12
      return Math.tanh(wave*1.6)*.19*attack*release*accent
    })
  }
  function pluck(at,midi,volume,pan) {
    const f=hz(midi)
    for(const [delay,echo] of [[0,1],[beat*.75,.26],[beat*1.5,.12]]) {
      voice(at+delay,.65,delay ? -pan : pan,t=>{
        const phase=tau*f*t,envelope=Math.min(1,t/.004)*Math.exp(-t*9)
        return (Math.sin(phase)+Math.sin(phase*2.001)*.25*Math.exp(-t*12)+Math.sin(phase*3)*.1)*envelope*volume*echo
      })
    }
  }
  for(let bar=0;bar<MENU_THEME.bars;bar++) {
    const root=[41,37,44,39][bar%4],at=bar*4*beat,drop=bar>=8,fill=bar%4===3
    // F minor / Db / Ab / Eb: an eight-bar build, then a full rhythmic hook.
    for(const interval of [12,15,19]) {
      const f=hz(root+interval),seconds=4*beat+.18
      voice(at,seconds,interval===15 ? -.5 : .5,t=>{
        const envelope=Math.min(1,t/.16)*Math.min(1,(seconds-t)/.3)
        return (Math.sin(tau*f*t)+Math.sin(tau*f*1.003*t)*.45)*.024*envelope
      })
    }
    for(const b of drop ? [0,1.5,2,2.75,3.5] : [0,2,2.75]) kick(at+b*beat,b%1 ? .8 : 1)
    for(const b of [1,3]) snare(at+b*beat,drop ? 1 : .8)
    for(let step=0;step<16;step++) {
      if(!drop && step%2) continue
      hat(at+step*beat/4,step===10,step%2 ? .42 : .8,step%2 ? -.35 : .3)
    }
    for(const b of [0,.75,1.5,2,2.75,3.5]) bass(at+b*beat,root+(b===3.5 ? 12 : 0),beat*.39,drop ? 1 : .8)
    const arp=[0,7,12,3,7,15,12,7]
    for(let step=0;step<8;step++) pluck(at+step*beat/2,root+24+arp[(step+bar%2*2)%8],drop ? .083 : .055,step%2 ? .38 : -.38)
    if(drop) {
      const hook=[12,15,19,17,15,12,10,7]
      for(let step=0;step<4;step++) pluck(at+(step+.25)*beat,root+24+hook[(step+bar%2*4)%8],.12,step%2 ? -.12 : .12)
    }
    if(fill) {
      for(let step=0;step<3;step++) snare(at+(3.25+step*.25)*beat,.22+step*.08)
      let low=0
      voice(at+2*beat,2*beat,-.3,t=>{
        const n=noise();low+=.08*(n-low)
        const ramp=t/(2*beat)
        return low*.11*ramp*ramp*Math.min(1,(2*beat-t)/.03)
      })
    }
  }
  let peak=0
  for(let i=0;i<length;i++) peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]))
  const level=.76/Math.max(.76,peak)
  for(let i=0;i<length;i++) {left[i]*=level;right[i]*=level}
  return {left,right,sampleRate,duration:length/sampleRate}
}
