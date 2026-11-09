#!/usr/bin/env python3
"""Build the original h4ngelic female chrome mannequin and Procreate guides.

Blender 4.x headless usage:
  blender -b --factory-startup --python scripts/mannequin-female-build.py -- \
    --variant B --output public/models/mannequin-female-b.glb \
    --atlas public/textures/mannequin/uv-atlas.png \
    --atlas-json public/textures/mannequin/uv-atlas.json \
    --report docs/validation/MANNEQUIN-CHROME/poly-trace-b.json

No external mesh, image, sculpt or texture is imported. All geometry is made
from the numeric profiles and primitive parameters below.
"""

import argparse
import hashlib
import json
import math
import struct
import sys
import zlib
from array import array
from pathlib import Path

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Quaternion, Vector

VARIANT_SEGMENTS = {"A": 48, "B": 20}
ATLAS_SIZE = 4096
ATLAS_SPAN_MM = 2000
MM_PER_PX = ATLAS_SPAN_MM / ATLAS_SIZE
PX_PER_MM = ATLAS_SIZE / ATLAS_SPAN_MM
BODY_HEIGHT_MM = 1700
SEED = 340044
MATERIAL_NAME = "mannequin_chrome"
HERO_BASE_COLOR = (0xE4, 0xE4, 0xE4)
HERO_ROUGHNESS = {"A": 0.18, "B": 0.30}
HERO_CLEARCOAT = 0.15
HERO_CLEARCOAT_ROUGHNESS = 0.12

# All rectangles use millimetres from the lower-left atlas corner. The fixed
# width/height values preserve the exact same 0.48828125 mm/px for every part.
PARTS = {
    "torso": {"x": 28, "y": 28, "w": 1068.1416, "h": 660, "label": "torso"},
    "head": {"x": 1160, "y": 28, "w": 534.0708, "h": 190, "label": "head"},
    "neck": {"x": 1160, "y": 238, "w": 282.7433, "h": 100, "label": "neck"},
    "left_upper_arm": {"x": 1160, "y": 358, "w": 282.7433, "h": 320, "label": "left upper arm"},
    "right_upper_arm": {"x": 1460, "y": 358, "w": 282.7433, "h": 320, "label": "right upper arm"},
    "left_forearm": {"x": 1160, "y": 698, "w": 226.1947, "h": 280, "label": "left forearm"},
    "right_forearm": {"x": 1460, "y": 698, "w": 226.1947, "h": 280, "label": "right forearm"},
    "left_hand": {"x": 1160, "y": 998, "w": 150, "h": 120, "label": "left hand"},
    "right_hand": {"x": 1350, "y": 998, "w": 150, "h": 120, "label": "right hand"},
    "left_thigh": {"x": 28, "y": 720, "w": 534.0708, "h": 440, "label": "left thigh"},
    "right_thigh": {"x": 592, "y": 720, "w": 534.0708, "h": 440, "label": "right thigh"},
    "left_calf": {"x": 28, "y": 1180, "w": 408.4071, "h": 450, "label": "left calf"},
    "right_calf": {"x": 592, "y": 1180, "w": 408.4071, "h": 450, "label": "right calf"},
    "left_foot": {"x": 1160, "y": 1140, "w": 220, "h": 100, "label": "left foot"},
    "right_foot": {"x": 1410, "y": 1140, "w": 220, "h": 100, "label": "right foot"},
}

