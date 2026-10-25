"""Independent Pillow decode check for the build's retained legacy PNG URLs.

Usage: python scripts/verify-publication-pixels.py [public] [dist]
Requires Pillow; no network, source mutation or publication action.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
output = Path(sys.argv[2] if len(sys.argv) > 2 else "dist")
manifest = json.loads((output / "data/publication-derivatives.json").read_text())
assert manifest["state"] == "prepared-local-publication"
checked = 0
for row in manifest["images"]:
    old, new = source / row["file"], output / row["file"]
    assert hashlib.sha256(old.read_bytes()).hexdigest() == row["sourceSHA256"]
    assert hashlib.sha256(new.read_bytes()).hexdigest() == row["sha256"]
    with Image.open(old) as a, Image.open(new) as b:
        a.load()
        b.load()
        assert (a.size, a.mode) == (b.size, b.mode), row["file"]
        assert a.tobytes() == b.tobytes(), row["file"]
        assert hashlib.sha256(b.tobytes()).hexdigest() == row["decodedPixelSHA256"]
    checked += 1
assert checked == 91
print(json.dumps({"independentDecoder": "Pillow", "legacyPNGs": checked,
                  "pixelsIdentical": True, "sourceAndOutputHashesVerified": True}, indent=2))
