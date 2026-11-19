import bpy
from pathlib import Path
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in {'MESH','ARMATURE','EMPTY'} and not o.hide_get(): o.select_set(True)
bpy.context.scene.frame_set(1)
out=Path.cwd()/'client/public/vex-preview/vex-walk.glb';out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='SCENE',export_force_sampling=True,export_frame_range=True)
print('EXPORTED',out,out.stat().st_size)
