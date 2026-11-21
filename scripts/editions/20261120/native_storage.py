"""Lossless storage for near-identical native Blender PNGs in a local render workspace."""
import base64
import hashlib
import json
import os
import struct
import zlib
from itertools import zip_longest
from pathlib import Path

import numpy as np

HEADER = b'\x89PNG\r\n\x1a\n'
BLOCK = 262144


def file_digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def png_chunks(path):
    with path.open('rb') as source:
        if source.read(8) != HEADER:
            raise ValueError(f'Unexpected PNG signature in {path}')
        while header := source.read(8):
            size, tag = struct.unpack('>I4s', header)
            data = source.read(size)
            checksum = source.read(4)
            if checksum != struct.pack('>I', zlib.crc32(data, zlib.crc32(tag))):
                raise ValueError(f'Invalid PNG chunk in {path}')
            yield tag, data, header + data + checksum


def filtered_parts(compressed):
    decoder = zlib.decompressobj()
    pending = bytearray()
    for piece in compressed:
        pending.extend(decoder.decompress(piece))
        while len(pending) >= BLOCK:
            yield bytes(pending[:BLOCK])
            del pending[:BLOCK]
    pending.extend(decoder.flush())
    if pending:
        yield bytes(pending)


def png_data(path):
    return filtered_parts(data for tag, data, _ in png_chunks(path) if tag == b'IDAT')


def xor(a, b):
    if a is None or b is None or len(a) != len(b):
        raise ValueError('Native PNG delta requires identically sized scanlines.')
    return np.bitwise_xor(np.frombuffer(a, 'u1'), np.frombuffer(b, 'u1')).tobytes()


def pack(path, reference, expected_sha):
    """Keep raw bytes on any mismatch. Remove only the freshly rendered working PNG on success."""
    receipt = path.with_suffix('.png.restore.json')
    delta = path.with_suffix('.png.delta')
    if not path.is_file():
        return receipt.is_file()
    if path.samefile(reference):
        return False
    before, lengths, after = [], [], []
    for tag, data, complete in png_chunks(path):
        if tag == b'IDAT':
            lengths.append(len(data))
        else:
            (after if lengths else before).append(base64.b64encode(complete).decode('ascii'))
    if not lengths or not after:
        return False
    temporary = delta.with_suffix('.partial')
    compressor = zlib.compressobj(6)
    with temporary.open('wb') as out:
        for old, new in zip_longest(png_data(reference), png_data(path)):
            out.write(compressor.compress(xor(old, new)))
        out.write(compressor.flush())
    if temporary.stat().st_size >= path.stat().st_size // 3:
        temporary.unlink()
        return False
    temporary.replace(delta)
    description = dict(base=os.path.relpath(reference, path.parent), baseSHA256=file_digest(reference),
                       before=before, IDAT=lengths, after=after, sha256=expected_sha,
                       deltaSHA256=file_digest(delta))
    # A streamed round-trip proves the exact original compressed file bytes, including metadata.
    if reconstructed_digest(path, description) != expected_sha or file_digest(path) != expected_sha:
        delta.unlink()
        return False
    temporary = receipt.with_suffix('.partial')
    temporary.write_text(json.dumps(description, separators=(',', ':')))
    temporary.replace(receipt)
    path.unlink()
    return True


def reconstruct(path, description):
    base = path.parent / description['base']
    delta = path.with_suffix('.png.delta')
    if file_digest(base) != description['baseSHA256'] or file_digest(delta) != description['deltaSHA256']:
        raise ValueError(f'Native PNG recovery source changed: {path}')
    yield HEADER
    yield from (base64.b64decode(x) for x in description['before'])
    encoder = zlib.compressobj(1, zlib.DEFLATED, 15, 8, zlib.Z_DEFAULT_STRATEGY)
    def encoded():
        with delta.open('rb') as source:
            changes = filtered_parts(iter(lambda: source.read(32768), b''))
            for old, change in zip_longest(png_data(base), changes):
                yield encoder.compress(xor(old, change))
        yield encoder.flush()
    lengths = iter(description['IDAT'])
    size = next(lengths, None)
    pending = bytearray()
    for block in encoded():
        pending.extend(block)
        while size is not None and len(pending) >= size:
            data = bytes(pending[:size])
            del pending[:size]
            yield struct.pack('>I4s', size, b'IDAT') + data + struct.pack('>I', zlib.crc32(data, zlib.crc32(b'IDAT')))
            size = next(lengths, None)
    if size is not None or pending:
        raise ValueError(f'Blender PNG encoder representation differs: {path}')
    yield from (base64.b64decode(x) for x in description['after'])


def reconstructed_digest(path, description):
    calculated = hashlib.sha256()
    for data in reconstruct(path, description):
        calculated.update(data)
    return calculated.hexdigest()


def verify(path, expected_sha):
    if path.is_file():
        return file_digest(path) == expected_sha
    description = json.loads(path.with_suffix('.png.restore.json').read_text())
    return description['sha256'] == expected_sha and reconstructed_digest(path, description) == expected_sha


def restore(path):
    if path.is_file():
        return path
    description = json.loads(path.with_suffix('.png.restore.json').read_text())
    temporary = path.with_suffix('.png.partial')
    calculated = hashlib.sha256()
    with temporary.open('wb') as out:
        for data in reconstruct(path, description):
            out.write(data)
            calculated.update(data)
    if calculated.hexdigest() != description['sha256']:
        temporary.unlink()
        raise ValueError(f'Native PNG reconstruction hash mismatched: {path}')
    temporary.replace(path)
    return path


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Restore an exact packed native PNG from its local render workspace.')
    parser.add_argument('png', type=Path)
    restore(parser.parse_args().png)
