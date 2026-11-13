import { useEffect,useMemo } from 'react'
import { CanvasTexture,SRGBColorSpace } from 'three'
import { Armor,Filament,Fastener } from './ForgedParts.jsx'
import { weaponFinish } from './weaponFinish.js'
import { useGame } from '../store.js'

function Block({ p,s,color='#111c27',r=[0,0,0],glow=false }) {
  return <mesh position={p} rotation={r}><boxGeometry args={s}/>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={.7} roughness={.48}/>}</mesh>
}
function Stencil({ weapon,width }) {
  const texture=useMemo(()=> {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,128);ctx.fillStyle='#c5d0d7';ctx.font='bold 40px monospace';ctx.fillText(`${weapon.number} / ${weapon.shortName.split(' ')[0]}`,8,48)
    ctx.fillStyle='#7b8b9a';ctx.font='18px monospace';ctx.fillText('DUEL ARMAMENTS  //  26.11',8,83);ctx.fillRect(8,103,220,3)
    for(let i=0;i<18;i++) ctx.fillRect(280+i*11,94,i%3 ? 4 : 7,22)
    const result=new CanvasTexture(canvas);result.colorSpace=SRGBColorSpace;return result
  },[weapon.number,weapon.shortName])
  useEffect(()=>()=>texture.dispose(),[texture])
  return [-1,1].map(side=><mesh key={side} name="weapon-serial-stencil" position={[side*(width+.008),.021,.052]} rotation={[0,side*Math.PI/2,0]}><planeGeometry args={[.22,.055]}/><meshBasicMaterial map={texture} transparent opacity={.65} depthWrite={false} toneMapped={false}/></mesh>)
}

