import {WEAPONS} from '../../../shared/weapons.js'

export const KILL_FEED_VISIBLE_MS=3000
export const KILL_FEED_FADE_MS=300
export const KILL_FEED_LIFETIME=KILL_FEED_VISIBLE_MS+KILL_FEED_FADE_MS
export const KILL_FEED_LIMIT=6

export function appendKill(feed,event,now) {
  if(!event || !Number.isSafeInteger(event.sequence) || event.sequence<1 || !Object.hasOwn(WEAPONS,event.weapon) || !['attackerId','targetId','attacker','target'].every(key=>typeof event[key]==='string' && event[key].length>0)) return feed
  const key=`${event.epoch}:${event.round}:${event.sequence}`
  if(feed.some(row=>row.key===key)) return feed
  return [...feed.filter(row=>row.expiresAt>now),{...event,key,expiresAt:now+KILL_FEED_LIFETIME}].slice(-KILL_FEED_LIMIT)
}
