# Controls

Choose **Enter Training** for stationary robot practice. The drone and Sparring mode have been removed. Select **Resume / Enter Arena** to capture the mouse.

| Input | Action |
| --- | --- |
| W / A / S / D | Move relative to view |
| Mouse | Aim; sensitivity is adjustable |
| Left click | Fire / swing blade |
| Hold left click | Automatic rifle fire |
| 1 / 2 / 3 / 4 | Pistol / Blade / Rifle / Shotgun |
| Q | Cycle all four weapons |
| R | Reload equipped firearm |
| Shift | Sprint |
| Space | Jump while grounded |
| Escape | Release mouse; pause offline training |
| E | Dash |
| F | Energy Shield |
| C | Scanner |
| V | EMP Blast |

Robot damage is 2× at the head, 1× at the torso, 0.75× at arms/legs, and 0.5× at feet. A pistol deals 40/20/15/10 respectively. Headshots display HEADSHOT and actual HP removed; defeats display ELIMINATED. All weapons respect cover. EMP deals flat area damage. Targets reset after three seconds. Robots match the player's 1.7-meter capsule height and stand on the floor in clear firing lanes. Head, body, limb and foot shots are available from the spawn floor without stepping onto a platform.

Pistol: 12 rounds, 20 base damage, 0.22-second recovery, 1.5-second reload. Rifle: 30 rounds, 14 base damage, 0.12-second minimum recovery, 2-second reload. Shotgun: 6 shells, 8 pellets, 14 base damage per pellet, falloff beyond 6 units, 24-unit range, 0.8-second recovery, 2.3-second reload. The shotgun uses only a dotted ring. Blade: 60 base damage, 2.6-unit reach, 0.65-second recovery, no ammo.

Empty firearms automatically reload; R reloads a partial magazine. A notice and weapon/cell animation show progress. Switching takes 0.25 seconds, preserves separate magazines, and cancels unfinished reloads. Re-equipping an empty firearm starts a fresh reload after equip recovery. Blade swings must finish before switching. Switching, reloading, pausing or losing focus clears the trigger; press again to resume firing.

Training pause freezes movement, attacks, reload, reset, ability, and hazard timers. Focus loss also pauses. Restart restores the run. Amber pads cause damage; Shield absorbs it, and EMP temporarily disables the pad. All four abilities have cooldown tiles. See [tactical systems](TACTICAL_SYSTEMS.md).

For multiplayer, join the same private room, both ready up, and let the host start the arena. All movement and weapon controls above work online. Head/body/limb/foot damage uses server validation. The host chooses Best of Three (default) or Free Play before readying. In Best of Three, elimination ends a round and first to two round wins takes the match. Free Play respawns killed players after three seconds. Escape releases your controls while the shared simulation continues. Connection loss pauses combat/movement/timers until recovery. **Return to Lobby** ends Free Play for both players; in Best of Three use **Forfeit Match** to concede, or return after the results screen. E/F/C/V work online with server-validated cooldowns. Shield absorbs weapon damage; EMP deals 40 damage through cover in an 8-unit radius, strips Shield, cancels active abilities and jams ability activation for four seconds. Guns and normal movement still work while jammed. Death cancels active effects but preserves ability cooldowns; new arena entry resets them. Best-of-three rounds last up to 90 seconds. Higher HP wins at timeout; equal HP replays the round. Four-second results precede a three-second countdown and fresh spawns, health, ammo and abilities. A shared scoreboard shows round wins and kills/deaths. Both ready up again in the lobby for a rematch. See the [online arena guide](ONLINE_ARENA.md).

Use Loadout before entering training or joining a room. Number keys select their usual weapon slots; Q cycles equipped weapons only. Unequipped abilities show UNEQUIPPED and cannot activate. Multiplayer equipment locks when you join the room; leave to change it. Hosts can choose any of the three maps. Ranked requires Best of Three and two distinct signed-in players. See [accounts, equipment and ranking rules](ACCOUNTS_AND_RANKINGS.md).

Sound controls are in Settings: Sound volume, Mute sound and Test Audio. Preferences save on this device. Configure sound before joining an online room; training also offers Settings from its pause menu. Headphones provide directional opponent sounds. See [combat audio](AUDIO_SYSTEM.md).
