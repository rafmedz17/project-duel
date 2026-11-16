# Tactical systems

See [Characters and loadouts](CHARACTERS_AND_LOADOUT.md) for the current ability rules, durations, cooldowns and equipment slots. Four character ultimates replace the old EMP system. Choose one unique skill independently of your character.

Training and multiplayer share character, weapon, loadout and grenade rules in the shared directory. Multiplayer owns movement, hits, damage, cooldowns, grenade flight, enemy filtering and temporary effects. Client prediction never grants damage or authority over effects.

Hold the unique-skill binding (C by default) to preview a grenade's bouncing path and detonation point; release to throw. A quick tap still throws immediately on release. Losing focus, pausing, dying or changing rounds cancels the guide. Its flight follows the same swept collision and fixed substeps used by the server. Flashbangs launch at 18m/s and affect exposed targets within 14m, with weaker blindness when facing away. Smoke canisters launch at 16m/s and create a 6m cloud for eight seconds. Walls still block flashes and stun effects. The fuse starts on release rather than while aiming.

Flash blindness uses an impact and fading afterimage without an overload message, and respects the white/black flash preference. Smoke uses animated billboards, shields use hexagonal energy plates, stun bursts scatter delayed sparks, and dashes add air streaks and a weapon tuck. Low graphics limits each particle effect to 12 instances; higher presets use 30. Reduced motion removes screen streak motion and flash entry animation. Grenade release and detonation have separate sounds, with the burst positioned at its actual location.

Q swaps the current and previously equipped weapons instead of cycling the three slots. Only an accepted weapon switch updates history; equip recovery and melee restrictions still apply. A new life or loadout resets history and falls back to primary/pistol.

Blinded enemies and training robots show orbiting light sparks above the helmet for exactly their remaining flash duration. These effects follow the head and respect solid cover; they do not change animation bones or hitboxes, and they disappear when the target recovers, dies or disconnects.

The HUD shows three weapon slots, four ability tiles, active effect countdowns, reload progress, flash blindness, root warnings and temporary fortress shield. Robots glow through cover during global scan and through the thrower's smoke where solid cover permits. Grenades have visible projectiles and detonation effects. All four practice robots use the same hit volumes as online players.

Each equipped skill has its own icon and key binding. During cooldown, the icon and its background fill from bottom to top using the actual remaining cooldown, with a numeric countdown. Ready icons glow in the skill's color; active ultimates use a character-specific emblem. Training pauses freeze the refill, and multiplayer follows the server clock. Reduced-motion settings remove glow pulses and smoothing while preserving the progress display.
