#!/usr/bin/env python3
"""Exakter UV-Ueberlappungstest fuer Mannequin-Assets (ohne Blender).

Warum eigener Test: `bpy.ops.uv.select_overlap` meldet sehr kleine, aber
trennbare Dreiecke als Ueberlappung und ist damit fuer Procreate-Entscheidungen
zu ungenau. Hier wird die tatsaechliche Schnittflaeche zweier UV-Dreiecke
berechnet (Sutherland-Hodgman-Clipping, beide Dreiecke sind konvex).

Aufruf:
  python3 scripts/check-mannequin-uv-overlap.py --input <asset.obj|asset.glb> \
    --out <report.json>

Draco-komprimierte GLBs muessen vorher entpackt werden, z. B. mit
  npx @gltf-transform/cli copy in.glb out.glb
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

EPSILON_AREA = 1e-9
GRID = 512


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", default="")
    return parser.parse_args()


def read_obj(path: Path) -> list[tuple[tuple[float, float], ...]]:
    verts: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    triangles = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        parts = raw.split()
        if not parts:
            continue
        if parts[0] == "v":
            verts.append(tuple(float(value) for value in parts[1:4]))
        elif parts[0] == "vt":
            uvs.append((float(parts[1]), float(parts[2])))
        elif parts[0] == "f":
            corners = []
            for token in parts[1:]:
                pieces = token.split("/")
                uv_index = int(pieces[1]) if len(pieces) > 1 and pieces[1] else 0
                corners.append(uvs[uv_index - 1] if uv_index else (0.0, 0.0))
            for index in range(1, len(corners) - 1):
                triangles.append((corners[0], corners[index], corners[index + 1]))
    return triangles


def read_glb(path: Path) -> list[tuple[tuple[float, float], ...]]:
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or total != len(data):
        raise SystemExit(f"{path}: kein gueltiges GLB")
    offset = 12
    document = None
    binary = b""
    while offset < total:
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        offset += length
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode("utf-8").rstrip(" \x00"))
        elif kind == 0x004E4942:
            binary = chunk
    if document is None:
        raise SystemExit(f"{path}: kein JSON-Chunk")
    if "KHR_draco_mesh_compression" in document.get("extensionsRequired", []):
        raise SystemExit(f"{path}: Draco-komprimiert — bitte vorher entpacken")

    component_formats = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
    type_counts = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

    def accessor_values(index: int) -> list[float]:
        accessor = document["accessors"][index]
        view = document["bufferViews"][accessor["bufferView"]]
        fmt, size = component_formats[accessor["componentType"]]
        count = type_counts[accessor["type"]]
        stride = view.get("byteStride") or size * count
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        values = []
        for element in range(accessor["count"]):
            base = start + element * stride
            values.append(struct.unpack_from("<" + fmt * count, binary, base))
        return values

    triangles = []
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            attributes = primitive.get("attributes", {})
            if "TEXCOORD_0" not in attributes or primitive.get("mode", 4) != 4:
                continue
            uv = accessor_values(attributes["TEXCOORD_0"])
            if "indices" in primitive:
                index = [int(value[0]) for value in accessor_values(primitive["indices"])]
            else:
                index = list(range(len(uv)))
            for position in range(0, len(index) - 2, 3):
                triangles.append(tuple((uv[index[position + k]][0], uv[index[position + k]][1]) for k in range(3)))
    return triangles


def area(triangle: tuple[tuple[float, float], ...]) -> float:
    (ax, ay), (bx, by), (cx, cy) = triangle
    return abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2


def clip(subject: list[tuple[float, float]], clip_triangle: tuple[tuple[float, float], ...]) -> list[tuple[float, float]]:
    output = subject
    sign = 1.0 if area(clip_triangle) > 0 else -1.0
    for index in range(3):
        if not output:
            break
        (x1, y1), (x2, y2) = clip_triangle[index], clip_triangle[(index + 1) % 3]
        dx, dy = x2 - x1, y2 - y1

        def side(point: tuple[float, float]) -> float:
            return sign * (dx * (point[1] - y1) - dy * (point[0] - x1))

        source, output = output, []
        for position, current in enumerate(source):
            previous = source[position - 1]
            inside_current = side(current) >= -1e-15
            inside_previous = side(previous) >= -1e-15
            if inside_current:
                if not inside_previous:
                    output.append(intersection(previous, current, side))
                output.append(current)
            elif inside_previous:
                output.append(intersection(previous, current, side))
    return output


def intersection(start: tuple[float, float], end: tuple[float, float], side) -> tuple[float, float]:
    t = side(start) / (side(start) - side(end))
    return (start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t)


def polygon_area(points: list[tuple[float, float]]) -> float:
    total = 0.0
    for position, point in enumerate(points):
        following = points[(position + 1) % len(points)]
        total += point[0] * following[1] - following[0] * point[1]
    return abs(total) / 2


def overlaps(triangles: list[tuple[tuple[float, float], ...]]) -> list[dict]:
    cells: dict[tuple[int, int], list[int]] = {}
    bounds = []
    for index, triangle in enumerate(triangles):
        xs = [point[0] for point in triangle]
        ys = [point[1] for point in triangle]
        low = (min(xs), min(ys))
        high = (max(xs), max(ys))
        bounds.append((low, high))
        for gx in range(max(0, int(low[0] * GRID)), min(GRID - 1, int(high[0] * GRID)) + 1):
            for gy in range(max(0, int(low[1] * GRID)), min(GRID - 1, int(high[1] * GRID)) + 1):
                cells.setdefault((gx, gy), []).append(index)
    found = []
    checked = set()
    for bucket in cells.values():
        for first in range(len(bucket)):
            for second in range(first + 1, len(bucket)):
                a, b = bucket[first], bucket[second]
                if (a, b) in checked:
                    continue
                checked.add((a, b))
                (a_low, a_high), (b_low, b_high) = bounds[a], bounds[b]
                if a_high[0] <= b_low[0] or b_high[0] <= a_low[0] or a_high[1] <= b_low[1] or b_high[1] <= a_low[1]:
                    continue
                clipped = clip(list(triangles[b]), triangles[a])
                if len(clipped) < 3:
                    continue
                covered = polygon_area(clipped)
                if covered <= EPSILON_AREA:
                    continue
                found.append({"faces": [a, b], "intersectionArea": covered,
                              "areas": [area(triangles[a]), area(triangles[b])]})
    found.sort(key=lambda entry: -entry["intersectionArea"])
    return found


def main() -> None:
    args = parse_args()
    path = Path(args.input)
    triangles = read_glb(path) if path.suffix.lower() == ".glb" else read_obj(path)
    if not triangles:
        raise SystemExit(f"{path}: keine UV-Dreiecke gefunden")
    collisions = overlaps(triangles)
    total_area = sum(area(triangle) for triangle in triangles)
    report = {
        "file": path.name,
        "bytes": path.stat().st_size,
        "triangles": len(triangles),
        "uvArea": round(total_area, 6),
        "overlappingPairs": len(collisions),
        "worst": collisions[:5],
        "passed": not collisions,
    }
    print("UV_OVERLAP_CHECK " + json.dumps(report, sort_keys=True))
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if collisions:
        raise SystemExit(1)


main()
