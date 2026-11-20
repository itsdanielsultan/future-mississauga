# The replay command supplies ARCHIVE and JOBS above this template in a local copy.
import os
import runpy
import sys
import traceback
from pathlib import Path
import bpy

os.environ['FM_MODEL_ARCHIVE'] = ARCHIVE
pending = iter(JOBS)


def render_next():
    job = next(pending, None)
    if job is None:
        print('Completed the selected Future Mississauga renders.', flush=True)
        return None
    try:
        bpy.ops.wm.open_mainfile(filepath=job['scene'], load_ui=False, use_scripts=False)
        sys.argv = ['blender', '--', *job['arguments']]
        runpy.run_path(job['script'], run_name='__main__')
    except Exception:
        output = Path(job['arguments'][2])
        (output.parent / (output.name + '-error.log')).write_text(traceback.format_exc())
        traceback.print_exc()
        raise
    return 0.25


bpy.app.timers.register(render_next, first_interval=1, persistent=True)
