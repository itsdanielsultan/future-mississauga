"""Verify or replay one of the November 20 city views from the owner's packed scenes."""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path


HERE = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text())


def verify(path, expected):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    if digest.hexdigest() != expected:
        raise ValueError(f'Input has changed: {path.name}')


def relocate(value, archive):
    # Original receipts pin bytes but also record the absolute paths used by Blender.
    if isinstance(value, dict):
        return {key: relocate(item, archive) for key, item in value.items()}
    if isinstance(value, list):
        return [relocate(item, archive) for item in value]
    if isinstance(value, str) and value.startswith('/') and '/work/' in value:
        return str(archive / value.split('/work/', 1)[1])
    return value


def checked_inputs(scene, digest, archive):
    receipt = archive / scene['importProof']
    verify(receipt, scene['importSHA256'])
    data = relocate(read(receipt), archive)
    blend = archive / scene['blend']
    if data['packedBlend']['sha256'] != digest or data['input']['sha256'] != scene['sourceGLBSHA256']:
        raise ValueError(f'Conflicting source record: {receipt.name}')
    verify(blend, digest)
    for field in ('inventory', 'offlineRepresentationAdapter'):
        pin = data.get(field)
        if pin:
            verify(Path(pin['path']), pin['sha256'])
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, help='Owner’s original model workspace, starting at work/')
    parser.add_argument('--workspace', type=Path, help='Output directory for rendered scenes and receipts')
    parser.add_argument('--view', action='append', help='Repeat to select specific camera identities')
    parser.add_argument('--proof-edge', type=int, help='Render a small camera proof into a separate folder')
    parser.add_argument('--blender', default='blender', help='Blender executable')
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--prepare', action='store_true', help='Create a Blender Scripting workspace job instead of launching Blender')
    parser.add_argument('--check', action='store_true', help='Validate private source pins without rendering')
    args = parser.parse_args()
    recipe = read(HERE / 'cameras.json')
    known = {view['identity']: view for view in recipe['views']}
    requested = args.view or list(known)
    missing = set(requested) - known.keys()
    if missing:
        parser.error('Unknown camera: ' + ', '.join(sorted(missing)))
    if args.list:
        print('\n'.join(requested))
        return
    if not args.archive or not (args.check or args.workspace):
        parser.error('Supply --archive and one of --check or --workspace.')
    if args.proof_edge is not None and args.proof_edge < 1:
        parser.error('--proof-edge must be positive')
    archive = args.archive.resolve()
    receipt_cache = {}
    if not args.check:
        workspace = args.workspace.resolve()
        output_group = workspace / ('proofs' if args.proof_edge else 'native')
        output_group.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(HERE / 'selected.json', workspace / 'selected.json')
    gui_queue = []
    for name in requested:
        view = known[name]
        source_id = view['source']
        if source_id not in receipt_cache:
            receipt_cache[source_id] = checked_inputs(recipe['scenes'][source_id], source_id, archive)
        if args.check:
            continue
        source = receipt_cache[source_id]
        output = output_group / name.removesuffix('.png').replace('/', '-')
        if output.exists() and any(output.iterdir()):
            raise FileExistsError(f'Existing render directory: {output}')
        inputs = workspace / 'inputs' / output.name
        inputs.mkdir(parents=True, exist_ok=True)
        receipt = inputs / 'import.json'
        plan = inputs / 'plan.json'
        receipt.write_text(json.dumps(source))
        plan.write_text(json.dumps(dict(lighting=view['lighting'], background=view['background'], jobs=[view['job']])))
        command = [args.blender, '--background', '--disable-autoexec', source['packedBlend']['path'],
                   '--python-exit-code', '1', '--python', str(HERE / 'renderers' / view['renderer']),
                   '--', str(receipt), str(plan), str(output), '--identities', name, '--samples', str(view['samples'])]
        if args.proof_edge:
            command.extend(['--max-preview-edge', str(args.proof_edge)])
        if view['trial']:
            command.append('--allow-trial')
        if view['waterShadowDisabled']:
            command.append('--water-shadow-disabled')
        if args.prepare:
            gui_queue.append(dict(scene=source['packedBlend']['path'], script=command[command.index('--python') + 1],
                                  arguments=command[command.index('--') + 1:]))
        else:
            subprocess.run(command, env={**os.environ, 'FM_MODEL_ARCHIVE': str(archive)}, check=True)
    if gui_queue:
        local_script = workspace / 'render-in-blender.py'
        body = (HERE / 'in_blender.py').read_text()
        local_script.write_text('ARCHIVE = ' + repr(str(archive)) + '\nJOBS = ' + repr(gui_queue) + '\n' + body)
        print(f'Open {local_script.name} in Blender’s Scripting workspace and choose Run Script.')
    print(f'Checked {len(receipt_cache)} packed scenes for {len(requested)} camera views.')


if __name__ == '__main__':
    main()
