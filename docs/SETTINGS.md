# Settings

Controls are part of **Settings**, available from the main menu, training pause menu and multiplayer Escape menu. Changes take effect immediately and persist locally. Signed-in players use **Save to Account** to sync preferences and controls to another device. Guests keep their own device preferences when an account signs out. Cloud errors leave local changes intact and show a retry message. Training ammo is a separate device-only practice option.

| Tab | Options |
| --- | --- |
| General | Mouse sensitivity, FPS, 60–110 degree vertical FOV, hold/tap scope input, damage numbers, opacity, Classic/Stacked damage, crosshair editor, training ammo |
| Controls | Rebind movement, sprint/jump, fire/aim, weapon slots, reload, inspect, cycle, abilities, armory and course controls |
| Graphics | Low/Medium/High quality, white/black flashbang, visible enemy body aura and color |
| Audio | Master volume, sound effects, generated ambient music, mute and audio test |

Click a binding, then press a key or mouse button. A conflict swaps the other action into the vacated binding, keeping every action available. Escape cancels rebinding and remains the fixed pause/release key. Default controls can be restored independently of other preferences. Right Shift also sprints while sprint uses its default Left Shift binding. Controls work identically in training and multiplayer.

Hold scope is the default. Tap scope toggles with a press, including a remapped keyboard aim key. Reloading, weapon switching, death or loss of mouse capture removes the optic. Your FOV returns after aiming; dash adds seven degrees up to 117. Sniper and red-dot optics retain their calibrated aim FOVs.

The crosshair editor offers cross, dot and circle shapes; color, size, center gap, thickness, opacity and center dot. The preview updates immediately. Shotguns retain a dotted spread ring, and aiming uses the equipped optic's reticle.

Classic damage shows separate recent confirmed hit amounts. Stacked damage adds hits within an 0.8-second chain window; a gap starts a new total. Turning numbers off preserves hit markers, headshot/kill feedback and audio. Opacity applies to numbers. Damage totals are cosmetic and do not change server validation or weapon statistics.

The enemy aura adds a subtle emissive color and armor outline across the whole body. It respects depth and walls. Scanner and spectral-smoke reveals retain their existing ability rules. Black flashbang uses the same timing and opacity as white, with a black background.

Audio is generated locally using one lazily unlocked Web Audio context. Master volume affects both buses; SFX and background music mix independently. Music is a quiet evolving sci-fi pad. Muting or setting a bus to zero silences that bus. Focus loss stops audio, while training pause stops combat sounds and can leave music playing. Returning does not replay missed combat cues.

In multiplayer, alt-tabbing clears held movement, attack and aim, but does not open the Escape menu or pause the server. The live view remains visible when you return, with **Click to Aim** to recapture the mouse as required by the browser. Escape opens the multiplayer menu and Settings. Match timers, damage, deaths and respawns continue while away or editing settings. A real connection interruption still follows the existing reconnection rules. Browsers may throttle rendering in hidden tabs; the server keeps running independently.

Preferences are validated before use, loaded from account Auth metadata at sign-in and saved with the existing authenticated Supabase client. They never grant permissions or change authoritative combat rules. No new database schema or service key is required.
