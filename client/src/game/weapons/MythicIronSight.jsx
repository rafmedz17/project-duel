import { REFLEX_LENS_POSITION,reflexProfile } from './optics.js'
import { Armor,Filament,Fastener } from './ForgedParts.jsx'
import { weaponFinish } from './weaponFinish.js'
import HologramPanel from './HologramPanel.jsx'

export default function MythicIronSight({ weapon,reticleRef,projectionRef,preview=false }) {
  const profile=reflexProfile(weapon),finish=weaponFinish(weapon)
  const compact=profile.variant==='compact',heavy=profile.variant==='reinforced'
  const width=compact ? .098 : heavy ? .128 : .113,height=compact ? .112 : heavy ? .135 : .122
  return <group name="mythic-iron-sight" position={REFLEX_LENS_POSITION}>
    <object3D name="iron-sight-zero" position={[0,0,.026]}/>
    <Armor points={[[.10,-.13],[.085,-.105],[-.08,-.098],[-.22,-.125],[-.14,-.147],[.07,-.147]]} thickness={width*.95} color={finish.body}/>
    {[-1,1].map(side=><group key={side}>
      <Armor position={[side*(width+.028),-.108,-.025]} rotation={[0,0,side*-.3]} points={[[.04,-.02],[-.08,.018],[-.2,.026],[-.12,-.038],[.025,-.045]]} thickness={.025} color={finish.body} bevel={.002}/>
      <Fastener position={[side*(width+.02),-.114,.016]} side={side}/>
    </group>)}
    <group ref={projectionRef} name="holographic-sight-projection" visible={preview}>
    {[-1,1].map(side=><group key={side}>
      <HologramPanel position={[side*width,-.02,0]} points={[[.055,-.082],[.025,-.05],[-.055,-.001],[-.16,height*.56],[-.245,height],[-.214,.026],[-.105,-.068],[.005,-.105]]} color={finish.accent}/>
      <HologramPanel position={[side*(width+.008),-.02,-.012]} points={[[.024,-.071],[-.055,-.03],[-.20,height*.53],[-.245,height],[-.23,.018],[-.11,-.066]]} thickness={.002} color={finish.accent}/>
      <Filament color={finish.accent} radius={heavy ? .0023 : .0019} points={[[side*(width-.01),-.073,.037],[side*(width-.026),-.019,-.04],[side*(width-.022),height*.63,-.16],[side*(width-.04),height-.02,-.244]]}/>
      <Filament color={finish.accent} radius={.0015} points={[[side*(width+.005),-.087,.02],[side*(width+.065),-.07,-.025],[side*(width+.048),-.046,-.10],[side*(width+.012),-.04,-.13]]}/>
      <Filament color={finish.accent} radius={.0008} points={[[side*(width+.015),-.1,-.025],[side*(width-.005),-.05,-.08],[side*(width-.035),.018,-.17],[side*(width-.04),height-.02,-.244]]}/>
      {compact && <HologramPanel position={[side*(width+.024),-.055,-.1]} rotation={[0,side*.18,side*.35]} points={[[.05,-.015],[-.11,.043],[-.2,.065],[-.13,-.025]]} color={finish.accent}/>}
    </group>)}
    <group ref={reticleRef} name="reflex-model-reticle" position={[0,0,.028]}>
      <mesh rotation={[0,0,Math.PI/4]}><planeGeometry args={[.003,.003]}/><meshBasicMaterial color={finish.accent} toneMapped={false}/></mesh>
    </group>
    <HologramPanel points={[[-.11,-.092],[-.21,-.035],[-.35,-.052],[-.27,-.107]]} thickness={heavy ? .083 : .058} color={finish.accent}/>
    {heavy && [-1,1].map(side=><Filament key={side} color={finish.accent} radius={.0015} points={[[side*.04,-.10,-.13],[side*.063,-.094,-.19],[side*.065,-.06,-.26],[side*.035,-.058,-.31]]}/>)}
    </group>
  </group>
}
