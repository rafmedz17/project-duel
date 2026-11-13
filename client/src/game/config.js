export { PLAYER, COVER } from '../../../shared/arena.js'
export { PISTOL, BLADE, RIFLE, SHOTGUN, WEAPONS, WEAPON_IDS, WEAPON_SWITCH } from '../../../shared/weapons.js'
export { ABILITIES } from '../../../shared/abilities.js'
export { TARGET_POSITIONS as TARGETS } from './training/config.js'
export const TARGET = { health: 100, reset: 3 }
export const OPPONENT = {
  id: 'opponent', health: 100, score: 200, respawn: 6,
  spawn: [0,1.15,-9], patrol: [[0,-9],[-4,-10],[0,-12],[4,-10]], speed: 1.7,
  range: 18, windup: 1.1, attackInterval: 2.4, grace: 1.5,
  damage: 12, projectileSpeed: 12, projectileLifetime: 3, maxProjectiles: 6,
}
export const HAZARD = { centers: [-15,15], z: 3, halfSize: 1.5, damage: 10, interval: 0.75 }

