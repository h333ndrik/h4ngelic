#!/usr/bin/env python3
"""Build the original h4ngelic dress form without external mesh inputs.

Run with Blender 4.x:
  blender -b --factory-startup --python scripts/mannequin-build.py -- \
    --variant B --output public/models/mannequin.glb \
    --report docs/validation/MANNEQUIN-PROCEDURAL/build-report-b.json

The geometry below is authored from fixed numeric profiles in this file. The
script deliberately contains no FBX, OBJ, USDZ, image or third-party asset
import. Its only dependencies are Blender and its bundled Python modules.
"""

import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

SEGMENTS = 32
SEED = 320032
HEIGHT = 1.5
BASE_COLOR_SRGB = (0xF0, 0xEF, 0xEB)
MATERIAL_NAME = "mannequin_matt"

# Dress-form silhouette: bottom opening, hip, waist, bust and shoulders.
# Radii are authored in Blender units; total model height is exactly 1.5.
TORSO_PROFILE = (
    (0.470, 0.000),
    (0.470, 0.118),
    (0.495, 0.139),
    (0.555, 0.140),
    (0.640, 0.133),
    (0.730, 0.116),
    (0.820, 0.100),
    (0.900, 0.104),
    (0.975, 0.115),
    (1.045, 0.120),
    (1.120, 0.124),
    (1.195, 0.130),
    (1.245, 0.122),
    (1.275, 0.086),
    (1.290, 0.056),
    (1.300, 0.000),
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=("A", "B"), default="B")
    parser.add_argument("--output", default="public/models/mannequin.glb")
    parser.add_argument("--report", default="")
    parser.add_argument("--draco", action="store_true")
    return parser.parse_args(argv)


def srgb_channel_to_linear(value):
    channel = value / 255.0
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.cursor.location = (0.0, 0.0, 0.0)


def make_material():
    material = bpy.data.materials.new(MATERIAL_NAME)
    material.use_nodes = True
    material.use_backface_culling = True
    color = tuple(srgb_channel_to_linear(channel) for channel in BASE_COLOR_SRGB)
    material.diffuse_color = (*color, 1.0)
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = 0.85
    principled.inputs["Metallic"].default_value = 0.0
    return material


def mesh_from_rings(name, layers, material):
    vertices = []
    layer_indices = []
    for radius, z in layers:
        if radius <= 1e-8:
            layer_indices.append(("point", len(vertices)))
            vertices.append((0.0, 0.0, z))
            continue
        indices = []
        for segment in range(SEGMENTS):
            angle = math.tau * segment / SEGMENTS
            indices.append(len(vertices))
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
        layer_indices.append(("ring", indices))

    faces = []
    for lower, upper in zip(layer_indices, layer_indices[1:]):
        lower_type, lower_data = lower
        upper_type, upper_data = upper
        if lower_type == "ring" and upper_type == "ring":
            for segment in range(SEGMENTS):
                nxt = (segment + 1) % SEGMENTS
                faces.append((lower_data[segment], lower_data[nxt], upper_data[nxt], upper_data[segment]))
        elif lower_type == "point" and upper_type == "ring":
            for segment in range(SEGMENTS):
                nxt = (segment + 1) % SEGMENTS
                faces.append((upper_data[segment], upper_data[nxt], lower_data))
        elif lower_type == "ring" and upper_type == "point":
            for segment in range(SEGMENTS):
                nxt = (segment + 1) % SEGMENTS
                faces.append((lower_data[segment], lower_data[nxt], upper_data))
        else:
            raise RuntimeError("A lathe cannot connect two axis points directly.")

    # Axis endpoints already close the profile; explicit rims receive a cap.
    bottom_type, bottom = layer_indices[0]
    top_type, top = layer_indices[-1]
    if bottom_type == "ring":
        bottom_center = len(vertices)
        vertices.append((0.0, 0.0, layers[0][1]))
        for segment in range(SEGMENTS):
            nxt = (segment + 1) % SEGMENTS
            faces.append((bottom_center, bottom[nxt], bottom[segment]))
    if top_type == "ring":
        top_center = len(vertices)
        vertices.append((0.0, 0.0, layers[-1][1]))
        for segment in range(SEGMENTS):
            nxt = (segment + 1) % SEGMENTS
            faces.append((top_center, top[segment], top[nxt]))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    return obj


