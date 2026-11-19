# VEX draft asset provenance

This is an early editable art study. Check the license of every additional asset
before using it. Do not assume licenses for other user-contributed packs match.

- The starting human was created by the project owner in MPFB. MakeHuman's
  [official license](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)
  describes its bundled graphical assets and MPFB output as CC0; code has a
  separate license.
- The rig study uses MPFB's bundled `game_engine` skeleton and weights. MPFB's
  [license](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md)
  lists bundled rigs and poses under CC0; the MPFB program itself is GPL-licensed.
- `matcreator_mc-bodysuit-2021` and `matcreator_mc-scifi-armor_jupiter7`, by
  MatCreator: CC0, from MakeHuman's official
  [suits02 pack](https://static.makehumancommunity.org/assets/assetpacks/suits02.html).
- `donitz_monk_robe_hood`, by Donitz: CC0, from the same suits02 pack.
- `culturalibre_hero-heroine_hood_2`, by culturalibre, used as an early mask:
  CC0, from MakeHuman's official
  [masks01 pack](https://static.makehumancommunity.org/assets/assetpacks/masks01.html).
- `matcreator_mc-scifi-armor_guardian`, by MatCreator: CC0, also from the
  suits02 pack. Source is retained for evaluation; it is not in the prototype.

The files were retrieved from the official pack in November 2026. Original
asset headers identify their authors and CC0 status. Some optional source
texture files were not downloaded: the draft uses simple custom materials.

`vex_visual_study.blend` also contains original cape and accent meshes created
for this project by `scripts/add_vex_details.py`. They use no third-party
textures or external assets.

The idle and walk blocking animations were created for this project. The user
also downloaded `source/animations/mixamo/Walking.fbx` from Mixamo on 2026-11-20;
the exact library title was not recorded. SHA-256:
`7f5779e9da4a706aea3f9af35b1cc2e122e674c000ae97ceec14ab5fa68e4627`.
The Mixamo walk study uses a copy of the animation with object-level motion
removed; the refined study adds original cape bone motion and adjusts the CC0
armor geometry. [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
permits royalty-free use of Mixamo animations in video games; Mixamo assets are
not represented here as CC0.

`vxr9_game_reference.glb` is a reference exported from this project's own
procedural VXR-9 weapon in `client/src/game/weapons/ArsenalModel.jsx` and its
weapon configuration. It is used for the Blender rifle fitting study.

The user downloaded `source/animations/mixamo/Rifle Idle.fbx` on 2026-11-20.
The file contains a copy of the character mesh, but the idle study uses only
its animation with the existing VEX meshes. SHA-256:
`9fbcb0a0c5839767d05cf8553041bbdb16ed9ff632bc198ac7aef7c9d1a416b6`.
Mixamo's terms referenced above apply to this animation.

The user downloaded `source/animations/mixamo/Rifle Crouch Walk.fbx` on
2026-11-20 (SHA-256 `a4e70d68e04221e5284c482523b3016ae5b32e1b3b9792752fa46cdc920575a4`).
This Mixamo animation was retained as source but not applied to the study: its
bone rest transforms differ from the existing VEX rig, and it needs retargeting
or a compatible export. Mixamo's terms referenced above apply.
