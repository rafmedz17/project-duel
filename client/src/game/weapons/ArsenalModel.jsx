import {forwardRef} from 'react'
import MythicIronSight from './MythicIronSight.jsx'
import GunChassis from './GunChassis.jsx'
import {Armor,Filament,Muzzle} from './ForgedParts.jsx'
import {Plate,Tube,Ring} from './ModelParts.jsx'
import {weaponFinish} from './weaponFinish.js'
import {reflexProfile} from './optics.js'
import {modelProfile,SIGHT_MODEL_SCALE} from './modelProfiles.js'

const Cell=forwardRef(function Cell({weapon},ref) {
  const p=modelProfile(weapon),f=weaponFinish(weapon),drum=['omega','ravager'].includes(weapon.model),compact=weapon.slot==='2'
  return <group position={p.cell}><group ref={ref} name="reload-energy-cell">
    {drum ? <group><mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.112,.112,.18,20]}/><meshStandardMaterial color={f.body} metalness={.7} roughness={.38}/></mesh>{[-1,1].map(side=><group key={side} position={[side*.093,0,0]} rotation={[0,Math.PI/2,0]}><Ring radius={.079} color={f.edge}/><Ring radius={.064} color={f.accent} glow/></group>)}</group> : <>
      <Armor points={compact ? [[.038,.065],[.038,-.055],[-.036,-.06],[-.041,.055]] : [[.055,.09],[.06,-.045],[.028,-.13],[-.055,-.125],[-.06,.075]]} thickness={weapon.category==='LMG' ? .14 : compact ? .052 : .074} color={f.body} bevel={.007}/>
      {[-1,1].flatMap(side=>[0,1,2].map(i=><Plate key={`${side}-${i}`} p={[side*(weapon.category==='LMG' ? .073 : compact ? .028 : .04),-.065+i*.033,0]} s={[.005,.009,compact ? .06 : .09]} color="#111923"/>))}
    </>}
    <Plate p={[0,-.015,drum ? .11 : .061]} s={[.03,compact ? .07 : .10,.007]} color={f.accent} glow/>
  </group></group>
})

function RevolverCylinder({parts,finish:f}) {
  return <group name="magnus-cylinder-crane" position={modelProfile({model:'magnus'}).cell}>
    <group ref={parts?.cell} name="reload-energy-cell"><group ref={parts?.rotor} name="revolver-cylinder" userData={{chambers:8}}>
      <Tube radius={.09} length={.145} color={f.body}/>
      {[-1,1].map(end=><group key={end} position={[0,0,end*.074]}>
        <Ring radius={.087} color={f.edge} tube={.006}/>
        {Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <group key={i} name={`revolver-chamber-${end}-${i}`} position={[Math.sin(a)*.061,Math.cos(a)*.061,0]}>
          <Tube radius={.017} length={.005} color="#090d15"/>
          <Ring radius={.017} tube={.002} color={f.edge}/>
          <Tube radius={.008} length={.008} color={end===1 ? '#d6b57c' : '#19232e'}/>
        </group>})}
        <Tube radius={.019} length={.012} color={f.edge}/>
      </group>)}
      {[0,1,2,3,4,5,6,7].map(i=>{const a=i*Math.PI/4;return <Plate key={i} p={[Math.sin(a)*.089,Math.cos(a)*.089,0]} s={[.012,.006,.085]} r={[0,0,-a]} color={i%2 ? f.edge : f.accent} glow={i%2===0}/>})}
    </group><Plate p={[-.07,-.035,.05]} s={[.06,.02,.06]} color={f.edge}/></group>
  </group>
}

function EnergyBlade({weapon,short=false}) {
  const f=weaponFinish(weapon),points=short ? [[-.025,.08],[-.08,.25],[-.17,.41],[-.19,.49],[-.08,.44],[.018,.27],[.038,.08]] : [[-.04,.09],[-.067,.58],[-.03,.72],[0,.90],[.038,.67],[.042,.09]]
  return <group name={short ? 'curved-void-blade' : 'phantom-energy-sword'}>
    <mesh position={[0,-.07,0]}><cylinderGeometry args={[.026,.033,.22,8]}/><meshStandardMaterial color={f.body} metalness={.7} roughness={.4}/></mesh>
    {[-.14,-.09,-.04].map(y=><Ring key={y} p={[0,y,0]} radius={.035} color={f.accent} glow/>)}
    <Plate p={[0,.045,0]} s={[short ? .15 : .23,.045,.07]} color={f.edge}/>
    <Armor points={points} thickness={.024} rotation={[0,Math.PI/2,0]} color={f.body} bevel={.004}/>
    <Armor points={points.map(([x,y])=>[x*.72,y])} thickness={.027} rotation={[0,Math.PI/2,0]} color={f.accent} bevel={.002}/>
    <Filament radius={.004} color="#d9f5ff" points={short ? [[-.035,.10,.017],[-.073,.26,.017],[-.14,.39,.017],[-.18,.47,.017]] : [[0,.12,.017],[-.01,.45,.017],[-.012,.70,.017],[0,.88,.017]]}/>
  </group>
}

