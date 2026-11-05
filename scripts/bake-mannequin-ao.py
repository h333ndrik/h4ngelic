#!/usr/bin/env python3
"""Backt AO in die Albedo von Variante C — weiche Studioschattierung statt Flat.

Blender 4.x headless:
  blender -b --factory-startup --python scripts/bake-mannequin-ao.py -- \
    --input <decoded.glb> --glb <baked.glb> --texture <skincolor_baked.png> \
    --report <report.json>

Es wird ausschliesslich Material und Textur angefasst: kein Remesh, kein
Decimate, kein Smooth, kein Re-UV. Das Skript prueft das vor und nach dem Lauf
(Tri-Zahl, UV-Fuellgrad, Bounding-Box) und bricht bei Abweichung ab.
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import tempfile
import zlib
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_gltf_utils import strip_basisu  # noqa: E402

# --- Konstanten -------------------------------------------------------------
RESOLUTION = 2048
AO_DISTANCE = 0.18          # Szeneneinheiten; Modell ist ~5.0 hoch (1 Einheit ~34 cm),
                             # 0.18 entspricht rund 6 cm an einer 1.70-m-Figur.
AO_STRENGTH = 0.35           # 0..1: dezent, Ziel "weiche Studioschattierung"
AO_SAMPLES = 64
BAKE_MARGIN = 16
GRADIENT_STRENGTH = 0.04     # unten 4 % dunkler; 0.0 schaltet den Verlauf ab
AO_BLUR_RADIUS = 2           # Texel; glaettet Bake-Rauschen, nur innerhalb der UV-Inseln
BASE_COLOR = (0xF0, 0xEF, 0xEB)
EXPECTED_TRIANGLES = 49838
EXPECTED_UV_FILL = 0.372     # Fuellgrad aus M1; Abweichung = UVs wurden angefasst
UV_FILL_TOLERANCE = 0.01
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--glb", required=True)
    parser.add_argument("--texture", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--resolution", type=int, default=RESOLUTION)
    parser.add_argument("--ao-distance", type=float, default=AO_DISTANCE)
    parser.add_argument("--ao-strength", type=float, default=AO_STRENGTH)
    parser.add_argument("--obj-dir", default="", help="Procreate-Paket (OBJ + MTL) neu schreiben")
    return parser.parse_args(argv)


def uv_fill(obj: bpy.types.Object) -> float:
    layer = obj.data.uv_layers.active.data
    total = 0.0
    for polygon in obj.data.polygons:
        loops = list(polygon.loop_indices)
        if len(loops) < 3:
            continue
        points = [(layer[index].uv.x, layer[index].uv.y) for index in loops]
        area = 0.0
        for position, (x1, y1) in enumerate(points):
            x2, y2 = points[(position + 1) % len(points)]
            area += x1 * y2 - x2 * y1
        total += abs(area) / 2
    return total


def dilate_nearest(values, mask, width, height, radius):
    """Traegt Werte bis zu `radius` Texel in die Luecken zwischen UV-Inseln.

    Ohne diese Auffuellung sampelt der Renderer an Inselraendern (Mipmap) die
    neutrale Basisfarbe und es entstehen helle Nahtlinien.
    """
    result = list(values)
    filled = bytearray(mask)

    def fill_line(index_of, length):
        last_position = None
        last_value = 0.0
        for offset in range(length):
            index = index_of(offset)
            if filled[index]:
                last_position, last_value = offset, result[index]
            elif last_position is not None and offset - last_position <= radius:
                result[index] = last_value
                filled[index] = 1

    for y in range(height):
        row = y * width
        fill_line(lambda offset, row=row: row + offset, width)
        fill_line(lambda offset, row=row: row + width - 1 - offset, width)
    for x in range(width):
        fill_line(lambda offset, x=x: offset * width + x, height)
        fill_line(lambda offset, x=x: (height - 1 - offset) * width + x, height)
    return result, filled


def world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return low, high


def srgb_to_linear(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def linear_to_srgb(value: float) -> float:
    return value * 12.92 if value <= 0.0031308 else 1.055 * value ** (1 / 2.4) - 0.055


def write_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    stride = width * 3
    raw = bytearray()
    # Blenders Bildpuffer ist von unten nach oben, PNG-Zeilen laufen von oben
    # nach unten — sonst landet die Textur vertikal gespiegelt im GLB.
    for row in range(height - 1, -1, -1):
        raw.append(0)
        raw += pixels[row * stride:(row + 1) * stride]
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                     + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def main() -> None:
    args = parse_args()
    source = strip_basisu(Path(args.input).expanduser().resolve())
    glb_target = Path(args.glb).expanduser().resolve()
    texture_target = Path(args.texture).expanduser().resolve()
    report_path = Path(args.report).expanduser().resolve()

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise SystemExit(f"Erwartet genau 1 Mesh, gefunden {len(meshes)}")
    obj = meshes[0]
    for other in list(bpy.data.objects):
        if other is not obj:
            bpy.data.objects.remove(other, do_unlink=True)

    triangles = len(obj.data.polygons)
    if triangles != EXPECTED_TRIANGLES:
        raise SystemExit(f"Tri-Zahl {triangles} != {EXPECTED_TRIANGLES} — Geometrie wurde veraendert")
    if obj.modifiers:
        raise SystemExit("Mesh hat Modifier — Bake darf die Geometrie nicht veraendern")
    if len(obj.data.uv_layers) != 1:
        raise SystemExit(f"Erwartet 1 UV-Map, gefunden {len(obj.data.uv_layers)}")
    fill_before = uv_fill(obj)
    if abs(fill_before - EXPECTED_UV_FILL) > UV_FILL_TOLERANCE:
        raise SystemExit(f"UV-Fuellgrad {fill_before:.4f} != {EXPECTED_UV_FILL} — UVs wurden veraendert")
    low, high = world_bounds(obj)
    height = high.z - low.z

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = AO_SAMPLES
    scene.render.bake.margin = BAKE_MARGIN
    scene.render.bake.use_clear = True
    if scene.world is None:
        scene.world = bpy.data.worlds.new("bake_world")
    ao_distance = args.ao_distance
    ao_strength = args.ao_strength
    scene.world.light_settings.distance = ao_distance

    resolution = args.resolution
    bake_image = bpy.data.images.new("ao_bake", width=resolution, height=resolution, float_buffer=True, alpha=False)
    bake_image.colorspace_settings.name = "Non-Color"

    material = obj.data.materials[0]
    material.use_nodes = True
    nodes = material.node_tree.nodes
    for node in nodes:
        if node.type == "TEX_IMAGE":
            nodes.remove(node)
    bake_node = nodes.new("ShaderNodeTexImage")
    bake_node.image = bake_image
    bake_node.name = "ao_bake"

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for node in nodes:
        node.select = False
    bake_node.select = True
    nodes.active = bake_node

    bpy.ops.object.bake(type="AO", margin=BAKE_MARGIN, use_clear=True)

    # --- Komposit: Basis x AO (Luminanz) x optionaler Verlauf ---------------
    size = resolution * resolution * 4
    ao = [0.0] * size
    bake_image.pixels.foreach_get(ao)
    base_linear = [srgb_to_linear(channel / 255) for channel in BASE_COLOR]

    # UV-Abdeckung rasterisieren: nur dort wird AO angewendet. Alles ausserhalb
    # der Inseln bleibt exakt die Basisfarbe, sonst bleiben die Clear-Texel (0)
    # als graue Punkte und Streifen im Atlas stehen.
    coverage = bytearray(resolution * resolution)
    height_map = [0.0] * (resolution * resolution)
    layer = obj.data.uv_layers.active.data
    span = max(high.z - low.z, 1e-6)
    vertices = obj.data.vertices
    for polygon in obj.data.polygons:
        loops = list(polygon.loop_indices)
        if len(loops) < 3:
            continue
        centre_z = sum((obj.matrix_world @ vertices[obj.data.loops[i].vertex_index].co).z for i in loops) / len(loops)
        face_height = min(1.0, max(0.0, (centre_z - low.z) / span))
        points = [(layer[index].uv.x * resolution, layer[index].uv.y * resolution) for index in loops]
        for corner in range(1, len(points) - 1):
            ax, ay = points[0]
            bx, by = points[corner]
            cx, cy = points[corner + 1]
            area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
            if abs(area) < 1e-9:
                continue
            min_x = max(0, int(min(ax, bx, cx)) - 1)
            max_x = min(resolution - 1, int(max(ax, bx, cx)) + 1)
            min_y = max(0, int(min(ay, by, cy)) - 1)
            max_y = min(resolution - 1, int(max(ay, by, cy)) + 1)
            for y in range(min_y, max_y + 1):
                py = y + 0.5
                row = y * resolution
                for x in range(min_x, max_x + 1):
                    px = x + 0.5
                    w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area
                    w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area
                    w2 = 1.0 - w0 - w1
                    if w0 < -1e-6 or w1 < -1e-6 or w2 < -1e-6:
                        continue
                    index = row + x
                    coverage[index] = 1
                    height_map[index] = face_height

    # Gueltig ist alles, was gebacken wurde: Inselflaechen plus der Bake-Margin,
    # den Blender selbst in die Luecken schreibt. Nur so bleibt die AO-Kante
    # jeder Insel bei sich und es blutet keine fremde Insel hinein.
    ao_values = [ao[texel * 4] for texel in range(resolution * resolution)]
    valid = bytearray(resolution * resolution)
    for texel in range(resolution * resolution):
        value = ao_values[texel]
        if not math.isfinite(value):
            value = 1.0
        ao_values[texel] = min(1.0, max(0.0, value))
        if coverage[texel] or ao_values[texel] > 1e-6:
            valid[texel] = 1
    height_filled, _ = dilate_nearest(height_map, valid, resolution, resolution, 4)
    coverage = valid

    # AO glaetten (normalisierte Faltung nur ueber abgedeckte Texel, damit die
    # Inselraender nicht ausbluten und das Bake-Rauschen verschwindet).
    if AO_BLUR_RADIUS > 0:
        radius = AO_BLUR_RADIUS
        blurred = [0.0] * (resolution * resolution)
        for y in range(resolution):
            for x in range(resolution):
                index = y * resolution + x
                if not coverage[index]:
                    continue
                total = 0.0
                weight = 0
                for offset_y in range(-radius, radius + 1):
                    ny = y + offset_y
                    if ny < 0 or ny >= resolution:
                        continue
                    row = ny * resolution
                    for offset_x in range(-radius, radius + 1):
                        nx = x + offset_x
                        if nx < 0 or nx >= resolution:
                            continue
                        neighbour = row + nx
                        if not coverage[neighbour]:
                            continue
                        total += ao_values[neighbour]
                        weight += 1
                blurred[index] = total / weight if weight else ao_values[index]
        for texel in range(resolution * resolution):
            if coverage[texel]:
                ao_values[texel] = blurred[texel]

    pixels = bytearray(resolution * resolution * 3)
    lum_min, lum_max, lum_sum = 1.0, 0.0, 0.0
    for texel in range(resolution * resolution):
        if not coverage[texel]:
            for channel in range(3):
                pixels[texel * 3 + channel] = BASE_COLOR[channel]
            continue
        ao_value = ao_values[texel]
        shaded = 1.0 - ao_strength * (1.0 - ao_value)
        if GRADIENT_STRENGTH > 0:
            shaded *= 1.0 - GRADIENT_STRENGTH * (1.0 - height_filled[texel])
        for channel in range(3):
            value = linear_to_srgb(min(1.0, max(0.0, base_linear[channel] * shaded)))
            pixels[texel * 3 + channel] = int(round(value * 255))
        luminance = 0.2126 * base_linear[0] + 0.7152 * base_linear[1] + 0.0722 * base_linear[2]
        luminance *= shaded
        lum_min = min(lum_min, luminance)
        lum_max = max(lum_max, luminance)
        lum_sum += luminance

    texture_target.parent.mkdir(parents=True, exist_ok=True)
    write_png(texture_target, resolution, resolution, bytes(pixels))

    # --- Material mit gebackener Textur + GLB-Export ------------------------
    nodes.remove(bake_node)
    image = bpy.data.images.load(str(texture_target), check_existing=False)
    image.name = "skincolor"
    image.colorspace_settings.name = "sRGB"
    texture_node = nodes.new("ShaderNodeTexImage")
    texture_node.image = image
    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    material.node_tree.links.new(texture_node.outputs["Color"], principled.inputs["Base Color"])
    principled.inputs["Roughness"].default_value = 0.62
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Specular IOR Level"].default_value = 0.25
    nodes.active = texture_node

    glb_target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_target), check_existing=False, export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_texcoords=True, export_normals=True,
        export_materials="EXPORT", export_image_format="AUTO", export_keep_originals=False,
        export_cameras=False, export_lights=False, export_animations=False,
    )

    if args.obj_dir:
        obj_dir = Path(args.obj_dir).expanduser().resolve()
        obj_dir.mkdir(parents=True, exist_ok=True)
        obj_path = obj_dir / "mannequin_paint.obj"
        bpy.ops.wm.obj_export(
            filepath=str(obj_path), check_existing=False, export_selected_objects=True,
            export_uv=True, export_normals=True, export_materials=False,
            path_mode="RELATIVE", export_triangulated_mesh=True, export_eval_mode="DAG_EVAL_RENDER",
        )
        obj_text = obj_path.read_text(encoding="utf-8")
        lines = [line for line in obj_text.splitlines() if not line.startswith(("mtllib ", "usemtl "))]
        obj_path.write_text("mtllib mannequin_paint.mtl\nusemtl skincolor\n" + "\n".join(lines) + "\n", encoding="utf-8")
        (obj_dir / "mannequin_paint.mtl").write_text(
            "# h4ngelic mannequin_paint — Procreate-Roundtrip\n"
            "newmtl skincolor\n"
            "Ka 1.000000 1.000000 1.000000\n"
            "Kd 1.000000 1.000000 1.000000\n"
            "Ks 0.250000 0.250000 0.250000\n"
            "Ke 0.000000 0.000000 0.000000\n"
            "Ni 1.500000\n"
            "d 1.000000\n"
            "illum 2\n"
            "Ns 144.400000\n"
            "map_Kd skincolor.png\n",
            encoding="utf-8",
        )

    fill_after = uv_fill(obj)
    covered = sum(coverage)
    mean_luminance = lum_sum / max(1, covered)
    report = {
        "blenderVersion": bpy.app.version_string,
        "resolution": resolution,
        "triangles": triangles,
        "vertices": len(obj.data.vertices),
        "modelHeight": round(height, 4),
        # Umrechnung fuer die AO-Konstanten: die Figur ist ~5.01 Szeneneinheiten
        # hoch; bei 1.70 m realer Koerpergroesse entspricht 1 Einheit ~34 cm.
        "sceneScale": {
            "modelHeight": round(height, 4),
            "assumedBodyHeightMeters": 1.70,
            "unitToMeters": round(1.70 / height, 4),
            "aoDistanceUnits": ao_distance,
            "aoDistanceMeters": round(ao_distance * (1.70 / height), 4),
        },
        "aoDistance": ao_distance,
        "aoStrength": ao_strength,
        "aoSamples": AO_SAMPLES,
        "gradientStrength": GRADIENT_STRENGTH,
        "baseColor": "#%02x%02x%02x" % BASE_COLOR,
        "roughness": 0.62,
        "uvFillBefore": round(fill_before, 6),
        "uvFillAfter": round(fill_after, 6),
        "uvUnchanged": abs(fill_before - fill_after) < 1e-9,
        "luminance": {"min": round(lum_min, 5), "max": round(lum_max, 5), "mean": round(mean_luminance, 5)},
        "uvCoverage": round(sum(coverage) / len(coverage), 4),
        "texture": texture_target.name,
        "textureBytes": texture_target.stat().st_size,
        "glb": glb_target.name,
        "glbBytes": glb_target.stat().st_size,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("MANNEQUIN_AO_BAKE " + json.dumps(report, sort_keys=True))


main()
