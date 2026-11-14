const finishes={
  phantom:{ body:'#233648',edge:'#95b7cf',accent:'#53cfff',style:'lance' },
  astral:{ body:'#30273f',edge:'#a898cd',accent:'#bc76ff',style:'lance' },
  hyperion:{ body:'#1b2c3e',edge:'#789db9',accent:'#58cfff' },
  railbreaker:{ body:'#38232c',edge:'#b87b86',accent:'#ff475d' },
  nova:{ body:'#21343d',edge:'#a4c4d1',accent:'#69d9ff',style:'talon' },
  striker:{ body:'#30213e',edge:'#a99bc9',accent:'#d576ff',style:'talon' },
  titan:{ body:'#263344',edge:'#91a5c2',accent:'#768fff',style:'crown' },
  omega:{ body:'#39272b',edge:'#b58b8f',accent:'#ff614e',style:'crown' },
  breach:{ body:'#1e3441',edge:'#96b9ca',accent:'#63ddff' },
  executor:{ body:'#30233b',edge:'#b396bd',accent:'#df79f9' },
  ravager:{ body:'#393228',edge:'#c6ab72',accent:'#ffbf47' },
  echo:{ body:'#21344a',edge:'#7fabc9',accent:'#59cfff' },
  magnus:{ body:'#30253d',edge:'#b3a3ce',accent:'#d18bff' },
  volt:{ body:'#393025',edge:'#c3ac7e',accent:'#ffce5e' },
  edge:{body:'#24364a',edge:'#a9c9d9',accent:'#38caff'},
  breaker:{body:'#3d3029',edge:'#c2a781',accent:'#ffb73e'},
  fangs:{body:'#30223f',edge:'#b59bcf',accent:'#c46aff'},
}
export const weaponFinish=weapon=>finishes[weapon.model] || { body:weapon.category==='SNIPER' ? '#293744' : '#303847',edge:'#8f9caa',accent:weapon.color,style:'lance' }

// Preserve the player's existing hologram palette independently of new skins.
const sightColors={phantom:'#8feaff',astral:'#bd96ff',nova:'#73ffda',striker:'#d576ff',titan:'#ffd17c',omega:'#ff937a'}
export const sightAccent=weapon=>sightColors[weapon.model] || weapon.color
