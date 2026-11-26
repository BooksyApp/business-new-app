# booqi Business (mobile)

Expo SDK 57 + expo-router app for salon owners and their team. Ported from `business-app` (api, session, screens) and restyled to the
published design (`artifacts/business-final`, BF01-BF13, BF40-BF49, BF79) with the glass dock pattern of `customer-new-app`.

- Identity: name `booqi Business`, slug `booqi-business`, scheme `booqibiz`, bundle id / package `az.booqi.business`.
- Login: `POST /api/public/auth/login` with `app` = `IOS_BUSINESS` / `ANDROID_BUSINESS` (`packages/shared/src/api/audience.ts`). No `X-PLATFORM` header (the old app never sent one).
- API base: `EXPO_PUBLIC_API_BASE` (default `https://new-business.getbooqi.tech`).
- Tabs: Təqvim, Müştərilər, Bildirişlər, Daha çox. Görünüşlər / Xidmətlər / Komanda / Rəylər / Mesajlar / Parametrlər are "Tezliklə" stubs.
- Run: `npm run mobile:start` (port 8083). Typecheck runs in CI (`.github/workflows/ci-mobile.yml`).
- Icons: Solar (CC BY 4.0), licence in `packages/shared/icons/LICENSE-ICONS.md`.

## Startup safety (v0.2.1+)
- `app/index.tsx` redirects by auth status (never to a guarded route); `app/+not-found.tsx` sends unknown deep links home.
- `src/lib/crash.tsx`: root error boundary + `ErrorUtils` handler show a plain-RN error screen (message + stack, retry button) instead of a blank app.
- Splash is force-hidden after 4s; fonts wait at most 3s; session bootstrap falls back to login after 6s; `expo-notifications` is lazy-loaded.
- API calls time out after 25s (status 0 = offline); a failed token refresh over the network keeps the session.
- Typecheck locally: `npx tsc --noEmit -p tsconfig.json` (needs node_modules; CI runs `ci-mobile`). Fix list: `FIXES.md`, `FIXES2.md`.
