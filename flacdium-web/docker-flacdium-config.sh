#!/bin/sh
# Rewrite the runtime config served to the browser from the FLACDIUM_BASE env var.
# Runs automatically on nginx container start (placed in /docker-entrypoint.d/).
set -e
: "${FLACDIUM_BASE:=http://localhost:8000}"
cat > /usr/share/nginx/html/flacdium-config.js <<EOF
window.FLACDIUM_MODE = true;
window.FLACDIUM_BASE = '${FLACDIUM_BASE}';
EOF
echo "flacdium-config: FLACDIUM_BASE=${FLACDIUM_BASE}"
