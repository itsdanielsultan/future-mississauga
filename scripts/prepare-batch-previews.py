"""Reproduce exact GLB gzip assets from pinned Library ZIP parts.

Usage: python3 scripts/prepare-batch-previews.py /absolute/path/to/ZIP-parts
Nothing from the input archives is copied except the named, hash-verified GLBs.
"""
import gzip
import hashlib
import json
import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'model-assets/20261025'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(folder):
    manifest = json.loads((OUTPUT / 'MANIFEST.json').read_text())
    verified_archives = set()
    prepared = []
    for asset in manifest['assets']:
        archive = folder / asset['sourcePart']
        if archive not in verified_archives:
            payload = archive.read_bytes()
            if len(payload) != asset['sourcePartBytes'] or sha(payload) != asset['sourcePartSHA256']:
                raise ValueError('Source ZIP identity does not match: ' + archive.name)
            verified_archives.add(archive)
        with zipfile.ZipFile(archive) as source:
            model = source.read(asset['sourceMember'])
        if len(model) != asset['decodedBytes'] or sha(model) != asset['sha256']:
            raise ValueError('Accepted GLB identity does not match: ' + asset['id'])
        encoded = bytearray(gzip.compress(model, compresslevel=9, mtime=0))
        encoded[9] = 3
        if gzip.decompress(encoded) != model:
            raise ValueError('Gzip changed GLB bytes: ' + asset['id'])
        if len(encoded) != asset['bytes'] or sha(encoded) != asset['downloadSHA256']:
            raise ValueError('Gzip identity differs; use the recorded compression runtime: ' + asset['id'])
        prepared.append((OUTPUT / asset['file'], encoded))
    # Verify every source before writing any result.
    for path, encoded in prepared:
        path.write_bytes(encoded)
    print(json.dumps({'assets':len(prepared), 'bytes':sum(len(data) for _, data in prepared), 'decodedIdentity':'exact'}))


if __name__ == '__main__':
    prepare(pathlib.Path(sys.argv[1]).resolve())
