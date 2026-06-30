#!/bin/sh
set -eu

mkdir -p /app/data /app/library /app/covers /app/tmp /tmp
chown -R flacdium:flacdium /app/data /app/library /app/covers /app/tmp /tmp

exec gosu flacdium "$@"
