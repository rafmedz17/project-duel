import { getCharacter } from '../../../../shared/characters.js'

export default function CharacterPortrait({ characterId, className = '' }) {
  const c = getCharacter(characterId), heavy = c.motif==='warden'
  return <svg className={`character-portrait ${className}`} viewBox="0 0 300 400" role="img" aria-label={`${c.name} character portrait`}>
    <defs><linearGradient id={`armor-${c.number}`} x2="1" y2="1"><stop stopColor="#53617a"/><stop offset=".5" stopColor={c.armor}/><stop offset="1" stopColor="#101c2d"/></linearGradient></defs>
    <circle cx="150" cy="170" r="117" fill="none" stroke={c.color} opacity=".16"/><circle cx="150" cy="170" r="104" fill="none" stroke={c.color} opacity=".1" strokeDasharray="3 12"/>
    <path d="M20 340L280 60M20 360L280 80" stroke={c.color} opacity=".08"/>
    <g fill={`url(#armor-${c.number})`} stroke="#778aa0" strokeWidth=".8">
      <path d="M102 236L146 249L142 359L112 382L90 369Z M154 249L198 236L210 369L188 382L158 359Z"/>
      <path d="M98 355L140 350L139 383L86 389L84 378Z M160 350L202 355L216 378L214 389L161 383Z"/>
      <path d={heavy ? 'M65 132L101 112L117 143L95 222L66 259L42 240L53 169Z' : 'M80 134L108 123L112 153L87 239L67 259L51 247L62 183Z'}/>
      <path d={heavy ? 'M235 132L199 112L183 143L205 222L234 259L258 240L247 169Z' : 'M220 134L192 123L188 153L213 239L233 259L249 247L238 183Z'}/>
      <path d="M104 117L130 107L170 107L196 117L202 187L184 239L151 255L116 239L98 187Z"/>
      <path d="M103 122L150 140L197 122L190 178L150 197L110 178Z" fill={c.armor}/>
      <path d="M118 41L150 31L182 41L194 70L187 104L171 119L129 119L113 104L106 70Z"/>
    </g>
    <g fill="none" stroke={c.color} strokeWidth="3">
      {c.motif==='runner' ? <><path d="M115 68L150 84L185 68M123 74L150 97L177 74"/><path d="M112 148L145 169L122 181M188 148L155 169L178 181"/></> : c.motif==='warden' ? <><path d="M116 74H184M150 42V100"/><path d="M150 149L173 161V181L150 197L127 181V161Z"/></> : c.motif==='engine' ? <><circle cx="150" cy="77" r="20"/><circle cx="150" cy="168" r="19"/><path d="M150 139V151M150 185V205M121 168H133M167 168H179"/></> : <><path d="M119 61L138 86M141 59L160 84M163 57L181 82"/><path d="M120 151L133 172M143 147L156 168M166 143L179 164"/></>}
      <path d="M111 267L115 326M189 267L185 326M69 185L64 219M231 185L236 219" opacity=".65"/>
    </g>
    <g fill={c.color}><path d="M106 216L133 225L130 231L104 223Z M194 216L167 225L170 231L196 223Z"/><path d="M112 368L131 365V372L109 377Z M188 368L169 365V372L191 377Z"/></g>
    <text x="245" y="368" fill={c.color} opacity=".2" fontFamily="monospace" fontSize="42">{c.number}</text>
  </svg>
}
