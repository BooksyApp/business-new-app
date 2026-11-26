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

## Does not fit the artifact structure
- RolesPage: instant-save permission matrix (flip per switch, phone one-role view) removed; permissions are edited in the role Drawer only (artifact has no matrix).
- BusinessHoursPage: client preview card ("your salon page") dropped; per-day copy kept as the existing ActionMenu in the .cp slot.
- CreateBusinessPage: SalonPreview aside and AuthShell header link dropped (artifact is a bare centered form).
- AddonsPage: preview shows only the add-on line (artifact), sample service line removed.
- InventoryPage: Meter bar removed (artifact shows count only); reorder level shown as tag.
- ItemsCategoryPage: mobile category chip row and mobile category menu replaced by the .rail (check responsive in visual QA).
- Dialogs/Drawers now use kit fixed overlays: no Radix focus trap / Esc handling.
