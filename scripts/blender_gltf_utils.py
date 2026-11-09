"""Kleine Helfer fuer die Blender-Skripte (kein bpy-Zugriff beim Import)."""
from __future__ import annotations

import json
import struct
import tempfile
from pathlib import Path


def strip_basisu(path: Path) -> Path:
    """Blender 4.5 kann KHR_texture_basisu nicht importieren.

    Fuer Bake und Render brauchen wir nur Geometrie, UVs und ggf. die
    PNG-Textur; die KTX2-Referenz wird deshalb aus einer Kopie entfernt.
    """
    data = path.read_bytes()
    if data[:4] != b"glTF":
        return path
    _, version, total = struct.unpack_from("<4sII", data, 0)
    if version != 2 or total != len(data):
        raise RuntimeError(f"{path}: ungueltiger GLB-Header")
    offset, chunks = 12, []
    while offset < total:
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunks.append((kind, data[offset:offset + length]))
        offset += length
    document = json.loads(chunks[0][1].decode("utf-8").rstrip(" \x00"))
    if "KHR_texture_basisu" not in document.get("extensionsRequired", []):
        return path
    for key in ("extensionsUsed", "extensionsRequired"):
        if key in document:
            document[key] = [value for value in document[key] if value != "KHR_texture_basisu"]
            if not document[key]:
                document.pop(key)
    for key in ("images", "textures", "samplers"):
        document.pop(key, None)
    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        pbr.pop("baseColorTexture", None)
        pbr.pop("metallicRoughnessTexture", None)
        for key in ("normalTexture", "occlusionTexture", "emissiveTexture", "extensions"):
            material.pop(key, None)
    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    binary = chunks[1][1] if len(chunks) > 1 else b""
    binary += b"\x00" * (-len(binary) % 4)
    length = 12 + 8 + len(encoded) + (8 + len(binary) if binary else 0)
    output = struct.pack("<4sII", b"glTF", 2, length) + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
    if binary:
        output += struct.pack("<II", len(binary), 0x004E4942) + binary
    target = Path(tempfile.mkstemp(prefix="mannequin-strip-", suffix=".glb")[1])
    target.write_bytes(output)
    return target
