# Reference character portraits

Generated with the built-in `image_gen` tool using the user's four-character PROJECT DUEL sheet as the design reference. PNGs retain the original transparent artwork. The game loads the smaller WebP copies (same dimensions and alpha, quality 0.90); all four together are approximately 1 MB. These are UI portraits, not 3D meshes. The playable armor is authored separately in `game/characters/armorGeometry.js`.

Files: `vex.png` / `vex.webp`, `spectra.png` / `spectra.webp`, `zero.png` / `zero.webp`, `axiom.png` / `axiom.webp`.

Final prompt template (one generation per character; substitute its description below for `{description}`):

> Create a production game character cutout portrait based closely on the uploaded PROJECT DUEL four-character reference sheet. Reference only; output just ONE character: {description} Full body from boots to head, centered with 8% transparent margin, consistent front three-quarter standing heroic pose, face toward viewer, arms resting close to sides, relaxed hands. Premium detailed realistic sci-fi armor, sculpted beveled armor plates, visible black flexible joints, brushed metal edges, restrained emissive accents, high-quality cinematic game render with crisp cool studio rim light. Preserve the reference's design and palette. No weapons, no skill effect, no glowing cloud, no pedestal, no scenery, no panel, no text, no logos, no watermark. Genuinely transparent background, portrait composition. This will be the character art in a game loadout selector.

Descriptions:

- **Vex:** VEX, the FIRST cyan-blue hooded phantom assassin. Deep sculpted navy hood, hidden dark face with luminous cyan V-shaped eyes, streamlined layered navy/titanium angular armor, bright cyan seams, asymmetric short split cape, slim athletic silhouette.
- **Spectra:** SPECTRA, the SECOND purple shield guardian. Dark purple helmet with narrow violet visor, broad silver/gunmetal segmented pauldrons and torso, glowing purple armor seams and reactor, powerful athletic armored silhouette. No shield prop.
- **Zero:** ZERO, the THIRD gold/yellow tactical fighter. Graphite segmented combat exosuit with gold/yellow angular chest armor, gold knee plates, helmet with pointed swept-back crest and amber slit visor, compact waist pouches, slim athletic silhouette.
- **Axiom:** AXIOM, the FOURTH red firestorm fighter. Black/gunmetal heavy angular plate armor with crimson shoulder shells and chest accents, menacing red faceted helmet, red visor, long split dark coat with scarlet lining, athletic broad-shouldered silhouette.
