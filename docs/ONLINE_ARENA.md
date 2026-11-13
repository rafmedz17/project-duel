# Shared online arena and validated combat

Two players share the same facility. The Node/Colyseus server owns movement, collision, weapon state, shot validation, damage, kills, death, respawn, all four abilities, and Best of Three matches. Local training uses the same weapon values and robot geometry, with four stationary robot targets and no drone.

## Play

From the project root, run `npm.cmd run dev:server` and `npm.cmd run dev:client` in separate terminals. Install dependencies in `server` and `client` first if needed. Restart an older backend after source updates. For two computers, see [LAN setup](PRIVATE_LOBBIES.md#two-computers-on-the-same-network).

1. Choose **Multiplayer**, create a room, and share its code. Join from another browser/computer.
2. The host selects Best of Three (default) or Free Play. Changing format resets both ready flags. Both select **Ready Up**. The host selects **Start Shared Arena**. A three-second countdown precedes opposite spawns.
3. Select **Enter Arena** in each browser to capture the mouse. WASD moves, mouse aims, Shift sprints, Space jumps, and left click attacks.
4. Select primary/pistol/melee with **1 / 2 / 3**, cycle with **Q**, and reload with **R**. Hold left click for the rifle. Empty magazines automatically reload. The first-person weapon animates firing, switching, melee, and reloads from server state.
5. Head hits deal 2× damage, torso 1×, arms/legs 0.75×, feet 0.5×. The pistol deals 40/20/15/10. Each shotgun pellet uses its hit region after distance falloff. Cover blocks hits. HUD markers and damage numbers confirm actual server-removed health (shield-only impacts show absorbed damage); headshots and eliminations have distinct labels.
6. Health starts at 100. In Free Play, killed players disappear, cannot move/fire, and respawn at their original spawn after three seconds with a fresh pistol/loadout. Best of Three ends the round on elimination, with no respawn until the next round. Kills/deaths persist until a new arena starts.
7. Escape releases your mouse and clears your controls. The other player can keep playing, and you remain vulnerable. Switching tabs also releases controls. Only the focused tab accepts mouse capture/input when testing on one computer.
8. In Free Play, **Return to Lobby** ends practice for both. In Best of Three, **Forfeit Match** concedes to the opponent; after results, **Return to Lobby** allows a rematch. Ready again to reset positions, health, loadouts, timers, and scores. **Leave Room** returns to the main menu.

The host chooses Best of Three or Free Play. Training targets and hazard pads are absent online. Use E Dash, F Shield, C your unique skill and X your character ultimate. All four equipped abilities are validated by the server.

## Connection behavior

A socket drop freezes the shared simulation and displays **Connection Interrupted**. Movement, reloads, ability/cooldown durations, and respawn clocks stop. Both clients clear held inputs. Reconnection within 15 seconds preserves the current arena; recapture the mouse to continue. Page refresh restores that reserved seat using a per-tab session token, preserving combat and scores. Explicit Leave clears recovery. Expired seats show a lobby error; server restarts discard rooms. Permanent departure/expiration awards a forfeit in Best of Three, preserving both scoreboard rows on the results screen; Free Play returns the remaining player to the lobby.

Releasing only your own mouse stops your controls without pausing the shared world. A 250 ms movement deadman clears stale held movement/jumps. Fire uses individual intents rather than a persistent server-side trigger, so a stopped stream cannot keep firing.

## Server validation

- `shared/arena.js` defines facility solids, movement, capsules and network rates. Rapier movement runs at fixed 60 Hz. Clients cannot choose simulation time, speed, positions, or velocities.
- `shared/weapons.js` defines all four weapons, magazine sizes, recovery, reload time, range, falloff and regional multipliers. Server and offline practice import it.
- `shared/robot.js` defines the rendered boxes and matching hit volumes for head, torso, arms, legs and feet. `shared/ballistics.js` intersects rays against the yaw-rotated robot, including head pitch. Shots can pass through visible gaps between limbs.
- A combat intent contains a monotonic sequence, arena generation, round generation, and action. Fire adds yaw/pitch; switch adds a valid weapon ID; ability adds a valid ability ID. Reload adds no other fields. Unknown fields, invalid types/aims, replayed sequences, and old-arena generations are rejected. Origin, target, damage, hit zone, health, ammo and player identity are never accepted from the client.
- The server derives the origin from its current shooter position plus eye height. It checks alive/connected state, equip recovery, shared weapon cooldown, reload state, and ammo before accepting an attack. Misses spend ammo/recovery too. Accepted fire is ray-tested against static cover and the nearest living opponent's robot parts; shotgun rays resolve independently and aggregate actual health removed once per target.
- Death awards exactly one kill, disables movement collision for the dead body, and schedules a three-second respawn. Dead players cannot attack or move. Respawn restores the body at its slot's spawn and resets weapons; kills/deaths remain.
- Switching preserves independent magazines and cancels incomplete reloads. An empty re-equipped firearm auto reloads after equip recovery. Melee swings must finish before switching; switching never clears previous attack recovery.
- Returning to lobby disposes the room's physics world. Re-entry creates a fresh generation and resets combat. The room clock remains active for later countdowns/reservations.

## Rendering and limits

Server patches arrive at 20 Hz. Local look and movement respond immediately. The client predicts capsule movement at 60 Hz using the shared server controller, then restores acknowledged state and replays pending steps. Small corrections smooth out; large corrections snap. Other players interpolate across a 100 ms history. Position histories stay outside React, while the combat HUD receives authoritative snapshots. Released arena views render on invalidation. See [movement/recovery/performance details](NETWORK_AND_PERFORMANCE.md).

There is no lag compensation/hit rewind yet. The server tests opponents at their current authoritative pose, so high latency and remote interpolation can affect shots against moving players. Hands-on balancing and laptop performance checks remain. [Combat audio](AUDIO_SYSTEM.md) follows confirmed state, with spatial opponent sounds. [Accounts and persistent results](ACCOUNTS_AND_RANKINGS.md) are optional through Supabase.

## Verification

From root: `npm.cmd run lint:server`, `npm.cmd run test:server`. From `client`: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd test`, `npm.cmd run test:browser`.

The backend cases cover room lifecycle, capacity, ready/countdown/re-entry, movement/collision, malformed/forged/replayed inputs, weapon timing, regional hits, respawns, abilities and reconnect-frozen clocks. They also verify accounts, loadout enforcement, new map collision, PostgreSQL RLS and idempotent result transactions. The 31 local cases include rendered-box versus authoritative-volume agreement across rotated/tilted robots. The browser suite covers regional hits, two-browser combat, abilities, complete matches, map selection, connection lifecycle and fixture-backed account flows. See the account guide for live-cloud setup and test boundaries.

## Online abilities

E/F/C/X activate Dash, Shield, the equipped unique skill and character ultimate. See [characters and loadouts](CHARACTERS_AND_LOADOUT.md) for full rules. The server derives grenade origin, collision, fuse, targets and effect deadlines. Cooldown spam, extra equipment, unavailable weapons, replayed sequences, old rounds and dead/disconnected senders are rejected.

Every ultimate lasts five seconds. Flashbang can blind the thrower and enemies but never teammates; stun roots only enemies and leaves aiming/firing available. Smoke reveals enemy silhouettes to its thrower through the cloud, with solid cover respected. Global Scan reveals enemies anywhere in the arena through cover. AEGIS bonus shield and general Shield have separate capacities and expirations.

Active effects stop on death; cooldown deadlines persist across Free Play respawns. New rounds and re-entry reset them. Connection interruptions freeze the shared clock. The HUD displays active effect countdowns, shield charge, flash and root feedback. Visible grenades, clouds, barriers, character auras and enemy silhouettes follow server snapshots.

## Best of Three

Best of Three is the default lobby format. The server awards a round on elimination, or to the player with higher actual HP after 90 seconds. Equal HP is a draw, awards no points, and replays the same numbered round. First to two round wins decides the match; there are at most three scored rounds, with draw replays allowed.

Each non-final result displays for four seconds. The next round then resets both spawns/view directions, HP, independent magazines, weapon selection, ability cooldowns/effects and held inputs. A shared three-second countdown blocks all movement, attacks and abilities before play resumes. Kills/deaths and round wins remain on the scoreboard. Old-round movement and combat packets are rejected, including packets delayed across a draw replay.

The HUD shows round number, round wins, timer, player scoreboard and round countdown/result. Winning the match displays VICTORY; the other player sees DEFEAT with the same authoritative scoreboard. Forfeit Match and permanent departure concede to the remaining player. A socket drop first freezes the current round, timer or intermission for the 15-second reconnect window; recovery preserves scores. Scoreboard names survive permanent departure. New players cannot enter until Return to Lobby clears the result.

Return to Lobby after results, then both ready up to play a fresh rematch. Room codes and members remain; the new arena generation resets all scores and results. Signed-in Best of Three results save through the server to Supabase when configured, with a durable retry queue and optional Elo ranking. Guest-only results remain in memory. Free Play retains unlimited three-second respawns. See [account setup, maps and ranking rules](ACCOUNTS_AND_RANKINGS.md).