function MeleeModel({weapon,parts,preview}) {
  const f=weaponFinish(weapon),hammer=weapon.model==='breaker',dual=weapon.model==='fangs'
  return <group name={`model-${weapon.model}`}>
    <group ref={parts?.action}>
      {hammer ? <group name="gravity-impact-hammer">
        <Plate p={[0,.15,0]} s={[.055,.59,.055]} color={f.body}/>
        {[-.1,-.035,.03].map(y=><Plate key={y} p={[0,y,0]} s={[.065,.012,.064]} color={f.edge}/>)}
        <group position={[0,.47,0]}>
          <Armor points={[[-.12,-.12],[-.17,.02],[-.12,.14],[.12,.14],[.17,.02],[.12,-.12]]} thickness={.38} color={f.body} bevel={.015}/>
          {[-1,1].map(side=><group key={side} position={[side*.23,0,0]}><Plate s={[.10,.30,.27]} color={f.edge}/><Plate p={[side*.057,0,0]} s={[.012,.23,.20]} color={f.accent} glow/></group>)}
          <mesh ref={parts?.rotor} position={[0,0,.18]}><torusGeometry args={[.075,.011,8,24]}/><meshBasicMaterial color={f.accent} toneMapped={false}/></mesh>
          <mesh position={[0,0,.18]}><icosahedronGeometry args={[.04,0]}/><meshBasicMaterial color="#fff3da" toneMapped={false}/></mesh>
        </group>
      </group> : <EnergyBlade weapon={weapon} short={dual}/>}
      {!preview && <><group ref={parts?.grip} name="weapon-grip-right" position={[0,-.14,.015]}/>{hammer && <group ref={parts?.support} name="weapon-grip-left" position={[0,.12,.025]}/>}</>}
    </group>
    {dual && <group ref={parts?.offhand} position={[-.64,0,0]} rotation={[0,0,.3]}><EnergyBlade weapon={weapon} short/>{!preview && <group ref={parts?.support} name="weapon-grip-left" position={[0,-.14,.015]}/>}</group>}
    <mesh ref={parts?.trail} position={[0,.28,-.04]} rotation={[0,0,-.2]}><torusGeometry args={[hammer ? .48 : .42,.018,6,28,Math.PI*.9]}/><meshBasicMaterial color={f.accent} transparent opacity={0} depthWrite={false} toneMapped={false}/></mesh>
  </group>
}

