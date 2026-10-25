"""Reproduce the lossless web copy from the accepted, unmodified Library ZIP."""
import gzip
import hashlib
import pathlib
import sys
import zipfile

ARCHIVE_SHA256 = '2a4bfb61e489aecc0eca530a6b0bdd19621d36a01c049f3a677ed40a0be1a54c'
GLB_SHA256 = '8bcba67694f6f80553a505ca037fa5bbc3451d7cadd11c554b9221625c50964e'
MEMBER = 'Artform_Rev03_20261025/models/Artform_Exterior_Study_rev03.glb'

def prepare(archive, output):
    if hashlib.sha256(archive.read_bytes()).hexdigest() != ARCHIVE_SHA256:
        raise ValueError('Accepted Artform archive identity does not match.')
    with zipfile.ZipFile(archive) as source:
        model = source.read(MEMBER)
    if len(model) != 15798312 or hashlib.sha256(model).hexdigest() != GLB_SHA256:
        raise ValueError('Accepted Artform GLB identity does not match.')
    encoded = bytearray(gzip.compress(model, compresslevel=9, mtime=0))
    encoded[9] = 3  # Reproducible gzip platform marker, independent of the host.
    if gzip.decompress(encoded) != model:
        raise ValueError('Gzip changed the accepted model bytes.')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encoded)
    print(f'{len(encoded)} bytes; SHA-256 {hashlib.sha256(encoded).hexdigest()}')

if __name__ == '__main__':
    root = pathlib.Path(__file__).resolve().parents[1]
    prepare(pathlib.Path(sys.argv[1]), root / 'public/models/studies-20261025/artform-rev03.glb.gz')
