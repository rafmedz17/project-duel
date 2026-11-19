"""Create editable early VEX idle and in-place walk studies in separate files.

Run with Blender 4.5 against vex_low_rig_study.blend. These are hand-authored
blocking passes for review, not motion-captured or final game animations.
"""
import bpy,math
from pathlib import Path
root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name!='vex_low_rig_study.blend': raise RuntimeError('Open vex_low_rig_study.blend first')
rig=bpy.data.objects['VEX | experimental skeleton']
scene=bpy.context.scene
scene.render.fps=24
bones=['Root','pelvis','spine_01','spine_02','spine_03','head','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r']
for name in bones:
    if name not in rig.pose.bones: raise RuntimeError('Missing rig bone '+name)
    rig.pose.bones[name].rotation_mode='XYZ'

def reset():
    for bone in rig.pose.bones:
        bone.location=(0,0,0);bone.rotation_euler=(0,0,0);bone.scale=(1,1,1)

def insert(name,frame,rot=(0,0,0),loc=None):
    bone=rig.pose.bones[name];bone.rotation_euler=rot
    bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=name)
    if loc is not None:
        bone.location=loc;bone.keyframe_insert(data_path='location',frame=frame,group=name)

def action(name):
    reset();rig.animation_data_clear();rig.animation_data_create()
    clip=bpy.data.actions.new(name);clip.use_fake_user=True;rig.animation_data.action=clip
    return clip

idle=action('VEX | Idle - blocking')
for frame in (1,7,13,19,25,31,37,43,49):
    t=(frame-1)/48;wave=math.sin(2*math.pi*t);breath=(1-math.cos(2*math.pi*t))/2
    insert('Root',frame,loc=(0,0,.002*breath))
    insert('spine_02',frame,(.014*breath,0,.004*wave))
    insert('spine_03',frame,(-.009*breath,0,-.004*wave))
    insert('head',frame,(.004*breath,0,.006*wave))
    insert('upperarm_l',frame,(.006*wave,0,0));insert('upperarm_r',frame,(-.006*wave,0,0))

walk=action('VEX | Walk forward - blocking')
for frame in range(1,26,2):
    phase=2*math.pi*(frame-1)/24;stride=math.sin(phase);bounce=(1-math.cos(2*phase))/2
    insert('Root',frame,loc=(0,0,.009*bounce))
    insert('pelvis',frame,(0,.018*stride,.012*stride))
    insert('spine_01',frame,(.015,0,-.018*stride))
    insert('spine_03',frame,(-.012,0,.024*stride))
    insert('head',frame,(0,0,-.012*stride))
    for side,sign in [('l',1),('r',-1)]:
        swing=stride*sign
        # Knee bends during the swing portion; ankle counter-rotates slightly.
        knee=.20*max(0,swing)
        insert('thigh_'+side,frame,(.25*swing,0,0))
        insert('calf_'+side,frame,(-knee,0,0))
        insert('foot_'+side,frame,(.07*swing+.06*knee,0,0))
        insert('upperarm_'+side,frame,(-.14*swing,0,0))
        insert('lowerarm_'+side,frame,(.025+.025*max(0,-swing),0,0))

# Provide one easy-to-play file for each clip. Both actions remain in each file.
bpy.context.view_layer.objects.active=rig;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for clip,filename,end in [(walk,'vex_walk_study.blend',25),(idle,'vex_idle_study.blend',49)]:
    rig.animation_data.action=clip;scene.frame_start=1;scene.frame_end=end;scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(root/filename))
    print('VEX_CLIP_SAVED',filename,clip.name,'frames',end)
