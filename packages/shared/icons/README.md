# İkon kitabxanası (tək mənbə)

Bütün ikonlar `svg/` qovluğundadır: `ad.svg` (passiv, Solar Broken) və `ad-bold.svg` (aktiv, Solar Bold). Mobil, veb və dizayn artifact-ı yalnız buradan oxuyur.

**İkonu dəyişmək:** eyni adlı SVG faylını əvəz et (viewBox `0 0 24 24`, rənglər `currentColor`, width/height yox), sonra kökdə `npm run icons` işə sal və commit et.
**Yeni ikon:** `svg/ad.svg` (+ istəsən `svg/ad-bold.svg`) əlavə et, `npm run icons`. Bold yoxdursa aktivdə passiv glif aktiv rəngdə çəkilir.
**Nə yaranır:** `apps/mobile/src/theme/iconData.ts` (bu monoreponun skripti yalnız mobil üçün generasiya edir).
Səhv viewBox və ya sərt rəng olarsa skript aydın mesajla dayanır. CI generasiya olunan faylların köhnəldiyini yoxlayır.
Dizayn artifact-ı (F69 kataloqu): `npm run icons:catalog` (yalnız lokal). Mənbə lisenziyası: `LICENSE-ICONS.md`.