def add_cylinder(name, radius, depth, location=(0.0, 0.0, 0.0), rotation=None, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, end_fill_type="NGON", location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation is not None:
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = rotation
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def add_knob(name, radius, location):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def add_torso(material):
    obj = mesh_from_rings("Torso", [(radius, z) for z, radius in TORSO_PROFILE], material)
    return obj


def add_tripod_base(material):
    parts = [add_cylinder("BaseHub", 0.082, 0.042, (0.0, 0.0, 0.021), vertices=24)]
    up = Vector((0.0, 0.0, 1.0))
    for index, angle_degrees in enumerate((-90.0, 30.0, 150.0)):
        angle = math.radians(angle_degrees)
        direction = Vector((math.cos(angle), math.sin(angle), 0.0))
        rotation = up.rotation_difference(direction)
        center = direction * 0.105 + Vector((0.0, 0.0, 0.022))
        parts.append(add_cylinder(f"BaseFoot{index + 1}", 0.021, 0.205, center, rotation, vertices=16))
    for part in parts:
        part.data.materials.append(material)
    return parts


def add_support_parts(material):
    neck = add_cylinder("Neck", 0.043, 0.145, (0.0, 0.0, 1.345), vertices=24)
    knob = add_knob("NeckKnob", 0.045, (0.0, 0.0, 1.455))
    pole = add_cylinder("Stand", 0.017, 0.500, (0.0, 0.0, 0.285), vertices=20)
    collar = add_cylinder("StandCollar", 0.047, 0.022, (0.0, 0.0, 0.482), vertices=24)
    for part in (neck, knob, pole, collar):
        part.data.materials.append(material)
    return [neck, knob, pole, collar]


def clean_object(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    loose_edges = [edge for edge in bm.edges if not edge.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context="EDGES")
    loose_vertices = [vertex for vertex in bm.verts if not vertex.link_edges]
    if loose_vertices:
        bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def apply_faceted_displacement(torso):
    texture = bpy.data.textures.new("mannequin_organic_breaks", type="CLOUDS")
    texture.noise_basis = "IMPROVED_PERLIN"
    texture.noise_scale = 0.16
    texture.noise_depth = 2
    texture.noise_type = "SOFT_NOISE"
    texture.intensity = 1.0
    texture.contrast = 1.0
    modifier = torso.modifiers.new("subtle_organic_facets", "DISPLACE")
    modifier.texture = texture
    modifier.texture_coords = "LOCAL"
    modifier.direction = "NORMAL"
    modifier.mid_level = 0.5
    modifier.strength = 0.0075
    bpy.context.view_layer.objects.active = torso
    torso.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    torso.select_set(False)


def object_counts(obj):
    obj.data.calc_loop_triangles()
    return {
        "name": obj.name,
        "vertices": len(obj.data.vertices),
        "polygons": len(obj.data.polygons),
        "triangles": len(obj.data.loop_triangles),
    }


def glb_bounds(path):
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise RuntimeError("Export did not produce a GLB.")
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    offset = 12
    document = None
    while offset < total:
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        offset += length
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode("utf-8").rstrip(" \x00"))
            break
    if document is None:
        raise RuntimeError("GLB has no JSON chunk.")
    mins = [float("inf")] * 3
    maxs = [float("-inf")] * 3
    triangle_count = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            accessor = document["accessors"][primitive["attributes"]["POSITION"]]
            if "min" in accessor and "max" in accessor:
                mins = [min(a, b) for a, b in zip(mins, accessor["min"])]
                maxs = [max(a, b) for a, b in zip(maxs, accessor["max"])]
            if "indices" in primitive:
                triangle_count += document["accessors"][primitive["indices"]]["count"] // 3
    return document, {"min": mins, "max": maxs}, triangle_count


def main():
    args = parse_args()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    reset_scene()
    material = make_material()

    torso = add_torso(material)
    if args.variant == "B":
        apply_faceted_displacement(torso)
    neck, knob, pole, collar = add_support_parts(material)
    base_parts = add_tripod_base(material)
    parts = [torso, neck, knob, pole, collar, *base_parts]

    for part in parts:
        clean_object(part)
        for polygon in part.data.polygons:
            polygon.use_smooth = args.variant == "A" and part in (torso, neck, knob, pole, collar)

    before_join = [object_counts(part) for part in parts]
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = torso
    bpy.ops.object.join()
    mannequin = bpy.context.object
    mannequin.name = "mannequin"
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mannequin["up_axis"] = "+Y"
    mannequin["front_axis"] = "+Z"
    mannequin["variant"] = args.variant
    mannequin["build_seed"] = SEED
    mannequin["asset_origin"] = "original procedural h4ngelic geometry; no FBX or external mesh input"
    mannequin.data.materials.clear()
    mannequin.data.materials.append(material)
    clean_object(mannequin)

    bm = bmesh.new()
    bm.from_mesh(mannequin.data)
    non_manifold = sum(1 for edge in bm.edges if not edge.is_manifold)
    loose = sum(1 for vertex in bm.verts if not vertex.link_edges)
    bm.free()
    final_counts = object_counts(mannequin)

    bpy.ops.object.select_all(action="DESELECT")
    mannequin.select_set(True)
    bpy.context.view_layer.objects.active = mannequin
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_draco_mesh_compression_enable=bool(args.draco),
        export_draco_mesh_compression_level=6,
    )

    document, bounds, exported_triangles = glb_bounds(output)
    glb_bytes = output.read_bytes()
    report = {
        "generator": "scripts/mannequin-build.py",
        "blender_version": bpy.app.version_string,
        "variant": args.variant,
        "seed": SEED,
        "output": str(output.relative_to(Path.cwd())) if output.is_relative_to(Path.cwd()) else str(output),
        "bytes": len(glb_bytes),
        "sha256": hashlib.sha256(glb_bytes).hexdigest(),
        "segments": SEGMENTS,
        "height_units": HEIGHT,
        "origin": [0.0, 0.0, 0.0],
        "up_axis": "+Y",
        "front_axis": "+Z",
        "before_join": before_join,
        "after_merge": final_counts,
        "decimation": {"ratio": 1.0, "applied": False, "reason": "authored low-poly geometry is already below the 60k triangle budget"},
        "cleanup": {"duplicate_merge_distance": 1e-6, "non_manifold_edges": non_manifold, "loose_edges": 0, "loose_vertices": loose},
        "materials": [entry.get("name") for entry in document.get("materials", [])],
        "texture_count": len(document.get("textures", [])),
        "image_count": len(document.get("images", [])),
        "bounds_gltf": bounds,
        "exported_triangles": exported_triangles,
        "draco": bool(args.draco),
        "external_mesh_inputs": [],
    }
    if final_counts["triangles"] > 60000:
        raise RuntimeError(f"Triangle budget exceeded: {final_counts['triangles']}")
    if report["materials"] != [MATERIAL_NAME] or report["texture_count"] or report["image_count"]:
        raise RuntimeError("The export must contain one untextured material.")
    if non_manifold or loose:
        raise RuntimeError(f"Cleanup failed: {non_manifold} non-manifold edges, {loose} loose vertices")
    report_path = Path(args.report).resolve() if args.report else None
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("MANNEQUIN_BUILD " + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
