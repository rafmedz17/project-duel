import {lazy,Suspense,useState} from 'react'
import {WEAPONS} from '../../../shared/weapons.js'
import {ABILITIES} from '../../../shared/abilities.js'
import {getCharacter,ULTIMATE_DURATION} from '../../../shared/characters.js'
import CharacterPortrait from '../game/characters/CharacterPortrait.jsx'

const ArsenalPreview=lazy(()=>import('../game/weapons/ArsenalPreview.jsx'))

export function WeaponGlyph({id}) {
  const w=WEAPONS[id],melee=w.category==='MELEE',pistol=w.category==='PISTOL'
  return <svg className="equipment-glyph" viewBox="0 0 240 100" aria-hidden="true" style={{color:w.color}}>
    <path d="M12 82H228M22 18V25M218 18V25" fill="none" stroke="currentColor" opacity=".18"/>
    {melee ? id==='gravity' ? <><path d="M100 30L113 23L148 79L140 85Z" fill="#586e82"/><path d="M74 15L103 7L132 33L109 53L77 37Z" fill="#233e54" stroke="currentColor"/><path d="M86 20L108 38M95 15L117 32" stroke="currentColor" strokeWidth="4"/></> : <>{[0,...(id==='fangs' ? [58] : [])].map(offset=><g key={offset} transform={`translate(${offset} 0)`}><path d="M64 77L142 13L131 42L85 76Z" fill="#476179" stroke="currentColor"/><path d="M85 67L142 13" stroke="currentColor" strokeWidth="3"/><path d="M59 73L74 85M67 80L55 92" stroke="#91a9be" strokeWidth="5"/></g>)}</> : <>
      {!pistol && <path d="M24 42L65 37L75 61L30 68Z" fill="#20364b" stroke="#58758e"/>}
      <path d={pistol ? 'M77 30L158 30L174 38L171 53L113 54L105 80L87 76L92 53L77 51Z' : 'M60 31L147 25L165 35L173 53L139 62L73 59Z'} fill="#2e4b64" stroke="#718ba2"/>
      <path d={pistol ? 'M91 37H158M112 48H143' : 'M75 38L133 34L143 42L83 46Z'} fill="currentColor" opacity=".85"/>
      {!pistol && <><path d="M149 36H212V49H157Z" fill="#15283a" stroke="#58758e"/><path d="M202 34H219V51H202Z" fill="#344e63"/><path d="M96 58L110 58L105 81L88 78Z" fill="#1c3145" stroke="#58758e"/><path d="M123 57L140 55L149 76L130 81Z" fill="#344e63"/><path d="M79 25L92 16H119V27" fill="#273d52" stroke="currentColor"/>{w.category==='LMG' && <circle cx="140" cy="69" r="17" fill="#20364b" stroke="currentColor"/>}{w.category==='SNIPER' && <path d="M104 15H144V24H104Z M215 40H237" fill="#253b51" stroke="currentColor"/>}</>}
      <path d={pistol ? 'M155 35V48' : 'M177 38V47M186 38V47M195 38V47'} stroke="currentColor" opacity=".7"/>
    </>}
  </svg>
}

export function SkillGlyph({id}) {
  const paths={flashbang:'M32 5L36 24L53 15L43 31L59 36L41 40L45 57L32 45L18 57L23 40L5 35L23 29L14 14L28 24Z',smoke:'M19 42C4 41 8 23 22 25C19 10 42 8 43 24C58 21 63 41 47 43M16 50H49M23 57H42',stun:'M10 22H26L22 40H39L34 58L55 31H38L44 12H28',scanner:'M32 8V15M32 49V56M8 32H15M49 32H56M32 32L45 19',ultimate:'M32 5L53 17V43L32 57L11 43V17ZM22 23L32 17L42 23L32 44Z'}
  return <svg className="skill-glyph" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{id==='scanner' && <><circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="9"/></>}<path d={paths[id] || paths.ultimate} strokeLinejoin="round" strokeLinecap="round"/></svg>
}

export default function LoadoutDetails({item,compact=false,animate=true}) {
  const [mode,setMode]=useState('inspect')
  const weapon=item.type==='weapon' ? WEAPONS[item.id] : null
  const character=getCharacter(item.id),ability=ABILITIES[item.id],ultimate=item.type==='ultimate'
  const title=weapon?.name || (ultimate ? character.ultimate : item.type==='character' ? character.name : ability.name)
  const color=weapon?.color || (ultimate || item.type==='character' ? character.color : ability.color)
  const description=weapon?.description || (ultimate ? character.detail : item.type==='character' ? character.description : ability.description)
  const stats=weapon ? [['DAMAGE',weapon.pellets ? `${weapon.damage} × ${weapon.pellets}` : weapon.damage],['FIRE RATE',weapon.burst ? '3-ROUND BURST' : `${weapon.rpm} RPM`],...(weapon.magazine ? [['MAGAZINE',weapon.magazine],['RELOAD',`${weapon.reload.toFixed(1)}s`],['ACCURACY',`${weapon.accuracy}/100`]] : [['REACH',`${weapon.range}m`]]),['MOVEMENT',`${Math.round(weapon.movement*100)}%`]] : ultimate || item.type==='character' ? [['ULTIMATE',character.ultimate],['DURATION',`${ULTIMATE_DURATION}s`],['COOLDOWN','45s'],['ROLE',character.role]] : [['DURATION',`${ability.duration}s`],['COOLDOWN',`${ability.cooldown}s`],['RANGE',item.id==='scanner' ? 'GLOBAL' : `${ability.radius}m`]]
  return <section className={`loadout-details ${compact ? 'compact-details' : ''}`} style={{'--detail-color':color}} aria-label={`${title} details`}>
    <div className="loadout-detail-art">{weapon ? <>{animate ? <Suspense fallback={<span className="preview-loading">ASSEMBLING…</span>}><ArsenalPreview id={item.id} mode={mode}/></Suspense> : <WeaponGlyph id={item.id}/>}<div className="detail-preview-controls">{['inspect','fire','reload'].map(action=><button type="button" key={action} disabled={action==='reload' && !weapon.magazine} aria-pressed={mode===action} onClick={()=>setMode(action)} aria-label={`Preview ${action}`}>{action.toUpperCase()}</button>)}</div></> : item.type==='character' ? <CharacterPortrait characterId={item.id}/> : <SkillGlyph id={ultimate ? 'ultimate' : item.id}/>}</div>
    <div className="loadout-detail-copy"><span className="loadout-kicker">{weapon?.category || (ultimate ? `${character.name} / ULTIMATE` : item.type==='character' ? 'OPERATIVE PROFILE' : 'UNIQUE SKILL')}</span><h3>{title}</h3><p>{description}</p><dl className="loadout-specs">{stats.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
  </section>
}
