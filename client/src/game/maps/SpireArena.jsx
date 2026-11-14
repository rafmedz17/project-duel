import {memo,useEffect,useLayoutEffect,useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {RigidBody,CuboidCollider} from '@react-three/rapier'
import {AdditiveBlending,CanvasTexture,Color,Object3D,RepeatWrapping,SRGBColorSpace} from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {AETHER_SPIRE} from '../../../../shared/maps/aetherSpire.js'

const CYAN='#50dcff',RED='#ff648c',VIOLET='#c080ff',GOLD='#d4b072'
const noRaycast=()=>null
const corners=[[-1,-1],[-1,1],[1,-1],[1,1]]
const part=(position,size,color,rotation=[0,0,0])=>({position,size,color,rotation})

// One draw per family, including all trim pieces and windows. No per-prop lights.
function Batch({items,shape='box',glow=false,shadow=false,name,detail=0}) {
  const mesh=useRef()
  useLayoutEffect(()=>{
    const object=new Object3D(),color=new Color()
    items.forEach((item,i)=>{
      object.position.set(...item.position);object.scale.set(...item.size)
      object.rotation.set(...item.rotation);object.updateMatrix()
      mesh.current.setMatrixAt(i,object.matrix)
      mesh.current.setColorAt(i,color.set(item.color))
    })
    mesh.current.instanceMatrix.needsUpdate=true
    if(mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate=true
    mesh.current.computeBoundingSphere()
  },[items])
  const rounded=useMemo(()=>shape==='armor' ? new RoundedBoxGeometry(1,1,1,1,.045) : null,[shape])
  useEffect(()=>()=>rounded?.dispose(),[rounded])
  if(!items.length) return null
  return <instancedMesh ref={mesh} name={name} args={[null,null,items.length]} geometry={rounded || undefined} castShadow={shadow} receiveShadow={shadow} raycast={noRaycast}>
    {shape==='box' && <boxGeometry/>}
    {shape==='leaf' && <icosahedronGeometry args={[1,detail]}/>}
    {glow ? <meshBasicMaterial toneMapped={false}/> : <meshStandardMaterial roughness={shape==='leaf' ? .94 : .52} metalness={shape==='leaf' ? .02 : .55}/>}
  </instancedMesh>
}

function makeTextures() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='#98a2b2';ctx.fillRect(0,0,512,512)
  ctx.fillStyle='#8b95a6';ctx.fillRect(6,6,244,500)
  ctx.fillStyle='#a0a8b8';ctx.fillRect(262,6,244,244)
  ctx.strokeStyle='#677489';ctx.lineWidth=3
  ctx.strokeRect(4,4,504,504);ctx.strokeRect(258,4,250,250);ctx.strokeRect(4,258,250,250)
  let seed=831
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<1200;i++) {
    const x=random()*512,y=random()*512
    ctx.strokeStyle=`rgba(${random()>.5 ? '240,245,255' : '35,45,65'},${random()*.075})`
    ctx.lineWidth=.5+random();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*12,y+random()*3);ctx.stroke()
  }
  ctx.fillStyle='#5a687d'
  for(const x of [14,242,270,498]) for(const y of [14,242,270,498]) {ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill()}
  const floor=new CanvasTexture(canvas);floor.colorSpace=SRGBColorSpace
  floor.wrapS=floor.wrapT=RepeatWrapping;floor.repeat.set(11,11)
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128
  const haloCtx=haloCanvas.getContext('2d'),gradient=haloCtx.createRadialGradient(64,64,0,64,64,64)
  gradient.addColorStop(0,'rgba(255,255,255,.55)');gradient.addColorStop(.35,'rgba(255,255,255,.16)');gradient.addColorStop(1,'rgba(255,255,255,0)')
  haloCtx.fillStyle=gradient;haloCtx.fillRect(0,0,128,128)
  const halo=new CanvasTexture(haloCanvas);halo.colorSpace=SRGBColorSpace
  return {floor,halo}
}

