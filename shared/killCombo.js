export const KILL_COMBO_WINDOW = 6
export const KILL_BADGE_SECONDS = 2.4
export const KILL_TIERS = ['ELIMINATION','DOUBLE KILL','TRIPLE KILL','OVERDRIVE','RAMPAGE']
export const killTier = count => Math.max(1,Math.min(5,count || 1))
export function awardKill(state,time,defeated,headshot=false) {
  if (!Number.isInteger(defeated) || defeated<=0) return {}
  const continuing=(state.killCombo || 0)>0 && time>=state.killAt && time-state.killAt<=KILL_COMBO_WINDOW
  return { killCombo:(continuing ? state.killCombo : 0)+defeated,killAt:time,killBadgeId:(state.killBadgeId || 0)+1,killHeadshot:headshot }
}
