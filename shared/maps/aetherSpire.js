// This layout is shared by server movement, client prediction and rendering.
// Decorations never add hidden cover or change collision with graphics quality.
const box=(position,size,color='#354156',kind='structure')=>({position,size,color,kind})
const cover=[
  ...[-1,1].flatMap(x=>[-1,1].map(z=>[x*9.5,.95,z*7.5,3,1.9,2.1])),
  ...[-1,1].flatMap(x=>[-1,1].map(z=>[x*5.7,.575,z*3.3,2.8,1.15,.85])),
  ...[-1,1].map(z=>[0,.575,z*5.4,3.6,1.15,.8]),
  ...[-1,1].map(x=>[x*4.6,.575,0,.8,1.15,2.8]),
]
const solids=[
  box([0,-.35,0],[44,.7,44],'#343d51','floor'),
  ...[-1,1].flatMap(side=>[
    box([side*21.5,1.9,0],[1,3.8,44]),
    box([0,1.9,side*21.5],[42,3.8,1]),
    ...[-1,1].map(z=>box([side*18.5,2.1,z*18.5],[5,4.2,5],'#29354b','corner')),
    ...[-1,1].map(z=>box([side*17,1.2,z*4.5],[6,2.4,.65],'#2d3b51','spawn')),
    ...[-1,1].map(z=>box([side*13.7,1.6,z*4.3],[.7,3.2,1.05],'#3c4961','gate')),
    box([side*13.7,3.5,0],[.7,.6,9.7],'#35455e','beam'),
    box([0,.6,side*17.5],[10,1.2,5],'#414a60','platform'),
    ...[-1,1].map(x=>box([x*5.3,1.75,side*17.6],[.6,1.1,4.8],'#39455b','rail')),
    // Low risers are walkable using this map's shared, bounded autostep setting.
    ...Array.from({length:10},(_,i)=>box([0,(i+1)*.06,side*(12.15+i*.3)],[8,(i+1)*.12,.3],'#465167','step')),
    ...[-1,1].map(x=>box([x*12.5,.4,side*14],[3,.8,2.2],'#3e4a60','planter')),
    ...[-1,1].map(z=>box([side*6.5,1.6,z*7],[.85,3.2,.85],'#2f3c54','pylon')),
  ]),
  ...cover.map(([x,y,z,w,h,d])=>box([x,y,z],[w,h,d],'#43516a','cover')),
  box([0,.175,0],[2.8,.35,2.8],'#384257','reactor-base'),
  box([0,2.1,0],[1.25,3.5,1.25],'#514169','reactor'),
]

export const AETHER_SPIRE={
  name:'AETHER SPIRE',
  description:'A skyline arena with cyan and crimson drop zones, twin flank routes, raised overlooks and a violet reactor at its heart.',
  solids,cover,
  spawns:[{position:[-17,1,0],yaw:-Math.PI/2},{position:[17,1,0],yaw:Math.PI/2}],
  accent:'#ba86ff',background:'#172035',
  autostep:{height:.18,width:.2},
}
