import { memo } from 'react'
import { useGame } from './store.js'
import { getMap } from '../../../shared/maps.js'
import Box from './WorldBox.jsx'
import TrainingGrounds from './training/TrainingGrounds.jsx'

const ArenaLayout = memo(function ArenaLayout({ training,mapId,quality }) {
  const map = getMap(mapId)
  return <>
    <color attach="background" args={[map.background]} />
    <fog attach="fog" args={[map.background, 25, 80]} />
    <ambientLight intensity={0.65} /><hemisphereLight args={['#a8dfff', '#111827', 1.8]} />
    <directionalLight position={[8, 18, 10]} intensity={2.8} color="#b6d9ff" />
    {quality !== 'Low' && <pointLight position={[0, 5, -10]} color="#7c3aed" intensity={65} distance={28} />}
    {map.solids.map((solid,index) => <Box key={index} {...solid} solid />)}
    <gridHelper args={[40, 20, map.accent, '#243c4e']} position={[0, 0.012, 0]} />
    {[-20, 20].map(v => <group key={v}>
      <Box position={[v * 0.972, 0.25, 0]} size={[0.07, 0.1, 39]} color={map.accent} glow />
      <Box position={[0, 0.25, v * 0.972]} size={[39, 0.1, 0.07]} color={map.accent} glow />
      {[-16, -8, 0, 8, 16].map(x => <group key={x}>
        <Box position={[x, 3.6, v * 0.935]} size={[0.12, 2.5, 0.05]} color={v < 0 ? '#7c3aed' : '#00d9ff'} glow />
      </group>)}
    </group>)}
    {map.cover.map(([x,y,z,w,,d], i) => <group key={i}>
      <Box position={[x,y+0.2,z+d/2+0.015]} size={[w*0.8,0.06,0.025]} glow color={map.accent} />
      <Box position={[x,y+0.2,z-d/2-0.015]} size={[w*0.8,0.06,0.025]} glow color={map.accent} />
    </group>)}
    {mapId==='neon' && [-12,12].flatMap(x => [-9,9].map(z => <group key={`${x}-${z}`}><Box position={[x,3.6,z]} size={[2.1,0.18,2.1]} color={map.accent} glow /><Box position={[x,2.3,z+1.02]} size={[1.3,0.8,0.03]} color="#4dceff" glow /></group>))}
    {mapId==='orbital' && <group><Box position={[0,5.2,0]} size={[3,0.2,3]} color={map.accent} glow />{[-13,13].flatMap(x => [-10,0,10].map(z => <Box key={`${x}-${z}`} position={[x,2.47,z]} size={[1.8,0.08,2.7]} color={map.accent} glow />))}</group>}
    {[-12, 12].map(x => <Box key={x} position={[x,5.22,0]} size={[0.15,0.04,37]} color="#88e5ff" glow />)}
    {!training && <Box position={[0,0.025,-15]} size={[5,0.03,4]} color="#49351c" />}
    <Box position={[0,0.025,15]} size={[5,0.03,4]} color="#17404d" />
    {[-2.5,2.5].map(x => <Box key={x} position={[x,0.05,15]} size={[0.06,0.03,4]} color="#00d9ff" glow />)}
  </>
})

export default function Arena({ training=true,mapId='facility' }) {
  const quality=useGame(s=>s.settings.quality)
  return training ? <TrainingGrounds quality={quality}/> : <ArenaLayout training={false} mapId={mapId} quality={quality}/>
}
