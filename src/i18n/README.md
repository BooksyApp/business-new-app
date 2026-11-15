# Panel i18n (az / en / ru)

A small typed translation layer, no dependencies. Locales: `az` (default for new users), `en`, `ru`.
The active locale lives in `src/lib/hubLocale.ts` (the Language modal writes it to
`localStorage["booqi.hub.locale"]`).

## Files

- `locales/en.json` - the source of truth (English text, nested keys). `az.json` and `ru.json` start as
  copies of `en.json`; a content manager replaces the values. **Keep the exact same keys in all three.**
- `index.ts` - `t(key, params?)`, `tDynamic`, `tOpt`, `fmtDate`, `fmtNumber`, `getLocale`.
- `useT.ts` - `const { t, locale, fmtDate, fmtNumber } = useT()` (same lookups, bound to the React context).
- `I18nProvider.tsx` - sets `<html lang>`, and remounts the tree when the language changes so every `t()` re-evaluates.
- `format.ts` - dates/numbers. Chrome ships without Azerbaijani Intl data, so `az` month/day names are
  built by hand (same approach as booqi-web `dates.ts`); `en`/`ru` use `Intl`.
- `dateFns.ts` - `format` from date-fns with the locale applied. Import `format` from `@/i18n/dateFns`, not `date-fns`.

## Using it

```tsx
import { t } from "@/i18n";
<Button>{t("common.save")}</Button>
<Input placeholder={t("clients.searchPlaceholder")} />
toast.success(t("hooks.timeOffCreated"));
```

`t` reads the locale at call time, so it works in components, hooks, services and event handlers. Do **not**
call `t()` at module level (it would be frozen in the language at import time): inside a module-level object use
a getter (`get label() { return t("x.y"); }`) or build the object inside the component.
If a file already has a local variable called `t`, import it as `import { t as tr } from "@/i18n"`.

Keys are type-checked: `t("nope")` fails `tsc` because the key is not in `en.json`.

## Adding a key

1. Add it to `locales/en.json` under the screen's namespace (`"calendar": { "title": "Calendar" }`).
2. Add the same key to `az.json` and `ru.json` (copy the English until translated).
3. Use `t("calendar.title")`. A missing key in `az`/`ru` falls back to `en`, then to the key itself,
   with a `console.warn` in dev only.

## Interpolation and plurals (ICU-lite)

```json
"greeting": "Hello, {name}",
"clients": "{count, plural, one {# client} other {# clients}}",
"clientsZero": "{count, plural, =0 {No clients} one {# client} other {# clients}}"
```
```ts
t("common.greeting", { name: "Aysel" });
t("clients.count", { count: 3 });   // "3 clients"
```

- `{name}` is replaced by the param (`null`, `undefined`, booleans render as empty).
- `{n, plural, ...}` picks `=N`, then the language's category (`one`/`few`/`many`/`other`), then `other`;
  `#` is the number. English/Azerbaijani use `one`/`other`; Russian also needs `few` and `many`:
  `{count, plural, one {# клиент} few {# клиента} many {# клиентов} other {# клиента}}`.
- Several plurals can appear in one message; they nest inside other text freely.
- A literal `{` or `}` is not supported in values.
- Some values deliberately start or end with a space or a middle dot (` · up to {days} days out`): they are fragments that
  sit next to other text. Keep the leading/trailing space and `·` in the translation.
- `<html lang>` follows the locale; with `az` the browser upper-cases `i` as `İ` in `uppercase` styled labels, which is correct
  for Azerbaijani once the text is translated.

## Option values that are also data

Some English strings are sent to / stored by the API (survey answers, refund reasons). Their label is looked
up with `tOpt(group, value)` -> key `opt.<group>.<slug>` (slug = lower-case value with non-alphanumerics as `_`),
falling back to the raw value. Add new options under `opt.*`; keep the English value itself unchanged.

## Dates and numbers

Use `fmtDate(date, intlOptions)` / `fmtNumber(n, intlOptions)` from `@/i18n` (or `useT()`), or `format` from
`@/i18n/dateFns` for date-fns patterns. Do not call `toLocaleDateString("en-GB", ...)` directly.

## Checking coverage

`node scripts/i18n-check.mjs --list` reports user-visible literals still outside `t()` (JSX text, string
props, toast/confirm/Error arguments, strings rendered inside JSX expressions); `--wide` also lists
sentence-like literals anywhere. Deliberate leftovers (stored values, brand names, developer errors) are
listed with a reason in `scripts/i18n-allowlist.json`, or silenced on one line with an `i18n-ignore` comment.

## Namespaces (keys per namespace)

- `common` (104) - shared words used on 3+ screens (Save, Cancel, days...)
- `acceptInvite` (15)
- `addComboService` (46)
- `addons` (18)
- `addressMapPicker` (8)
- `addService` (71)
- `addStaff` (22)
- `analytics` (231)
- `auth` (24) - login/registration shell + salon preview
- `bookingRules` (43)
- `branding` (23)
- `business` (56)
- `businessHours` (38)
- `businessOwnerRoute` (3)
- `calendar` (236)
- `checkout` (16)
- `clients` (128)
- `createBusiness` (23)
- `editStaff` (18)
- `home` (34)
- `hooks` (74) - toasts and messages from src/hooks
- `inventory` (41)
- `itemsCategory` (38)
- `layout` (45) - sidebar, navigation, language modal
- `locations` (15)
- `login` (16)
- `main` (2)
- `marketing` (92)
- `media` (8)
- `memberships` (57)
- `money` (144)
- `notFound` (2)
- `notifications` (39)
- `offers` (44)
- `page` (4) - page kit components (components/page)
- `paymentMethod` (80)
- `photos` (43)
- `promotion` (44)
- `referralProgram` (44)
- `registration` (124)
- `reviews` (43)
- `roles` (36)
- `sales` (120)
- `section` (1)
- `security` (12)
- `serviceChip` (2)
- `services` (56) - error messages from src/services
- `setup` (40)
- `staff` (190)
- `team` (31)
- `ui` (14) - shadcn/ui primitives (sr-only text, aria-labels)
- `utils` (16) - helpers in src/utils, src/lib, src/config
- `kit` (2) - page kit defaults
- `opt` (53) - labels for stored option values (survey answers, refund reasons) via tOpt()
