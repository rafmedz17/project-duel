import { schema, t } from '@colyseus/schema'

export const AbilityState = schema({
  readyAt:t.number().default(0),activeUntil:t.number().default(0),startedAt:t.number().default(-10),uses:t.number().default(0),result:t.number().default(0),
  originX:t.number().default(0),originY:t.number().default(0),originZ:t.number().default(0),directionX:t.number().default(0),directionZ:t.number().default(-1),
},'AbilityState')

export const LobbyPlayer = schema({
  authenticated:t.boolean().default(false),startingWeapon:t.string().default(''),allowedWeapons:t.array('string'),allowedAbilities:t.array('string'),
  roundWins:t.number().default(0),
  abilities:t.map(AbilityState),disabledUntil:t.number(),shieldCharge:t.number(),shieldHit:t.number().default(-10),hitShieldDamage:t.number(),
  hp:t.number().default(100),weapon:t.string().default('pistol'),
  pistolAmmo:t.number().default(12),rifleAmmo:t.number().default(30),shotgunAmmo:t.number().default(6),
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
