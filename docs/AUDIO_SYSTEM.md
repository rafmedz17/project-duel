# Combat audio

Audio now works in training and multiplayer. Open **Settings → Audio** for **General audio**, **Sound effects**, **Background music**, **Mute all audio** and **Test Audio**. Master volume defaults to 55%, effects to 100% and music to 25%. Preferences save locally and survive reloads and training restarts; signed-in players can Save to Account for cross-device sync. Settings is available from the main menu, training pause and multiplayer Escape menu. Headphones help with opponent direction.

## Sounds

- All 14 firearms have individually tuned reports: a sharp transient, body impact, mechanical action, energy resonance and a short room tail. SMGs have short, tight reports; snipers and shotguns have heavier low-frequency impact. Each of the three melee weapons has its own sweep or charged strike. Automatic fire follows accepted shots, rather than a looping sound. Small pitch and noise variations soften repetition.
- Equip, reload start and reload completion use the equipped weapon's mechanical character. Cancelling or switching during a reload does not play a successful refill.
- Confirmed hits, headshots, eliminations and shield hits have different sounds. Damage, shield absorption and player death also have cues.
- Confirmed kills within six simulation seconds escalate through Double Kill, Triple Kill, Overdrive and Rampage. Each tier has a distinct rising energy sting, replacing the ordinary elimination sound. Only the shooter hears their combo confirmation. These sounds follow the same mute, volume, focus and pause controls; delayed updates play only the latest tier.
- Dash, Shield, Scanner and EMP play once per accepted activation, including casts that affect no target.
- Grounded travel produces alternating boot impacts, sole scuffs and armor detail. Sprinting has a faster, heavier gait; jumps have a lift-off sound and actual landings have an impact scaled to the drop. The facility and orbital station use metallic footsteps; Neon District uses a drier concrete sound. Standing still, dashing and round/spawn teleports do not produce a backlog of steps. Jumping does not emit grounded steps.
- Best of Three has round win/loss/draw, countdown, round start and victory/defeat cues.

Opponent weapon, reload, ability and footstep sounds use their server-owned positions. Distance reduces their volume, and camera position/orientation controls their stereo direction. Self weapon sounds and hit confirmations remain centered. Walls do not muffle audio yet; directional and distance attenuation are implemented without acoustic occlusion.

## Lifecycle and performance

The browser creates one Web Audio context after a user interaction. Opening the page does not autoplay audio. **Test Audio** plays a short preview even while training is paused. Browser policy or missing Web Audio support produces an explanatory test notice while gameplay remains usable.

Background music plays only on the landing page and its menu panels, including landing-page Settings. Opening multiplayer stops it, including the room preview and lobby. Training, training pause/settings, the field armory, multiplayer rounds, respawn/loadout phases and results have no background music. Returning to the landing page restores music at its saved volume after audio has been unlocked by an interaction.

Training pause, focus loss, hidden tabs, interrupted online connections and returning to the lobby stop active combat voices. Focus loss stops music too. Online gameplay still runs when the cursor is released, so opponent sounds continue while that browser remains focused. Reconnection, refocusing and unmuting seed current counters instead of replaying missed sounds. Local death permits the death cue to finish; restarting resets the event baseline.

The implementation uses oscillators, filtered noise, shaped envelopes, one reused noise buffer and one shared short stereo room response. It downloads no audio files and adds no package dependency. Separate SFX and music gains feed a compressor and master gain. A 32-voice limit bounds output and resource use. Finished/cancelled nodes disconnect. Unsupported or blocked audio does not block movement or combat.

## Code and verification

| File | Responsibility |
| --- | --- |
| `client/src/audio/synth.js` | Lazy Web Audio graph, generated sounds, spatial panners, master controls and voice cleanup |
| `client/src/audio/profiles.js` | Individual firearm layers, melee/ability/feedback voices, weapon-specific handling and movement sounds |
| `client/src/audio/cues.js` | Accepted combat/round transitions and grounded footstep distance |
| `client/src/audio/useGameAudio.js` | Store subscriptions, listener pose, focus/visibility handling and event baselines |
| `client/src/audio/settings.js` | Safe volume/mute defaults and normalization |

`npm.cmd test` includes combat, audio and celebration rules. Browser audio scenarios verify actual nonzero Web Audio output, autoplay gating, saved preferences, weapon/ability cues, all five kill sound tiers, hit feedback, footsteps, reloads, mute/pause silence and missing-API fallback. The online tests use normal SDK peers sending validated actions to the real game server. They check positional opponent sounds, combo/death handling, replay rejection and focus/resume behavior; they never supply hit results.

`audio.diagnostics()` exposes read-only counters, active voices, recent cue names, spatial source position and analyser RMS for development checks. It does not change gameplay state or inject hits. Browser tests also run the existing account, training and multiplayer scenarios for regressions.

API references: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode).
