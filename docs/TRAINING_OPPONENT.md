# Archived drone prototype

The drone and Sparring entry were removed in the robot-target/validated-combat update. This document describes the earlier prototype for reference. Use [robot training controls](CONTROLS.md) or [online combat](ONLINE_ARENA.md) for the current game.

# Sparring drone

Choose **Enter Sparring** on the main menu, then **Resume / Enter Arena**. Normal **Enter Training** keeps the four stationary targets without an opponent. You can enable or disable the drone from the pause menu. Restart preserves your selected mode while clearing the run.

The drone hovers along a short diamond route in the north lane. It uses a Rapier capsule and character controller, so it collides with the arena and the player. It is a basic patrol opponent, not a full navigation or competitive AI.

| Setting | Value |
| --- | --- |
| Health | 100 HP |
| Patrol speed | 1.7 units/second |
| Detection / attack range | 18 units with clear sight |
| Attack warning | 1.1 seconds |
| Time between firing and next charge | 2.4 seconds |
| Energy pulse | 12 damage, 12 units/second, 3-second maximum lifetime |
| Defeat award | 200 points |
| Respawn delay | 6 seconds |

When you enter range with clear sight, the core turns red and the HUD displays **DRONE CHARGING**. A thin warning beam and a floor ring show the position it has locked. Its shot aims at your position when charging starts. Move sideways, Dash, or get behind cover before the visible pulse arrives. If you break sight during charging, it cancels the attack. The projectile travels through the world rather than applying instant unavoidable damage.

Drone sight and pulse collision use Rapier queries against the real scene colliders. A pulse sweeps its travel segment every fixed physics step, so walls, cover, target structures, and the player capsule can stop it. The drone's own body is excluded. Active pulse meshes use a fixed small pool without timers or React updates on every movement frame.

All four weapons damage the drone using the existing crosshair/raycast system and normal weapon rules. Shotgun pellets resolve as one attack and cannot award the same defeat twice. Its HP bar appears above the body and in the HUD. On defeat, it shrinks out, clears its pulses, and temporarily stops blocking movement. It respawns at its original position after six seconds with full health and a brief grace period. The run's score and defeat total remain until restart.

Ability interactions:

- **Shield (F):** absorbs incoming pulse damage using the same 50-point capacity as hazards; excess damage reaches health.
- **Scanner (C):** reveals the live drone through cover, showing current HP, distance, and EMP status.
- **EMP (V):** within eight units, deals 40 damage, jams the drone for four seconds, cancels its charge, and removes its active pulses. It cannot fire immediately when the jam ends.
- **Dash (E):** lets you sidestep the locked shot; collision and gravity still apply.

Pause/focus loss freezes the clock, patrol, attack warning, pulses, and respawn. Disabling the opponent removes its body and pulses. Restart clears HP damage, jams, projectiles, attacks, hits, defeats, score, ability usage, and ammunition, while keeping Sparring enabled if you selected it.

Tuning lives in `OPPONENT` in `client/src/game/config.js`. Pure AI decisions and lifecycle rules live in `game/opponents/opponentRules.js`; physical movement, collision queries, and pulse simulation live in `TrainingOpponent.jsx`. All damage is local prototype logic. Future online matches must use server-authoritative decisions and damage.