TORSO_PROFILE = (
    (0.820, 0.000),
    (0.820, 0.094),
    (0.850, 0.140),
    (0.910, 0.170),
    (0.970, 0.160),
    (1.040, 0.138),
    (1.120, 0.108),
    (1.165, 0.104),
    (1.220, 0.116),
    (1.285, 0.134),
    (1.345, 0.145),
    (1.405, 0.143),
    (1.450, 0.108),
    (1.468, 0.075),
    (1.472, 0.000),
)
CALF_PROFILE = (
    (0.040, 0.000),
    (0.040, 0.042),
    (0.075, 0.050),
    (0.180, 0.064),
    (0.400, 0.051),
    (0.470, 0.054),
    (0.482, 0.000),
)
THIGH_PROFILE = (
    (0.465, 0.000),
    (0.465, 0.056),
    (0.520, 0.062),
    (0.790, 0.084),
    (0.870, 0.086),
    (0.905, 0.076),
    (0.910, 0.000),
)
UPPER_ARM_PROFILE = ((0.0, 0.040), (0.030, 0.045), (0.230, 0.037), (0.320, 0.033))
FOREARM_PROFILE = ((0.0, 0.035), (0.050, 0.033), (0.280, 0.024))
NECK_PROFILE = ((1.455, 0.000), (1.455, 0.044), (1.535, 0.042), (1.535, 0.000))
SHOULDER_Z = 1.390
SHOULDER_X = 0.155
ARM_OUTWARD_DEGREES = 15.0
ARM_FORWARD_DEGREES = 5.0
SHOULDER_DIRECTION = Vector((
    math.sin(math.radians(ARM_OUTWARD_DEGREES)),
    -math.tan(math.radians(ARM_FORWARD_DEGREES)),
    -math.cos(math.radians(ARM_OUTWARD_DEGREES)),
)).normalized()


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=("A", "B"), default="B")
    parser.add_argument("--output", default="public/models/mannequin-female-b.glb")
    parser.add_argument("--report", default="")
    parser.add_argument("--atlas", default="")
    parser.add_argument("--atlas-json", default="")
    parser.add_argument("--demo-design", default="")
    parser.add_argument("--guides-dir", default="")
    parser.add_argument("--render-size", type=int, default=1440)
    parser.add_argument("--mobile-size", type=int, default=390)
    parser.add_argument("--draco", action="store_true")
    return parser.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.cursor.location = (0.0, 0.0, 0.0)


def srgb_channel_to_linear(value):
    channel = value / 255.0
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def make_material(variant):
    material = bpy.data.materials.new(MATERIAL_NAME)
    material.use_nodes = True
    material.use_backface_culling = True
    color = tuple(srgb_channel_to_linear(channel) for channel in HERO_BASE_COLOR)
    material.diffuse_color = (*color, 1.0)
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Metallic"].default_value = 1.0
    principled.inputs["Roughness"].default_value = HERO_ROUGHNESS[variant]
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = HERO_CLEARCOAT
        principled.inputs["Coat Roughness"].default_value = HERO_CLEARCOAT_ROUGHNESS
    return material


def part_uv(part):
    spec = PARTS[part]
    return (
        spec["x"] / ATLAS_SPAN_MM,
        spec["y"] / ATLAS_SPAN_MM,
        (spec["x"] + spec["w"]) / ATLAS_SPAN_MM,
        (spec["y"] + spec["h"]) / ATLAS_SPAN_MM,
    )


def ensure_uv_layer(obj):
    layer = obj.data.uv_layers.get("UVMap") or obj.data.uv_layers.new(name="UVMap")
    return layer


def assign_cylindrical_uv(obj, part, z_min, z_max):
    layer = ensure_uv_layer(obj)
    u0, v0, _, _ = part_uv(part)
    spec = PARTS[part]
    u_width = spec["w"] / ATLAS_SPAN_MM
    v_height = spec["h"] / ATLAS_SPAN_MM
    for polygon in obj.data.polygons:
        values = []
        for loop_index in polygon.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            angle = math.atan2(vertex.x, vertex.y)
            if angle < 0:
                angle += math.tau
            values.append(angle / math.tau)
        if values and max(values) - min(values) > 0.5:
            values = [value + 1.0 if value < 0.5 else value for value in values]
        for loop_index, local_u in zip(polygon.loop_indices, values):
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            local_v = (vertex.z - z_min) / max(z_max - z_min, 1e-9)
            layer.data[loop_index].uv = (u0 + local_u * u_width, v0 + min(1.0, max(0.0, local_v)) * v_height)


def assign_planar_uv(obj, part):
    layer = ensure_uv_layer(obj)
    u0, v0, _, _ = part_uv(part)
    spec = PARTS[part]
    u_width = spec["w"] / ATLAS_SPAN_MM
    v_height = spec["h"] / ATLAS_SPAN_MM
    xs = [vertex.co.x for vertex in obj.data.vertices]
    ys = [vertex.co.y for vertex in obj.data.vertices]
    minimum_x, maximum_x = min(xs), max(xs)
    minimum_y, maximum_y = min(ys), max(ys)
    for polygon in obj.data.polygons:
        for loop_index in polygon.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            local_u = (vertex.x - minimum_x) / max(maximum_x - minimum_x, 1e-9)
            local_v = (vertex.y - minimum_y) / max(maximum_y - minimum_y, 1e-9)
            layer.data[loop_index].uv = (u0 + local_u * u_width, v0 + local_v * v_height)


