"""Create an editable VEX visual study from the CC0-fitted draft in Blender.

Run: blender --background --factory-startup --disable-autoexec vex_prototype_draft.blend --python add_vex_details.py
This is an art study, not a rigged or optimized game asset.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(bpy.data.filepath).parent
if bpy.data.filepath.endswith('vex_prototype_draft.blend') is False:
    raise RuntimeError('Open vex_prototype_draft.blend before running this script')
scene=bpy.context.scene
human=bpy.data.objects['Human']
armor=bpy.data.objects['VEX armor - source draft']
bodysuit=bpy.data.objects['VEX bodysuit - source draft']
mask=bpy.data.objects['VEX face mask - source draft']
hood=bpy.data.objects['VEX hood - source draft']
depsgraph=bpy.context.evaluated_depsgraph_get()

def material(name,color,metallic=0,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=.38
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m
steel=material('VEX | brushed blue-black alloy',(.048,.10,.15),.68)
trim=material('VEX | titanium edges',(.20,.34,.40),.65)
light=material('VEX | cyan energy',(.025,.80,1.0),.12,1.8)
lightdim=material('VEX | blue energy',(.01,.29,.42),.25,.9)
cape=material('VEX | midnight cape',(.013,.043,.068),.18)

# Raycast existing fitted, non-primitive meshes to keep drawn plating aligned
# with the body instead of overlaying a flat billboard.
trees={o.name:BVHTree.FromObject(o,depsgraph) for o in (armor,bodysuit,mask,hood)}
def project(x,z,objects,offset=.003):
    hits=[]
    for o in objects:
        inv=o.matrix_world.inverted(); origin=inv @ Vector((x,-2,z))
        direction=(inv.to_3x3() @ Vector((0,1,0))).normalized()
        point,normal,index,distance=trees[o.name].ray_cast(origin,direction,5)
        if point is not None:
            world=o.matrix_world @ point
            hits.append(world.y)
    if not hits:
        return None
    return (x,min(hits)-offset,z)

def make_mesh(name,verts,faces,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    obj.data.materials.append(mat);obj.parent=human
    return obj

def stripe(name,points,width,mat,objects,offset=.004):
    verts=[]
    for i,(x,z) in enumerate(points):
        prev=Vector(points[max(i-1,0)]);nxt=Vector(points[min(i+1,len(points)-1)])
        tangent=(nxt-prev).normalized(); perpendicular=Vector((-tangent.y,tangent.x))*width/2
        for side in (-1,1):
            p=project(x+perpendicular.x*side,z+perpendicular.y*side,objects,offset)
            if p is None:
                print('Skipped detail with missing surface:',name,x,z)
                return None
            verts.append(p)
    return make_mesh(name,verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)],mat)

# Each accent is a slim mesh: no point lights, particles, physics or textures.
# Coordinates are in the same metre scale as the MPFB body.
for side in (-1,1):
    def path(points): return [(side*x,z) for x,z in points]
    stripe('VEX | visor energy',path([(.011,1.548),(.031,1.539),(.056,1.548)]),.008,light,(mask,hood),.004)
    stripe('VEX | visor brow',path([(.012,1.558),(.037,1.565),(.059,1.558)]),.004,trim,(mask,hood),.004)
    stripe('VEX | breastplate rim',path([(.01,1.348),(.06,1.326),(.113,1.337),(.15,1.323)]),.009,trim,(armor,bodysuit),.004)
    stripe('VEX | breastplate energy',path([(.012,1.319),(.045,1.298),(.09,1.31),(.13,1.29)]),.006,lightdim,(armor,bodysuit),.006)
    stripe('VEX | chest chevron',path([(.008,1.185),(.037,1.212),(.072,1.22)]),.006,light,(armor,bodysuit),.005)
    stripe('VEX | lower armor',path([(.03,1.082),(.066,1.065),(.097,1.079)]),.006,trim,(armor,bodysuit),.005)
    stripe('VEX | thigh energy',path([(.101,.72),(.13,.68),(.139,.62)]),.006,lightdim,(armor,bodysuit),.005)
    stripe('VEX | shin detail',path([(.147,.40),(.15,.32),(.16,.26)]),.006,lightdim,(armor,bodysuit),.005)

# A separate panel on each side of the spine. Low-poly surfaces can later be
# weighted to a small number of bones; there is no real-time cloth simulation.
for side in (-1,1):
    verts=[];columns=5;rows=11
    for row in range(rows):
        t=row/(rows-1)
        for col in range(columns):
            u=col/(columns-1)
            center=.055+.11*t; width=.075+.17*math.sin(t*math.pi*.6)
            x=side*(center+u*width)
            y=.105+.065*t+.022*math.sin(u*math.pi*2+t*5)
            z=1.38-1.03*t-.07*u*t + .035*math.sin(t*math.pi*2+u*2)*t
            verts.append((x,y,z))
    faces=[]
    for row in range(rows-1):
        for col in range(columns-1):
            i=row*columns+col;faces.append((i,i+1,i+1+columns,i+columns))
    panel=make_mesh('VEX | left cape' if side<0 else 'VEX | right cape',verts,faces,cape)
    for polygon in panel.data.polygons: polygon.use_smooth=True
    solid=panel.modifiers.new('Thin cape edge','SOLIDIFY');solid.thickness=.002
    # A thin inset strip follows the outer hem and is part of the mesh design.
    edge=[]
    for row in range(rows):
        t=row/(rows-1)
        for u in (.93,.975):
            center=.055+.11*t;width=.075+.17*math.sin(t*math.pi*.6)
            edge.append((side*(center+u*width),.105+.065*t+.022*math.sin(u*math.pi*2+t*5)-.002,1.38-1.03*t-.07*u*t+.035*math.sin(t*math.pi*2+u*2)*t))
    make_mesh('VEX | cape energy seam',edge,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(rows-1)],lightdim)

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D': area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT');human.select_set(True);bpy.context.view_layer.objects.active=human
out=root/'vex_visual_study.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('VEX_STUDY_SAVED',out)
