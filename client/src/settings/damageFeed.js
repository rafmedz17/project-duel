export const emptyDamageFeed=()=>({ generation:null,hitId:0,time:-10,snapshotTime:-10,entries:[],total:0 })
export function advanceDamageFeed(previous,state) {
  // Combat timestamps can be slightly ahead of tick / tickRate after floating
  // point accumulation or network encoding. Compare snapshot clocks to detect
  // a rewind; using the last hit time here makes the same hit reset forever.
  const reset=previous.generation!==state.generation || state.time<previous.snapshotTime
  const feed=reset ? emptyDamageFeed() : previous
  if(!reset && state.hitId===feed.hitId) return feed
  const entries=feed.entries.filter(hit=>state.time-hit.time<.8),amount=Math.round(state.hitDamage || state.hitShieldDamage || 0)
  const accepted=state.hitId>0 && state.time-state.hit<.8 && amount>0
  const total=accepted ? (state.hit-feed.time<.8 ? feed.total : 0)+amount : 0
  return { generation:state.generation,hitId:state.hitId,time:accepted ? state.hit : state.time,snapshotTime:state.time,entries:accepted ? [...entries,{ id:state.hitId,time:state.hit,amount }].slice(-5) : entries,total }
}
