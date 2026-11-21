"""Restore the public media omitted from Git, checking each file before installation."""
import argparse
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path, PurePosixPath
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ORIGINS = {
    "preview": "https://future-mississauga-preview.thedanielsultan.workers.dev",
    "live": "https://futuremississauga.com",
}

def content_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def recover(public, origin, route, record):
    path = PurePosixPath(route)
    if not route.startswith("/") or str(path) != route or ".." in path.parts:
        raise ValueError("Invalid public media path")
    key, size = record["key"], record["bytes"]
    if not re.fullmatch(r"[a-f0-9]{64}", key) or type(size) is not int or size <= 0:
        raise ValueError("Invalid media record for " + route)
    dest = public.joinpath(*path.parts[1:])
    if not dest.resolve().is_relative_to(public.resolve()):
        raise ValueError("Media path escapes the public directory")
    if dest.exists():
        if dest.stat().st_size == size and content_hash(dest) == key:
            return False
        raise ValueError("A different local file already exists at " + route)
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = Request(origin + "/media/sha256/" + key, headers={"Accept-Encoding": "identity"})
    with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False) as output:
        temp = Path(output.name)
        try:
            digest = hashlib.sha256()
            with urlopen(request, timeout=120) as response:
                if response.status != 200:
                    raise ValueError("Unexpected response for " + route)
                for block in iter(lambda: response.read(1024 * 1024), b""):
                    if output.tell() + len(block) > size:
                        raise ValueError("Download exceeds its published size at " + route)
                    output.write(block)
                    digest.update(block)
            if output.tell() != size or digest.hexdigest() != key:
                raise ValueError("The hosted file differs from this Git edition at " + route)
            output.flush()
            os.link(temp, dest)
        finally:
            temp.unlink(missing_ok=True)
    return True

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="host", choices=tuple(ORIGINS), default="preview")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "cloudflare/media-recovery.json").read_text())
    restored = sum(recover(ROOT / "public", ORIGINS[args.host], route, record) for route, record in manifest["routes"].items())
    print(f"Restored {restored} files. Verified {len(manifest['routes'])} public media paths.")

if __name__ == "__main__":
    main()
