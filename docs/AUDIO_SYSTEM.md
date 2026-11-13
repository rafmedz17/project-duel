# Combat audio

Audio now works in training and multiplayer. Open **Settings** to adjust **Sound volume**, toggle **Mute sound**, or select **Test Audio**. Volume defaults to 55%. Preferences save on this device and survive reloads and training restarts. Settings are available from the main menu and the training pause menu; set them before joining an online room. Headphones help with opponent direction.

## Sounds

- Each weapon has a distinct generated energy shot or blade sweep. Automatic rifle fire follows accepted shots, rather than a looping sound.
- Equip, reload start and reload completion have separate cues. Cancelling or switching during a reload does not play a successful refill.
- Confirmed hits, headshots, eliminations and shield hits have different sounds. Damage, shield absorption and player death also have cues.
- Confirmed kills within six simulation seconds escalate through Double Kill, Triple Kill, Overdrive and Rampage. Each tier has a distinct rising energy sting, replacing the ordinary elimination sound. Only the shooter hears their combo confirmation. These sounds follow the same mute, volume, focus and pause controls; delayed updates play only the latest tier.
- Dash, Shield, Scanner and EMP play once per accepted activation, including casts that affect no target.
- Grounded movement produces footsteps. Standing still, jumping, dashing and round/spawn teleports do not produce a backlog of steps.
- Best of Three has round win/loss/draw, countdown, round start and victory/defeat cues.

Opponent weapon, reload, ability and footstep sounds use their server-owned positions. Distance reduces their volume, and camera position/orientation controls their stereo direction. Self weapon sounds and hit confirmations remain centered. Walls do not muffle audio yet; directional and distance attenuation are implemented without acoustic occlusion.

## Lifecycle and performance

The browser creates one Web Audio context after a user interaction. Opening the page does not autoplay audio. **Test Audio** plays a short preview even while training is paused. Browser policy or missing Web Audio support produces an explanatory test notice while gameplay remains usable.

Training pause, focus loss, hidden tabs, interrupted online connections and returning to the lobby stop active voices. Online gameplay still runs when the cursor is released, so opponent sounds continue while that browser remains focused. Reconnection, refocusing and unmuting seed current counters instead of replaying missed sounds. Local death permits the death cue to finish; restarting resets the event baseline.

The implementation uses oscillators, envelopes and one reused noise buffer. It downloads no audio files and adds no package dependency. A compressor, master gain and a 32-voice limit bound output and resource use. Finished/cancelled nodes disconnect. Unsupported or blocked audio does not block movement or combat.

## Code and verification

| File | Responsibility |
| --- | --- |
| `client/src/audio/synth.js` | Lazy Web Audio graph, generated sounds, spatial panners, master controls and voice cleanup |
| `client/src/audio/cues.js` | Accepted combat/round transitions and grounded footstep distance |
| `client/src/audio/useGameAudio.js` | Store subscriptions, listener pose, focus/visibility handling and event baselines |
| `client/src/audio/settings.js` | Safe volume/mute defaults and normalization |

`npm.cmd test` includes combat, audio and celebration rules. Browser audio scenarios verify actual nonzero Web Audio output, autoplay gating, saved preferences, weapon/ability cues, all five kill sound tiers, hit feedback, footsteps, reloads, mute/pause silence and missing-API fallback. The online tests use normal SDK peers sending validated actions to the real game server. They check positional opponent sounds, combo/death handling, replay rejection and focus/resume behavior; they never supply hit results.

`audio.diagnostics()` exposes read-only counters, active voices, recent cue names, spatial source position and analyser RMS for development checks. It does not change gameplay state or inject hits. Browser tests also run the existing account, training and multiplayer scenarios for regressions.

API references: [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode).