def mesh_from_rings(name, layers, material, part, planar=False):
    vertices, indices = [], []
    layer_indices = []
    for radius, z in layers:
        if radius <= 1e-9:
            layer_indices.append(("point", len(vertices)))
            vertices.append((0.0, 0.0, z))
        else:
            ring = []
            for segment in range(variant_segments):
                angle = math.tau * segment / variant_segments
                ring.append(len(vertices))
                vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
            layer_indices.append(("ring", ring))
    faces = []
    for lower, upper in zip(layer_indices, layer_indices[1:]):
        lower_type, lower_data = lower
        upper_type, upper_data = upper
        if lower_type == "ring" and upper_type == "ring":
            for segment in range(variant_segments):
                nxt = (segment + 1) % variant_segments
                faces.append((lower_data[segment], lower_data[nxt], upper_data[nxt], upper_data[segment]))
        elif lower_type == "point" and upper_type == "ring":
            for segment in range(variant_segments):
                nxt = (segment + 1) % variant_segments
                faces.append((upper_data[segment], upper_data[nxt], lower_data))
        elif lower_type == "ring" and upper_type == "point":
            for segment in range(variant_segments):
                nxt = (segment + 1) % variant_segments
                faces.append((lower_data[segment], lower_data[nxt], upper_data))
    if layer_indices[0][0] == "ring":
        center = len(vertices)
        vertices.append((0.0, 0.0, layers[0][1]))
        for segment in range(variant_segments):
            faces.append((center, layer_indices[0][1][(segment + 1) % variant_segments], layer_indices[0][1][segment]))
    if layer_indices[-1][0] == "ring":
        center = len(vertices)
        vertices.append((0.0, 0.0, layers[-1][1]))
        for segment in range(variant_segments):
            faces.append((center, layer_indices[-1][1][segment], layer_indices[-1][1][(segment + 1) % variant_segments]))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    if planar:
        assign_planar_uv(obj, part)
    else:
        assign_cylindrical_uv(obj, part, layers[0][1], layers[-1][1])
    return obj


def add_vertical_part(name, profile, material, part, location=(0, 0, 0), planar=False):
    obj = mesh_from_rings(name, [(radius, z) for z, radius in profile], material, part, planar)
    obj.location = location
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    return obj


def add_limb_segment(name, profile, material, part, start, direction, length):
    local = mesh_from_rings(name, [(radius, z) for z, radius in profile], material, part, planar=False)
    quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    local.rotation_mode = "QUATERNION"
    local.rotation_quaternion = quaternion
    local.location = start
    bpy.context.view_layer.objects.active = local
    local.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    local.select_set(False)
    return local


def add_ellipsoid(name, center, radius_xyz, material, part):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=variant_segments,
        ring_count=8,
        radius=1.0,
        location=center,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = radius_xyz
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.data.materials.append(material)
    assign_cylindrical_uv(obj, part, center[2] - radius_xyz[2], center[2] + radius_xyz[2])
    return obj


