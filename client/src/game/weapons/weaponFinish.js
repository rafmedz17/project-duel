const finishes={
  phantom:{ body:'#25313d',edge:'#778b9c',accent:'#8feaff',style:'lance' },
  astral:{ body:'#302b43',edge:'#a39bb7',accent:'#bd96ff',style:'lance' },
  nova:{ body:'#233b3c',edge:'#85b4ab',accent:'#73ffda',style:'talon' },
  striker:{ body:'#31223d',edge:'#9d8aaf',accent:'#d576ff',style:'talon' },
  titan:{ body:'#34352d',edge:'#a49a7d',accent:'#ffd17c',style:'crown' },
  omega:{ body:'#3b2b2e',edge:'#aa8a81',accent:'#ff937a',style:'crown' },
}
export const weaponFinish=weapon=>finishes[weapon.model] || { body:weapon.category==='SNIPER' ? '#293744' : '#303847',edge:'#8f9caa',accent:weapon.color,style:'lance' }
