# booqi Business (business-new-app)
AZ: booqi Business - salon paneli (web) + iOS/Android tətbiqi. Monorepo (npm workspaces).
EN: booqi Business - salon panel web + iOS/Android app.

- `apps/web` - salon panel (Vite + React, ex salon-hub, history preserved; imported from salon-hub `staging/2026-11-15`). Served at the root `/` of business.getbooqi.tech.
- `apps/mobile` - placeholder (Expo app, designed first).
- `packages/shared` - placeholder (API core, icons later).

Commands: `npm ci` · `npm run web:dev` · `npm run web:build` · `npm run typecheck`
Cut-over from the old salon-hub repo: see README-cutover.md.
