# Port report P2 (BF50-BF56, Anbar BF57)

Branch feat/port-p2, draft PR #9 into feat/new-ui. CI (typecheck + web build) green on every push.
Helper added: src/components/bz/p2-page.tsx (BzPage wrapper = AppLayout + .dsh/.mainx, initialsOf).

## Ported (full page markup on kit)
- LocationsPage (BF56 Filiallar), StaffTargetsPage (BF54), AddonsPage + AddAddonPage (BF52: list, drawer, preview)
- BusinessHoursPage (BF56: .hrw rows, closed-day Dialog)
- CreateBusinessPage (BF56 Salon yarat)
- ItemsCategoryPage (BF50: category rail, rows, archive view, ConfirmDialog, category Drawer)
- RolesPage (BF54: role rows + permission editor Drawer)
- AddStaffPage, EditStaffPage (BF55: Drawer, CheckRow services, hours card)
- InventoryPage (BF57: kp tiles, pill tabs, rows with +/-)

## Partial (shell only: Drawer + Tabs + footer bar; tab bodies keep old markup)
- AddServicePage (1449 lines; 5 tabs, bodies not yet converted to SectionCard/Field)
- AddComboServicePage (same)

## Skipped (not started, size/budget)
- StaffPage (2281 lines: members, shifts, resources, commissions, time-off/payout/rule dialogs)
- SuppliersOrdersPage, StockCountPage; Peak pricing card, Portfolio section, ChairRentCard, WorkingHoursEditor, RoleSelect, StaffAvatarPicker (old-styled widgets kept as children)

## Does not fit the artifact structure (resolved)
All earlier regressions restored in commit "fix(port-p2): restore dropped features" (CI green):
- Roles: instant-save permission matrix (desktop table + phone one-role view) back, in a Card under the role rows.
- Business hours: client preview (ClientPreview) back under the cards.
- Create business: SalonPreview back as an aside beside the form.
- Inventory: Meter bar + reorder level back in each row.
- Add-ons: preview again shows the sample service line plus the add-on line.
- Services: mobile category chip row + category menu back (lg:hidden); .rail hidden below lg (max-lg:hidden); verify visually.
- Drawer, Dialog, ConfirmDialog in bz/Overlay.tsx now use Radix Dialog (Esc, focus trap, aria), rendered without portal so scope wrappers apply.
