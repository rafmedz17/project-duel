"""Create an experimental reduced-mesh VEX rig from vex_rig_study.blend.

This bakes the current shape and mask modifiers into a separate copy, reduces
geometry, and retains the armature and temporary rig-test animation. The result
is only a candidate: inspect all poses and measure gameplay performance.
"""
import bpy
from pathlib import Path
root=Path(bpy.data.filepath).parent
if Path(bpy.data.filepath).name!='vex_rig_study.blend': raise RuntimeError('Open vex_rig_study.blend as input')
rig=bpy.data.objects['VEX | experimental skeleton']
bpy.context.scene.frame_set(1)
ratios={'Human':.15,'VEX bodysuit - source draft':.07,'VEX armor - source draft':.11,'VEX face mask - source draft':.25,'VEX hood - source draft':.22}
def tris(mesh): return sum(len(p.vertices)-2 for p in mesh.polygons)
def reduce_weights(obj):
    bone_groups={g.index for g in obj.vertex_groups if rig.data.bones.get(g.name) and rig.data.bones[g.name].use_deform}
    for v in obj.data.vertices:
        entries=sorted([(g.group,g.weight) for g in v.groups if g.group in bone_groups and g.weight>0],key=lambda item:item[1],reverse=True)
        if not entries: raise RuntimeError('Unweighted vertex in '+obj.name+' '+str(v.index))
        keep=entries[:4];total=sum(w for _,w in keep)
        for index,_ in entries[4:]: obj.vertex_groups[index].remove([v.index])
        for index,weight in keep: obj.vertex_groups[index].add([v.index],weight/total,'REPLACE')
for obj in [o for o in bpy.data.objects if o.type=='MESH']:
    armatures=[m for m in obj.modifiers if m.type=='ARMATURE' and m.object==rig]
    if len(armatures)!=1: raise RuntimeError('Expected one rig modifier on '+obj.name)
    arm=armatures[0];arm.show_viewport=False
    ratio=ratios.get(obj.name)
    if ratio:
        mod=obj.modifiers.new('Temporary low-detail reduction','DECIMATE');mod.ratio=ratio
    # Evaluated meshes bake shape keys and visibility masks at rest, leaving
    # their deform-weight data layers intact. The rig stays live afterwards.
    bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(depsgraph)
    mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
    before=tris(obj.data);obj.data=mesh
    for modifier in list(obj.modifiers):
        if modifier!=arm: obj.modifiers.remove(modifier)
    arm.show_viewport=True
    reduce_weights(obj)
    print('VEX_REDUCE',obj.name,before,'->',tris(mesh),'triangles')
out=root/'vex_low_rig_study.blend';bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('VEX_LOW_STUDY_SAVED',out)