function buildDetails(quality) {
  const metal=[],dark=[],paint=[],light=[],foliage=[],branches=[],city=[],windows=[]
  const high=quality==='High',low=quality==='Low'
  for(const solid of AETHER_SPIRE.solids) {
    const {position:[x,y,z],size:[w,h,d],kind}=solid
    if(['floor','step','reactor'].includes(kind)) continue
    // Machined top caps, inset panels and protected luminous strips.
    metal.push(part([x,y+h/2+.035,z],[w+.06,.07,d+.06],'#758198'))
    if(['cover','spawn','rail','gate'].includes(kind)) {
      const color=kind==='spawn' || kind==='gate' ? x<0 ? CYAN : RED : GOLD
      for(const side of [-1,1]) {
        dark.push(part([x,y,z+side*(d/2+.012)],[w*.86,h*.61,.025],'#1b2538'))
        light.push(part([x,y+h*.3,z+side*(d/2+.035)],[w*.74,.035,.035],color))
        if(!low) for(const offset of [-.35,.35]) metal.push(part([x+w*offset,y,z+side*(d/2+.04)],[.085,h*.7,.05],'#6b7891'))
      }
    }
    if(kind==='pylon') {
      dark.push(part([x,y,z],[1.05,2.65,1.05],'#1c2338'))
      for(const side of [-1,1]) {
        light.push(part([x,1.8,z+side*.54],[.36,2.1,.025],VIOLET))
        light.push(part([x+side*.54,1.8,z],[.025,2.1,.36],VIOLET))
      }
      for(const offset of [-.45,.45]) metal.push(part([x+offset,1.8,z],[.13,2.75,.9],'#6c6588'))
    }
  }
  // The reactor cage encloses its authoritative collision volume.
  for(const [x,z] of corners) {
    metal.push(part([x*.54,2.1,z*.54],[.12,3.5,.12],'#81769e'))
    light.push(part([x*.56,2.1,z*.56],[.045,3.1,.045],VIOLET))
  }
  for(const y of [.43,3.8]) metal.push(part([0,y,0],[1.5,.14,1.5],'#70678b'))
  for(const side of [-1,1]) {
    const color=side<0 ? CYAN : RED
    // Spawn frames; facing each other across the central arena.
    for(const z of [-4.12,4.12]) {
      light.push(part([side*13.28,1.6,z],[.055,3,.065],color))
      light.push(part([side*17,.055,z],[7,.035,.055],color))
    }
    light.push(part([side*13.28,3.48,0],[.06,.07,8.3],color))
    light.push(part([side*20.93,1.55,0],[.04,.09,7.4],color))
    for(const z of [-1.5,1.5]) light.push(part([side*18.5,.035,z],[3,.018,.035],color))
    // Upper and lower routes have wide, readable approaches.
    for(const x of [-9,0,9]) {
      paint.push(part([x,.022,side*11],[6,.012,.035],'#bca575'))
      for(const dx of [-.25,.25]) light.push(part([x+dx,.033,side*10.4],[.075,.015,.7],CYAN,[0,dx<0 ? -.7 : .7,0]))
    }
    for(let i=0;i<10;i++) light.push(part([0,(i+1)*.12+.009,side*(12.015+i*.3)],[7.65,.018,.035],i%3===0 ? GOLD : '#7a91a7'))
    light.push(part([0,1.215,side*15.12],[9,.025,.065],GOLD))
    for(const x of [-5.3,5.3]) light.push(part([x,2.32,side*17.6],[.12,.04,4.6],CYAN))
    for(const edge of [-20.9,20.9]) {
      light.push(part([edge,.16,0],[.045,.045,32],edge<0 ? CYAN : RED))
      light.push(part([0,.16,edge],[32,.045,.045],CYAN))
    }
    // Lane paint and angled entry arrows, all cosmetic and below foot level.
    for(const z of [-7,7]) for(let i=0;i<4;i++) paint.push(part([side*(12+i*1.1),.026,z],[.52,.018,.055],'#8996ab'))
    for(const x of [11.1,12.1]) for(const flip of [-1,1]) light.push(part([side*x,.032,flip*.22],[.5,.02,.045],color,[0,side*flip*.7,0]))
    // Corner bastions and amber recess lamps.
    for(const z of [-18.5,18.5]) {
      dark.push(part([side*18.5,3.3,z],[5.15,.32,5.15],'#182135'))
      light.push(part([side*18.5,3.51,z],[3.3,.045,.1],GOLD))
    }
  }
  // Pink ornamental trees: opaque low-poly leaf clusters, not alpha cards.
  for(const [sx,sz] of corners) {
    const x=sx*12.5,z=sz*14
    dark.push(part([x,.82,z],[2.7,.05,1.9],'#1c2936'))
    light.push(part([x,.65,z-sz*1.12],[2.5,.065,.035],CYAN))
    branches.push(part([x,1.65,z],[.18,1.65,.18],'#574052',[0,0,sx*.08]))
    for(const side of [-1,1]) branches.push(part([x+side*.3,2.12,z],[.12,1.15,.12],'#695063',[0,sz*.25,side*-.7]))
    const count=low ? 7 : high ? 24 : 14
    for(let i=0;i<count;i++) {
      const angle=i*2.39996,radius=.3+Math.sqrt(i/count)*1.15
      foliage.push(part([x+Math.cos(angle)*radius,2.65+Math.sin(i*5.1)*.43,z+Math.sin(angle)*radius*.68],[.5+(i%3)*.1,.42+(i%2)*.15,.5],['#b95ea6','#d281b5','#854d91','#e49bc6'][i%4],[i*.7,i*.4,0]))
    }
  }
  // Far skyline: static instancing keeps the city inexpensive on Low.
  const count=low ? 20 : high ? 60 : 36
  for(let i=0;i<count;i++) {
    const angle=i/count*Math.PI*2,radius=31+(i%5)*3.4,h=5+(i*7%17)
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,w=2+(i%3)*1.2,d=2.8+(i%4)
    city.push(part([x,h/2-4,z],[w,h,d],['#182a40','#20364b','#293247','#23394e'][i%4]))
    if(!low || i%2===0) for(let row=0;row<(high ? 4 : 2);row++) {
      windows.push(part([x,h*.25-2+row*1.8,z+d/2+.02],[w*.67,.045,.025],i%3===0 ? '#9973b6' : '#52829e'))
      windows.push(part([x+w/2+.02,h*.25-2+row*1.8,z],[.025,.045,d*.62],i%3===0 ? '#9973b6' : '#52829e'))
    }
    if(high && i%4===0) windows.push(part([x,h-3.8,z],[.06,1.8,.06],CYAN))
  }
  return {metal,dark,paint,light,foliage,branches,city,windows}
}

