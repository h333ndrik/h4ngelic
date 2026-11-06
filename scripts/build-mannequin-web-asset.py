#!/usr/bin/env python3
"""Baut aus dem lokalen Sculpt-GLB das Web-Asset (Variante C) und das Procreate-Paket.

Der voll aufgeloeste Sculpt (249k Tris, 7,5 MB) bleibt lokal. Dieses Skript erzeugt
eine web-taugliche Ableitung mit einer ueberlappungsfreien UV-Map, damit Procreate
gemalte Pixel nicht auf die Rueckseite spiegelt.

Blender 4.x headless:
  blender -b --factory-startup --python scripts/build-mannequin-web-asset.py -- \
    --source outputs/mannequin-remodeling/real-run/export/mannequin_smooth.glb \
    --texture outputs/mannequin-remodeling/real-run/export/skincolor.png \
    --glb /tmp/mannequin-c-repaired.glb \
    --obj-dir outputs/mannequin-remodeling/procreate \
    --report docs/validation/MANNEQUIN-C/uv-repair.json

Schritte: 1 Mesh pruefen, UVs neu entpacken, Ueberlappungen und degenerierte
UV-Inseln in ein freies Grid umpacken, smoothes Shading ohne Auto-Smooth-Modifier,
GLB ohne Modifier-Anwendung exportieren (Modifier wuerden die UVs neu schneiden),
danach OBJ + MTL fur Procreate schreiben.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

GRID_MARGIN = 0.008
GRID_TOP = 0.900
GRID_BOTTOM = 0.992
SHRINK = 0.88
# Schwelle relativ zur typischen UV-Dreiecksflaeche: ein absoluter Wert wuerde
# bei dichten Meshes fast alle Faces treffen.
MIN_UV_AREA_RATIO = 0.02
# UVs werden vor dem Reparieren auf das 16-Bit-Draco-Raster gesnappt. Damit ist
# die spaetere Draco-Quantisierung fuer TEXCOORD_0 ein No-Op und kann keine
# neuen Splitter erzeugen.
UV_SNAP_BITS = 16
TINY_ISLAND_ANGLE = math.radians(30)
ISLAND_MARGIN = 0.0006
PACK_MARGIN = 0.0004


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Lokales Sculpt-GLB")
    parser.add_argument("--texture", required=True, help="skincolor.png (relativ oder absolut)")
    parser.add_argument("--glb", required=True, help="Ziel-GLB (uncompressed, fuer gltf-transform)")
    parser.add_argument("--obj-dir", required=True, help="Zielordner fuer das Procreate-Paket")
    parser.add_argument("--report", required=True, help="JSON-Report")
    return parser.parse_args(argv)


def select_only(obj: bpy.types.Object) -> None:
    for other in list(bpy.context.selected_objects):
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def uv_overlap(obj: bpy.types.Object) -> tuple[int, list[int]]:
    """Gibt (ueberlappende Loops, ueberlappende Faces) der aktiven UV-Map zurueck."""
    bpy.ops.object.mode_set(mode="EDIT")
    try:
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.select_all(action="SELECT")
        bpy.ops.uv.select_overlap(extend=False)
        bm = bmesh.from_edit_mesh(obj.data)
        layer = bm.loops.layers.uv.active
        loops = sum(1 for face in bm.faces for loop in face.loops if loop[layer].select)
        faces = sorted(face.index for face in bm.faces if any(loop[layer].select for loop in face.loops))
    finally:
        bpy.ops.object.mode_set(mode="OBJECT")
    return loops, faces


def uv_areas(obj: bpy.types.Object) -> list[tuple[float, int]]:
    layer = obj.data.uv_layers.active.data
    areas = []
    for polygon in obj.data.polygons:
        loops = list(polygon.loop_indices)
        if len(loops) < 3:
            continue
        (ax, ay) = layer[loops[0]].uv
        (bx, by) = layer[loops[1]].uv
        (cx, cy) = layer[loops[2]].uv
        areas.append((abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2, polygon.index))
    return areas


def degenerate_uv_faces(obj: bpy.types.Object) -> tuple[list[int], float, float]:
    """Findet Faces, deren UV-Dreieck fast keine Flaeche hat.

    Solche Splitter entstehen beim Smart-Project aus sehr kleinen 3D-Dreiecken und
    kollabieren nach dem OBJ-Rundlauf; Procreate liest sie dann als Ueberlappung.
    Die Schwelle ist relativ zur medianen UV-Flaeche, damit sie unabhaengig von
    der Pack-Skalierung funktioniert.
    """
    areas = uv_areas(obj)
    if not areas:
        return [], 0.0, 0.0
    values = sorted(area for area, _ in areas)
    median = values[len(values) // 2]
    threshold = max(median * MIN_UV_AREA_RATIO, 1e-12)
    return sorted(index for area, index in areas if area < threshold), median, threshold


def snap_uvs(obj: bpy.types.Object) -> None:
    steps = (1 << UV_SNAP_BITS) - 1
    layer = obj.data.uv_layers.active.data
    for loop in layer:
        loop.uv = (round(loop.uv.x * steps) / steps, round(loop.uv.y * steps) / steps)


def fit_uv_bounds(obj: bpy.types.Object, margin: float = 0.002) -> None:
    """Skaliert das gepackte Layout formatgleich in die 0..1-Flaeche.

    Ohne diesen Schritt bleibt die Smart-Project-Insel klein (rund 9 % der
    Texturflaeche) und Procreate malt auf zu wenig Pixeln.
    """
    layer = obj.data.uv_layers.active.data
    xs = [loop.uv.x for loop in layer]
    ys = [loop.uv.y for loop in layer]
    low_x, high_x, low_y, high_y = min(xs), max(xs), min(ys), max(ys)
    span = max(high_x - low_x, high_y - low_y)
    if span <= 0:
        return
    scale = (1.0 - 2 * margin) / span
    for loop in layer:
        loop.uv = (margin + (loop.uv.x - low_x) * scale, margin + (loop.uv.y - low_y) * scale)


def shrink_main_uvs(obj: bpy.types.Object) -> None:
    """Haelt den oberen Streifen fuer das Reparatur-Raster frei."""
    layer = obj.data.uv_layers.active.data
    for loop in layer:
        loop.uv = (loop.uv.x * SHRINK, loop.uv.y * SHRINK)


def pack_faces_in_grid(obj: bpy.types.Object, faces: list[int]) -> int:
    """Legt Problem-Faces in ein freies Raster ueber der Haupt-UV-Flaeche.

    Deterministisch: die Reihenfolge folgt den Face-Indizes, die Zellgroesse nur
    der Anzahl. Damit bleibt der Lauf reproduzierbar.
    """
    if not faces:
        return 0
    layer = obj.data.uv_layers.active.data
    columns = max(1, math.ceil(math.sqrt(len(faces) * 11.0)))
    rows = max(1, math.ceil(len(faces) / columns))
    cell_width = (1.0 - 2 * GRID_MARGIN) / columns
    cell_height = (GRID_BOTTOM - GRID_TOP) / rows
    for slot, polygon_index in enumerate(faces):
        polygon = obj.data.polygons[polygon_index]
        column, row = slot % columns, slot // columns
        x0 = GRID_MARGIN + column * cell_width
        y0 = GRID_TOP + row * cell_height
        center_x = x0 + cell_width / 2
        center_y = y0 + cell_height / 2
        radius_x = cell_width * 0.36
        radius_y = cell_height * 0.36
        loops = list(polygon.loop_indices)
        steps = (1 << UV_SNAP_BITS) - 1
        for order, loop_index in enumerate(loops):
            angle = math.tau * order / max(len(loops), 1)
            x = center_x + math.cos(angle) * radius_x
            y = center_y + math.sin(angle) * radius_y
            layer[loop_index].uv = (round(x * steps) / steps, round(y * steps) / steps)
    return len(faces)


def write_mtl(path: Path) -> None:
    """Procreate-MTL mit rein relativem Texturpfad und mattem Glanz."""
    path.write_text(
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


def main() -> None:
    args = parse_args()
    source = Path(args.source).expanduser().resolve()
    texture = Path(args.texture).expanduser().resolve()
    glb_target = Path(args.glb).expanduser().resolve()
    obj_dir = Path(args.obj_dir).expanduser().resolve()
    report_path = Path(args.report).expanduser().resolve()
    for required in (source, texture):
        if not required.is_file():
            raise SystemExit(f"Fehlende Eingabe: {required}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise SystemExit(f"Erwartet genau 1 Mesh, gefunden {len(meshes)}")
    obj = meshes[0]
    for other in list(bpy.data.objects):
        if other is not obj:
            bpy.data.objects.remove(other, do_unlink=True)
    select_only(obj)

    source_polygons = len(obj.data.polygons)
    source_vertices = len(obj.data.vertices)

    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=TINY_ISLAND_ANGLE, margin_method="SCALED", rotate_method="AXIS_ALIGNED_Y",
        island_margin=ISLAND_MARGIN, area_weight=0, correct_aspect=True, scale_to_bounds=False,
    )
    bpy.ops.uv.pack_islands(
        rotate=True, rotate_method="ANY", margin_method="ADD", margin=PACK_MARGIN,
        pin=False, shape_method="CONCAVE", merge_overlap=False,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.uv_layers[0].name = "UVMap"
    fit_uv_bounds(obj)
    snap_uvs(obj)

    tiny_faces, uv_median, uv_threshold = degenerate_uv_faces(obj)
    overlap_loops_before, overlap_faces_before = uv_overlap(obj)
    repair = set(overlap_faces_before) | set(tiny_faces)
    shrink_main_uvs(obj)
    pack_faces_in_grid(obj, sorted(repair))
    # Das Snappen auf das Draco-Raster und das Umsetzen einzelner Faces kann
    # Nachbarn minimal verschieben; daher wird bis zur Fixpunktbildung
    # nachrepariert (deterministisch, maximal vier Durchlaeufe).
    overlap_loops_after, overlap_faces_after = uv_overlap(obj)
    for _ in range(3):
        if not overlap_faces_after:
            break
        repair |= set(overlap_faces_after)
        pack_faces_in_grid(obj, sorted(repair))
        overlap_loops_after, overlap_faces_after = uv_overlap(obj)
    if overlap_faces_after:
        raise SystemExit(f"UV-Ueberlappung bleibt: {overlap_loops_after} Loops / {overlap_faces_after} Faces")
    repaired = len(repair)

    image = bpy.data.images.load(str(texture), check_existing=False)
    image.name = "skincolor"
    material = bpy.data.materials.new("skincolor")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    texture_node = nodes.new("ShaderNodeTexImage")
    texture_node.image = image
    material.node_tree.links.new(texture_node.outputs["Color"], principled.inputs["Base Color"])
    material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    principled.inputs["Roughness"].default_value = 0.62
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Specular IOR Level"].default_value = 0.25
    obj.data.materials.clear()
    obj.data.materials.append(material)

    # Kein Auto-Smooth-Modifier: der Export wuerde die UVs sonst neu aufschneiden.
    bpy.ops.object.shade_smooth()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

    glb_target.parent.mkdir(parents=True, exist_ok=True)
    select_only(obj)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_target), check_existing=False, export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_texcoords=True, export_normals=True,
        export_materials="EXPORT", export_image_format="AUTO", export_keep_originals=False,
        export_cameras=False, export_lights=False, export_animations=False,
    )

    obj_dir.mkdir(parents=True, exist_ok=True)
    obj_path = obj_dir / "mannequin_paint.obj"
    bpy.ops.wm.obj_export(
        filepath=str(obj_path), check_existing=False, export_selected_objects=True,
        export_uv=True, export_normals=True, export_materials=False,
        path_mode="RELATIVE", export_triangulated_mesh=True, export_eval_mode="DAG_EVAL_RENDER",
    )
    write_mtl(obj_dir / "mannequin_paint.mtl")
    # Ohne usemtl bindet Procreate die Textur nicht an das Mesh. Der Export laeuft
    # bewusst ohne Material, damit keine absoluten Texturpfade entstehen.
    obj_text = obj_path.read_text(encoding="utf-8")
    lines = [line for line in obj_text.splitlines() if not line.startswith(("mtllib ", "usemtl "))]
    obj_path.write_text("mtllib mannequin_paint.mtl\nusemtl skincolor\n" + "\n".join(lines) + "\n", encoding="utf-8")

    report = {
        "blenderVersion": bpy.app.version_string,
        "source": source.name,
        "texture": texture.name,
        "glb": glb_target.name,
        "glbBytes": glb_target.stat().st_size,
        "obj": obj_path.name,
        "objBytes": obj_path.stat().st_size,
        "polygons": source_polygons,
        "vertices": source_vertices,
        "uvOverlapLoopsBefore": overlap_loops_before,
        "uvOverlapFacesBefore": overlap_faces_before,
        "degenerateUvFaces": len(tiny_faces),
        "uvAreaMedian": uv_median,
        "uvAreaThreshold": uv_threshold,
        "repairedFaces": repaired,
        "uvOverlapLoopsAfter": overlap_loops_after,
        "uvOverlapFacesAfter": overlap_faces_after,
        "material": {"name": material.name, "roughness": 0.62, "metallic": 0.0},
        "shading": "shade_smooth_without_auto_smooth",
        "uvLayout": "smart_project + packed grid repair",
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("MANNEQUIN_WEB_ASSET " + json.dumps(report, sort_keys=True))


main()
