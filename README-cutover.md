# Cut-over plan: salon-hub -> business-new-app (NOT executed; needs the founder's yes)

Today staging deploy.sh `hub` takes an INCOMING tree (git archive of repo `salon-hub`, branch `staging/2026-11-15`) uploaded to /opt/booqi-staging/incoming/salon-hub-<sha>-<ts>; it builds `src/salon-hub` (vite build) and atomically swaps a static dir. No git URL in deploy.sh.

Steps (when approved):
1. In business-new-app: `git archive --format=tar HEAD apps/web | tar -x --strip-components=2 -C <tmp>` so the tree root equals the old salon-hub layout (package.json at root). Name it salon-hub-<sha>-<ts> (name pattern is enforced; deploy.sh and `repo_of hub` stay unchanged).
2. Upload to incoming/ and run `./deploy.sh hub <incoming-dir>`. Build env (VITE_*) is unchanged.
3. Verify: https://business.getbooqi.tech loads at `/`, login, calendar, `/api` + `/ws` work, assets 200, CSP has no violations, Sentry release = new sha.
4. Rollback: `./deploy.sh rollback hub` (instant swap to the previous release).
5. Later (optional): add a deploy script/ci-hub.sh in this repo like customer-new-app's ci-newweb.sh.
6. The old salon-hub repo is deleted/archived ONLY after the founder says so, following a verified cut-over. Nothing is removed now.
