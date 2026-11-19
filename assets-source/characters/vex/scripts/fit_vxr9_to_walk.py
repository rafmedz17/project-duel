"""Fit the game's exported VXR-9 reference to the VEX walk study.

The rifle model was exported from client/src/game/weapons/ArsenalModel.jsx.
The rig follows both hand-bone tails using its existing named grip sockets.
This is a Blender review setup; tracking constraints are not game integration.
"""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name!='vex_walk_refined_study.blend': raise RuntimeError('Open vex_walk_refined_study.blend first')
glb=root/'vxr9_game_reference.glb'
if not glb.is_file():raise RuntimeError('Missing VXR-9 game model export')
rig=bpy.data.objects['VEX | experimental skeleton'];scene=bpy.context.scene
for name in ('hand_l','hand_r'):
    if not rig.pose.bones.get(name): raise RuntimeError('Missing hand bone '+name)
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(glb))
imported=set(bpy.data.objects)-before
found={o.name:o for o in imported}
gun=found.get('VXR9_Export');right_grip=found.get('weapon-grip-right');left_grip=found.get('weapon-grip-left')
if not all((gun,right_grip,left_grip)):raise RuntimeError('The VXR-9 export is missing named attachment sockets')
bpy.context.view_layer.update()
# glTF is transformed from game coordinates into Blender's Z-up space.
right_local=gun.matrix_world.inverted() @ right_grip.matrix_world.translation
left_local=gun.matrix_world.inverted() @ left_grip.matrix_world.translation
axis=left_local-right_local
if axis.length<.05:raise RuntimeError('VXR-9 grip spacing is invalid')

def anchor(name,bone):
    obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj)
    obj.empty_display_type='PLAIN_AXES';obj.empty_display_size=.025
    obj.parent=rig;obj.parent_type='BONE';obj.parent_bone=bone;obj.location=(0,0,0)
    return obj
right=anchor('VEX | rifle right-hand anchor','hand_r')
left=anchor('VEX | rifle support-hand target','hand_l')
distances=[]
for frame in range(scene.frame_start,scene.frame_end+1):
    scene.frame_set(frame);bpy.context.view_layer.update()
    distances.append((left.matrix_world.translation-right.matrix_world.translation).length)
scale=(sum(distances)/len(distances))/axis.length
if not .35<scale<1:raise RuntimeError('Unexpected weapon scale: '+str(scale))
scene.frame_set(scene.frame_start);bpy.context.view_layer.update()
aim=bpy.data.objects.new('VEX | rifle two-hand aim',None);scene.collection.objects.link(aim)
aim.empty_display_type='PLAIN_AXES';aim.empty_display_size=.035;aim.parent=right;aim.location=(0,0,0)
track=aim.constraints.new('TRACK_TO');track.name='Align rifle to support hand';track.target=left;track.track_axis='TRACK_Y';track.up_axis='UP_Z'
# Transform the gun so the right socket is the pivot and its support socket
# points along aim's +Y; the constraint then aligns +Y to the left hand.
offset=bpy.data.objects.new('VEX | VXR-9 grip offset',None);scene.collection.objects.link(offset)
offset.parent=aim;offset.rotation_mode='QUATERNION';q=axis.normalized().to_track_quat('Y','Z').inverted();offset.rotation_quaternion=q;offset.scale=(scale,)*3;offset.location=-(q @ right_local)*scale
gun.parent=offset;gun.location=(0,0,0);gun.rotation_mode='XYZ';gun.rotation_euler=(0,0,0);gun.scale=(1,1,1)
bpy.context.view_layer.update()
right_err=[];left_err=[]
for frame in range(scene.frame_start,scene.frame_end+1):
    scene.frame_set(frame);bpy.context.view_layer.update()
    right_err.append((right.matrix_world.translation-right_grip.matrix_world.translation).length)
    left_err.append((left.matrix_world.translation-left_grip.matrix_world.translation).length)
if max(right_err)>.002 or max(left_err)>.01:raise RuntimeError('Grip alignment outside tolerance: '+repr((max(right_err),max(left_err))))
scene.frame_set(scene.frame_start);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
out=root/'vex_rifle_walk_study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('VEX_RIFLE_STUDY_SAVED',out,'scale',round(scale,4),'hand_distance',round(min(distances),4),round(max(distances),4),'grip_errors_m',round(max(right_err),5),round(max(left_err),5),'weapon_meshes',sum(o.type=='MESH' for o in imported))
