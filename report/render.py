# Renders each raw Lux3D GLB to report/img/<name>.png (run: blender -b -P report/render.py).
import bpy, math, os, mathutils
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(f"{root}/public/report", exist_ok=True)
for name in ["remnant-a", "remnant-b", "remnant-c", "kitchen"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f"{root}/lux3d/raw/{name}.glb")
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    pts = [o.matrix_world @ mathutils.Vector(c) for o in objs for c in o.bound_box]
    lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
    hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
    c, size = (lo + hi) / 2, (hi - lo).length
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.scene.collection.objects.link(cam)
    cam.location = c + mathutils.Vector((0.9, -1.1, 0.9)) * size
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    for loc, e in [((1, -1, 2), 4), ((-2, -1, 1), 1.5)]:
        sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
        sun.data.energy = e
        sun.rotation_euler = (mathutils.Vector((0, 0, 0)) - mathutils.Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(sun)
    w = bpy.data.worlds.new("w"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.92, 0.9, 1)
    bpy.context.scene.world = w
    s = bpy.context.scene
    s.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [i.identifier for i in s.render.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    s.render.resolution_x, s.render.resolution_y = 900, 700
    s.render.filepath = f"{root}/public/report/{name}.png"
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name, len(objs), sum(len(o.data.polygons) for o in objs), [round(x, 3) for x in (hi - lo)])
