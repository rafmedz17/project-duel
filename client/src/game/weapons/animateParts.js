import {MathUtils} from 'three'
import {modelProfile} from './modelProfiles.js'

// Both viewpoints consume the same accepted combat timestamps. These transforms
// only pose geometry; they never send attacks or change simulation state.
export function animateParts(parts,a,weapon,s,time,delta) {
  const {action,rotor,offhand,trail,cell,bolt,pump,hinge,core,flash,eject}=parts
  const melee=weapon.fireMode==='melee',p=modelProfile(weapon)
  if(action.current) action.current.rotation.x=melee ? -a.windup*.5+a.hit*.2 : a.kick*.04
  if(cell.current) {
    if(p.revolver) {cell.current.position.set(-a.reloadPose*.17,a.reloadPose*.015,a.reloadPose*.035);cell.current.rotation.set(0,-a.reloadPose*.3,0)}
    else {cell.current.position.set(-a.drop*.13,-a.drop*.32,a.drop*.09);cell.current.rotation.z=-a.drop*.35}
  }
  if(bolt.current) {
    if(p.revolver) bolt.current.rotation.x=-a.kick*.5-a.reloadPose*.3
    else bolt.current.position.z=p.boltZ+a.bolt*(weapon.scope ? .13 : .045)
  }
  if(pump.current) pump.current.position.z=p.pumpZ+a.pump*.14
  if(hinge.current) hinge.current.rotation.x=a.hinge
  if(rotor.current) {
    if(p.revolver) rotor.current.rotation.z=-((s.shot || 0)%8)*Math.PI/4+a.kick*.10
    else rotor.current.rotation.z+=Math.min(delta,.1)*a.spin*28
  }
  if(core.current) {core.current.rotation.x=time;core.current.rotation.y=time*1.4}
  if(flash.current) {flash.current.visible=a.flash;flash.current.rotation.z=(s.shot || 0)*2.4}
  if(trail.current) {trail.current.visible=a.hit>.12;trail.current.material.opacity=a.hit*.5;trail.current.rotation.z=-.3+a.hit}
  if(eject.current) {
    const age=time-s.lastShot;eject.current.visible=!p.revolver && age>=0 && age<.24
    eject.current.position.set(p.width+.035+age*.8,.035+age*.7-age*age*3,.035+age*.4)
    eject.current.rotation.set(age*20,age*13,age*17)
  }
  if(offhand.current) {
    if(weapon.model==='fangs') {
      const alternating=(s.swings || 0)%2 ? -1 : 1
      offhand.current.position.set(-.64+a.hit*.4,.04+a.hit*.15,-a.hit*.15)
      offhand.current.rotation.set(a.windup*-.3,0,.3-a.hit*1.2*alternating)
    } else {
      // The support hand reaches the magazine, follows its withdrawal and
      // insertion, then returns to the foregrip. Pump shotguns move it with the pump.
      const reach=a.reloadPose,z=p.support[2]+a.pump*.14
      const reloadHand=p.revolver ? [-.17*reach,p.cell[1]-.025,p.cell[2]+.035*reach] : [p.cell[0]-.06-a.drop*.13,p.cell[1]-.04-a.drop*.32,p.cell[2]+a.drop*.09]
      offhand.current.position.set(MathUtils.lerp(p.support[0],reloadHand[0],reach),MathUtils.lerp(p.support[1],reloadHand[1],reach),MathUtils.lerp(z,reloadHand[2],reach))
      offhand.current.rotation.set(a.drop*.2,0,-a.drop*.35)
    }
  }
}
