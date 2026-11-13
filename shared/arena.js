// Shared by the rendered facility and the authoritative server collision world.
export const PLAYER = { height:1.7,radius:0.35,speed:5,sprint:8.5,jump:7,gravity:21,eye:0.65,spawn:[0,1,15],sensitivity:0.002 }
export const COVER = [[-8,1.25,-5,3,2.5,2],[8,1.25,-5,3,2.5,2],[-8,1.25,6,3,2.5,2],[8,1.25,6,3,2.5,2],[-3,0.65,0,3,1.3,2],[3,0.65,0,3,1.3,2]]
const box = (position,size,color = '#263849') => ({ position,size,color })
export const ARENA_SOLIDS = [
  box([0,-0.3,0],[41,0.6,41],'#142332'),
  ...[-20,20].flatMap(v => [
    box([v,3,0],[1,6,41]),box([0,3,v],[40,6,1]),
    ...[-16,-8,0,8,16].flatMap(x => [box([x,3,v*0.96],[0.6,6,0.8],'#354d62'),box([v*0.96,3,x],[0.8,6,0.6],'#354d62')]),
  ]),
  ...COVER.flatMap(([x,y,z,w,h,d]) => [box([x,y,z],[w,h,d]),box([x,y+h/2+0.06,z],[w+0.1,0.12,d+0.1],'#40566b')]),
  ...[-12,12].map(x=>box([x,1.1,0],[3,2.2,0.18],'#49778b')),
  ...[-12,12].map(x => box([x,5.5,0],[0.5,0.5,38],'#354d62')),
]
export const ONLINE = Object.freeze({
  tickRate:60,inputRate:20,patchRate:50,inputTimeoutMs:250,countdownSeconds:3,
  capsuleHalfHeight:PLAYER.height/2-PLAYER.radius,capsuleRadius:PLAYER.radius,maxPitch:1.48,interpolationMs:100,
  spawns:[{ position:[0,1,15],yaw:0 },{ position:[0,1,-15],yaw:Math.PI }],
})
