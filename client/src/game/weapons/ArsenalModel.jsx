import { forwardRef } from 'react'

function Plate({ p=[0,0,0],s=[0.1,0.1,0.1],r=[0,0,0],color='#34465d',glow=false }) {
  return <mesh position={p} rotation={r}><boxGeometry args={s}/>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={0.82} roughness={0.28}/>}</mesh>
}
function Tube({ p=[0,0,0],radius=0.04,length=0.3,color='#263347',glow=false }) {
  return <mesh position={p} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[radius,radius,length,12]}/>{glow ? <meshBasicMaterial color={color} toneMapped={false}/> : <meshStandardMaterial color={color} metalness={0.9} roughness={0.24}/>}</mesh>
}
function Ring({ p=[0,0,0],radius=0.07,color }) {
  return <mesh position={p}><torusGeometry args={[radius,0.007,6,24]}/><meshBasicMaterial color={color} toneMapped={false}/></mesh>
}
function Hand({ p=[0,0,0],left=false }) {
  return <group position={p} rotation={[0,0,left ? -0.12 : 0.12]}>
    <Plate s={[0.1,0.14,0.12]} color="#233144"/>
    <Plate p={[0,-0.13,0.03]} s={[0.09,0.18,0.11]} r={[0.25,0,0]} color="#142333"/>
    {[-1.5,-0.5,0.5,1.5].map(i=><group key={i} position={[i*0.025,0.025,-0.06]}><Plate s={[0.02,0.06,0.035]} color="#7890a4"/><Plate p={[0,0.035,-0.014]} s={[0.02,0.025,0.05]} color="#3e536b"/></group>)}
    <Plate p={[left ? 0.06 : -0.06,0.02,0]} s={[0.035,0.07,0.035]} r={[0,0,left ? -0.4 : 0.4]} color="#668397"/>
    <Plate p={[0,-0.08,0.09]} s={[0.07,0.025,0.005]} color="#6fe5ef" glow/>
  </group>
}
const Cell=forwardRef(function Cell({ weapon },ref) {
  const drum=['omega','ravager','magnus'].includes(weapon.model)
  return <group position={[0,-0.17,weapon.slot==='2' ? 0.1 : -0.08]}>
    <group ref={ref} name="reload-energy-cell">
      {drum ? <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.12,0.12,0.19,12]}/><meshStandardMaterial color="#24354b" metalness={0.85} roughness={0.28}/></mesh> : <Plate s={[weapon.category==='LMG' ? 0.19 : 0.095,weapon.slot==='2' ? 0.15 : 0.23,0.14]} color="#203047"/>}
      <Plate p={[0,0,0.075]} s={[0.058,drum ? 0.1 : 0.16,0.012]} color={weapon.color} glow/>
      {[-0.035,0.035].map(x=><Plate key={x} p={[x,0,0.084]} s={[0.008,0.12,0.006]} color="#d2faff" glow/>)}
    </group>
  </group>
})

function EnergyBlade({ weapon,short=false }) {
  const length=short ? 0.35 : 0.7
  return <group>
    <mesh position={[0,-0.08,0]}><cylinderGeometry args={[0.035,0.045,0.24,8]}/><meshStandardMaterial color="#1c3043" metalness={0.9} roughness={0.25}/></mesh>
    {[-0.12,-0.05,0.02].map(y=><Ring key={y} p={[0,y,0]} radius={0.045} color={weapon.color}/>)}
    <Plate p={[0,0.07,0]} s={[short ? 0.18 : 0.27,0.045,0.09]} color="#98afc3"/>
    <mesh position={[0,0.08+length/2,0]} rotation={[0,0,short ? -0.1 : 0]}><cylinderGeometry args={[0.01,short ? 0.055 : 0.075,length,4]}/><meshStandardMaterial color="#a5eaf1" emissive={weapon.color} emissiveIntensity={1.3} metalness={0.5} roughness={0.2}/></mesh>
    <Plate p={[0,0.09+length/2,0.035]} s={[0.012,length*0.9,0.009]} color="#edffff" glow/>
    <mesh position={[0,0.1+length,0]}><coneGeometry args={[0.016,0.12,4]}/><meshBasicMaterial color={weapon.color} toneMapped={false}/></mesh>
  </group>
}

