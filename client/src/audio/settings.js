export const DEFAULT_AUDIO = Object.freeze({ volume:0.55,muted:false })
export function audioSettings(value = {}) {
  return { volume:typeof value.volume==='number' && Number.isFinite(value.volume) ? Math.max(0,Math.min(1,value.volume)) : DEFAULT_AUDIO.volume,muted:value.muted===true }
}
