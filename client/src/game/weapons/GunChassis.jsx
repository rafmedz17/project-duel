import {useEffect,useMemo} from 'react'
import {CanvasTexture,SRGBColorSpace} from 'three'
import {Armor,Filament,Fastener} from './ForgedParts.jsx'
import {weaponFinish} from './weaponFinish.js'
import {modelProfile} from './modelProfiles.js'
import {Plate,Tube} from './ModelParts.jsx'
import {useGame} from '../store.js'

function Stencil({weapon,width}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128
    const ctx=canvas.getContext('2d');ctx.fillStyle='#c5d0d7';ctx.font='bold 40px monospace';ctx.fillText(`${weapon.number} / ${weapon.shortName.split(' ')[0]}`,8,48)
    ctx.fillStyle='#7b8b9a';ctx.font='18px monospace';ctx.fillText('DUEL ARMAMENTS  //  26.11',8,83);ctx.fillRect(8,103,220,3)
    for(let i=0;i<18;i++) ctx.fillRect(280+i*11,94,i%3 ? 4 : 7,22)
    const result=new CanvasTexture(canvas);result.colorSpace=SRGBColorSpace;return result
  },[weapon.number,weapon.shortName])
  useEffect(()=>()=>texture.dispose(),[texture])
  return [-1,1].map(side=><mesh key={side} name="weapon-serial-stencil" position={[side*(width+.009),.015,.035]} rotation={[0,side*Math.PI/2,0]}><planeGeometry args={[.17,.04]}/><meshBasicMaterial map={texture} transparent opacity={.65} depthWrite={false} toneMapped={false}/></mesh>)
}

