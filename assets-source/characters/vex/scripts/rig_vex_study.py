"""Build a separate, editable experimental VEX rig using MPFB's game-engine rig.

Run in Blender 4.5 with MPFB installed:
  blender --background --factory-startup --disable-autoexec vex_visual_study.blend --python rig_vex_study.py
The output is a deformation study, not a final animation or optimized asset.
"""
import bpy,sys,os,addon_utils
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name!='vex_visual_study.blend':
    raise RuntimeError('Open vex_visual_study.blend as the input')
project=root.parents[2]
user_tmp=project/'.tmp'/'vex-rig-mpfb'
user_tmp.mkdir(parents=True,exist_ok=True)
resource_path=bpy.utils.resource_path
bpy.utils.resource_path=lambda kind,*a,**kw: str(user_tmp) if kind=='USER' else resource_path(kind,*a,**kw)
bpy.utils.extension_path_user=lambda *a,**kw: str(user_tmp/'mpfb')
addon_root=Path(os.environ['APPDATA'])/'Blender Foundation/Blender/4.5/extensions/blender_org'
if not (addon_root/'mpfb').is_dir(): raise RuntimeError('MPFB extension was not found')
sys.path.insert(0,str(addon_root));addon_utils.enable('mpfb',default_set=True,persistent=False)
from mpfb.services.humanservice import HumanService
from mpfb.services.clothesservice import ClothesService
from mpfb.entities.clothes.mhclo import Mhclo

human=bpy.data.objects['Human']
rig=HumanService.add_builtin_rig(human,'game_engine',import_weights=True)
if not rig or not all(n in rig.data.bones for n in ['head','hand_l','hand_r','spine_03']): raise RuntimeError('Humanoid rig is incomplete')
rig.name='VEX | experimental skeleton'
source=root/'source'/'clothes'
assets=[('VEX bodysuit - source draft','matcreator_mc-bodysuit-2021'),('VEX armor - source draft','matcreator_mc-scifi-armor_jupiter7'),('VEX face mask - source draft','culturalibre_hero-heroine_hood_2'),('VEX hood - source draft','donitz_monk_robe_hood')]
for object_name,folder in assets:
    obj=bpy.data.objects[object_name]
    mhclo=Mhclo();mhclo.load(str(source/folder/(folder+'.mhclo')))
    ClothesService.set_up_rigging(human,obj,rig,mhclo,interpolate_weights=True,import_subrig=False,import_weights=False)
    print('VEX_RIGGED',obj.name,len(obj.data.vertices),len(obj.vertex_groups))

# Project each small decorative mesh to the already-weighted body or mask.
# Keep the cape rigidly attached to the upper spine in this first rig study.
armor=bpy.data.objects['VEX armor - source draft'];mask=bpy.data.objects['VEX face mask - source draft']
def weight_index(obj):
    tree=KDTree(len(obj.data.vertices))
    for v in obj.data.vertices: tree.insert(obj.matrix_world @ v.co,v.index)
    tree.balance();return tree
indices={o.name:weight_index(o) for o in [armor,mask]}
rig_bones={bone.name for bone in rig.data.bones if bone.use_deform}
def assign_decor(obj):
    if 'cape' in obj.name:
        group=obj.vertex_groups.new(name='spine_03');group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    else:
        src=mask if 'visor' in obj.name else armor
        tree=indices[src.name]
        for vertex in obj.data.vertices:
            _,index,_=tree.find(obj.matrix_world @ vertex.co)
            weights=[(src.vertex_groups[g.group].name,g.weight) for g in src.data.vertices[index].groups if src.vertex_groups[g.group].name in rig_bones and g.weight>0]
            weights=sorted(weights,key=lambda item:item[1],reverse=True)[:4]
            if not weights: weights=[('head' if src==mask else 'spine_03',1)]
            total=sum(weight for _,weight in weights)
            for name,weight in weights:
                group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                group.add([vertex.index],weight/total,'REPLACE')
    obj.parent=rig
    modifier=obj.modifiers.new('VEX skeleton','ARMATURE');modifier.object=rig
for obj in list(bpy.data.objects):
    if obj.type=='MESH' and obj.name.startswith('VEX | '): assign_decor(obj)

# This is a deliberately small rig test, not a finished run cycle.
bpy.context.view_layer.objects.active=rig
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for name in ('upperarm_l','upperarm_r','thigh_l','thigh_r'):
    rig.pose.bones[name].rotation_mode='XYZ'
for frame,angle in [(1,0),(8,.22),(15,0),(22,-.22),(29,0)]:
    for name,multiplier in [('upperarm_l',1),('upperarm_r',-1),('thigh_l',-1),('thigh_r',1)]:
        bone=rig.pose.bones[name];bone.rotation_euler=(angle*multiplier,0,0)
        bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=name)
if rig.animation_data and rig.animation_data.action: rig.animation_data.action.name='VEX | test step (temporary)'
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=29;bpy.context.scene.frame_set(1)
out=root/'vex_rig_study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('VEX_RIG_SAVED',out,'bones',len(rig.data.bones))
