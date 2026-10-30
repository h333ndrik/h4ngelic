#!/usr/bin/env python3
"""Package only the exact HTML that passed both offline browser suites."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import base64, json, subprocess, zipfile

root = Path(__file__).resolve().parent.parent
html = (root / 'artifacts/h4ngelic-preview.html').read_bytes()
digest = sha256(html).hexdigest()
reports = ['artifacts/control-offline-results.json', 'artifacts/living-offline-native-results.json']
for path in reports:
    result = json.loads((root / path).read_text())
    assert (result.get('htmlSha256') or result.get('htmlSHA256')) == digest, f'Offline evidence does not match HTML: {path}'
    assert result['htmlBytes'] == len(html)
assert b'carousel-fixture-' not in html, 'Browser fixture must never be published.'
original = (root / 'public/images/digital-artworks/green-black-original.jpg').read_bytes()
original_hash = sha256(original).hexdigest()
assert original_hash == 'df0781e4f572ba9e644c3471fbb6060e228c34f02acf32d01f4b0e1dce68132f'
assert base64.b64encode(original) in html, 'The genuine original must be embedded byte-for-byte.'
soundtrack = (root / 'public/audio/h4ngelic_v8_full_sound_remaster_v11.mp3').read_bytes()
soundtrack_hash = sha256(soundtrack).hexdigest()
assert soundtrack_hash == '307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b'
assert html.count(base64.b64encode(soundtrack)) == 1, 'Approved soundtrack must be embedded exactly once, unchanged.'
tattoo_manifest = json.loads((root / 'docs/assets/tattoo-originals-v31.json').read_text())
tattoo_hashes = {}
for photo in tattoo_manifest['images']:
    path = photo['path']
    original_photo = (root / path).read_bytes()
    photo_hash = sha256(original_photo).hexdigest()
    assert photo_hash == photo['sha256'], f'Tattoo original changed: {path}'
    assert base64.b64encode(original_photo) in html, f'Tattoo original absent from offline export: {path}'
    tattoo_hashes[path] = photo_hash
folder = root / 'docs/previews'
folder.mkdir(parents=True, exist_ok=True)
(folder / 'h4ngelic-preview.html').write_bytes(html)
archive = folder / 'portfolio-preview.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    package.writestr('h4ngelic-preview.html', html)
    package.writestr('BITTE-LESEN.txt', (folder / 'README-WEBSITE-UPDATE.txt').read_bytes())
with zipfile.ZipFile(archive) as package:
    assert package.read('h4ngelic-preview.html') == html
result = dict(sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'], cwd=root, text=True).strip(),
    packagedAt=datetime.now(timezone.utc).isoformat(), htmlBytes=len(html), htmlSha256=digest,
    zipBytes=archive.stat().st_size, zipSha256=sha256(archive.read_bytes()).hexdigest(),
    zipHTMLMatchesExport=True, originalArtworkUnchanged=True, originalArtworkSHA256=original_hash,
    testFixtureContentExcluded=True, approvedSoundtrackUnchanged=True, approvedSoundtrackSHA256=soundtrack_hash,
    tattooOriginalsSHA256=tattoo_hashes, offlineReports=reports)
output = root / 'artifacts/master-foundation/offline-package.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
