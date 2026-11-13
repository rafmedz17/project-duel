import { schema, t } from '@colyseus/schema'
import { freshMagazines } from '../../../shared/weapons.js'

export const AbilityState = schema({
  flying:t.boolean().default(false),projectileX:t.number(),projectileY:t.number(),projectileZ:t.number(),detonatedAt:t.number().default(-10),
  readyAt:t.number().default(0),activeUntil:t.number().default(0),startedAt:t.number().default(-10),uses:t.number().default(0),result:t.number().default(0),
  originX:t.number().default(0),originY:t.number().default(0),originZ:t.number().default(0),directionX:t.number().default(0),directionZ:t.number().default(-1),
},'AbilityState')

export const ArsenalState=schema({
  secondaryWeapon:t.string().default('pistol'),meleeWeapon:t.string().default('blade'),spinStarted:t.number().default(-10),spinning:t.boolean().default(false),windupStart:t.number().default(-10),windupEnd:t.number(),knockX:t.number(),knockZ:t.number(),
  swings:t.number(),
  killCombo:t.number(),killAt:t.number().default(-10),killBadgeId:t.number(),killHeadshot:t.boolean().default(false),
  ...Object.fromEntries(Object.entries(freshMagazines()).filter(([id])=>!['pistol','rifle','shotgun'].includes(id)).map(([id,amount])=>[id+'Ammo',t.number().default(amount)])),
},'ArsenalState')

export const LobbyPlayer = schema({
  arsenal:ArsenalState,
  characterId:t.string().default('vex'),uniqueSkill:t.string().default('flashbang'),teamId:t.string().default(''),
  ultimateShield:t.number(),flashUntil:t.number(),flashStarted:t.number(),rootedUntil:t.number(),rooted:t.boolean().default(false),
  authenticated:t.boolean().default(false),startingWeapon:t.string().default(''),allowedWeapons:t.array('string'),allowedAbilities:t.array('string'),
  roundWins:t.number().default(0),
  abilities:t.map(AbilityState),disabledUntil:t.number(),shieldCharge:t.number(),shieldHit:t.number().default(-10),hitShieldDamage:t.number(),
  hp:t.number().default(100),weapon:t.string().default('pistol'),
  pistolAmmo:t.number().default(15),rifleAmmo:t.number().default(30),shotgunAmmo:t.number().default(6),
  reloading:t.boolean().default(false),reloadStart:t.number(),reloadEnd:t.number(),reloadReason:t.string(),
  attackReadyAt:t.number(),lastSwitch:t.number().default(-10),lastShot:t.number().default(-10),lastSwing:t.number().default(-10),shot:t.number(),
  hit:t.number().default(-10),hitId:t.number(),hitDamage:t.number(),hitDefeated:t.number(),hitHeadshot:t.boolean().default(false),hurt:t.number().default(-10),
  kills:t.number(),deaths:t.number(),respawnAt:t.number(),
  name:t.string(),
  slot:t.number(),
  ready:t.boolean().default(false),
  connected:t.boolean().default(true),
  x:t.number(),y:t.number(),z:t.number(),yaw:t.number(),pitch:t.number(),
  grounded:t.boolean().default(false),active:t.boolean().default(false),inputSequence:t.number().default(-1),
  inputSteps:t.number(),vx:t.number(),vy:t.number(),vz:t.number(),dashRemaining:t.number(),dashX:t.number(),dashZ:t.number(),
  combatSequence:t.number().default(-1),
},'LobbyPlayer')
// Keep combat code independent of the wire layout; the added arsenal state is nested
// to stay within Colyseus' per-schema field limit.
for (const key of ['secondaryWeapon','meleeWeapon','spinStarted','spinning','windupStart','windupEnd','swings','knockX','knockZ','killCombo','killAt','killBadgeId','killHeadshot',...Object.keys(freshMagazines()).filter(id=>!['pistol','rifle','shotgun'].includes(id)).map(id=>id+'Ammo')]) Object.defineProperty(LobbyPlayer.prototype,key,{
  get() { return this.arsenal[key] },set(value) { this.arsenal[key]=value },configurable:true,
})


export const RoundResult = schema({ number:t.number(),winnerId:t.string(),reason:t.string() },'RoundResult')
export const MatchResultPlayer = schema({ id:t.string(),name:t.string(),slot:t.number(),roundWins:t.number(),kills:t.number(),deaths:t.number() },'MatchResultPlayer')

export const LobbyState = schema({
  mapId:t.string().default('facility'),ranked:t.boolean().default(false),saveStatus:t.string().default(''),resultRanked:t.boolean().default(false),
  format:t.string().default('duel'),matchPhase:t.string().default('idle'),
  roundNumber:t.number().default(0),roundId:t.number().default(0),roundRemaining:t.number().default(0),phaseRemaining:t.number().default(0),
  roundWinnerId:t.string().default(''),winnerId:t.string().default(''),matchReason:t.string().default(''),
  roundResults:t.array(RoundResult),results:t.array(MatchResultPlayer),
  code:t.string(),
  hostId:t.string(),
  phase:t.string().default('waiting'),
  players:t.map(LobbyPlayer),
  arenaActive:t.boolean().default(false),
  arenaEpoch:t.number().default(0),tick:t.number().default(0),countdown:t.number().default(0),note:t.string().default(''),
},'LobbyState')
