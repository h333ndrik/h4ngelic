#!/usr/bin/env python3
"""Neutrales 3/4-Render fuer die Vorher/Nachher-Evidence (Blender headless).

  blender -b --factory-startup --python scripts/render-mannequin-evidence.py -- \
    --glb <model.glb> --out <render.png> [--texture <skincolor.png>] [--res 900 1200]

Kein Eingriff ins Modell: Kamera, Licht und Welt werden nur fuer das Bild gebaut.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_gltf_utils import strip_basisu  # noqa: E402

SAMPLES = 64
KEY_ENERGY = 380
FILL_ENERGY = 100

AZIMUTH_DEGREES = 35.0
ELEVATION_DEGREES = 6.0
FOCAL_MM = 60.0
WORLD_STRENGTH = 0.35


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--glb", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--texture", default="")
    parser.add_argument("--res", nargs=2, type=int, default=(900, 1200))
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(strip_basisu(Path(args.glb).expanduser().resolve())))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise SystemExit(f"Erwartet 1 Mesh, gefunden {len(meshes)}")
    obj = meshes[0]
    for other in list(bpy.data.objects):
        if other is not obj:
            bpy.data.objects.remove(other, do_unlink=True)

    material = obj.data.materials[0]
    material.use_nodes = True
    nodes = material.node_tree.nodes
    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    image_node = next((node for node in nodes if node.type == "TEX_IMAGE"), None)
    if args.texture:
        image = bpy.data.images.load(str(Path(args.texture).expanduser().resolve()), check_existing=False)
        if image_node is None:
            image_node = nodes.new("ShaderNodeTexImage")
            material.node_tree.links.new(image_node.outputs["Color"], principled.inputs["Base Color"])
        image_node.image = image
    principled.inputs["Roughness"].default_value = 0.62
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Specular IOR Level"].default_value = 0.25

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = args.res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"

    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.28, 0.28, 0.285, 1.0)
    background.inputs["Strength"].default_value = WORLD_STRENGTH
    scene.world = world

    low = Vector((min((obj.matrix_world @ Vector(corner)).x for corner in obj.bound_box),
                  min((obj.matrix_world @ Vector(corner)).y for corner in obj.bound_box),
                  min((obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box)))
    high = Vector((max((obj.matrix_world @ Vector(corner)).x for corner in obj.bound_box),
                   max((obj.matrix_world @ Vector(corner)).y for corner in obj.bound_box),
                   max((obj.matrix_world @ Vector(corner)).z for corner in obj.bound_box)))
    centre = (low + high) / 2
    height = high.z - low.z

    azimuth = math.radians(AZIMUTH_DEGREES)
    elevation = math.radians(ELEVATION_DEGREES)
    distance = height * 1.85
    camera_data = bpy.data.cameras.new("studio_camera")
    camera_data.lens = FOCAL_MM
    camera = bpy.data.objects.new("studio_camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = centre + Vector((math.sin(azimuth) * math.cos(elevation),
                                       -math.cos(azimuth) * math.cos(elevation),
                                       math.sin(elevation))) * distance
    direction = centre - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    key = bpy.data.lights.new("key", type="AREA")
    key.energy = KEY_ENERGY
    key.size = height * 0.7
    key_object = bpy.data.objects.new("key", key)
    scene.collection.objects.link(key_object)
    key_object.location = centre + Vector((-height * 0.75, -height * 0.95, height * 0.85))
    key_object.rotation_euler = (centre - key_object.location).to_track_quat("-Z", "Y").to_euler()

    fill = bpy.data.lights.new("fill", type="AREA")
    fill.energy = FILL_ENERGY
    fill.size = height * 1.1
    fill_object = bpy.data.objects.new("fill", fill)
    scene.collection.objects.link(fill_object)
    fill_object.location = centre + Vector((height * 1.1, -height * 0.5, height * 0.2))
    fill_object.rotation_euler = (centre - fill_object.location).to_track_quat("-Z", "Y").to_euler()

    output = Path(args.out).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print("MANNEQUIN_RENDER " + json.dumps({
        "glb": Path(args.glb).name,
        "output": output.name,
        "bytes": output.stat().st_size,
        "samples": SAMPLES,
        "azimuth": AZIMUTH_DEGREES,
        "elevation": ELEVATION_DEGREES,
        "resolution": list(args.res),
    }))


main()
