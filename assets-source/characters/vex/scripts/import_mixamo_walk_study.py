"""Build an in-place Mixamo walk study on the existing reduced-detail VEX.

Input: vex_low_rig_study.blend and source/animations/mixamo/Walking.fbx.
This keeps the original FBX untouched; it removes FBX armature-object motion
from a copied action so game movement can eventually control position. It is
an art/rig test and must be reviewed before use in the game.
"""
import bpy,math
from pathlib import Path
root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name!='vex_low_rig_study.blend': raise RuntimeError('Open vex_low_rig_study.blend as input')
rig=bpy.data.objects['VEX | experimental skeleton']
source=root/'source/animations/mixamo/Walking.fbx'
if not source.is_file(): raise RuntimeError('Missing downloaded Walking.fbx')
before=set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(source),use_anim=True)
new=set(bpy.data.objects)-before
imports=[o for o in new if o.type=='ARMATURE']
if len(imports)!=1: raise RuntimeError('Expected one armature in the FBX')
other=imports[0]
if not other.animation_data or not other.animation_data.action: raise RuntimeError('No animation in FBX')
if {b.name for b in rig.data.bones}!={b.name for b in other.data.bones}: raise RuntimeError('Rig bones do not match')
for bone in rig.data.bones:
    a=bone.matrix_local;b=other.data.bones[bone.name].matrix_local
    if max(abs(a[i][j]-b[i][j]) for i in range(4) for j in range(4))>2e-4: raise RuntimeError('Rest bone differs: '+bone.name)
raw=other.animation_data.action
clip=raw.copy();clip.name='VEX | Mixamo rifle walk - in-place study';clip.use_fake_user=True
# Mixamo's uploaded FBX has animated object-level displacement and rotation.
# Preserve only the skeleton tracks, leaving gameplay to position the body.
removed=[]
for curve in list(clip.fcurves):
    if not curve.data_path.startswith('pose.bones['): removed.append(curve.data_path);clip.fcurves.remove(curve)
if not removed: raise RuntimeError('Expected object-level travel in Mixamo clip')
rig.animation_data_clear();rig.animation_data_create();rig.animation_data.action=clip
if len(clip.slots)!=1: raise RuntimeError('Unexpected animation slot count')
rig.animation_data.action_slot=clip.slots[0]
for p in rig.pose.bones:
    p.rotation_mode='QUATERNION';p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
rig.location=(0,0,0);rig.rotation_mode='XYZ';rig.rotation_euler=(0,0,0);rig.scale=(1,1,1)
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=math.floor(clip.frame_range.x);scene.frame_end=math.ceil(clip.frame_range.y)
# Verify that the copied animation reproduces bone-local poses before removal.
for frame in (scene.frame_start,(scene.frame_start+scene.frame_end)//2,scene.frame_end):
    scene.frame_set(frame);bpy.context.view_layer.update()
    for name in ('pelvis','spine_03','upperarm_l','lowerarm_l','thigh_l','calf_l','foot_r'):
        a=rig.pose.bones[name].matrix_basis;b=other.pose.bones[name].matrix_basis
        delta=max(abs(a[i][j]-b[i][j]) for i in range(4) for j in range(4))
        if delta>1e-4: raise RuntimeError('Animation mismatch at '+name+' frame '+str(frame)+': '+str(delta))
for obj in new: bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.view_layer.objects.active=rig;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
scene.frame_set(scene.frame_start)
out=root/'vex_mixamo_walk_study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('VEX_MIXAMO_STUDY_SAVED',out,'frames',scene.frame_start,scene.frame_end,'removed object channels',sorted(set(removed)))
