// Geometry and hit volumes share the same boxes in training and online play.
export const ROBOT_PARTS = [
  { id:'head',region:'head',position:[0,0.48,0],size:[0.35,0.35,0.38] },
  { id:'torso',region:'body',position:[0,-0.03,0],size:[0.43,0.6,0.32] },
  ...[-1,1].flatMap(side => [
    { id:`arm${side}`,region:'limb',position:[side*0.3,-0.1,0],size:[0.13,0.57,0.17] },
    { id:`leg${side}`,region:'limb',position:[side*0.13,-0.55,0],size:[0.17,0.56,0.2] },
    { id:`foot${side}`,region:'foot',position:[side*0.13,-0.79,-0.045],size:[0.2,0.12,0.31] },
  ]),
]
