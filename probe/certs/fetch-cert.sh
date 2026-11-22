#!/bin/sh
# Fetches the public wildcard certificate from local-ip.sh (*.local-ip.sh, for testing only).
set -eu
dir="$(dirname "$0")"
curl -fsSL https://local-ip.sh/server.pem -o "$dir/fullchain.pem"
curl -fsSL https://local-ip.sh/server.key -o "$dir/privkey.pem"
echo "Certificate fetched into $dir"
