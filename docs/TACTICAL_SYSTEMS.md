# Tactical systems

This update adds five playable features to the local training prototype. Weapon values live in `shared/weapons.js`; ability values live in `client/src/game/config.js`; no new dependencies or external assets are needed.

| Feature | Input | Behavior | Recovery |
| --- | --- | --- | --- |
| Plasma Shotgun | 4, then left click | 6 shells, 8 rays per blast, 14 base damage per pellet; 24-unit range | 0.8-second attack interval, 2.3-second reload |
| Dash | E | Move at 20 units/second for 0.18 seconds along WASD direction, or horizontally forward with no movement input | 3-second cooldown from activation |
| Energy Shield | F | Absorb up to 50 damage for 3.5 seconds; excess damage spills into health | 9-second cooldown from activation |
| Scanner | C | Reveal live targets within 40 units for 5 seconds, with HP/distance markers through cover | 10-second cooldown from activation |
| EMP Blast | V | Deal 40 damage to robots within an 8-unit sphere; jam electronics and disable nearby hazard pads for 4 seconds | 12-second cooldown from activation |

Shotgun spread is deterministic: one center pellet plus seven in a ring. Damage is full through 6 units, then decreases toward 35% at the range limit. Distance falloff is rounded per pellet, then head/body/limb/foot multipliers (2/1/0.75/0.5) are applied and rounded. Damage is capped by remaining health. Each ray hits the first solid surface; this prevents hitting through cover. All pellets resolve as one attack, one shell, and at most one accuracy hit. Multiple defeated targets may each award 100 points, but no target can award twice within the same blast.

Dash uses the existing Rapier capsule sweep and keeps gravity. Its duration is consumed in fixed physics steps, including a fractional final step, so slow rendering cannot cut the travel distance short. It cannot teleport through walls or cover. It does not grant damage immunity. Its camera field-of-view change and cyan edge feedback are cosmetic. Diagonal direction is normalized.

Shield does not restore health. Its bar decreases when hazard damage is absorbed, it stops protecting when depleted or expired, and a later activation replenishes it after cooldown. Try activating it before stepping onto an amber pad.

Scanner markers follow the camera smoothly without React state updates every frame. They reveal positions, HP, distance, and EMP status of live training targets even if cover blocks the normal view. Entities outside the viewport are not given misleading on-screen markers. Scanner does not allow firing through cover.

EMP is an area pulse from the player's activation position and intentionally affects electronics through cover. Jammed robot accents turn purple. Defeated jammed targets wait until both their normal respawn delay and the jam have expired before resetting. Nearby disabled hazard grids turn cyan and become harmless until the jam expires. The HUD reports when no electronics are in range.

Try this sequence: Dash toward cover, use Scanner to find targets beyond it, approach with the Shotgun, and fire at close range. At a hazard pad, use Shield to observe absorption, then EMP to switch the pad off. Its amber grid and damage return after four seconds.

Ability time and cooldowns freeze on pause. Abilities cannot activate while paused or defeated. Restart clears every active effect, cooldown, shield charge, target jam, hazard shutdown, and combat statistic.

## Multiplayer abilities

All four abilities now work online on the same E/F/C/V bindings and tuning. The server accepts only an ability ID plus sequence/arena generation; it derives origin, dash direction, duration, range, charge and damage. Dash uses the current validated movement direction, or horizontal aim when stationary, and cannot cross cover, walls or the opponent capsule. Control release or a disconnect cancels remaining dash travel.

Shield absorbs up to 50 weapon damage before health for 3.5 seconds. Head/limb multipliers still apply before absorption. Shield-only feedback shows the absorbed amount; mixed hits show actual HP removed with a separate shield amount. Opponents can see the barrier and dash trail. Scanner reveals a live opponent within 40 units, through cover, for five seconds with a projected name/HP/distance marker. It does not permit shooting through cover.

EMP affects living opponents within an 8-unit sphere from the server-owned player position, through cover. It removes Shield, deals 40 flat health damage, cancels active abilities and jams activation for four seconds. Weapons and normal movement still work while jammed. The HUD shows JAMMED and remaining disruption time. Empty casts still spend the 12-second cooldown.

Death cancels active effects while keeping cooldown deadlines; respawn does not refresh abilities. A fresh arena resets everything. Reconnect interruptions freeze ability timers alongside combat. Client visuals and cooldown tiles read synchronized server state.