function Sign({title,subtitle,position,rotation=[0,0,0],color=CYAN,width=5}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#172238';ctx.fillRect(0,0,512,128)
    ctx.fillStyle=color;ctx.fillRect(0,0,512,3)
    ctx.textAlign='center';ctx.font='bold 36px sans-serif';ctx.fillText(title,256,60)
    ctx.font='15px monospace';ctx.fillStyle='#a8b5ce';ctx.fillText(subtitle,256,96)
    return new CanvasTexture(canvas)
  },[title,subtitle,color])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh name={`spire-sign-${title}`} position={position} rotation={rotation} raycast={noRaycast}><planeGeometry args={[width,width/4]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
}

function Reactor({quality}) {
  const rotor=useRef(),crystal=useRef(),dust=useRef()
  const particles=useMemo(()=>Float32Array.from({length:(quality==='High' ? 110 : 38)*3},(_,i)=>i%3===1 ? .4+(Math.sin(i*1.37)+1)*2.7 : Math.sin(i*21.13)*10),[quality])
  useFrame((_,delta)=>{
    const dt=Math.min(delta,.05)
    rotor.current.rotation.y+=dt*.18
    crystal.current.rotation.y-=dt*.28
    if(dust.current) dust.current.rotation.y+=dt*.015
  })
  return <group name="spire-reactor">
    <group ref={rotor}>
      {[.23,.4].map((y,i)=><mesh key={y} position={[0,y,0]} rotation={[-Math.PI/2,0,Math.PI/8]} raycast={noRaycast}><ringGeometry args={[i ? 2.25 : 2.65,i ? 2.3 : 2.74,8]}/><meshBasicMaterial color={i ? '#85669b' : VIOLET} side={2} toneMapped={false}/></mesh>)}
      {quality!=='Low' && <mesh position={[0,3.6,0]} rotation={[Math.PI/2,.15,0]} raycast={noRaycast}><torusGeometry args={[1.35,.018,4,48]}/><meshBasicMaterial color={VIOLET} toneMapped={false}/></mesh>}
    </group>
    <group ref={crystal} position={[0,2.12,0]}>
      <mesh scale={[.43,1.22,.43]} raycast={noRaycast}><octahedronGeometry args={[1,0]}/><meshStandardMaterial color="#b080e8" emissive="#9b40ed" emissiveIntensity={1.35} metalness={.6} roughness={.22}/></mesh>
      <mesh scale={[.53,1.4,.53]} raycast={noRaycast}><octahedronGeometry args={[1,0]}/><meshBasicMaterial color="#d5a2ff" wireframe toneMapped={false}/></mesh>
      <mesh scale={[.12,.91,.12]} raycast={noRaycast}><octahedronGeometry args={[1,0]}/><meshBasicMaterial color="#f1d8ff" toneMapped={false}/></mesh>
    </group>
    {quality!=='Low' && <points ref={dust} raycast={noRaycast}><bufferGeometry><bufferAttribute attach="attributes-position" args={[particles,3]}/></bufferGeometry><pointsMaterial color="#d7b8ff" size={quality==='High' ? .035 : .025} transparent opacity={.4} depthWrite={false}/></points>}
  </group>
}

function Collisions() {
  return <RigidBody type="fixed" colliders={false} name="spire-collision">
    {AETHER_SPIRE.solids.map((solid,i)=><group key={i}>
      <CuboidCollider position={solid.position} args={solid.size.map(value=>value/2)}/>
      <mesh position={solid.position} userData={{blocksShot:true,coverSolid:solid}}>
        <boxGeometry args={solid.size}/><meshBasicMaterial visible={false}/>
      </mesh>
    </group>)}
  </RigidBody>
}

