"""Export a neutral, rigged VEX FBX for an optional Mixamo compatibility test.

Run with Blender 4.5 on vex_low_rig_study.blend. The file is an experiment:
Mixamo must successfully recognize the rig, and downloaded animation still
needs review, possible retargeting and armor cleanup.
"""
import bpy
from pathlib import Path
root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name!='vex_low_rig_study.blend': raise RuntimeError('Open vex_low_rig_study.blend first')
rig=bpy.data.objects['VEX | experimental skeleton']
rig.animation_data_clear()
for bone in rig.pose.bones:
    bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0);bone.location=(0,0,0);bone.scale=(1,1,1)
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for name in ['Human','VEX bodysuit - source draft','VEX armor - source draft','VEX face mask - source draft','VEX hood - source draft']:
    obj=bpy.data.objects[name]
    if not any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers): raise RuntimeError('Missing rig on '+name)
    obj.select_set(True)
bpy.context.view_layer.objects.active=rig
out=root/'vex_mixamo_compatibility_test.fbx'
bpy.ops.export_scene.fbx(filepath=str(out),use_selection=True,object_types={'ARMATURE','MESH'},add_leaf_bones=False,bake_anim=False,path_mode='COPY',embed_textures=True)
print('VEX_MIXAMO_FBX',out)
