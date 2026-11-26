# Staging deploy of the new business UI (new-business.getbooqi.tech)

Staging only. Workflow: `.github/workflows/deploy-staging.yml` (push to `main` / `feat/new-ui` touching `apps/web/**`, or manual).

## What the key can do
GitHub secrets `STAGING_SSH_KEY`, `STAGING_HOST`, `STAGING_KNOWN_HOSTS`. The public key sits in `~deploy/.ssh/authorized_keys` as
`command="/opt/booqi-staging/ci-newhub.sh",restrict ssh-ed25519 ... gha-business-new-app-newhub`
(`restrict` = no pty, no port/agent/X11 forwarding, no shell). The forced script accepts only:
- (default) a tar of `dist/` on stdin: extracted to `www/newhub-releases/<UTC timestamp>`, must contain `index.html`, no symlinks/devices, max 200 MB, then `www/newhub` symlink is switched atomically. Last 5 releases are kept (+ `initial`).
- `rollback`: points `www/newhub` at the previous release.
Any other command is refused ("forbidden"). It cannot read or write anything outside `www/newhub*`. Script source: `business/devops/staging/ci-newhub.sh` in the booqi workspace.

## Rollback
Actions -> "Deploy staging (new-business)" -> Run workflow -> `rollback` ticked. Or `gh workflow run deploy-staging.yml -R BooksyApp/business-new-app -f rollback=true`.
Manually (admin): `ln -sfn newhub-releases/<ts> /opt/booqi-staging/www/.newhub.tmp && mv -T /opt/booqi-staging/www/.newhub.tmp /opt/booqi-staging/www/newhub`.

## Rotation
1. `ssh-keygen -t ed25519 -N '' -C gha-business-new-app-newhub -f <tmp>/key` (outside any repo).
2. Append the new `command="/opt/booqi-staging/ci-newhub.sh",restrict <new pub>` line on the server, then `gh secret set STAGING_SSH_KEY < <tmp>/key`.
3. Run a deploy to confirm, remove the old authorized_keys line, shred `<tmp>/key`.
`STAGING_KNOWN_HOSTS`: `ssh-keyscan -t ed25519 <host>` (update if the server is rebuilt).

## Revoke
Remove the `gha-business-new-app-newhub` line from `~deploy/.ssh/authorized_keys` and delete the 3 secrets (`gh secret delete STAGING_SSH_KEY|STAGING_HOST|STAGING_KNOWN_HOSTS -R BooksyApp/business-new-app`).
