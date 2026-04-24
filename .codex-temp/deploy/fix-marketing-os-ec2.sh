#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p /home/ec2-user/deploy-staging/marketing-os /home/ec2-user/marketting-os-backups

tar -czf "/home/ec2-user/marketting-os-backups/marketting-os-fix-${TS}.tgz" \
  --exclude=.git \
  --exclude=marketing-os-server/node_modules \
  --exclude=marketing-os-server/dist \
  -C /home/ec2-user marketting-os

rm -rf /home/ec2-user/deploy-staging/marketing-os/*
tar -xzf /home/ec2-user/marketing-os-sync-fix.tgz -C /home/ec2-user/deploy-staging/marketing-os

rsync -a --delete \
  --exclude=.git \
  --exclude=marketing-os-server/.env \
  --exclude=marketing-os-server/.env.* \
  --exclude=marketing-os-server/node_modules \
  --exclude=marketing-os-server/dist \
  --exclude=marketing-os-ui/node_modules \
  --exclude=marketing-os-ui/.env \
  /home/ec2-user/deploy-staging/marketing-os/ /home/ec2-user/marketting-os/

cd /home/ec2-user/marketting-os/marketing-os-server
npm run build
pm2 restart marketing-os-api
pm2 save

echo "__STATUS__"
pm2 describe marketing-os-api | sed -n '1,25p'
echo "__HASH__"
sha256sum /home/ec2-user/marketting-os/marketing-os-server/src/modules/messaging/messaging.controller.ts | awk '{print $1}'
