"""Refine the VEX Mixamo walk study in a separate editable Blender file.

A conservative rest-pose clearance adjustment reduces armor/undersuit overlap.
A four-bone cape rig adds a small looping sway without cloth simulation. This
is a reviewable study, not a final deformation or performance guarantee.
"""
import bpy,math
from pathlib import Path
from mathutils.bvhtree import BVHTree
root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name!='vex_mixamo_walk_study.blend': raise RuntimeError('Open vex_mixamo_walk_study.blend as input')
rig=bpy.data.objects['VEX | experimental skeleton'];armor=bpy.data.objects['VEX armor - source draft'];suit=bpy.data.objects['VEX bodysuit - source draft']
if rig.animation_data.action.name!='VEX | Mixamo rifle walk - in-place study': raise RuntimeError('Expected the verified Mixamo walk action')
scene=bpy.context.scene;scene.frame_set(1)
# Avoid editing a pose-dependent coordinate or overwriting the original model.
rig.data.pose_position='REST';bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(suit,deps)
changes=[]
for vertex in armor.data.vertices:
    world=armor.matrix_world @ vertex.co;point=suit.matrix_world.inverted() @ world
    hit,normal,_,distance=tree.find_nearest(point,.015)
    if hit is None: continue
    signed=(point-hit).dot(normal)
    if signed<.002:
        amount=min(.004,max(0,.003-signed))
        world_delta=suit.matrix_world.to_3x3() @ (normal*amount)
        local_delta=armor.matrix_world.inverted().to_3x3() @ world_delta
        changes.append((vertex.index,local_delta))
for index,delta in changes: armor.data.vertices[index].co+=delta
armor.data.update()

# Two bones per panel, with smooth skin weights. Upper cape follows the body;
# lower cape adds subtle delayed motion. There is no cloth simulation.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
spine=rig.data.edit_bones['spine_03']
for side,sign in [('L',-1),('R',1)]:
    upper=rig.data.edit_bones.new('VEX_cape_'+side+'_upper')
    upper.head=(sign*.09,.12,1.38);upper.tail=(sign*.14,.15,.96);upper.parent=spine
    lower=rig.data.edit_bones.new('VEX_cape_'+side+'_lower')
    lower.head=upper.tail;lower.tail=(sign*.20,.19,.36);lower.parent=upper;lower.use_connect=True
bpy.ops.object.mode_set(mode='OBJECT')

def smoothstep(v):
    v=max(0,min(1,v));return v*v*(3-2*v)
for obj in [o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('VEX | ') and 'cape' in o.name]:
    # Match the two trim strips to their panel using their x positions.
    mean_x=sum(v.co.x for v in obj.data.vertices)/len(obj.data.vertices)
    side='L' if mean_x<0 else 'R'
    for group in list(obj.vertex_groups): obj.vertex_groups.remove(group)
    top=obj.vertex_groups.new(name='spine_03');upper=obj.vertex_groups.new(name='VEX_cape_'+side+'_upper');lower=obj.vertex_groups.new(name='VEX_cape_'+side+'_lower')
    for vertex in obj.data.vertices:
        t=(1.38-vertex.co.z)/1.03
        top_w=1-smoothstep(t/.18);low_w=smoothstep((t-.28)/.45);upper_w=max(0,1-top_w-low_w)
        total=top_w+upper_w+low_w
        for group,weight in ((top,top_w/total),(upper,upper_w/total),(lower,low_w/total)):
            if weight>1e-6:group.add([vertex.index],weight,'REPLACE')

original=rig.animation_data.action;action=original.copy();action.name='VEX | Mixamo rifle walk - cape and armor study';action.use_fake_user=True
rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
for side,sign in [('L',-1),('R',1)]:
    upper=rig.pose.bones['VEX_cape_'+side+'_upper'];lower=rig.pose.bones['VEX_cape_'+side+'_lower']
    upper.rotation_mode='XYZ';lower.rotation_mode='XYZ'
    for frame in list(range(scene.frame_start,scene.frame_end+1,3))+([scene.frame_end] if (scene.frame_end-scene.frame_start)%3 else []):
        phase=2*math.pi*(frame-scene.frame_start)/(scene.frame_end-scene.frame_start)
        upper.rotation_euler=(.025*math.sin(phase-.5),.012*sign*math.sin(phase+.25),.012*sign*math.sin(phase-.3))
        lower.rotation_euler=(.048*math.sin(phase-1.1),.020*sign*math.sin(phase-.4),.018*sign*math.sin(phase-.8))
        upper.keyframe_insert(data_path='rotation_euler',frame=frame,group=upper.name)
        lower.keyframe_insert(data_path='rotation_euler',frame=frame,group=lower.name)
rig.data.pose_position='POSE';scene.frame_set(scene.frame_start);bpy.context.view_layer.update()
out=root/'vex_walk_refined_study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('VEX_REFINED_SAVED',out,'clearance vertices',len(changes),'bones',len(rig.data.bones),'frames',scene.frame_start,scene.frame_end)