export default function ArsenalModel({ weapon,parts,preview=false }) {
  const compact=weapon.slot==='2',smg=weapon.category==='SMG',sniper=weapon.category==='SNIPER',lmg=weapon.category==='LMG'
  const rotary=weapon.model==='omega',double=weapon.model==='executor',hammer=weapon.model==='breaker',dual=weapon.model==='fangs'
  const length=compact ? 0.35 : smg ? 0.5 : sniper ? 1.2 : lmg ? 0.86 : 0.74
  if (weapon.fireMode==='melee') return <group name={`model-${weapon.model}`}>
    <group ref={parts?.action}>
      {hammer ? <group>
        <group position={[0,0.07,0]} rotation={[Math.PI/2,0,0]}><Tube length={0.62} radius={0.045}/></group>
        <Plate p={[0,0.14,0]} s={[0.07,0.62,0.07]} color="#34465d"/>
        <group position={[0,0.5,0]}>
          <Plate s={[0.48,0.28,0.23]} color="#53627d"/>
          {[-1,1].map(side=><group key={side} position={[side*0.27,0,0]}><Plate s={[0.1,0.35,0.3]} color="#1b2b42"/><Plate p={[side*0.06,0,0]} s={[0.018,0.26,0.22]} color={weapon.color} glow/></group>)}
          <mesh ref={parts?.rotor} position={[0,0,0.125]}><torusGeometry args={[0.085,0.014,8,24]}/><meshBasicMaterial color={weapon.color} toneMapped={false}/></mesh>
          <mesh position={[0,0,0.13]}><icosahedronGeometry args={[0.05,0]}/><meshBasicMaterial color="#f1d9ff" toneMapped={false}/></mesh>
        </group>
      </group> : <EnergyBlade weapon={weapon} short={dual}/>}
      {!preview && <Hand p={[0,-0.14,0.015]}/>}
    </group>
    {dual && <group ref={parts?.offhand} position={[-0.64,0,0]} rotation={[0,0,0.3]}><EnergyBlade weapon={weapon} short/>{!preview && <Hand p={[0,-0.14,0.015]} left/>}</group>}
    <mesh ref={parts?.trail} position={[0,0.28,-0.04]} rotation={[0,0,-0.2]}><torusGeometry args={[hammer ? 0.48 : 0.42,0.018,6,28,Math.PI*0.9]}/><meshBasicMaterial color={weapon.color} transparent opacity={0} depthWrite={false} toneMapped={false}/></mesh>
  </group>
  return <group name={`model-${weapon.model}`}>
    <Plate p={[0,0,0.04]} s={[lmg ? 0.28 : compact ? 0.15 : 0.19,compact ? 0.14 : 0.2,compact ? 0.3 : 0.46]} color={weapon.model==='astral' ? '#44406a' : '#34475c'}/>
    {[-1,1].map(side=><group key={side}>
      <Plate p={[side*(lmg ? 0.146 : compact ? 0.08 : 0.103),0.025,-0.015]} s={[0.022,0.1,compact ? 0.18 : 0.31]} r={[0,0,side*0.08]} color="#71899f"/>
      <Plate p={[side*(lmg ? 0.16 : 0.12),0.025,-0.09]} s={[0.009,0.018,compact ? 0.12 : 0.24]} color={weapon.color} glow/>
      {[0,1,2].map(i=><Plate key={i} p={[side*0.11,-0.04,0.02+i*0.052]} s={[0.012,0.035,0.02]} r={[0,0,side*0.25]} color="#101b2b"/>)}
    </group>)}
    <Plate p={[0,-0.15,0.14]} s={[0.085,0.24,0.12]} r={[-0.2,0,0]} color="#172a3d"/>
    {!compact && <><Plate p={[0,-0.025,0.36]} s={[0.1,0.13,0.24]} color="#1c2c41"/><Plate p={[0,-0.02,0.48]} s={[0.16,0.23,0.045]} r={[0.12,0,0]} color="#4b627b"/></>}
    <group ref={parts?.action}>
      {rotary ? <group ref={parts?.rotor} position={[0,0,-0.37]}>
        {Array.from({ length:6 },(_,i)=>{ const a=i*Math.PI/3;return <group key={i} position={[Math.cos(a)*0.09,Math.sin(a)*0.09,0]}><Tube length={0.65} radius={0.025}/><Tube p={[0,0,-0.33]} length={0.04} radius={0.031} color={weapon.color} glow/></group> })}
        {[-0.24,0.2].map(z=><Ring key={z} p={[0,0,z]} radius={0.125} color={weapon.color}/>)}
      </group> : double ? <group ref={parts?.hinge} position={[0,-0.02,-0.15]}>
        {[-0.055,0.055].map(x=><group key={x}><Tube p={[x,0,-0.22]} radius={0.043} length={0.46}/><Ring p={[x,0,-0.46]} radius={0.04} color={weapon.color}/></group>)}
        <Plate p={[0,0.055,-0.22]} s={[0.16,0.025,0.32]} color="#687c91"/>
      </group> : <group>
        <Tube p={[0,0,-length/2-0.14]} radius={sniper ? 0.035 : compact ? 0.035 : 0.045} length={length-0.2}/>
        <Tube p={[0,0,-length+0.02]} radius={sniper ? 0.048 : 0.058} length={0.1} color="#60768d"/>
        <Ring p={[0,0,-length-0.035]} radius={sniper ? 0.037 : 0.045} color={weapon.color}/>
      </group>}
      {weapon.model==='railbreaker' && [-1,1].map(side=><group key={side}><Plate p={[side*0.075,0.015,-0.67]} s={[0.045,0.07,0.9]} color="#384a61"/><Plate p={[side*0.1,0.02,-0.7]} s={[0.009,0.026,0.85]} color={weapon.color} glow/>{[0,1,2,3,4].map(i=><Ring key={i} p={[0,0,-0.35-i*0.14]} radius={0.065} color={weapon.color}/>)}</group>)}
    </group>
    <group ref={parts?.bolt} position={[0,0.12,-0.02]}>
      <Plate s={[compact ? 0.13 : 0.08,0.035,compact ? 0.31 : 0.35]} color="#768ca2"/>
      <Plate p={[0,0.022,0]} s={[0.032,0.012,compact ? 0.22 : 0.28]} color={weapon.color} glow/>
      {sniper && <Plate p={[0.11,-0.025,0.12]} s={[0.15,0.035,0.04]} color="#8094a8"/>}
    </group>
    {weapon.scope ? <group position={[0,0.23,-0.05]}>
      <Plate p={[0,-0.055,0]} s={[0.08,0.11,0.1]}/><Tube radius={0.07} length={0.34} color="#19293d"/>
      <Ring p={[0,0,0.177]} radius={0.055} color={weapon.color}/><Tube p={[0,0,0.173]} radius={0.048} length={0.008} color="#194650" glow/>
      <Plate p={[0,0.09,0]} s={[0.055,0.035,0.08]} color="#5c7189"/>
    </group> : !compact && <group position={[0,0.19,0.1]}><Plate p={[-0.044,0,0]} s={[0.018,0.09,0.035]}/><Plate p={[0.044,0,0]} s={[0.018,0.09,0.035]}/><Plate p={[0,0.05,0]} s={[0.1,0.02,0.035]} color={weapon.color} glow/></group>}
    <group ref={parts?.pump} position={[0,-0.06,-0.35]}>
      {!compact && <Plate s={[0.15,0.11,smg ? 0.15 : 0.28]} color="#182b3e"/>}
      {!compact && [-1,0,1].map(i=><Plate key={i} p={[0,-0.062,i*0.07]} s={[0.12,0.016,0.02]} color={weapon.color} glow/>)}
    </group>
    <Cell ref={parts?.cell} weapon={weapon}/>
    {weapon.model==='volt' && [-1,0,1].map(i=><Tube key={i} p={[i*0.04,0.085,-0.08]} radius={0.012} length={0.2} color={weapon.color} glow/>)}
    {weapon.model==='striker' && [-1,1].map(i=><Plate key={i} p={[i*0.11,-0.12,-0.03]} s={[0.04,0.23,0.1]} r={[0,0,i*0.16]} color="#4f5875"/>)}
    {weapon.model==='astral' && <Plate p={[0,-0.13,0.31]} s={[0.13,0.2,0.15]} color="#52537d"/>}
    {lmg && <group position={[0.16,0.06,0.03]}><mesh ref={parts?.core}><icosahedronGeometry args={[0.055,0]}/><meshBasicMaterial color={weapon.color} toneMapped={false}/></mesh><Ring radius={0.08} color={weapon.color}/></group>}
    {!preview && <><Hand p={[0,-0.23,0.15]}/><group ref={parts?.offhand} position={[-0.04,-0.2,compact ? 0.13 : -0.33]}><Hand left/></group></>}
    <group ref={parts?.flash} position={[0,0,rotary ? -0.76 : double ? -0.63 : -length-0.12]}>
      <mesh rotation={[Math.PI/2,0,0]}><coneGeometry args={[weapon.pellets ? 0.15 : 0.08,0.25,6]}/><meshBasicMaterial color={weapon.color} toneMapped={false} transparent opacity={0.8} depthWrite={false}/></mesh>
      <mesh rotation={[0,0,Math.PI/4]}><octahedronGeometry args={[weapon.pellets ? 0.12 : 0.06]}/><meshBasicMaterial color="#efffff" toneMapped={false}/></mesh>
    </group>
    <group ref={parts?.eject} position={[0.14,0.04,0.08]}><mesh><octahedronGeometry args={[0.018]}/><meshBasicMaterial color={weapon.color} toneMapped={false}/></mesh></group>
  </group>
}