const SpireArena=memo(function SpireArena({quality='Low',colliders=true}) {
  const textures=useMemo(()=>makeTextures(),[])
  useEffect(()=>()=>Object.values(textures).forEach(texture=>texture.dispose()),[textures])
  const details=useMemo(()=>buildDetails(quality),[quality])
  const structure=useMemo(()=>AETHER_SPIRE.solids.filter(s=>!['floor','reactor'].includes(s.kind)).map(s=>part(s.position,s.size,s.color)),[])
  const high=quality==='High'
  return <>
    <color attach="background" args={[AETHER_SPIRE.background]}/>
    <fog attach="fog" args={['#263349',quality==='Low' ? 35 : 42,105]}/>
    <group name="aether-spire" userData={{quality}}>
    <ambientLight intensity={.38}/><hemisphereLight args={['#c7d7ff','#3c3044',1.6]}/>
    <directionalLight position={[-14,26,9]} color="#c7d8ff" intensity={2.8} castShadow={high} shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-27} shadow-camera-right={27} shadow-camera-top={27} shadow-camera-bottom={-27} shadow-camera-near={1} shadow-camera-far={80} shadow-bias={-.0003} shadow-normalBias={.04}/>
    {quality!=='Low' && <><pointLight position={[0,3.6,0]} color="#bf65ff" intensity={high ? 45 : 26} distance={13}/><directionalLight position={[16,7,-16]} color="#f3b2cd" intensity={.65}/></>}
    {high && <><pointLight position={[-17,2.8,0]} color={CYAN} intensity={32} distance={10}/><pointLight position={[17,2.8,0]} color={RED} intensity={32} distance={10}/></>}
    {colliders && <Collisions/>}
    <mesh position={[0,-.35,0]} receiveShadow={high} raycast={noRaycast} name="spire-floor"><boxGeometry args={[44,.7,44]}/><meshStandardMaterial color="#768095" map={textures.floor} roughness={.72} metalness={.48}/></mesh>
    <Batch items={structure} shape="armor" shadow={high} name="spire-architecture"/>
    <Batch items={details.metal} shape="armor" shadow={high} name="spire-metalwork"/>
    <Batch items={details.dark} name="spire-insets"/>
    <Batch items={details.paint} name="spire-lane-markings"/>
    <Batch items={details.light} glow name="spire-emissive-trim"/>
    <Batch items={details.branches} shadow={high} name="spire-tree-branches"/>
    <Batch items={details.foliage} shape="leaf" detail={high ? 1 : 0} shadow={high} name="spire-blossoms"/>
    <Batch items={details.city} name="spire-skyline"/>
    <Batch items={details.windows} glow name="spire-city-lights"/>
    {[[0,0,VIOLET,10],[-17,0,CYAN,8],[17,0,RED,8]].map(([x,z,color,size])=><mesh key={x} position={[x,.018,z]} rotation={[-Math.PI/2,0,0]} raycast={noRaycast}><planeGeometry args={[size,size]}/><meshBasicMaterial map={textures.halo} color={color} transparent opacity={quality==='Low' ? .3 : .65} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>)}
    {quality!=='Low' && <sprite position={[0,2.15,0]} scale={[3.8,4.8,1]} raycast={noRaycast}><spriteMaterial map={textures.halo} color={VIOLET} transparent opacity={high ? .65 : .35} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></sprite>}
    {high && corners.map(([x,z])=><sprite key={`${x}-${z}`} position={[x*6.5,1.8,z*7]} scale={[2.3,3.7,1]} raycast={noRaycast}><spriteMaterial map={textures.halo} color={VIOLET} transparent opacity={.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false}/></sprite>)}
    <Reactor quality={quality}/>
    <Sign title="CYAN / 01" subtitle="DROP ZONE A  //  AETHER SPIRE" position={[-20.94,2.6,0]} rotation={[0,Math.PI/2,0]} color={CYAN} width={6}/>
    <Sign title="CRIMSON / 02" subtitle="DROP ZONE B  //  AETHER SPIRE" position={[20.94,2.6,0]} rotation={[0,-Math.PI/2,0]} color={RED} width={6}/>
    {[-1,1].map(side=><Sign key={side} title="AETHER SPIRE" subtitle="OBSERVATION DECK  //  KEEP MOVING" position={[0,2.8,side*20.94]} rotation={[0,side>0 ? Math.PI : 0,0]} color={GOLD} width={7}/>)}
    {[-1,1].map(side=><Sign key={side} title="FLANK ROUTE" subtitle="OVERLOOK  //  12 M" position={[side*9.5,2.45,side*8.57]} rotation={[0,side>0 ? 0 : Math.PI,0]} width={2.8}/>)}
    </group>
  </>
})

export default SpireArena
