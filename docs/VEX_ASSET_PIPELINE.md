# VEX prototype: zero-budget asset plan

Status: the project owner created `vex_base.blend` in MPFB. An early unrigged
art study using CC0 armor and hood assets is saved at
`assets-source/characters/vex/vex_prototype_draft.blend`. A second visual study,
`vex_visual_study.blend`, adds cyan accents and a split cape; front, side and
back preview images and an asset license record are alongside it. An MPFB
game-engine rig study and a reduced-mesh copy are saved as `vex_rig_study.blend`
and `vex_low_rig_study.blend`. Both contain a temporary test-step animation,
not a finished movement set. The reduced copy has 11,336 source triangles and
at most four deform influences per vertex, but retains many separate objects
and has not been measured in game. It shows some armor clipping in the test
pose. Separate `vex_idle_study.blend` and `vex_walk_study.blend` files contain
early in-place keyframed blocking cycles; they are not polished gameplay clips.
`vex_mixamo_compatibility_test.fbx` is a neutral 53-bone, five-mesh export,
without cape or accent meshes. The user uploaded it to Mixamo and downloaded
`Walking.fbx`. `vex_mixamo_walk_study.blend` applies a copied version of that
clip to the original low-detail rig, cape and accents. Source and target bone
rest matrices and sampled bone-local poses were checked; object-level motion
was removed for an in-place study. Its endpoints nearly match, and the rig
remains fixed in the scene. `vex_walk_refined_study.blend` preserves those body
poses, adds a four-bone cape sway without cloth simulation, and makes a small
rest-pose armor clearance adjustment. A nearest-surface diagnostic across all
42 frames found fewer penetrating armor vertices in every frame, although
intersections and visible deformation artifacts remain. The result needs
animation and deformation review and has not been tested in game.
The study is not game-ready: the design, deformation, animation, draw calls
and performance still require substantial work.
The game still uses its existing character models.

## First milestone

Build and review one lightweight, rigged VEX inspired by the existing portrait at
`client/src/assets/characters/vex.webp`. Review front, side, and back views before
replacing any playable character. The portrait is a design reference, not an
existing 3D asset. The unseen surfaces need original design work.

Keep the hood, masked face, angular layered armor, cyan accents, gloves, boots,
and split cape recognizable. Put small surface details into baked textures
rather than runtime geometry. Do not build another runtime primitive character.

## Start here

1. Check authoring-machine requirements before installing Blender. The reported
   target laptop is an Acer Aspire with a 10th-generation Intel Core i3 and 4 GB
   RAM; its GPU and exact model are still unknown. Blender's current published
   minimum is 8 GB RAM, so this laptop is below that minimum:
   https://www.blender.org/download/requirements/
   Do not make installing the latest Blender on this laptop a prerequisite for
   browser-side asset inspection or integration. The authoring workflow below
   requires a suitable machine; an already-authored, license-verified GLB can be
   integrated without running Blender locally. No such asset is selected yet.
2. Follow the official MPFB getting-started instructions to install the Blender
   extension and official core assets. Check the extension's current Blender
   compatibility before choosing a Blender version:
   https://www.makehumancommunity.org/mpfb/docs/getting_started.html
3. Create a neutral-pose adult humanoid base using those core assets. Save a
   working Blender source before adding armor. A paid model is unnecessary.
4. Author and visually refine VEX's armor, hood, and cape in Blender. This is the
   substantial art step; installing tools or writing a GLB loader does not
   automatically reproduce the portrait.
5. Rig, texture, animate, and export the completed prototype. Mixamo is optional
   for initial movement clips and requires a free Adobe ID; its output still
   needs testing and adjustment for this character and weapon poses.

## License requirements

The official MakeHuman license identifies bundled graphical assets and their
output, including MPFB imports, as CC0. Its code license is separate. This does
not automatically cover third-party community assets:
https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md

Mixamo's official FAQ permits royalty-free use of its characters and animations
in commercial games and describes the free Adobe ID requirement:
https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html

Record the exact source URL, author, version or retrieval date, license text, and
any attribution obligations for each included model, texture, and animation.
Verify the actual asset's license before downloading or importing it. Do not
assume a Sketchfab listing is usable because it is free to view or download.

## Initial performance budgets

These are proposed limits to validate on the weakest target PC, not measured
performance guarantees. The reported target is an Acer Aspire, 10th-generation
Intel Core i3, and 4 GB RAM. GPU, exact model, resolution, and measured baseline
frame times are still unknown. Prioritize the low-quality mesh for this laptop;
the close-up budget is optional and must not become its default.

| Item | Starting target |
| --- | --- |
| Close-up mesh | At most 20–25k triangles |
| Low-quality mesh | Approximately 8–12k triangles |
| Distant mesh | Approximately 3–5k triangles |
| Materials | At most 3; consolidate armor into an atlas |
| Low-quality textures | 1K maps, shared across VEX instances |
| Skin weights | At most 4 influences per vertex |
| Cape | A short bone chain; no real-time cloth simulation |
| Low-quality effects | No character shadows or additional character lights |

