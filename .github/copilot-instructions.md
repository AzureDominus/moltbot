# AzureDominus Fork Context

This is a fork of **OpenClaw** maintained by **AzureDominus**.

## Deployment

- **VPS:** Hetzner
- **SSH Access:** `ssh timmy@timmys-crib`
- **Agent Name:** Timmy (main agent)
- **Repo Location on VPS:** `~/openclaw`

## Updating to a New Version of OpenClaw

1. Pull from upstream and resolve any merge conflicts (ask if unsure)
2. If merge conflicts were resolved, run `pnpm install && pnpm build` locally to verify the fix before pushing
3. Push to origin (the fork)
4. SSH into Timmy: `ssh timmy@timmys-crib`
5. Stop the gateway: `systemctl --user stop openclaw-gateway.service`
6. Navigate to repo: `cd ~/openclaw`
7. Pull and build: `git pull --rebase && pnpm install && pnpm build && pnpm ui:build`
8. Start the gateway: `systemctl --user start openclaw-gateway.service`

**Important:** Always use `systemctl --user` to manage the gateway service. Never use `pkill` or `nohup` to restart it.
