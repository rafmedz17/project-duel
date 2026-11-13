# Characters and loadouts

Choose **Character & Loadout** before entering training or joining a room. All four operatives use the same 1.7-meter body and hit volumes; their armor, visor and reactor details differ. Practice robots display the four character designs.

| Character | Ultimate (X) | Effect for exactly 5 seconds |
| --- | --- | --- |
| VEX / Phase Runner | Phase Overdrive | Repeated Dash without its normal cooldown; an individual dash still lasts 0.18 seconds and stun still blocks it |
| AEGIS / Orbital Warden | Fortress Protocol | +200 temporary shield, separate from the standard 50-point Shield; unused bonus expires |
| ION / Infinite Engine | Infinite Circuit | Cancel reload, refill magazines and fire without consuming ammunition |
| RAZE / Redline Hunter | Redline Surge | +50% damage and +50% attack speed; cover, range and regional multipliers still apply |

Ultimates have a 45-second cooldown from activation, are available at the start of a run/round, and display a five-second countdown. Death cancels temporary effects. Free Play respawns preserve cooldowns; a new Best of Three round resets them. Training pause and online connection interruptions freeze the simulation clock.

Every loadout has one primary, one pistol, one melee, Dash, Shield, one freely selected unique skill and the character's fixed ultimate. Choose from all 17 playable weapons in the [arsenal](WEAPONS.md), with a live animated preview and fire/reload/inspect controls. The Deploy With selector chooses your starting weapon; default is your selected pistol. Keys **1 / 2 / 3** always select **Primary / Pistol / Melee** and **Q** cycles those three.

| Unique skill (C) | Effect | Cooldown |
| --- | --- | --- |
| Flashbang | Thrown grenade with a 0.9-second fuse. Blinds the thrower and enemies within 10 meters and line of sight; teammates are immune. Facing and distance reduce flash duration, up to 3 seconds. | 14s |
| Spectral Smoke | Thrown grenade with a 0.9-second fuse. Creates a 4-meter-radius cloud for 8 seconds. The thrower sees enemy silhouettes through their cloud; solid cover still blocks this reveal. | 18s |
| Gravity Snare | Thrown stun grenade with a 0.9-second fuse. Roots enemies within 6 meters and line of sight for 3 seconds. Movement, jumping and Dash stop; aiming and firing remain possible. Self and teammates are immune. | 16s |
| Global Scan | Reveals enemies anywhere in the arena, including through walls, for 5 seconds. No grenade or line of sight is required. | 18s |

Grenades bounce against solid arena geometry. Their trajectories, fuse, effects, enemy filtering and cooldowns are computed by the multiplayer server. Current public matches are 1v1; teammate immunity uses server-controlled team identifiers for future team modes. Grenades do not damage health. The old EMP has been replaced by the selectable unique skills.

Dash (E) keeps its 3-second cooldown. Shield (F) absorbs 50 damage for up to 3.5 seconds with a 9-second cooldown. Both are always equipped on every character. AEGIS bonus shield absorbs damage before normal Shield, then health. Shield never heals.

Guest selections save on this device; signed-in selections save in Supabase and load across devices. Existing saved equipment keeps its primary and defaults to ECHO-9 and PHANTOM EDGE. Equipment locks when joining a room; leave the room to change it. The server rejects extra guns, invalid slot combinations, extra skills and client-supplied character effects.