def add_beveled_box(name, center, dimensions, material, part, rotation=None, bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    if rotation is not None:
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = rotation
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    modifier = obj.modifiers.new("abstract_block_bevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 1 if variant_segments == 20 else 2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(material)
    assign_planar_uv(obj, part)
    obj.select_set(False)
    return obj


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


def object_counts(obj):
    obj.data.calc_loop_triangles()
    return {
        "name": obj.name,
        "vertices": len(obj.data.vertices),
        "triangles": len(obj.data.loop_triangles),
        "has_uv": bool(obj.data.uv_layers),
    }


def seam_for_vertical(profile, center_x=0.0, center_y=0.0, sign=1):
    return [(center_x, center_y + sign * radius, z) for z, radius in profile if radius > 1e-8]


def seam_for_limb(profile, start, direction, length):
    direction = direction.normalized()
    basis_y = Vector((0, 1, 0))
    basis_y = (basis_y - direction * basis_y.dot(direction)).normalized()
    points = []
    for local_z, radius in profile:
        if radius <= 1e-8:
            continue
        point = start + direction * local_z + basis_y * radius
        points.append(tuple(point))
    return points


def build_body(material):
    global variant_segments
    objects = []
    seams = {}
    torso = add_vertical_part("Torso", TORSO_PROFILE, material, "torso")
    objects.append(torso)
    seams["torso"] = seam_for_vertical(TORSO_PROFILE)

    neck = add_vertical_part("Neck", NECK_PROFILE, material, "neck")
    objects.append(neck)
    seams["neck"] = seam_for_vertical(NECK_PROFILE)

    head = add_ellipsoid("Head", (0, 0, 1.610), (0.085, 0.075, 0.090), material, "head")
    objects.append(head)
    seams["head"] = [(0.0, 0.075 * math.sin(math.pi * i / 10), 1.520 + 0.18 * i / 10) for i in range(1, 10)]

    for side, prefix in ((-1, "left"), (1, "right")):
        x = side * 0.090
        thigh = add_vertical_part(f"{prefix.title()}Thigh", THIGH_PROFILE, material, f"{prefix}_thigh", (x, 0, 0))
        calf = add_vertical_part(f"{prefix.title()}Calf", CALF_PROFILE, material, f"{prefix}_calf", (x, 0, 0))
        foot = add_beveled_box(f"{prefix.title()}Foot", (x, -0.055, 0.037), (0.105, 0.230, 0.074), material, f"{prefix}_foot", bevel=0.016)
        objects.extend((thigh, calf, foot))
        seams[f"{prefix}_thigh"] = seam_for_vertical(THIGH_PROFILE, x)
        seams[f"{prefix}_calf"] = seam_for_vertical(CALF_PROFILE, x)
        seams[f"{prefix}_foot"] = []

        shoulder = Vector((side * SHOULDER_X, 0.0, SHOULDER_Z))
        direction = Vector((side * SHOULDER_DIRECTION.x, SHOULDER_DIRECTION.y, SHOULDER_DIRECTION.z)).normalized()
        upper = add_limb_segment(f"{prefix.title()}UpperArm", UPPER_ARM_PROFILE, material, f"{prefix}_upper_arm", shoulder, direction, 0.320)
        elbow = shoulder + direction * 0.320
        forearm = add_limb_segment(f"{prefix.title()}Forearm", FOREARM_PROFILE, material, f"{prefix}_forearm", elbow, direction, 0.280)
        wrist = elbow + direction * 0.280
        hand_center = wrist + direction * 0.055
        rotation = Vector((0, 0, 1)).rotation_difference(direction)
        hand = add_beveled_box(f"{prefix.title()}Hand", hand_center, (0.042, 0.052, 0.110), material, f"{prefix}_hand", rotation=rotation, bevel=0.010)
        objects.extend((upper, forearm, hand))
        seams[f"{prefix}_upper_arm"] = seam_for_limb(UPPER_ARM_PROFILE, shoulder, direction, 0.320)
        seams[f"{prefix}_forearm"] = seam_for_limb(FOREARM_PROFILE, elbow, direction, 0.280)
        seams[f"{prefix}_hand"] = []

    for obj in objects:
        clean_object(obj)
        for polygon in obj.data.polygons:
            polygon.use_smooth = variant == "A"
    before = [object_counts(obj) for obj in objects]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = torso
    bpy.ops.object.join()
    mannequin = bpy.context.object
    mannequin.name = "mannequin_female"
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    clean_object(mannequin)
    if variant == "A":
        bpy.ops.object.select_all(action="DESELECT")
        mannequin.select_set(True)
        bpy.context.view_layer.objects.active = mannequin
        bpy.ops.object.shade_auto_smooth(angle=math.radians(34))
    mannequin.data.materials.clear()
    mannequin.data.materials.append(material)
    return mannequin, seams, before


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)


def write_rgba_png(path, width, height, pixels):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    stride = width * 4
    raw = bytearray()
    for row in range(height):
        raw.append(0)
        start = row * stride
        raw.extend(pixels[start:start + stride])
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    path.write_bytes(signature + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + png_chunk(b"IEND", b""))


def atlas_pixels():
    pixels = bytearray(ATLAS_SIZE * ATLAS_SIZE * 4)
    for spec in PARTS.values():
        x0 = round(spec["x"] * PX_PER_MM)
        x1 = round((spec["x"] + spec["w"]) * PX_PER_MM)
        y0 = ATLAS_SIZE - round((spec["y"] + spec["h"]) * PX_PER_MM)
        y1 = ATLAS_SIZE - round(spec["y"] * PX_PER_MM)
        x0, x1 = max(0, x0), min(ATLAS_SIZE - 1, x1)
        y0, y1 = max(0, y0), min(ATLAS_SIZE - 1, y1)
        for offset in (0, 1):
            for x in range(x0, min(ATLAS_SIZE, x1 + 1)):
                for y in (y0 + offset, y1 - offset):
                    index = (y * ATLAS_SIZE + x) * 4
                    pixels[index:index + 4] = bytes((0, 0, 0, 89))
            for y in range(y0, min(ATLAS_SIZE, y1 + 1)):
                for x in (x0 + offset, x1 - offset):
                    index = (y * ATLAS_SIZE + x) * 4
                    pixels[index:index + 4] = bytes((0, 0, 0, 89))
    return pixels


def atlas_document():
    parts = {}
    for part, spec in PARTS.items():
        u0, v0, u1, v1 = part_uv(part)
        x0 = round(spec["x"] * PX_PER_MM)
        y0 = ATLAS_SIZE - round((spec["y"] + spec["h"]) * PX_PER_MM)
        width = round(spec["w"] * PX_PER_MM)
        height = round(spec["h"] * PX_PER_MM)
        anchor = [u0 + (u1 - u0) * 0.5, v0 + (v1 - v0) * (0.68 if part.startswith("torso") else 0.5)]
        parts[part] = {
            "label": spec["label"],
            "uvRect": [u0, v0, u1, v1],
            "pixelRect": [x0, y0, width, height],
            "anchorUV": anchor,
        }
    torso = PARTS["torso"]
    torso_front_x0 = round((torso["x"] + torso["w"] * 0.25) * PX_PER_MM)
    torso_front_w = round(torso["w"] * 0.5 * PX_PER_MM)
    parts["torso_front"] = {
        "label": "front torso / chest",
        "uvRect": [part_uv("torso")[0] + (part_uv("torso")[2] - part_uv("torso")[0]) * 0.25,
                   part_uv("torso")[1], part_uv("torso")[0] + (part_uv("torso")[2] - part_uv("torso")[0]) * 0.75, part_uv("torso")[3]],
        "pixelRect": [torso_front_x0, parts["torso"]["pixelRect"][1], torso_front_w, parts["torso"]["pixelRect"][3]],
        "anchorUV": [parts["torso"]["anchorUV"][0], parts["torso"]["anchorUV"][1]],
    }
    torso_u0, torso_v0, torso_u1, torso_v1 = part_uv("torso")
    torso_px0, torso_py0, torso_pw, torso_ph = parts["torso"]["pixelRect"]
    quarter_u = (torso_u1 - torso_u0) * 0.25
    quarter_px = round(torso_pw * 0.25)
    parts["torso_back"] = {
        "label": "back torso / split across the seam",
        "uvRect": [torso_u0, torso_v0, torso_u1, torso_v1],
        "pixelRect": [torso_px0, torso_py0, torso_pw, torso_ph],
        "uvRects": [
            [torso_u0, torso_v0, torso_u0 + quarter_u, torso_v1],
            [torso_u1 - quarter_u, torso_v0, torso_u1, torso_v1],
        ],
        "pixelRects": [
            [torso_px0, torso_py0, quarter_px, torso_ph],
            [torso_px0 + torso_pw - quarter_px, torso_py0, quarter_px, torso_ph],
        ],
        "anchorUV": [torso_u0 + quarter_u * 0.5, parts["torso"]["anchorUV"][1]],
    }
    return {
        "version": 1,
        "file": "uv-atlas.png",
        "atlas": {"width": ATLAS_SIZE, "height": ATLAS_SIZE, "transparent": True,
                  "lineColor": "#000000", "lineAlpha": 0.35, "lineWidthPx": 2},
        "scale": {"bodyHeightMM": BODY_HEIGHT_MM, "uvSpanMM": ATLAS_SPAN_MM,
                  "mmPerPixel": MM_PER_PX, "pixelsPerMeter": 1000 / MM_PER_PX,
                  "bodyHeightPx": BODY_HEIGHT_MM / MM_PER_PX},
        "seam": {"body": "back centre", "blenderBack": "+Y", "gltfBack": "-Z", "front": "+Z"},
        "parts": parts,
    }


def write_demo_design(path, size=1024):
    pixels = bytearray(size * size * 4)
    center = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x - center, y - center
            distance = math.hypot(dx, dy)
            alpha = 0
            color = (0, 0, 0)
            if 250 <= distance <= 285:
                alpha = 235
                color = (198, 255, 64)
            elif (abs(dx) <= 14 and abs(dy) <= 205) or (abs(dy) <= 14 and abs(dx) <= 205):
                alpha = 255
                color = (240, 239, 235)
            elif 45 <= distance <= 62:
                alpha = 255
                color = (185, 139, 225)
            if alpha:
                index = (y * size + x) * 4
                pixels[index:index + 4] = bytes((*color, alpha))
    write_rgba_png(path, size, size, pixels)


def canonicalize_indices(path):
    """Make Blender's non-deterministic triangle emission byte-reproducible."""
    path = Path(path)
    data = bytearray(path.read_bytes())
    _, _, total = struct.unpack_from("<4sII", data, 0)
    offset = 12
    document = None
    binary = None
    while offset < total:
        length, kind = struct.unpack_from("<II", data, offset)
        start = offset + 8
        if kind == 0x4E4F534A:
            document = json.loads(data[start:start + length].decode("utf-8").rstrip(" \x00"))
        elif kind == 0x004E4942:
            binary = start
        offset = start + length
    if document is None or binary is None:
        raise RuntimeError("Cannot canonicalize a GLB without JSON and BIN chunks.")
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            accessor = document["accessors"][primitive["indices"]]
            if accessor["componentType"] != 5123 or accessor["type"] != "SCALAR":
                raise RuntimeError("Canonical index sorting expects unsigned-short scalar indices.")
            view = document["bufferViews"][accessor["bufferView"]]
            start = binary + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            count = accessor["count"]
            if count % 3:
                raise RuntimeError("Canonical index sorting expects triangle lists.")
            values = struct.unpack_from(f"<{count}H", data, start)
            triangles = sorted(tuple(values[index:index + 3]) for index in range(0, count, 3))
            flat = [value for triangle in triangles for value in triangle]
            struct.pack_into(f"<{count}H", data, start, *flat)
    path.write_bytes(data)


def glb_summary(path):
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise RuntimeError("Export did not produce a GLB.")
    _, _, total = struct.unpack_from("<4sII", data, 0)
    offset = 12
    document = None
    while offset < total:
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        offset += length
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode("utf-8").rstrip(" \x00"))
    if document is None:
        raise RuntimeError("GLB has no JSON chunk.")
    triangle_count = 0
    mins = [float("inf")] * 3
    maxs = [float("-inf")] * 3
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            accessor = document["accessors"][primitive["attributes"]["POSITION"]]
            mins = [min(a, b) for a, b in zip(mins, accessor.get("min", mins))]
            maxs = [max(a, b) for a, b in zip(maxs, accessor.get("max", maxs))]
            triangle_count += document["accessors"][primitive["indices"]]["count"] // 3
    return data, document, triangle_count, {"min": mins, "max": maxs}