Use baked normals and authored emissive accents instead of tiny modeled panels
or bloom-dependent detail. Avoid stacked transparent cape surfaces. Reuse cached
geometry and textures while giving each character its own skeleton and animation
state. Texture download size and GPU memory are different measurements.

## Proposed deliverables

These files do not exist yet:

```text
assets-source/characters/vex/vex.blend
assets-source/characters/vex/LICENSES.md
client/public/models/characters/vex/vex.glb
client/src/game/characters/GltfCharacter.jsx
client/src/game/characters/VexModel.jsx
client/src/game/characters/rigBindings.js
client/src/game/characters/animationController.js
```

Export in meters and fit the existing standing and crouched body proportions.
Use named animation clips and in-place movement. Include head and hand bones,
and explicit weapon attachment bindings. Keep editable sources out of the public
asset directory. Package required textures with the runtime GLB.

## Integration boundaries

- `CharacterPortrait.jsx`: current loadout portraits are WebP images.
- `RobotModel.jsx` and `armorGeometry.js`: current procedural full-body visuals.
  Preserve the invisible hit proxies when introducing the new visual model.
- `OperativeArms.jsx`: separate first-person and remote procedural arms. Keep
  first-person arms for the prototype; avoid rendering duplicate remote arms.
- `OnlinePlayers.jsx`: interpolated remote position, yaw, head pitch, and stance.
  Adapt the head bone rather than treating the old head group as a skeleton.
- `RemoteEquipment.jsx` and `ArsenalModel.jsx`: existing weapon placement and
  named right/left hand grip points. Align bone-driven hands to those grips.
- `TrainingGrounds.jsx`: introduce one VEX bot before converting multiple bots.
- `shared/robot.js`: existing shared hit regions and proportions remain intact.

Three.js and React Three Fiber are already installed. The installed Three.js
package includes GLTFLoader and SkeletonUtils. No additional rendering engine or
Drei dependency is required. GLB loading, skeleton animation, and rig bindings
still need implementation. Retain a local visual fallback on asset failure.

Do not change skills, weapons, scope designs, movement, server combat, network
messages, or hit validation for this prototype.

## Acceptance checks

1. Inspect silhouette, armor surfaces, textures, and deformation in a preview.
2. Check standing height, planted feet, crouch, head aim, and both weapon grips.
3. Verify damage regions, reloads, death/respawn, scan/smoke reveal, and enemy aura.
4. Compare the old and new models at the same resolution and graphics settings:
   one training bot, a populated training course, and a two-player online match.
5. Record typical and worst frame times, draw calls, triangle counts, loading
   time, and memory. A 60 FPS target has about 16.7 ms available per frame.
6. Run the comparison on the weakest target PC. Reduce detail or effects if the
   budget is exceeded before enabling VEX throughout the game.

Only proceed to SPECTRA, ZERO, or AXIOM after VEX passes visual and performance
review. No smoothness claim can be made until the prototype is measured.

## Rifle walk fitting study

`vxr9_game_reference.glb` is a Blender reference exported from the project's
existing VXR-9 weapon model. `vex_rifle_walk_study.blend` fits it to the VEX
walk using Blender hand anchors and constraints, without changing the walk.
Across the 42-frame loop, the weapon's grip landmarks stay within 1 mm of
those anchors. This does not verify finger placement or prevent mesh clipping.
The Blender constraints do not implement runtime weapon attachment.

The reference imports as 87 mesh objects and approximately 10,194 triangles,
in addition to the character. It is not optimized or tested in the game. Review
the grip and armor deformation, optimize the asset and draw calls, implement
runtime attachment, and measure performance on the target PC before use.

A close-up grip review at frame 10 is available in `vex_grip_check_front.png`
and `vex_grip_check_above.png`. The weapon aligns to hand-bone landmarks, but
this does not establish exact finger-to-grip contact. The body has finger-bone
weights; the bodysuit has few finger-group weights, which alone does not prove
an issue without checking which vertices it contains. Further manual posing and
animation-frame inspection are required before claiming a finished grip.

A standalone production-build browser preview is available at
`/vex-preview.html`. It uses `client/public/vex-preview/vex-walk.glb`, exported
from the rifle walk study with sampled animation, and plays the character and
rifle animation tracks together. It is a review page, not a playable character.
Its approximately 1.2 MB GLB and many meshes have not been optimized or
profiled on the target computer. Publishing the preview requires a deployment.

`vex_rifle_idle_study.blend` applies the downloaded Mixamo rifle idle to the
same VEX rig and retains the original study separately. Its 53 body rest bones
match; the VEX rig also has four cape bones. The support-hand attachment differs
from its rifle socket by up to approximately 3.8 cm during this idle, so the
grip needs adjustment. The standalone browser preview can switch between the
walk and idle studies. They are separate prototype exports, not blended game
movement, and neither has been tested on the target machine.
