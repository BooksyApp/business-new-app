# packages/shared

Shared code of the business workspace (consumed by `apps/mobile`).

- `src/api/core.ts` - API request core (offline, RFC 7807, renew-and-retry), copied from customer-new-app and adapted.
- `src/api/audience.ts` - the `app` audience names for login (`IOS_BUSINESS`, `ANDROID_BUSINESS`, `WEB_BUSINESS`), defined once.
- `icons/` - Solar icon library (SVG sources). Licence: `icons/LICENSE-ICONS.md` (CC BY 4.0, 480 Design). Run `npm run icons` at the root to regenerate `apps/mobile/src/theme/iconData.ts`.