def setup_camera(scene, view, size_x, size_y):
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = f"camera_{view}"
    camera.data.type = "ORTHO"
    aspect = size_x / size_y
    camera.data.ortho_scale = 1.94 * min(1.0, aspect)
    target = Vector((0.0, 0.0, 0.86))
    positions = {
        "front": Vector((0.0, -4.0, 0.86)),
        "back": Vector((0.0, 4.0, 0.86)),
        "left": Vector((-4.0, 0.0, 0.86)),
        "right": Vector((4.0, 0.0, 0.86)),
    }
    camera.location = positions[view]
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.resolution_x = size_x
    scene.render.resolution_y = size_y
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    return camera


def setup_lighting(scene):
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    world = bpy.data.worlds.new("mannequin_render_world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.025, 0.027, 0.028, 1)
    background.inputs["Strength"].default_value = 0.55
    scene.world = world
    for name, location, energy, size in (
        ("key", (-2.8, -3.2, 3.5), 520, 4.0),
        ("fill", (2.8, -2.2, 1.7), 260, 3.0),
        ("rim", (0.8, 2.8, 3.2), 420, 2.5),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, 0.9)) - light.location).to_track_quat("-Z", "Y").to_euler()


def render_plain(path, scene):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def read_render_rgba(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    pixels = array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return pixels, width, height


def guide_from_mask(path, scene, camera, seams, view):
    pixels, width, height = read_render_rgba(path.with_name(f".mask-{view}.png") if view != "front-390" else path.with_name(".mask-front-390.png"))
    output = bytearray(width * height * 4)
    for y in range(height):
        source_row = height - 1 - y
        for x in range(width):
            source = (source_row * width + x) * 4
            if pixels[source + 3] > 0.5:
                target = (y * width + x) * 4
                output[target:target + 4] = bytes((31, 31, 31, 255))
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if not output[index * 4 + 3]:
                continue
            boundary = False
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= width or ny >= height or not output[(ny * width + nx) * 4 + 3]:
                        boundary = True
                        break
                if boundary:
                    break
            if boundary:
                output[index * 4:index * 4 + 4] = bytes((0, 0, 0, 255))
    if view in ("back", "left", "right"):
        for part, points in seams.items():
            if not points:
                continue
            projected = []
            for point in points:
                co = world_to_camera_view(scene, camera, Vector(point))
                projected.append((round(co.x * (width - 1)), round((1 - co.y) * (height - 1))))
            for (x0, y0), (x1, y1) in zip(projected, projected[1:]):
                dx, dy = abs(x1 - x0), -abs(y1 - y0)
                sx = 1 if x0 < x1 else -1
                sy = 1 if y0 < y1 else -1
                error = dx + dy
                while True:
                    if 0 <= x0 < width and 0 <= y0 < height:
                        index = (y0 * width + x0) * 4
                        output[index:index + 4] = bytes((0, 0, 0, 255))
                    if x0 == x1 and y0 == y1:
                        break
                    twice = 2 * error
                    if twice >= dy:
                        error += dy
                        x0 += sx
                    if twice <= dx:
                        error += dx
                        y0 += sy
    write_rgba_png(path, width, height, output)


def render_guides(directory, mannequin, seams, material, size, mobile_size):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    setup_lighting(scene)
    for view in ("front", "back", "left", "right"):
        for obj in list(scene.objects):
            if obj.type == "CAMERA":
                bpy.data.objects.remove(obj, do_unlink=True)
        camera = setup_camera(scene, view, size, size)
        mannequin.data.materials.clear()
        mannequin.data.materials.append(material)
        render_plain(directory / f"{view}.png", scene)
        mask_material = bpy.data.materials.new("__guide_mask")
        mask_material.use_nodes = True
        mask_material.node_tree.nodes.clear()
        output = mask_material.node_tree.nodes.new("ShaderNodeOutputMaterial")
        emission = mask_material.node_tree.nodes.new("ShaderNodeEmission")
        emission.inputs["Color"].default_value = (1, 1, 1, 1)
        emission.inputs["Strength"].default_value = 1.0
        mask_material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
        mannequin.data.materials.clear()
        mannequin.data.materials.append(mask_material)
        render_plain(directory / f".mask-{view}.png", scene)
        guide_from_mask(directory / f"{view}-guide.png", scene, camera, seams, view)
        (directory / f".mask-{view}.png").unlink(missing_ok=True)
        bpy.data.materials.remove(mask_material)
    for obj in list(scene.objects):
        if obj.type == "CAMERA":
            bpy.data.objects.remove(obj, do_unlink=True)
    camera = setup_camera(scene, "front", mobile_size, mobile_size * 2)
    render_plain(directory / "front-390.png", scene)
    mask_material = bpy.data.materials.new("__guide_mask_mobile")
    mask_material.use_nodes = True
    mask_material.node_tree.nodes.clear()
    output = mask_material.node_tree.nodes.new("ShaderNodeOutputMaterial")
    emission = mask_material.node_tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1, 1, 1, 1)
    emission.inputs["Strength"].default_value = 1.0
    mask_material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    mannequin.data.materials.clear()
    mannequin.data.materials.append(mask_material)
    render_plain(directory / ".mask-front-390.png", scene)
    guide_from_mask(directory / "front-390-guide.png", scene, camera, seams, "front-390")
    (directory / ".mask-front-390.png").unlink(missing_ok=True)
    bpy.data.materials.remove(mask_material)
    mannequin.data.materials.clear()
    mannequin.data.materials.append(material)


