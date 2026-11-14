const paths={
  dash:<><path d="m20 10 14 14-14 14M10 12l12 12-12 12M5 18h6M3 24h7M5 30h6"/><path d="m32 10 10 14-10 14" opacity=".55"/></>,
  shield:<><path d="m24 5 15 6v12c0 10-15 19-15 19S9 33 9 23V11Z"/><path d="m24 12 8 3v8c0 5-8 11-8 11s-8-6-8-11v-8Z"/><path d="M24 17v11M19 22h10"/></>,
  flashbang:<><path d="m24 9 4 10 11 5-11 4-4 11-4-11-11-4 11-5Z"/><path d="M24 2v3M24 43v3M2 24h3M43 24h3M8 8l5 5M35 35l5 5M8 40l5-5M35 13l5-5"/></>,
  smoke:<><path d="M12 34a8 8 0 0 1-1-16 11 11 0 0 1 21-3 9 9 0 0 1 3 18M8 39h30M14 44h18"/><path d="M15 26c6-8 12-8 18 0-6 8-12 8-18 0Z"/><circle cx="24" cy="26" r="2.5"/></>,
  stun:<><path d="M8 11v9M40 11v9M8 34v6h10M40 34v6H30M13 35h22M17 10v17l-4 4v4M29 10v17l6 4"/><path d="m26 5-7 12h8l-4 10 12-15h-9l4-7"/></>,
  scanner:<><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="10" opacity=".55"/><path d="M24 24 36 12M24 3v6M24 39v6M3 24h6M39 24h6"/><circle cx="24" cy="24" r="3"/><circle cx="15" cy="16" r="2" fill="currentColor" stroke="none"/></>,
  'ultimate-dash':<><path d="m24 4 7 15 12-6-8 19-11 12-11-12-8-19 12 6Z"/><path d="m20 17 9 7-9 7M13 31l11 13 11-13"/></>,
  'ultimate-shield':<><path d="m24 10 15 6v9c0 9-15 18-15 18S9 34 9 25v-9Z"/><path d="m10 10-3-7 10 5 7-5 7 5 10-5-3 7M24 18v17M16 26h16"/></>,
  'ultimate-ammo':<><path d="M12 9h24v30H12zM19 4h10M19 44h10M7 16h5M36 16h5M7 32h5M36 32h5"/><path d="M24 24c-11-14-17 10-6 6l12-12c11-4 5 20-6 6Z"/></>,
  'ultimate-power':<><path d="m28 3-17 24h12l-3 18 18-26H26Z"/><path d="M12 9 5 16v16l7 7M36 9l7 7v16l-7 7" opacity=".65"/></>,
}

export default function SkillIcon({id,effect}) {
  const glyph=id==='ultimate' ? `ultimate-${effect}` : id
  return <svg data-skill-icon={glyph} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[glyph] || paths.scanner}</svg>
}