export default function GunChassis({weapon,firstPerson=false}) {
  const detail=useGame(s=>s.settings.quality!=='Low'),p=modelProfile(weapon),f=weaponFinish(weapon)
  const compact=weapon.slot==='2',smg=weapon.category==='SMG',lmg=weapon.category==='LMG',sniper=weapon.scope
  const rotary=weapon.model==='omega',double=weapon.model==='executor'
  const bullpupRear=firstPerson ? .29 : p.rear
  const receiverRear=p.bullpup ? bullpupRear-.015 : compact ? .12 : .19
  const upper=p.bullpup ? [[bullpupRear-.01,.06],[bullpupRear-.05,.125],[-.19,.13],[-.255,.06],[-.19,-.075],[bullpupRear-.08,-.105],[bullpupRear-.01,-.045]] : compact ? [[.13,.035],[.10,.085],[p.front+.025,.085],[p.front,.025],[p.front,-.053],[.095,-.07]] : [[.19,.045],[.15,.105],[p.front+.055,.108],[p.front,.04],[p.front+.035,-.075],[.14,-.092],[.19,-.045]]
  return <group name="forged-gun-chassis" userData={{model:weapon.model,length:p.rear-p.muzzle}}>
    {p.revolver ? <group name="revolver-frame">
      <Armor points={[[.11,.055],[.07,.085],[-.16,.065],[-.19,.018],[-.125,.01],[-.1,.043],[.08,.043]]} thickness={.075} color={f.edge} bevel={.006}/>
      <Armor points={[[.13,.035],[.075,.02],[.062,-.14],[-.12,-.15],[-.16,-.115],[-.18,-.13],[-.135,-.18],[.1,-.18],[.15,-.10]]} thickness={.062} color={f.body} bevel={.007}/>
      <Armor points={[[p.muzzle+.065,.04],[-.135,.052],[-.135,.01],[p.muzzle+.035,.008]]} thickness={.075} color={f.body} bevel={.005}/>
      {[-1,1].map(side=><Filament key={side} radius={.0018} color={f.accent} points={[[side*.041,.056,-.14],[side*.041,.048,-.23],[side*.031,.043,p.muzzle+.065]]}/>)}
    </group> : <>
      <Armor points={upper} thickness={p.width*2} color={f.body} bevel={.009}/>
      <Armor points={[[receiverRear-.01,-.07],[receiverRear-.04,-.125],[p.front+.08,-.11],[p.front,-.055],[p.front+.1,-.035],[receiverRear,-.04]]} thickness={p.width*1.5} color="#16222e" bevel={.006}/>
      {[-1,1].map(side=><group key={side}>
        <Armor position={[side*(p.width+.002),0,0]} points={[[receiverRear-.025,.04],[receiverRear-.065,.075],[p.front+.07,.075],[p.front+.035,.025],[p.front+.1,-.012],[receiverRear-.06,-.015]]} thickness={.009} color={f.edge} bevel={.003}/>
        <Filament color={f.accent} radius={.0018} points={[[side*(p.width+.012),-.03,receiverRear-.03],[side*(p.width+.015),-.045,.04],[side*(p.width+.012),-.018,p.front+.08]]}/>
        {detail && [receiverRear-.04,p.front+.075].map(z=><Fastener key={z} position={[side*(p.width+.013),-.047,z]} side={side}/>)}
        <Plate p={[side*(p.width+.012),.04,-.065]} s={[.007,.032,.075]} color="#101721"/>
      </group>)}
      {detail && !compact && <Stencil weapon={weapon} width={p.width}/>}
    </>}
    <group name="pistol-grip" position={[0,0,compact ? -.04 : 0]}>
      <Armor points={[[.16,-.075],[.10,-.11],[.075,-.29],[.14,-.315],[.19,-.28],[.205,-.12]]} thickness={compact ? .066 : .073} color="#172330" bevel={.011} roughness={.65} metalness={.3}/>
      {[0,1,2,3].map(i=><Plate key={i} p={[0,-.15-i*.036,.189-i*.003]} s={[.077,.008,.009]} color={i===3 ? f.accent : '#465362'} glow={i===3}/>)}
    </group>
    <Filament glow={false} radius={.008} color={f.edge} points={[[0,-.105,compact ? .09 : .13],[0,-.23,-.025],[0,-.18,-.075],[0,-.1,-.065]]}/>
    <Plate p={[0,-.135,.037]} s={[.012,.05,.014]} color="#aeb7bd" r={[.25,0,0]}/>
    {!compact && !p.bullpup && !firstPerson && <group name="shoulder-stock">
      {[-1,1].map(side=><Armor key={side} position={[side*.035,0,0]} points={[[.18,.055],[p.rear-.02,.06],[p.rear,-.10],[p.rear-.045,-.13],[p.rear-.065,-.04],[.21,-.04]]} thickness={.018} color={f.edge} bevel={.005}/>)}
      <Plate p={[0,-.045,p.rear]} s={[.10,.20,.035]} color="#111b27"/>
      <Plate p={[0,.068,p.rear-.075]} s={[.105,.045,.14]} color={f.body}/>
      <Filament color={f.accent} radius={.0016} points={[[.05,-.035,.21],[.05,-.035,p.rear-.035],[.045,-.09,p.rear-.02]]}/>
    </group>}
    {p.bullpup && <group name="astral-bullpup-receiver">
      <Plate p={[0,-.025,bullpupRear-.003]} s={[.16,.19,.038]} color="#111821"/>
      <Armor points={[[bullpupRear-.04,.105],[bullpupRear-.11,.155],[-.19,.151],[-.245,.10],[-.1,.087],[bullpupRear-.09,.09]]} thickness={.078} color={f.edge} bevel={.005}/>
      {[-1,1].map(side=><group key={side}>
        {[0,1,2].map(i=><Plate key={i} p={[side*.087,-.015,.20+i*.04]} s={[.008,.055,.022]} color={f.accent} glow/>)}
        <Armor position={[side*.098,0,-.04]} points={[[.07,.07],[-.04,.09],[-.13,.03],[-.08,-.035],[.045,-.025]]} thickness={.014} color={f.body} bevel={.005}/>
      </group>)}
    </group>}
    {!compact && !rotary && !double && <group name="ventilated-barrel-shroud">
      {[-1,1].map(side=><group key={side}>
        <Armor position={[side*(p.width*.8),0,0]} points={[[p.front+.04,.067],[p.muzzle+.11,.043],[p.muzzle+.085,-.035],[p.front+.035,-.065]]} thickness={lmg ? .023 : .016} color={f.body} bevel={.005}/>
        {Array.from({length:detail ? sniper ? 6 : lmg ? 6 : smg ? 3 : 4 : 3},(_,i)=>{const z=p.front-.025-i*((p.front-p.muzzle-.13)/(detail ? sniper || lmg ? 6 : smg ? 3 : 4 : 3));return <group key={i}>
          <Plate p={[side*(p.width*.8+.013),.012,z]} s={[.007,.03,.021]} color="#09121a" r={[.25,0,0]}/>
          <Plate p={[side*(p.width*.8+.017),-.008,z]} s={[.003,.005,.015]} color={f.accent} glow/>
        </group>})}
        <Filament color={f.accent} radius={.0015} points={[[side*p.width,-.046,p.front],[side*(p.width*.8),-.039,p.muzzle+.16],[side*.045,-.018,p.muzzle+.08]]}/>
      </group>)}
      <Armor points={[[p.front,.08],[p.muzzle+.12,.068],[p.muzzle+.1,.04],[p.front,.043]]} thickness={p.width*.95} color={f.edge} bevel={.003}/>
    </group>}
    {!compact && <group name="optic-mount-riser"><Plate p={[0,.135,p.sightZ]} s={[p.width*.85,.055,.12]} color="#253342"/><Plate p={[0,.166,p.sightZ]} s={[p.width,.009,.15]} color={f.edge}/></group>}
    {compact && !p.revolver && <group name="pistol-slide-rails">
      {[-1,1].flatMap(side=>[0,1,2].map(i=><Plate key={`${side}-${i}`} p={[side*(p.width+.006),.06,.09-i*.022]} s={[.004,.03,.009]} color="#0c1722" r={[.3,0,0]}/>))}
      <Plate p={[0,.10,.10]} s={[.075,.032,.025]} color={f.edge}/>
      <Plate p={[0,.095,p.muzzle+.06]} s={[.014,.023,.02]} color={f.accent} glow/>
    </group>}
    {smg && <group name={weapon.model==='nova' ? 'nova-folding-brace' : 'striker-reinforced-frame'}>
      <Armor points={[[.13,-.09],[.07,-.14],[p.front+.07,-.15],[p.front+.04,-.09]]} thickness={p.width*1.5} color={f.edge} bevel={.005}/>
      {weapon.model==='striker' && [-1,1].map(side=><Plate key={side} p={[side*.089,.02,-.17]} s={[.022,.19,.11]} color={f.body} r={[0,0,side*.15]}/>)}
    </group>}
    {weapon.model==='titan' && <group name="titan-belt-feed">
      <Plate p={[.13,.01,-.015]} s={[.095,.13,.15]} color={f.edge}/>
      {[0,1,2,3,4].map(i=><group key={i} position={[.17+i*.006,-.065-i*.023,.02]}><Tube radius={.009} length={.07} color="#baa274"/><Plate p={[0,0,-.04]} s={[.013,.013,.017]} color={f.accent} glow/></group>)}
    </group>}
    {sniper && <group name="sniper-bipod"><Plate p={[0,-.09,p.muzzle+.25]} s={[.07,.04,.06]} color={f.edge}/>{[-1,1].map(side=><Plate key={side} p={[side*.03,-.115,p.muzzle+.16]} s={[.012,.018,.21]} color="#354556" r={[0,side*.08,0]}/>)}</group>}
  </group>
}
