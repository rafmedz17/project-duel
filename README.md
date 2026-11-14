# PROJECT DUEL

A playable FPS training facility and private two-player arena built with React, Three.js, React Three Fiber, Rapier, and Colyseus. Training has four connected courses, 21 character robots, a reflex challenge, an in-session armory, 17 weapons, four selectable unique skills, four character ultimates, scoring and saved settings. Multiplayer has server-owned combat, best-of-three matches, three selectable maps and customizable loadouts. Optional Supabase accounts add saved profiles, cross-device equipment, match history, statistics, Elo rankings and a leaderboard. Training and guest play work without cloud accounts.

## Launch

Use Node.js 22 or newer. If dependencies are missing, run `npm.cmd install` separately in `client` and `server`. From the project root, use separate terminals:

```powershell
npm.cmd run dev:client
```

```powershell
npm.cmd run dev:server
```

Open the Vite address (normally http://localhost:5173). The server is only needed for Multiplayer. `npm.cmd` avoids Windows PowerShell's script execution policy issue; other shells can use `npm`.

Choose **Enter Training**, then **Resume / Enter Arena**. WASD moves, the mouse aims, Shift sprints, Space jumps, and left click attacks. Select primary/pistol/melee with **1 / 2 / 3**, cycle with **Q**, and reload with **R**. Hold left click for automatic weapons, hold right click to activate holographic sights on rifles/SMGs/LMGs or precision sniper scopes, and press **T** to inspect. Holographic fins disappear outside aim. Escape releases the mouse and pauses training. Focus loss also pauses it.

Four courses surround a safe central hub: 10 stationary robots ahead, a 45-second reflex challenge on the right, six strafing robots behind, and five armed robots with obstacles on the left. Press **G** in a course to reset the range, control moving robots, or start/stop a challenge. Combat robots stay disarmed until you start their course; cover blocks their shots, and leaving the course disarms them. All robots use the multiplayer hit zones and stand directly on the floor. See [training grounds](docs/TRAINING_GROUNDS.md).

| Hit region | Damage multiplier | Pistol example |
| --- | --- | --- |
| Head | 2× | 56 |
| Torso | 1× | 28 |
| Arms / legs | 0.75× | 21 |
| Feet | 0.5× | 14 |

All 17 weapons use these regional rules; RAILBREAKER headshots use 1.5×. Shotgun falloff is applied before regional scaling and rounding. The number shown is actual remaining HP removed. Headshots show coral feedback and **HEADSHOT**; defeats show **ELIMINATED**. Cover blocks shots except RAILBREAKER's limited thin-cover penetration. See the [weapon arsenal](docs/WEAPONS.md) for statistics and special behavior.

Firearms keep separate magazines and unlimited reserve ammo. Empty magazines auto reload, with a weapon/cell animation, notice, progress bar, and countdown. R reloads partial magazines. Switching cancels a reload without refilling it; re-equipping an empty firearm starts again after the equip delay. The shotgun has only a dotted ring crosshair.

Confirmed kills display animated sci-fi badges with escalating combo sounds: Elimination, Double Kill, Triple Kill, Overdrive and Rampage. Keep kills within six seconds to chain them. Firearms draw short colored trails, including shotgun pellets and opponent shots online, with cover and thin-cover penetration matching the accepted shot. Death and new rounds reset combos; pause and mute controls apply to the new effects too.

Multiplayer trails survive respawns and remain visible when mouse capture is released. Best of Three preserves winning-kill badges during round results and displays the final elimination badge inside the victory dialog.

Every character has **E** Dash, **F** Shield, **C** a freely selected unique skill, and **X** a fixed ten-second ultimate. Choose VEX, AEGIS, ION or RAZE in **Character & Loadout**, then equip one of 11 primaries, three pistols and three melee weapons with animated previews. Press **B** during training to change character, guns, melee and unique skill. The field armory pauses the simulation and applies equipment without resetting your position, health or course progress. These changes are for the current training session; your saved multiplayer presets remain separate. See [characters and loadouts](docs/CHARACTERS_AND_LOADOUT.md), [controls](docs/CONTROLS.md) and [tactical systems](docs/TACTICAL_SYSTEMS.md).

Combat audio includes individually layered sounds for all 17 weapons, weapon-specific reloads, confirmed hits/headshots, eliminations, damage, abilities and round results. Footsteps alternate boots with walk/sprint detail, jump and landing cues, and metal/concrete surfaces. Opponent sounds use distance and direction in multiplayer. **Settings → Audio → Test Audio** previews the current volume. Background music plays only on the landing page and its menu panels; training and multiplayer have no music. Training pause silences combat sounds; tab/focus loss silences all audio. Resuming does not replay missed events. All sounds are generated locally without asset downloads. See [audio behavior and controls](docs/AUDIO_SYSTEM.md).

Build up to five presets in **Character & Loadout**. Click the character or an equipment card to open its picker; selecting an item saves automatically. Selecting a preset also saves it as your default. Hover or focus a card for details and a live weapon preview. Guests save on this device; signed-in players save privately across devices. The B field armory uses the same automatic saves during training. Best of Three offers a five-second loadout phase before every round. Free Play offers a five-second preset swap window after death.

Settings combines General, Sensitivity, Controls, Graphics and Audio tabs. Sensitivity contains general mouse speed and separate Look, ADS and Firing multipliers for each weapon category. Edit FOV, hold/tap scope, damage numbers, crosshair, enemy aura, flashbang color and audio levels; rebind keyboard and mouse controls. Changes save locally; signed-in players can Save to Account for cross-device preferences. Multiplayer keeps running while alt-tabbed, with a click to recapture your mouse on return. See [settings](docs/SETTINGS.md).

## Multiplayer

Choose **Play Multiplayer**, then **Casual** or **Ranked** from the nearby picker. Your private room is created automatically, using your saved callsign or an assigned guest callsign. Copy your own invite code or enter a friend's code in the separate join field at the top. The lobby displays both operatives, callsigns and ready states around a match-format selector and tactical map preview. The host chooses the map and format; guests see the same settings. When both players select **Ready Up**, the server automatically starts a five-second countdown. Either player can cancel readiness to stop it. After the countdown, select **Enter Arena** to capture the mouse. The same movement and weapon controls work online.

Casual supports guest players, Best of Three and Free Play. Ranked requires two different signed-in accounts and Best of Three. A ranked host waits for an eligible opponent and server confirmation before ready checks unlock; choosing Casual in the lobby explicitly changes that setup back to casual.

The server validates shot origin from its own player position, range, cover, robot hit region, cooldown, magazine, reload, and equip recovery. Clients send aim and actions, never hit results or damage. Players have 100 HP. Free Play gives eliminated players five seconds to choose a preset before respawning; Best of Three keeps them eliminated until the next round. The HUD shows health, shield charge, ammo, confirmed damage/headshots, cooldowns, scan markers, flash/root feedback, ultimate status, and kills/deaths. Use **E** Dash, **F** Shield, **C** your unique skill and **X** your character ultimate online too. The server owns cooldowns and effects. Shield absorbs up to 50 damage. Grenades, global scan and ten-second ultimates share their training rules online. The host selects **Best of Three** (default) or **Free Play** in the lobby. Best of Three is first to two round wins, with a scoreboard, 90-second rounds, four-second results, five-second loadout phases and three-second round countdowns. Elimination ends a round; at timeout higher HP wins, and equal HP replays the round. New rounds restore spawns, health, all magazines and abilities. Free Play retains unlimited five-second respawns with preset selection.

Escape releases your own controls while the opponent can keep playing. A connection interruption pauses the shared simulation, including reload and respawn timers. A reconnect within 15 seconds preserves the arena. In Best of Three, **Forfeit Match** concedes to the opponent; permanent departure also awards a forfeit. The victory/defeat screen preserves both scoreboard rows. **Return to Lobby** after a match lets both players ready up for a fresh rematch. In Free Play, Return to Lobby ends the practice session for both. See [lobby/LAN setup](docs/PRIVATE_LOBBIES.md) and [online combat details](docs/ONLINE_ARENA.md).

## Main menu

Each fresh page load opens a fullscreen recommendation with **No, thanks** and **I agree**. Agree requests fullscreen for the whole game through the browser API; declining continues normally. A blocked or unsupported request leaves a message and a way to continue. The choice lasts until the next page load. Browser shortcuts such as Ctrl+W can still close the tab; fullscreen cannot guarantee shortcut blocking. F11 is also available manually in desktop browsers that support it.

The menu has Settings, Leaderboard and Profile in the upper right, with Training Grounds, Play Multiplayer and Loadouts below. Its live cinematic loops through the Facility, Neon District, Orbital Station and Training Nexus with camera moves, staged operatives and cosmetic bullet trails. Reduced-motion preferences keep the camera still. Opening a panel or hiding the tab also stops the cinematic from continuously rendering.

The original **Limit Break** theme is a 138 BPM electronic score with a drum/bass build and a synth hook. It starts after a click or key press, follows Settings → Audio, and stops in training and multiplayer. The stereo loop ships as a cached WAV asset; the browser does not synthesize the song during play. To regenerate it after editing `client/src/audio/menuTheme.js`, run `node scripts/render-menu-theme.mjs` before building.

First-person operatives have character-colored armored arms, articulated gloves, trigger fingers and a magazine handoff during reloads. The arms follow the gun's grips through recoil, movement, inspection and melee attacks; precision scopes hide both arms and the weapon. Multiplayer opponents carry their actual equipped gun or melee model, with pitch, crouch, reload and attack animations driven by server combat snapshots. Arm extensions and equipment are cosmetic; the shared robot hit volumes and combat rules remain authoritative.

## Verification

For cloud accounts and rankings, follow [Supabase setup and feature rules](docs/ACCOUNTS_AND_RANKINGS.md). Until configured, guest loadouts save locally and multiplayer remains casual. The backend secret belongs only in `server/.env`; the frontend receives a public publishable key.

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

Local combat/audio/geometry/physics tests and backend cases cover all 17 weapon specifications, burst scheduling, rotary spin-up, penetration, heavy-melee knockback, loadout slots, PostgreSQL RLS, result transactions, delayed-network prediction and production HTTP/WebSocket hosting. Browser scenarios cover gameplay, model previews, clear sniper scopes, audio, maps, account fixtures, refresh recovery and paused rendering. They use actual mouse capture and inputs for regional hits, reloads, online combat, complete matches, collision and connection lifecycle. Geometry checks also verify player/capsule height and clear shots to every practice hit region from the spawn floor. See the account guide for local/mock/live-cloud test boundaries. Test-only fixtures never supply gameplay hit results.

Browser tests start both services if needed. Install Chromium with `npx.cmd playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed browser. Restart an older running backend after updating code.

## Code map

| File | Responsibility |
| --- | --- |
| `shared/arena.js` | Facility solids, movement, capsule and network values |
| `shared/maps.js` | Three shared collision layouts, spawns and visual themes |
| `shared/loadout.js` | Shared equipment defaults and validation |
| `shared/weapons.js` | Seventeen weapon configurations, falloff, regional damage |
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
| `client/src/accounts/` | Supabase Auth, profile, equipment, history and leaderboard screens |
| `client/src/audio/` | Generated combat audio, positional opponents, audio settings and lifecycle |
| `server/src/rooms/` | Private rooms, synchronized state and lifecycle |
| `server/src/arena/ArenaSimulation.js` | Authoritative fixed-step Rapier movement |
| `server/src/arena/DuelMatch.js` | Best-of-three lifecycle, timed rounds, scoring, forfeits and results |
| `server/src/arena/ArenaCombat.js` | Validated attacks, abilities, shields, grenades/ultimates, damage and respawn |
| `server/src/accounts.js` | Verified identities, canonical loadouts and durable result uploads |
| `supabase/migrations/` | Account tables, RLS, grants and atomic match/Elo recording |

All visual assets are procedural geometry and system fonts. Accounts use the pinned Supabase JS SDK; database tests use PGlite, and local migration tooling uses the pinned Supabase CLI. Earlier drone modules remain unused; the game no longer renders or offers the drone.

## Known limits

- Local online movement uses prediction and server reconciliation; opponents retain 100 ms interpolation. Hit rewind remains future work, so latency can affect aiming at moving players.
- Static scenery avoids combat clock updates, paused training renders on demand, and engine downloads have separate cached chunks. The initial app chunk is about 299 KB raw / 95 KB gzip; large physics/Three.js chunks and target-laptop profiling remain. See [network and performance](docs/NETWORK_AND_PERFORMANCE.md).
- Refresh restores the same reserved seat within 15 seconds. Server restarts discard rooms. Public hosting is prepared with a combined game/server Dockerfile; deployment awaits a connected host. See [deployment](docs/DEPLOYMENT.md). Public matchmaking and audio wall muffling remain future work. Audio includes distance/direction and landing-page music.
- The existing four moderate development-only ESLint/minimatch advisories remain; they are unrelated to account gameplay.

See the [design](docs/GAME_DESIGN.md) and [roadmap](docs/DEVELOPMENT_ROADMAP.md).
