import { getCharacter } from '../../../../shared/characters.js'

const portraits={
  vex:new URL('../../assets/characters/vex.webp',import.meta.url).href,
  aegis:new URL('../../assets/characters/spectra.webp',import.meta.url).href,
  ion:new URL('../../assets/characters/zero.webp',import.meta.url).href,
  raze:new URL('../../assets/characters/axiom.webp',import.meta.url).href,
}

export default function CharacterPortrait({ characterId, className = '' }) {
  const character=getCharacter(characterId)
  return <img className={`character-portrait ${className}`} src={portraits[characterId] || portraits.vex} alt={`${character.name} character portrait`} loading="lazy" decoding="async" width="1024" height="1536" style={{objectFit:'contain'}}/>
}
