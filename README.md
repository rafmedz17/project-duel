# PROJECT DUEL

A playable FPS training facility and private two-player arena built with React, Three.js, React Three Fiber, Rapier, and Colyseus. Training has four robot targets, four weapons, four abilities, hazards, scoring, and saved settings. Multiplayer now has server-owned movement, weapons, hit validation, damage, kills, respawns, all four abilities, and best-of-three matches. Training works without a backend or account.

## Launch

Use Node.js 22 or newer. If dependencies are missing, run `npm.cmd install` separately in `client` and `server`. From the project root, use separate terminals:

```powershell
npm.cmd run dev:client
```

```powershell
npm.cmd run dev:server
```

Open the Vite address (normally http://localhost:5173). The server is only needed for Multiplayer. `npm.cmd` avoids Windows PowerShell's script execution policy issue; other shells can use `npm`.

Choose **Enter Training**, then **Resume / Enter Arena**. WASD moves, the mouse aims, Shift sprints, Space jumps, and left click attacks. Select pistol/blade/rifle/shotgun with **1–4**, cycle with **Q**, and reload with **R**. Hold left click for the rifle. Escape releases the mouse and pauses training. Focus loss also pauses it.

The practice drone and Sparring entry have been removed. Four stationary robots use the same model and body proportions as multiplayer players. They stand on raised platforms so torso shots remain visible above low cover. Each has 100 HP, awards 100 points when defeated, and resets after three seconds. Approach beyond cover to practice foot shots.

| Hit region | Damage multiplier | Pistol example |
| --- | --- | --- |
| Head | 2× | 40 |
| Torso | 1× | 20 |
| Arms / legs | 0.75× | 15 |
| Feet | 0.5× | 10 |

All four weapons use these multipliers; shotgun falloff is applied before regional scaling and rounding. The number shown is actual remaining HP removed. Headshots show coral feedback and **HEADSHOT**; defeats show **ELIMINATED**. Cover blocks shots. EMP remains a flat area pulse, without a headshot multiplier.

Firearms keep separate magazines and unlimited reserve ammo. Empty magazines auto reload, with a weapon/cell animation, notice, progress bar, and countdown. R reloads partial magazines. Switching cancels a reload without refilling it; re-equipping an empty firearm starts again after the equip delay. The shotgun has only a dotted ring crosshair.

Training abilities: **E** Dash, **F** Shield, **C** Scanner, **V** EMP. Amber pads deal damage; Shield absorbs it and EMP temporarily disables pads. Restart restores health, weapons, targets, score, abilities, and timers. Settings save sensitivity, quality, and FPS visibility locally. See [controls](docs/CONTROLS.md) and [tactical systems](docs/TACTICAL_SYSTEMS.md).

## Multiplayer

Choose **Multiplayer**, create a room, and share its code with a second browser or computer. Both players select **Ready Up**, then the host selects **Start Shared Arena**. After the three-second countdown, select **Enter Arena** to capture the mouse. The same movement and weapon controls work online.

The server validates shot origin from its own player position, range, cover, robot hit region, cooldown, magazine, reload, and equip recovery. Clients send aim and actions, never hit results or damage. Players have 100 HP. Free Play respawns eliminated players after three seconds; Best of Three keeps them eliminated until the next round. The HUD shows health, shield charge, ammo, confirmed damage/headshots, cooldowns, scanner markers, EMP jam status, and kills/deaths. Use **E** Dash, **F** Shield, **C** Scanner and **V** EMP online too. The server owns cooldowns and effects. Shield absorbs up to 50 damage; EMP deals 40 damage within 8 units, strips shields and jams abilities for four seconds. The host selects **Best of Three** (default) or **Free Play** in the lobby. Best of Three is first to two round wins, with a scoreboard, 90-second rounds, four-second results and three-second round countdowns. Elimination ends a round; at timeout higher HP wins, and equal HP replays the round. New rounds restore spawns, health, all magazines and abilities. Free Play retains three-second respawns.

Escape releases your own controls while the opponent can keep playing. A connection interruption pauses the shared simulation, including reload and respawn timers. A reconnect within 15 seconds preserves the arena. In Best of Three, **Forfeit Match** concedes to the opponent; permanent departure also awards a forfeit. The victory/defeat screen preserves both scoreboard rows. **Return to Lobby** after a match lets both players ready up for a fresh rematch. In Free Play, Return to Lobby ends the practice session for both. See [lobby/LAN setup](docs/PRIVATE_LOBBIES.md) and [online combat details](docs/ONLINE_ARENA.md).

## Verification

From `client`:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd run test:browser
```

From the root:

```powershell
npm.cmd run lint:server
npm.cmd run test:server
```

There are 31 local combat/geometry/physics tests, 40 backend tests, and 21 browser scenarios. The backend tests include real HTTP/WebSocket rooms and deterministic physics/combat. Browser tests use actual mouse capture and inputs, including robot head/foot shots, reload feedback, two-player damage/death/respawn, a complete 2?1 match/rematch and forfeit results, weapon input, collision, connection flow, and arena re-entry. Test-only fixtures never supply gameplay hit results.

Browser tests start both services if needed. Install Chromium with `npx.cmd playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed browser. Restart an older running backend after updating code.

## Code map

| File | Responsibility |
| --- | --- |
| `shared/arena.js` | Facility solids, movement, capsule and network values |
| `shared/weapons.js` | Four weapon configurations, falloff, regional damage |
| `shared/match.js` | Match formats, round timing and gameplay gating |
| `shared/abilities.js` | Shared ability bindings, cooldowns and tuning |
| `shared/robot.js` | Robot geometry and matching hit boxes |
| `shared/ballistics.js` | Ray/box and rotated robot intersection, pellet directions |
| `client/src/game/characters/RobotModel.jsx` | Shared training / multiplayer robot model |
| `client/src/game/Arena.jsx` | Facility, hazards, resettable robot targets |
| `client/src/game/store.js` | Offline training combat, abilities, statistics and clock |
| `client/src/game/weapons/` | Weapon models, animations and local attack input |
| `client/src/game/hud/` | Training HUD, scanner and shared combat feedback |
| `client/src/multiplayer/` | Lobby, online controls, interpolated players, server-backed weapon rendering/HUD |
| `server/src/rooms/` | Private rooms, synchronized state and lifecycle |
| `server/src/arena/ArenaSimulation.js` | Authoritative fixed-step Rapier movement |
| `server/src/arena/DuelMatch.js` | Best-of-three lifecycle, timed rounds, scoring, forfeits and results |
| `server/src/arena/ArenaCombat.js` | Validated attacks, abilities, shields/EMP, damage and respawn |

All visual assets are procedural geometry and system fonts. No new dependency was needed for this feature. Earlier drone modules remain unused; the game no longer renders or offers the drone.

## Known limits

- Online poses use smoothed server snapshots and 100 ms remote interpolation. There is no movement prediction or hit rewind yet; latency can affect aiming at moving players.
- Hands-on balancing and integrated-GPU performance testing remain. The production engine/WASM bundle retains its large-chunk warning; Low render quality reduces GPU work.
- Multiplayer offers private Best of Three and Free Play. Results are in memory; accounts, persistent match history, ranking, sound, session recovery across reloads and public hosting remain future work.
- The existing four moderate development-only ESLint/minimatch advisories were not changed by this dependency-free update.

See the [design](docs/GAME_DESIGN.md) and [roadmap](docs/DEVELOPMENT_ROADMAP.md).
