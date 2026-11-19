"""Apply the downloaded Mixamo idle to a separate VEX rifle study."""
import bpy, math
from pathlib import Path
root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name != 'vex_rifle_walk_study.blend': raise RuntimeError('Open the rifle walk study first')
rig=bpy.data.objects['VEX | experimental skeleton']; before=set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(root/'source/animations/mixamo/Rifle Idle.fbx'), use_anim=True)
new=set(bpy.data.objects)-before
imports=[o for o in new if o.type=='ARMATURE']
if len(imports)!=1: raise RuntimeError('Expected one imported armature')
other=imports[0]
if not other.animation_data or not other.animation_data.action: raise RuntimeError('Idle animation missing')
for bone in other.data.bones:
 target=rig.data.bones.get(bone.name)
 if target is None or max(abs(bone.matrix_local[i][j]-target.matrix_local[i][j]) for i in range(4) for j in range(4))>2e-4: raise RuntimeError('Incompatible bone '+bone.name)
clip=other.animation_data.action.copy();clip.name='VEX | Mixamo rifle idle study';clip.use_fake_user=True
for curve in list(clip.fcurves):
 if not curve.data_path.startswith('pose.bones['): clip.fcurves.remove(curve)
rig.animation_data.action=clip
if len(clip.slots)!=1: raise RuntimeError('Unexpected animation slots')
rig.animation_data.action_slot=clip.slots[0]
for bone in rig.pose.bones:
 bone.rotation_mode='QUATERNION';bone.location=(0,0,0);bone.rotation_quaternion=(1,0,0,0);bone.scale=(1,1,1)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=math.floor(clip.frame_range.x);scene.frame_end=math.ceil(clip.frame_range.y)
for frame in (scene.frame_start,(scene.frame_start+scene.frame_end)//2,scene.frame_end):
 scene.frame_set(frame);bpy.context.view_layer.update()
 for name in ('pelvis','spine_03','upperarm_l','lowerarm_l','hand_l','upperarm_r','hand_r','thigh_l'):
  a=rig.pose.bones[name].matrix_basis;b=other.pose.bones[name].matrix_basis
  if max(abs(a[i][j]-b[i][j]) for i in range(4) for j in range(4))>1e-4: raise RuntimeError('Pose mismatch '+name+' frame '+str(frame))
for obj in new: bpy.data.objects.remove(obj,do_unlink=True)
errors=[]
for frame in range(scene.frame_start,scene.frame_end+1):
 scene.frame_set(frame);bpy.context.view_layer.update()
 for side in ('right','left'):
  anchor=bpy.data.objects['VEX | rifle right-hand anchor' if side=='right' else 'VEX | rifle support-hand target']
  grip=bpy.data.objects['weapon-grip-'+side]
  errors.append((side,frame,(anchor.matrix_world.translation-grip.matrix_world.translation).length))
print('IDLE_FIT_MAX',max(errors,key=lambda e:e[2]),'frames',scene.frame_start,scene.frame_end)
scene.frame_set(scene.frame_start);bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
out=root/'vex_rifle_idle_study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out));print('SAVED',out)