def main():
    args = parse_args()
    global variant, variant_segments
    variant = args.variant
    variant_segments = VARIANT_SEGMENTS[variant]
    reset_scene()
    material = make_material(variant)
    mannequin, seams, before = build_body(material)
    final_counts = object_counts(mannequin)
    bpy.ops.object.select_all(action="DESELECT")
    mannequin.select_set(True)
    bpy.context.view_layer.objects.active = mannequin
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_draco_mesh_compression_enable=bool(args.draco),
        export_draco_mesh_compression_level=6,
    )
    canonicalize_indices(output)
    data, document, triangle_count, bounds = glb_summary(output)
    if final_counts["triangles"] > 6000:
        raise RuntimeError(f"Triangle budget exceeded: {final_counts['triangles']}")
    if len(data) > 250 * 1024:
        raise RuntimeError(f"GLB byte budget exceeded: {len(data)}")
    if len(document.get("meshes", [])) != 1 or len(document["meshes"][0].get("primitives", [])) != 1:
        raise RuntimeError("The GLB must contain one mesh and one primitive/draw call.")
    if len(document.get("materials", [])) != 1 or document["materials"][0].get("name") != MATERIAL_NAME:
        raise RuntimeError("The GLB must contain one mannequin_chrome material.")
    if document.get("images") or document.get("textures"):
        raise RuntimeError("The GLB must not contain textures or images.")
    if args.atlas:
        write_rgba_png(args.atlas, ATLAS_SIZE, ATLAS_SIZE, atlas_pixels())
    atlas_json = atlas_document() if args.atlas_json else None
    if args.atlas_json:
        Path(args.atlas_json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.atlas_json).write_text(json.dumps(atlas_json, indent=2) + "\n")
    if args.demo_design:
        demo_path = Path(args.demo_design)
        write_demo_design(demo_path)
        demo_path.with_suffix(".json").write_text(json.dumps({
            "slug": demo_path.stem,
            "part": "torso_front",
            "anchorUV": atlas_document()["parts"]["torso_front"]["anchorUV"] if args.atlas_json else [0.438, 0.264],
            "widthMM": 120,
            "wrap": "clamp",
            "source": "procedural geometric test motif generated by scripts/mannequin-female-build.py",
        }, indent=2) + "\n")
    if args.guides_dir:
        render_guides(args.guides_dir, mannequin, seams, material, args.render_size, args.mobile_size)
    report = {
        "generator": "scripts/mannequin-female-build.py",
        "blender_version": bpy.app.version_string,
        "variant": variant,
        "seed": SEED,
        "output": str(output.relative_to(Path.cwd())) if output.is_relative_to(Path.cwd()) else str(output),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "segments": variant_segments,
        "height_mm": BODY_HEIGHT_MM,
        "leg_length_mm": 900,
        "leg_ratio": 900 / BODY_HEIGHT_MM,
        "arm_outward_degrees": ARM_OUTWARD_DEGREES,
        "arm_forward_degrees": ARM_FORWARD_DEGREES,
        "origin": [0.0, 0.0, 0.0],
        "up_axis": "+Y",
        "front_axis": "+Z",
        "before_join": before,
        "after_merge": final_counts,
        "cleanup": {"duplicate_merge_distance": 1e-6,
                    "index_order": "deterministic lexicographic triangle order; winding preserved"},
        "material": document["materials"][0],
        "mesh_count": len(document.get("meshes", [])),
        "primitive_count": sum(len(mesh.get("primitives", [])) for mesh in document.get("meshes", [])),
        "texture_count": len(document.get("textures", [])),
        "image_count": len(document.get("images", [])),
        "exported_triangles": triangle_count,
        "bounds_gltf": bounds,
        "uv_atlas": atlas_json["scale"] if atlas_json else None,
        "external_asset_inputs": [],
        "draco": bool(args.draco),
    }
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    print("MANNEQUIN_FEMALE_BUILD " + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