export default function GunChassis({ weapon,length,preview=false }) {
  const detail=useGame(s=>s.settings.quality!=='Low')
  const compact=weapon.slot==='2',smg=weapon.category==='SMG',lmg=weapon.category==='LMG',sniper=weapon.category==='SNIPER',rotary=weapon.model==='omega'
  const finish=weaponFinish(weapon),width=lmg ? .142 : compact ? .075 : smg ? .087 : .1
  const front=compact ? -.24 : smg ? -.30 : -.34,rear=compact ? .19 : .27
  const upper=[[rear,.055],[rear-.04,.102],[front+.055,.108],[front,.057],[front+.02,-.068],[rear-.07,-.102],[rear,-.053]]
  return <group name="forged-gun-chassis" userData={{ model:weapon.model }}>
    <Armor points={upper} thickness={width*2} color={finish.body} bevel={.009}/>
    <Armor points={[[.23,-.084],[.17,-.108],[-.16,-.102],[-.26,-.055],[-.12,-.038],[.18,-.044]]} thickness={width*1.66} color="#172330" bevel={.007}/>
    {[-1,1].map(side=><group key={side}>
      <Armor position={[side*(width+.002),0,0]} points={[[rear-.035,.043],[rear-.08,.067],[front+.08,.071],[front+.04,.027],[front+.14,-.017],[rear-.09,-.007]]} thickness={.009} color={finish.edge} bevel={.003}/>
      <Block p={[side*(width+.01),.045,-.11]} s={[.006,.034,.095]}/>
      <Block p={[side*(width+.014),.043,-.11]} s={[.004,.013,.052]} color="#57646f"/>
      <Filament color={finish.accent} radius={.0017} points={[[side*(width+.014),-.027,.21],[side*(width+.022),-.04,.1],[side*(width+.019),-.016,-.16],[side*(width+.014),.018,front+.07]]}/>
      {detail && [rear-.055,front+.085].map(z=><Fastener key={z} position={[side*(width+.013),-.047,z]} side={side}/>)}
      <Block p={[side*(width+.015),-.04,.095]} s={[.005,.014,.04]} color="#b2b8ba" r={[.14,0,0]}/>
    </group>)}
    {detail && <Stencil weapon={weapon} width={width}/>}
    <Armor points={[[.18,-.105],[.12,-.117],[.09,-.3],[.17,-.325],[.215,-.285],[.225,-.14]]} thickness={.078} color="#172330" bevel={.01} roughness={.7} metalness={.35}/>
    {Array.from({ length:detail ? 5 : 3 },(_,i)=><Block key={i} p={[0,-.16-i*.04,.211-i*.003]} s={[.083,.008,.006]} color="#3f4b57" r={[-.12,0,0]}/>)}
    <Filament glow={false} radius={.009} color="#53606d" points={[[0,-.115,.13],[0,-.26,-.035],[0,-.19,-.11],[0,-.102,-.10]]}/>
    <mesh position={[0,-.145,.07]} rotation={[.25,0,0]}><boxGeometry args={[.013,.055,.016]}/><meshStandardMaterial color="#aeb7bd" metalness={.9} roughness={.3}/></mesh>
    {!compact && preview && <>
      <Armor points={[[.24,.04],[.34,.061],[.48,.015],[.49,-.065],[.38,-.102],[.25,-.045]]} thickness={smg ? .067 : .095} color="#26313e" bevel={.008}/>
      <Armor points={[[.47,.045],[.52,.04],[.535,-.14],[.49,-.16],[.46,-.11]]} thickness={.115} color="#111b26" bevel={.01} metalness={.15} roughness={.86}/>
      <Armor points={[[.28,.071],[.35,.095],[.46,.07],[.48,.04],[.32,.026]]} thickness={.105} color={finish.edge} bevel={.004}/>
      <Block p={[0,-.045,.36]} s={[.103,.03,.12]} color="#0c1520"/>
      <Filament color={finish.accent} radius={.0015} points={[[width*.6,-.047,.29],[width*.6,-.055,.36],[width*.6,-.069,.41],[width*.6,-.075,.46]]}/>
    </>}
    {!compact && !rotary && <group name="ventilated-barrel-shroud">
      {[-1,1].map(side=><group key={side}>
        <Armor position={[side*(smg ? .067 : .083),0,0]} points={[[-.25,.07],[-length+.11,.049],[-length+.07,-.034],[-.28,-.075]]} thickness={lmg ? .026 : .018} color={finish.body} bevel={.005}/>
        {Array.from({ length:!detail ? 3 : sniper ? 7 : lmg ? 6 : smg ? 3 : 5 },(_,i)=><group key={i} position={[side*(smg ? .079 : .098),.019,-.31-i*(sniper ? .095 : .057)]}>
          <Block p={[0,0,0]} s={[.008,.034,.023]} color="#080f18" r={[.3,0,0]}/>
          <Block p={[side*.004,-.012,0]} s={[.003,.004,.018]} color={finish.accent} glow/>
        </group>)}
        <Filament color={finish.accent} radius={.0013} points={[[side*.085,-.05,-.27],[side*.085,-.046,-length*.55],[side*.068,-.032,-length+.12],[side*.061,-.015,-length+.08]]}/>
      </group>)}
      <Armor points={[[-.25,.082],[-length+.12,.071],[-length+.08,.039],[-.27,.042]]} thickness={.082} color="#576774" bevel={.003}/>
      {Array.from({ length:detail ? 7 : 3 },(_,i)=><Block key={i} p={[0,.092,-.27-i*.065]} s={[.091,.016,.014]} color="#25323f"/>)}
    </group>}
    {compact && <group>
      <Armor points={[[.21,.082],[.18,.13],[-.21,.13],[-.28,.08],[-.23,.06],[.19,.06]]} thickness={.154} color={finish.edge} bevel={.008}/>
      {[-1,1].flatMap(side=>[0,1,2,3].map(i=><Block key={`${side}-${i}`} p={[side*.081,.095,.11-i*.025]} s={[.004,.025,.009]} color="#1b2632" r={[.3,0,0]}/>))}
    </group>}
    {smg && <Armor position={[0,-.002,-.12]} points={[[.06,-.1],[.07,-.16],[-.02,-.31],[-.09,-.3],[-.08,-.12]]} thickness={.086} color={finish.body} bevel={.007}/>} 
    {lmg && <group name="lmg-feed-mechanism">
      <Armor position={[.12,0,.02]} points={[[.08,-.06],[.12,.095],[-.13,.106],[-.18,-.035]]} thickness={.09} color={finish.edge} bevel={.006}/>
      {[0,1,2,3].map(i=><group key={i} position={[.19+i*.009,-.07-i*.03,.035]}><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.011,.011,.074,8]}/><meshStandardMaterial color="#9c8a69" metalness={.85} roughness={.38}/></mesh><Block p={[0,0,.04]} s={[.014,.014,.018]} color={finish.accent} glow/></group>)}
    </group>}
    {weapon.model==='astral' && <Armor points={[[.2,-.08],[.26,-.12],[.22,-.26],[.15,-.245],[.12,-.12]]} thickness={.11} color={finish.body} bevel={.007}/>} 
  </group>
}
