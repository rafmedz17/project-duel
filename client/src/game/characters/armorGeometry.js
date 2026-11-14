import { BufferGeometry,Color,ConeGeometry,CylinderGeometry,Euler,Float32BufferAttribute,Matrix4,Quaternion,Shape,SphereGeometry,Vector3,ExtrudeGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const cache=new Map()
const dark='#111a26',joint='#202735'

// Geometry is shared between characters of the same design. All colored armor
// is merged into one mesh per hit region, with a second mesh for light strips.
// Cosmetic geometry never replaces the authoritative robot hit boxes.
export function armorGeometry(part,c,equipped=false) {
  const key=`${c.number}:${part.id}:${equipped}`
  if(cache.has(key)) return cache.get(key)
  const base=[],light=[]
  const metal=c.armor,trim=c.trim,ink=c.cloth
  const runner=c.motif==='runner',warden=c.motif==='warden',engine=c.motif==='engine',hunter=c.motif==='hunter'
  function add(geometry,color,glow=false,position,rotation) {
    let g=geometry
    if(rotation) g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...rotation)))
    if(position) g.translate(...position)
    if(g.index) { const indexed=g;g=g.toNonIndexed();indexed.dispose() }
    g.deleteAttribute('uv')
    const rgb=new Color(color),colors=new Float32Array(g.attributes.position.count*3)
    for(let i=0;i<colors.length;i+=3) { colors[i]=rgb.r;colors[i+1]=rgb.g;colors[i+2]=rgb.b }
    g.setAttribute('color',new Float32BufferAttribute(colors,3))
    ;(glow ? light : base).push(g)
  }
  function plate(points,depth,z,color,glow=false) {
    const shape=new Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath()
    const bevel=Math.min(.006,depth*.2)
    const g=new ExtrudeGeometry(shape,{depth,bevelEnabled:!glow,bevelSegments:2,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:1})
    g.translate(0,0,z-depth/2)
    // Form curved armor shells instead of flat plates pasted onto cubes.
    const vertices=g.attributes.position
    for(let i=0;i<vertices.count;i++) vertices.setZ(i,vertices.getZ(i)+vertices.getX(i)**2*.75)
    g.computeVertexNormals();add(g,color,glow)
  }
  function block(position,size,color,rotation) { add(new RoundedBoxGeometry(...size,1,Math.min(.009,...size.map(v=>v*.15))),color,false,position,rotation) }
  function orb(position,size,color) { const g=new SphereGeometry(1,8,6);g.scale(...size);add(g,color,false,position) }
  function line(points,color=c.color,radius=.0035,glow=true) {
    for(let i=1;i<points.length;i++) {
      const a=new Vector3(...points[i-1]),b=new Vector3(...points[i]),direction=b.clone().sub(a)
      const g=new CylinderGeometry(radius,radius,direction.length(),5)
      g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.normalize()))
      g.translate(...a.add(b).multiplyScalar(.5).toArray());add(g,color,glow)
    }
  }
  const front=-part.size[2]/2
  if(part.id==='head') {
    orb([0,-.012,.015],[.153,.157,.16],metal)
    if(runner) {
      plate([[-.17,-.16],[-.176,.04],[-.11,.155],[0,.18],[.12,.145],[.176,.025],[.165,-.16],[.1,-.12],[0,-.14],[-.1,-.12]],.29,.025,ink)
      plate([[-.143,-.116],[-.135,.075],[0,.145],[.135,.075],[.143,-.116],[0,-.146]],.012,-.141,dark)
      line([[-.155,-.12,-.161],[-.145,.07,-.162],[0,.156,-.13],[.145,.07,-.162],[.155,-.12,-.161]],trim,.005,false)
    } else {
      plate([[-.14,.075],[-.11,.142],[0,.164],[.11,.142],[.14,.075],[.12,-.02],[-.12,-.02]],.025,-.115,engine ? trim : metal)
      plate([[-.146,.015],[-.115,-.115],[0,-.166],[.115,-.115],[.146,.015],[0,-.03]],.035,-.141,metal)
      for(const side of [-1,1]) {
        block([side*.15,.005,.018],[.035,.09,.12],c.secondary)
        line([[side*.169,.025,-.02],[side*.169,-.025,-.02]],c.color,.006)
      }
      const hair=hunter ? c.secondary : warden ? '#b0acc6' : '#8b8d98'
      for(let i=-3;i<=3;i++) {
        const x=i*.034,y=.145+(.028-Math.abs(i)*.006)
        add(new ConeGeometry(.032,.1,5),hair,false,[x,y+.025,.025],[-.6,0,-i*.17])
        add(new ConeGeometry(.026,.085,5),hair,false,[x,y+.018,.085],[-.85,0,-i*.16])
      }
    }
    plate([[-.13,.052],[-.108,-.018],[0,-.065],[.108,-.018],[.13,.052],[0,.015]],.012,-.164,dark)
    for(const side of [-1,1]) {
      plate([[side*.018,-.018],[side*.114,.025],[side*.102,-.006],[side*.032,-.04]],.004,-.177,c.color,true)
      plate([[side*.025,-.064],[side*.114,-.029],[side*.081,-.10],[side*.02,-.137]],.013,-.16,runner ? metal : c.secondary)
      line([[side*.021,-.04,-.178],[side*.01,-.085,-.176]],c.color,.0025)
    }
  } else if(part.id==='torso') {
    plate([[-.2,.34],[-.18,.405],[.18,.405],[.2,.34],[.18,.06],[.13,-.25],[.18,-.36],[0,-.4],[-.18,-.36],[-.13,-.25],[-.18,.06]],.25,.025,ink)
    orb([0,.17,.015],[.19,.19,.13],ink)
    block([0,.4,0],[.13,.13,.13],joint)
    // Collar and shoulder-to-waist plates leave flexible dark joints visible.
    for(const side of [-1,1]) {
      block([side*.12,.36,-.035],[.11,.12,.18],metal,[0,0,side*.2])
      plate([[side*.024,.3],[side*.17,.345],[side*.225,.265],[side*.185,.12],[side*.07,.095],[side*.025,.17]],.045,front-.005,metal)
      plate([[side*.025,.29],[side*.17,.335],[side*.205,.28],[side*.07,.225]],.015,front-.04,warden ? trim : engine ? c.secondary : trim)
      line([[side*.025,.16,front-.034],[side*.072,.10,front-.034],[side*.17,.135,front-.034]])
      for(let i=0;i<3;i++) block([side*(.10+i*.022),.24+i*.006,front-.038],[.012,.009,.006],joint)
      orb([side*.18,.28,front-.01],[.007,.007,.007],trim)
      plate([[side*.175,.08],[side*.155,-.15],[side*.105,-.22],[side*.09,-.04]],.028,-.10,c.secondary)
      line([[side*.17,.05,-.12],[side*.13,-.05,-.12],[side*.14,-.17,-.12]],c.color,.004)
      block([side*.153,-.265,-.04],[.085,.11,.23],engine ? c.secondary : metal)
      plate([[side*.18,-.27],[side*.225,-.36],[side*.18,-.48],[side*.1,-.39]],.028,-.055,metal)
      // Back-mounted reactor rails and engraved spine.
      block([side*.11,.19,.176],[.065,.26,.065],metal,[0,0,side*.1])
      line([[side*.11,.28,.212],[side*.11,.10,.212]],c.color,.006)
      if(runner || hunter) {
        const length=hunter ? .78 : .67
        plate([[side*.14,.24],[side*.22,.22],[side*.28,-.32],[side*.34,-length],[side*.17,-length+.1],[side*.1,-.28]],.014,.19,ink)
        line([[side*.22,.15,.18],[side*.27,-.32,.18],[side*.33,-length+.025,.18]],c.color,.003)
        if(hunter) plate([[side*.23,-.28],[side*.32,-.73],[side*.255,-.68]],.003,.178,c.secondary)
      }
    }
    for(let i=0;i<3;i++) {
      const y=.04-i*.085,w=.08-i*.009
      plate([[-w,y+.038],[0,y+.05],[w,y+.038],[w*.8,y-.02],[0,y-.055],[-w*.8,y-.02]],.025,-.125,metal)
    }
    block([0,-.26,-.13],[.12,.07,.035],trim)
    plate([[-.035,.215],[0,.26],[.035,.215],[0,.167]],.012,front-.04,c.color,true)
    line([[0,.31,.192],[0,-.19,.192]],trim,.007,false)
    if(engine) for(const side of [-1,1]) block([side*.125,-.2,-.15],[.055,.105,.06],trim)
  } else if(part.id.startsWith('arm')) {
    const side=Math.sign(part.position[0]),width=warden ? .115 : .095
    orb([0,.19,0],[.076,.16,.077],ink)
    plate([[-width,.18],[-width*.9,.32],[0,.38],[width,.31],[width,.18],[0,.12]],.18,0,warden ? trim : hunter ? c.secondary : metal)
    plate([[-width*.8,.30],[0,.35],[width*.8,.29],[width*.6,.23],[-width*.6,.23]],.015,-.105,metal)
    line([[-width*.65,.22,-.108],[0,.19,-.108],[width*.65,.22,-.108]],c.color,.004)
    if(runner) plate([[side*.02,.31],[side*.14,.34],[side*.08,.22],[side*.03,.17]],.075,.01,trim)
    block([0,.06,0],[.11,.19,.13],metal)
    for(let i=0;i<3;i++) block([0,.085-i*.03,-.07],[.072,.009,.012],ink)
    orb([0,-.075,0],[.062,.067,.067],joint)
    if(!equipped) {
      block([0,-.19,0],[.105,.23,.135],metal,[0,0,-side*.04])
      plate([[-.05,-.09],[0,-.05],[.05,-.09],[.037,-.28],[0,-.31],[-.037,-.28]],.02,-.08,trim)
      line([[0,-.09,-.094],[side*.018,-.17,-.094],[0,-.26,-.094]],c.color,.004)
      block([0,-.33,-.01],[.105,.09,.11],joint)
      for(let i=0;i<4;i++) block([-.036+i*.024,-.365,-.022],[.019,.07,.04],metal)
    }
  } else if(part.id.startsWith('leg')) {
    orb([0,.075,.01],[.078,.2,.082],ink)
    orb([0,-.15,.02],[.07,.13,.07],ink)
    plate([[-.071,.23],[.055,.25],[.082,.14],[.055,.02],[0,-.035],[-.07,.06]],.035,-.072,metal)
    plate([[-.06,.20],[.037,.22],[.055,.16],[0,.105],[-.067,.13]],.012,-.095,engine ? trim : c.secondary)
    for(let i=0;i<2;i++) block([0,.03-i*.034,-.065],[.12,.014,.035],joint)
    plate([[-.07,-.055],[0,-.025],[.07,-.055],[.06,-.14],[0,-.18],[-.06,-.14]],.05,-.077,trim)
    plate([[-.055,-.19],[.045,-.17],[.072,-.25],[.055,-.29],[-.06,-.29]],.025,-.07,metal)
    line([[0,.19,-.105],[-.025,.11,-.105]],c.color,.0035)
    line([[0,-.065,-.108],[.02,-.11,-.108],[0,-.14,-.108]],c.color,.004)
    block([0,-.25,.02],[.11,.1,.13],metal)
  } else {
    block([0,-.02,-.005],[.19,.055,.30],joint)
    plate([[-.085,-.015],[-.074,.065],[.055,.065],[.085,.005],[.07,-.037],[-.074,-.037]],.23,-.018,metal)
    block([0,.027,-.09],[.14,.05,.1],trim,[-.2,0,0])
    line([[-.07,.016,-.143],[0,.026,-.156],[.07,.016,-.143]],c.color,.003)
  }
  function finish(geometries) {
    if(!geometries.length) return new BufferGeometry()
    const merged=mergeGeometries(geometries)
    geometries.forEach(g=>g.dispose());merged.computeBoundingSphere();return merged
  }
  const result={armor:finish(base),lights:finish(light)}
  cache.set(key,result);return result
}
