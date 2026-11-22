#!/bin/sh
# Haalt het publieke wildcard-certificaat van local-ip.sh op (*.local-ip.sh, alleen voor testen).
set -eu
map="$(dirname "$0")"
curl -fsSL https://local-ip.sh/server.pem -o "$map/fullchain.pem"
curl -fsSL https://local-ip.sh/server.key -o "$map/privkey.pem"
echo "Certificaat opgehaald in $map"
