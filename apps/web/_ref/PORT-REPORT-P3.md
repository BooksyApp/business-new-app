# PORT-REPORT P3

Branch feat/port-p3, PR #12 (draft) into feat/new-ui. CI (typecheck + build) green on last head.
New kit-extension file: src/components/bz/p3-Settings.tsx (BzPage, SettingsFrame = BF58 rail + stk, HelpLink, BzSaveBar).

## Ported
- Setup hub (SetupPage): BF58 g3 of Cards with chevron rows, search kept, ?focus= kept.
- Online sales (BF59 #3), Security (BF59 #1), Notifications email + sms-push (BF58), Booking rules (all 4 sections, BF58), Branding (BF59 #2), Integrations shell + Keys/Webhooks tabs (BF59 #4-6): SettingsFrame / kit Cards, Field, Toggle, Btn, dirty save bar.
- Billing (BF59 #10 / BF69): kit Cards, Btn, Note, StatusPill, ErrorState.
- Salon profile (BusinessPage, BF58 #5): kit PageHead/Cards + kit Drawer for the edit form (Escape closes; was Radix sheet).
- Onboarding checklist (SetupGuide, BF78 #1).
- AcceptInvite (BF14/55): kit Field/Note/Btn inside AuthShell.
- Registration, 11 steps (BF77): segmented progress + group/count header, kit Field/SelectField/RadioGroup/CheckRow/RowItem/ChipRow, Back (ol) / Continue (v) footer, add-service/add-staff/hours dialogs on kit Field + FooterBar (Radix Dialog shell kept). AuthShell and --reg-* untouched.

## Partial (inner content keeps old styling)
- Integrations: MarketplaceTabs.tsx (market/feeds/calendar/tracking/social/domain tabs) not restyled; revoke/delete confirms stay Radix AlertDialog.
- Billing: invoice/commission/message tables and the two confirm AlertDialogs stay as before (logic identical).
- Notifications: NotificationTextsCard, ChannelsCard, ClientPreview unchanged. Booking rules: SlotOffersCard, ClientPreview unchanged. Branding: ClientPreview/receipt preview unchanged. Business: SalonQrCard, ShareKitCard, webCard unchanged.
- Registration: success screen and "signups closed" screen keep brandCta; SalonPreview aside unchanged.

## Skipped
- Login: already BF13-like (inline --reg-* in AuthShell), left as is.
- QuickSearch, profile menu, language switch: live in components/layout/* (forbidden to touch).
- BF76 (shop orders list): ShopOrdersPage is another group; only the online-sales settings form (BF76 #3) is covered.

## Real fields not placed
None dropped. Notes: Booking rules page-head save is disabled until dirty (as before). Brand color shows a "#rrggbb" error hint (was a red ring). Deposit/late-fee fields on salon profile remain intentionally absent (as before).
