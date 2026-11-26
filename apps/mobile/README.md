# booqi Business (mobile)

Expo SDK 57 + expo-router app for salon owners and their team. Ported from `business-app` (api, session, screens) and restyled to the
published design (`artifacts/business-final`, BF01-BF13, BF40-BF49, BF79) with the glass dock pattern of `customer-new-app`.

- Identity: name `booqi Business`, slug `booqi-business`, scheme `booqibiz`, bundle id / package `az.booqi.business`.
- Login: `POST /api/public/auth/login` with `app` = `IOS_BUSINESS` / `ANDROID_BUSINESS` (`packages/shared/src/api/audience.ts`). No `X-PLATFORM` header (the old app never sent one).
- API base: `EXPO_PUBLIC_API_BASE` (default `https://new-business.getbooqi.tech`).
- Tabs: Təqvim, Müştərilər, Bildirişlər, Daha çox. Görünüşlər / Xidmətlər / Komanda / Rəylər / Mesajlar / Parametrlər are "Tezliklə" stubs.
- Run: `npm run mobile:start` (port 8083). Typecheck runs in CI (`.github/workflows/ci-mobile.yml`).
- Icons: Solar (CC BY 4.0), licence in `packages/shared/icons/LICENSE-ICONS.md`.
