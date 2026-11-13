# Controls

Choose **Enter Training** for stationary robot practice. The drone and Sparring mode have been removed. Select **Resume / Enter Arena** to capture the mouse.

| Input | Action |
| --- | --- |
| W / A / S / D | Move relative to view |
| Mouse | Aim; sensitivity is adjustable |
| Left click | Fire / melee attack; burst weapons commit three shots |
| Hold left click | Automatic weapon fire; OMEGA spins up before firing |
| Hold right click | Sniper scope; release to return to normal view |
| T | Inspect equipped weapon |
| 1 / 2 / 3 | Primary / Pistol / Melee |
| Q | Cycle the three equipped weapons |
| R | Reload equipped firearm |
| Shift | Sprint |
| Space | Jump while grounded |
| Escape | Release mouse; pause offline training |
| E | Dash |
| F | Energy Shield |
| C | Selected unique skill |
| X | Character ultimate (5 seconds) |

Robot damage is 2× at the head (RAILBREAKER: 1.5×), 1× at the torso, 0.75× at arms/legs, and 0.5× at feet. ECHO-9 deals 56/28/21/14 respectively. Headshots display HEADSHOT and actual HP removed; defeats display ELIMINATED. Cover blocks shots; RAILBREAKER can penetrate thin cover. Targets reset after three seconds. Robots match the player's 1.7-meter capsule height and stand on the floor in clear firing lanes. Head, body, limb and foot shots are available from the spawn floor without stepping onto a platform.

Choose from 11 primaries, three pistols and three melee weapons. Each has its own model, animation, handling and statistics; see the [weapon arsenal](WEAPONS.md). Shotguns use only a dotted ring. Both snipers zoom with a clear circular optic; the first-person model is hidden while scoped and returns on release.

Confirmed eliminations display an animated kill badge. Another kill within six simulation seconds advances the combo: **Double Kill → Triple Kill → Overdrive → Rampage**, with a different sound at each tier. Higher combos keep their exact count on the Rampage badge. Nonlethal hits do not advance it. Death, restarting and a fresh multiplayer round clear the combo; training pause freezes its timer. The badge stays hidden while paused, dead, or behind multiplayer menus. Badges last 2.4 seconds. Sound volume and Mute sound also control combo sounds.

Firearms leave short, colored bullet trails, including individual shotgun pellets and opponent shots online. They follow accepted shots, stop at cover and respect RAILBREAKER's thin-cover penetration. Melee attacks and rejected shots emit no bullet trail. Trails are visual effects and do not change damage.

Empty firearms automatically reload; R reloads a partial magazine. A notice and weapon/cell animation show progress. Switching normally takes 0.25 seconds; snipers and OMEGA take longer. Switching preserves separate magazines and cancels unfinished reloads. Re-equipping an empty firearm starts a fresh reload after equip recovery. Melee swings must finish before switching. Switching, reloading, pausing or losing focus clears the trigger; press again to resume firing.

Training pause freezes movement, attacks, reload, reset, ability, and hazard timers. Focus loss also pauses. Restart restores the run. Amber pads cause damage; Shield absorbs it, and protection expires when depleted or timed out. All four abilities have cooldown tiles. See [tactical systems](TACTICAL_SYSTEMS.md).

For multiplayer, join the same private room, both ready up, and let the host start the arena. All movement and weapon controls above work online. Head/body/limb/foot damage uses server validation. The host chooses Best of Three (default) or Free Play before readying. In Best of Three, elimination ends a round and first to two round wins takes the match. Free Play gives killed players five seconds to select a preset before respawning. Escape releases your controls while the shared simulation continues. Connection loss pauses combat/movement/timers until recovery. **Return to Lobby** ends Free Play for both players; in Best of Three use **Forfeit Match** to concede, or return after the results screen. E/F/C/X work online with server-validated effects and cooldowns. Flashbang affects self and enemies; stun roots enemies only. Best-of-three rounds last up to 90 seconds. Higher HP wins at timeout; equal HP replays the round. Four-second results precede a ten-second loadout phase and a three-second countdown. Every round starts with fresh spawns, health, ammo and abilities. A shared scoreboard shows round wins and kills/deaths. Both ready up again in the lobby for a rematch. See the [online arena guide](ONLINE_ARENA.md).

Use **Character & Loadout** before entering training or joining a room. Select one primary, one pistol and one melee. Every character also has Dash and Shield, one selectable unique skill and a fixed five-second ultimate. All 17 weapons are playable. Save up to five presets before joining. Best of Three allows preset selection for ten seconds before every round, including the first. Free Play opens a five-second swap window after death. Selecting a slot updates the pending loadout immediately; it deploys when the timer ends. The current slot is kept if you do nothing. You cannot change equipment while alive in active play. After respawning or a round countdown, click Enter Arena to capture the mouse again. See [characters and loadouts](CHARACTERS_AND_LOADOUT.md) and [accounts and rankings](ACCOUNTS_AND_RANKINGS.md).

Sound controls are in Settings: Sound volume, Mute sound and Test Audio. Preferences save on this device. Configure sound before joining an online room; training also offers Settings from its pause menu. Headphones provide directional opponent sounds. See [combat audio](AUDIO_SYSTEM.md).
