# Movement, recovery and performance

Online movement predicts the local capsule at fixed 60 Hz using the server's shared `shared/movement.js` controller. Key presses send immediately, followed by 20 Hz held-input updates. Packets contain controls and sequence/round IDs, never time deltas, positions or velocity claims.

Server snapshots include position, velocity, ground contact, remaining acknowledged dash movement, and simulated steps for the acknowledged input. The client restores that state and replays pending steps. Small camera corrections decay; large corrections snap. History is bounded and prediction stops on stale snapshots. Opponents retain 100 ms interpolation. Hits, ammo, damage and abilities remain server validated, without hit rewind. Remote capsules use their latest server poses during local prediction, so close player collisions can require correction.

Tests compare real Rapier client/server movement on all three maps, delayed commands/snapshots, release convergence, and acknowledgements that advance only when simulated.

## Refresh recovery

The current reconnection token stays in per-tab `sessionStorage`, updates on connection/reconnection, and restores the reserved seat at startup. A refresh within the server's 15-second reservation preserves player ID, arena, combat and scores. Action sequences resume from server acknowledgements. Click Enter Arena again to recapture the mouse.

Explicit Leave clears recovery. Expired/rejected tokens clear themselves and show a lobby error without creating another room. Storage failures do not break ordinary play. Server restarts discard rooms; recovery cannot extend an expired reservation. Tokens are bearer credentials: do not share/log them. They stay out of URLs and localStorage.

## Rendering and downloads

- The 3D engine loads separately from menu/UI JavaScript. Three.js and Rapier use separate hashed chunks so gameplay edits can retain cached engine downloads. The initial app chunk is about 299 KB raw / 95 KB gzip, versus the previous combined 3.5 MB chunk. The 3D preview still requires the engine download.
- Static arena scenery is memoized separately from training targets and hazard feedback. Combat clock updates no longer rerender the entire facility.
- Menu and paused training render on demand; active training renders continuously. Uncaptured online views invalidate on snapshots. Low quality limits resolution and lighting; saved Low also starts without multisample antialiasing.
- `node scripts/compress-client.mjs` produces Brotli/gzip files. The production server negotiates compression, caches hashed assets for a year and revalidates HTML. Build metadata/dotfiles are not served.

Engine chunks remain substantial: Rapier/WASM is about 2.24 MB raw / 842 KB gzip / 699 KB Brotli; Three.js about 743 KB raw / 188 KB gzip. Large-chunk build warnings remain. These measurements describe downloads, not a measured FPS gain. Target-laptop/integrated-GPU profiling and balancing remain.
