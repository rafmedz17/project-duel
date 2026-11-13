export const DEFAULT_AUDIO = Object.freeze({ volume:0.55,muted:false,sfxVolume:1,musicVolume:0.25 })
export function audioSettings(value = {}) {
  const level=key=>typeof value[key]==='number' && Number.isFinite(value[key]) ? Math.max(0,Math.min(1,value[key])) : DEFAULT_AUDIO[key]
  return { volume:level('volume'),muted:value.muted===true,sfxVolume:level('sfxVolume'),musicVolume:level('musicVolume') }
}
