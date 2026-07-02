# TravelBot Deployment

GitHub should be the single source of truth for production. Do not patch random production files unless it is an emergency; merge the fix back into the repo immediately after.

## Required GitHub Secrets

- `EC2_HOST`: production host, for example `43.204.27.127`
- `EC2_USER`: SSH user, usually `ec2-user`
- `EC2_SSH_KEY`: private key contents for the production deploy key

## Optional GitHub Variables

- `PROD_ROOT`: defaults to `/home/ec2-user/travel-bot-git`
- `FRONTEND_RELEASE`: defaults to `/home/ec2-user/travel-bot-frontend-release`
- `API_PM2_NAME`: defaults to `travel-bot-api`
- `BOT_PM2_NAME`: defaults to `travel-bot-bot`
- `APP_URL`: defaults to `https://travelbot.wayon.in`

## Deploy Flow

1. Push to `main` or run `Deploy TravelBot Production` manually from GitHub Actions.
2. GitHub builds frontend locally in CI.
3. GitHub type-checks backend.
4. CI uploads source and `frontend/dist` artifacts to EC2.
5. EC2 installs production dependencies, swaps the frontend release, restarts PM2, and runs health checks.

The frontend is built in CI, not on production.

## Emergency Hotfix Rule

If production is patched manually with `ssh` or `scp`, copy that same fix back into the repo before the next deployment. Otherwise, the next GitHub deployment can overwrite it.
