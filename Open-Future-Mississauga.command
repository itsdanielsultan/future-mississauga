#!/bin/zsh
# Open this checkout on the Mac using a free local port.
set -eu
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}"
exec node scripts/serve.mjs --port 0 --open
