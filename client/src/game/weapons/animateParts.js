import {MathUtils} from 'three'

// Both viewpoints consume the same accepted combat timestamps. These transforms
// only pose geometry; they never send attacks or change simulation state.
export function animateParts(parts,a,weapon,s,time,delta) {
  const {action,rotor,offhand,trail,cell,bolt,pump,hinge,core,flash,eject}=parts
  const melee=weapon.fireMode==='melee',compact=weapon.slot==='2'
  if(action.current) action.current.rotation.x=melee ? -a.windup*.5+a.hit*.2 : a.kick*.04
  if(cell.current) {cell.current.position.set(-a.drop*.13,-a.drop*.32,a.drop*.09);cell.current.rotation.z=-a.drop*.35}
  if(bolt.current) bolt.current.position.z=-.02+a.bolt*(weapon.scope ? .17 : .055)
  if(pump.current) pump.current.position.z=-.35+a.pump*.14
  if(hinge.current) hinge.current.rotation.x=a.hinge
  if(rotor.current) rotor.current.rotation.z+=Math.min(delta,.1)*a.spin*28
  if(core.current) {core.current.rotation.x=time;core.current.rotation.y=time*1.4}
  if(flash.current) {flash.current.visible=a.flash;flash.current.rotation.z=(s.shot || 0)*2.4}
  if(trail.current) {trail.current.visible=a.hit>.12;trail.current.material.opacity=a.hit*.5;trail.current.rotation.z=-.3+a.hit}
  if(eject.current) {
    const age=time-s.lastShot;eject.current.visible=age>=0 && age<.24
    eject.current.position.set(.14+age*.8,.04+age*.7-age*age*3,.08+age*.4)
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
      const reach=a.reloadPose,z=compact ? .13 : -.33+a.pump*.14
      offhand.current.position.set(MathUtils.lerp(-.04,-.06-a.drop*.13,reach),MathUtils.lerp(-.2,-.25-a.drop*.32,reach),MathUtils.lerp(z,(compact ? .1 : -.08)+a.drop*.09,reach))
      offhand.current.rotation.set(a.drop*.2,0,-a.drop*.35)
    }
  }
}