export default function ArsenalModel({weapon,parts,preview=false,firstPerson=false}) {
  if(weapon.fireMode==='melee') return <MeleeModel weapon={weapon} parts={parts} preview={preview}/>
  const p=modelProfile(weapon),f=weaponFinish(weapon),compact=weapon.slot==='2',rotary=weapon.model==='omega',double=weapon.model==='executor'
  return <group name={`model-${weapon.model}`} userData={{muzzle:p.muzzle,profile:weapon.model}}>
    <GunChassis weapon={weapon} firstPerson={firstPerson}/>
    <group ref={parts?.action}>
      {rotary ? <group name="omega-six-barrel-assembly" ref={parts?.rotor} position={[0,0,-.43]}>
        {Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return <group key={i} position={[Math.cos(a)*.074,Math.sin(a)*.074,0]}><Tube radius={.021} length={.51} color={f.edge}/><Muzzle position={[0,0,-.30]} radius={.022} color={f.edge} accent={f.accent}/></group>})}
        {[-.22,.15].map(z=><Ring key={z} p={[0,0,z]} radius={.102} color={f.accent} glow/>)}
        <Ring p={[0,0,-.24]} radius={.107} tube={.012} color={f.edge}/>
      </group> : double ? <group name="executor-break-action" ref={parts?.hinge} position={[0,-.018,-.135]}>
        {[-.044,.044].map(x=><group key={x}><Tube p={[x,.018,-.17]} radius={.035} length={.35} color={f.edge}/><Muzzle position={[x,.018,p.muzzle+.135]} radius={.035} color={f.edge} accent={f.accent}/></group>)}
        <Plate p={[0,.060,-.15]} s={[.125,.023,.28]} color={f.body}/>
      </group> : <group name="barrel-assembly">
        <Tube p={[0,0,(p.front+p.muzzle)/2]} radius={weapon.scope ? .023 : compact ? .022 : weapon.pellets ? .041 : .028} length={p.front-p.muzzle} color={f.edge}/>
        <Muzzle position={[0,0,p.muzzle]} radius={weapon.pellets ? .045 : p.revolver ? .032 : weapon.scope ? .029 : compact ? .026 : .032} color={f.edge} accent={f.accent}/>
      </group>}
      {weapon.model==='railbreaker' && <group name="railbreaker-twin-accelerator">
        {[-1,1].map(side=><group key={side}><Plate p={[side*.065,0,(p.front+p.muzzle)/2]} s={[.032,.055,p.front-p.muzzle-.08]} color={f.body}/><Plate p={[side*.083,0,(p.front+p.muzzle)/2]} s={[.006,.018,p.front-p.muzzle-.11]} color={f.accent} glow/></group>)}
        {[0,1,2,3].map(i=><Ring key={i} p={[0,0,p.front-.09-i*.13]} radius={.055} color={f.accent} glow/>)}
      </group>}
    </group>
    {p.revolver ? <>
      <RevolverCylinder parts={parts} finish={f}/>
      <group ref={parts?.bolt} position={[0,.085,.105]} name="revolver-hammer"><Armor points={[[-.01,0],[.025,.055],[.06,.06],[.065,.025],[.035,-.01]]} thickness={.027} color={f.edge} bevel={.004}/></group>
    </> : <group ref={parts?.bolt} position={[0,compact ? .065 : .12,p.boltZ]} name={compact ? 'pistol-reciprocating-slide' : 'bolt-carrier'}>
      <Plate s={[compact ? p.width*2.06 : .055,compact ? .055 : .025,compact ? .23 : .24]} color={f.edge}/>
      <Plate p={[0,compact ? .03 : .016,0]} s={[.008,.005,compact ? .14 : .16]} color={f.accent} glow/>
      {weapon.scope && <Plate p={[.085,-.04,.08]} s={[.12,.025,.033]} color={f.edge}/>}
    </group>}
    {weapon.scope ? <group name="precision-scope-model" position={[0,.23,p.sightZ]} scale={SIGHT_MODEL_SCALE}>
      <Plate p={[0,-.055,0]} s={[.08,.11,.10]} color={f.body}/><Tube radius={.07} length={.34} color="#19293d"/>
      <Ring p={[0,0,.177]} radius={.055} color={weapon.color} glow/><Tube p={[0,0,.173]} radius={.048} length={.008} color="#194650" glow/>
      <Plate p={[0,.09,0]} s={[.055,.035,.08]} color={f.edge}/>
    </group> : reflexProfile(weapon) ? <MythicIronSight weapon={weapon} reticleRef={parts?.reticle} projectionRef={parts?.projection} preview={preview}/> : null}
    {!compact && <group ref={parts?.pump} name={weapon.model==='breach' ? 'pump-fore-end' : 'foregrip'} position={[0,-.065,p.pumpZ]}>
      <Plate s={[p.width*1.65,.075,weapon.model==='breach' ? .18 : .13]} color={f.body}/>
      {[-1,0,1].map(i=><Plate key={i} p={[0,-.042,i*.04]} s={[p.width*1.4,.008,.01]} color={f.edge}/>)}
    </group>}
    {!p.revolver && <Cell ref={parts?.cell} weapon={weapon}/>}
    {weapon.model==='breach' && <Tube p={[0,-.065,-.41]} radius={.028} length={.42} color={f.edge}/>}
    {weapon.model==='volt' && [-1,0,1].map(i=><Tube key={i} p={[i*.032,.065,-.055]} radius={.009} length={.16} color={f.accent} glow/>)}
    {!preview && <><group ref={parts?.grip} name="weapon-grip-right" position={p.grip}/><group ref={parts?.offhand} position={p.support}><group ref={parts?.support} name="weapon-grip-left"/></group></>}
    <group ref={parts?.flash} name="weapon-muzzle-flash" position={[0,0,p.muzzle-.065]}>
      <mesh rotation={[Math.PI/2,0,0]}><coneGeometry args={[weapon.pellets ? .12 : .065,.20,6]}/><meshBasicMaterial color={f.accent} toneMapped={false} transparent opacity={.8} depthWrite={false}/></mesh>
      <mesh rotation={[0,0,Math.PI/4]}><octahedronGeometry args={[weapon.pellets ? .09 : .045]}/><meshBasicMaterial color="#efffff" toneMapped={false}/></mesh>
    </group>
    <group ref={parts?.eject} position={[p.width+.035,.035,.035]}><mesh><octahedronGeometry args={[.014]}/><meshBasicMaterial color={f.accent} toneMapped={false}/></mesh></group>
  </group>
}
