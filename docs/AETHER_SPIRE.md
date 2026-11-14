# Aether Spire

Select **Multiplayer → Casual or Ranked → Arena map → AETHER SPIRE** as the host.
It supports the existing two-player Best of Three and Free Play formats. It does
not change room capacity. Training Grounds and the three previous arena maps
remain available as before.

The reference-inspired arena has opposing cyan/crimson spawn gates, a violet
reactor, low central cover, two outer flank routes, northern/southern observation
decks, pink ornamental trees, and a surrounding dusk city skyline. Floor panels
and signs are generated locally; there are no new external assets or downloads.

## Graphics

| Setting | Aether Spire rendering |
| --- | --- |
| Low | Shared instanced scenery, simplified trees and skyline, no point lights, particles or shadow maps |
| Medium | Denser scenery, reactor accent light, rim light, dust and reactor halo |
| High | Fuller tree geometry and skyline, three accent point lights, 2048px directional shadows and pylon halos |

All settings retain the same cover, stairs, platforms, spawn positions, and
damage occlusion. Switching graphics during a match changes only rendering.
Emissive strips and soft floor light pools keep Low readable without real-time
accent lights. Geometry, colors and transforms are batched into instanced meshes.
The existing DPR/antialiasing preferences also apply.

Measurements from the isolated software-rendered preview are draw/geometry counts,
not a guarantee of FPS on a particular laptop. Profile the complete game on the
target machine; players, weapons, abilities and HUD add their own work.

## Shared simulation

`shared/maps/aetherSpire.js` owns all solid bounds and spawns. The map registry
supplies this exact data to server movement, client prediction, bullet occlusion,
and the renderer's collision/shot proxies. Visual details never add colliders.

The 1.2m observation decks have ten 12cm risers. This map opts into the same
bounded 18cm autostep on both server and client; other maps retain their original
controller behavior. No jump is required to reach either deck. Decorative trees
and the skyline are cosmetic; planter bases are solid cover. The reactor cage
encloses its shared solid core volume.

## Files and validation

- `shared/maps/aetherSpire.js`: layout, spawns and map-specific step settings.
- `client/src/game/maps/SpireArena.jsx`: batched scenery and quality variants.
- `client/src/game/Arena.jsx`: new arena routing.
- `client/src/game/World.jsx`: High-only map shadow configuration.
- `client/src/multiplayer/LobbyMapCard.jsx`: map preview and actual spawn markers.
- `server/tests/aether-spire.test.js`: symmetry, protected starts and walk-up decks.
- `server/tests/maps-loadout.test.js`: all-map cover, grounded spawns and occlusion.
- `client/tests/aether-spire.spec.js`: real two-client lobby selection, online
  movement and live Low/Medium/High changes with identical collider counts.

Restart the local Node server after updating so its map registry includes Spire.
For production, rebuild the client and redeploy the server and client together.
The existing deployment compression script remains applicable.

Before publishing the new map, apply
`supabase/migrations/20261114190352_aether_spire_map.sql` using the project's normal
migration deployment process. It expands the existing match-history map whitelist
to include `spire`; permissions and RLS stay unchanged. The migration is tested
locally through the PostgreSQL result transaction, not applied to hosted Supabase
by this change. Guest multiplayer does not need the database migration.
