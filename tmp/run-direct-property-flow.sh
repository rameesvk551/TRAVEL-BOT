#!/usr/bin/env bash
set -euo pipefail
set -a
source /home/ec2-user/marketting-os/marketing-os-server/.env
set +a
cd /home/ec2-user/travel-bot-git/bot
node direct-publish-flow.mjs \
  --waba-id 2478492146002706 \
  --flow-name "ABC Trours Property Flow" \
  --flow-json ../docs/whatsapp/property-selector-flow.json
