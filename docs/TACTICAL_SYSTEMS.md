# Tactical systems

See [Characters and loadouts](CHARACTERS_AND_LOADOUT.md) for the current ability rules, durations, cooldowns and equipment slots. Four character ultimates replace the old EMP system. Choose one unique skill independently of your character.

Training and multiplayer share character, weapon, loadout and grenade rules in the shared directory. Multiplayer owns movement, hits, damage, cooldowns, grenade flight, enemy filtering and temporary effects. Client prediction never grants damage or authority over effects.

The HUD shows three weapon slots, four ability tiles, active effect countdowns, reload progress, flash blindness, root warnings and temporary fortress shield. Robots glow through cover during global scan and through the thrower's smoke where solid cover permits. Grenades have visible projectiles and detonation effects. All four practice robots use the same hit volumes as online players.

Each equipped skill has its own icon and key binding. During cooldown, the icon and its background fill from bottom to top using the actual remaining cooldown, with a numeric countdown. Ready icons glow in the skill's color; active ultimates use a character-specific emblem. Training pauses freeze the refill, and multiplayer follows the server clock. Reduced-motion settings remove glow pulses and smoothing while preserving the progress display.
