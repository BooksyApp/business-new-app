import type { Id } from '@booqi/business-shared';
import { request } from '@/lib/api';

/** Back-office endpoints (inventory, marketing, money, payroll, roles, integrations, reports, profile). Same paths and bodies as the old web hub. */
const B = (b: Id) => `/businesses/${b}`;
const rng = (from?: string, to?: string) => { const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to); const s = p.toString(); return s ? `?${s}` : ''; };

export interface Product { id: Id; name: string; sku: string | null; price: number; quantityOnHand: number; lowStockThreshold: number; isActive: boolean; lowStock: boolean }
export interface ProductInput { name: string; sku?: string; price: number; quantityOnHand: number; lowStockThreshold: number; isActive?: boolean }
export interface Promo { id: Id; code: string; type: string; value: number; max_uses: number | null; uses: number; valid_to: string | null; active: boolean }
export interface Campaign { id: Id; name: string; channel: string; segment: string; subject: string | null; body: string; status: string; recipientCount: number; sentCount?: number }
export interface Expense { id: Id; category: string; description: string | null; amount: number; spent_on: string; recurs_monthly: boolean }
export interface Role { id: Id; name: string; description?: string | null; isOwner: boolean; isDefault: boolean; permissions: string[]; memberCount: number }
export interface Perm { key: string; group: string; label: string; description: string }
export interface CommissionRule { id?: Id; businessId: Id; category: string; staffId?: Id; type: string; value: number; description?: string; isActive?: boolean }
export interface TargetRow { staffId: Id; staffName: string; revenueTarget: number; bookingsTarget: number; revenueActual: number; bookingsActual: number }
export interface PayrollRun { id: Id; period_start: string; period_end: string; status: 'DRAFT' | 'APPROVED' | 'PAID'; total_amount: number; lines?: { id: Id; staff_name: string | null; hours: number; base_pay: number; commission: number; tips: number; total: number }[] }
export interface TipSummary { totals: { total: number; outstanding: number; cash: number; card: number; lines: number }; byStaff: { staff_name: string | null; earned: number; outstanding: number }[] }
export interface Drawer { id: Id; opened_at: string; status: 'OPEN' | 'CLOSED'; opening_float: number; expected?: number; counted_cash: number | null; variance: number | null }
export interface InvoiceSum { id: Id; number: string; issued_on: string; buyer_name: string | null; gross_amount: number; status: 'ISSUED' | 'VOID' }
export interface Profit { months: { month: string; revenue: number | string; expenses: number | string; wages: number | string; profit: number | string }[]; totals: { revenue: number | string; expenses: number | string; wages: number | string; profit: number | string } }
export interface Tax { totals: { count: number | string; net: number | string; tax: number | string; gross: number | string }; byRate: { rate: number | string; net: number | string; tax: number | string }[] }
export interface ApiKey { id: string; name: string; prefix: string; scopes: string[]; revokedAt: string | null; lastUsedAt: string | null }
export interface Webhook { id: string; url: string; events: string[]; active: boolean; failedDeliveries: number }
export interface Addon { id: Id; name: string; price?: number; priceType?: string; isActive: boolean }
export interface PeakRule { weekday: number; startTime: string; endTime: string; percent: number }
export interface Pkg { id: Id; name: string; service_id: Id | null; sessions_total: number; price: number; active: boolean }
export interface GiftCard { id: Id; code: string; amount: number; balance: number; status?: string }
export interface Automation { birthdayEnabled: boolean; birthdayDaysBefore: number; birthdaySubject: string | null; birthdayBody: string | null; winbackEnabled: boolean; winbackDaysAfter: number; winbackSubject: string | null; winbackBody: string | null; sentLast30Days: number }
export interface Balance { outstanding: number; credit: number; balance: number }
export interface Crm { blocked: boolean; blockReason: string | null }
export interface AuditRow { actor_name: string | null; method: string; entity_type: string | null; summary: string | null; path: string; created_at: string }
export interface ReportDataset { key: string; label: string; columns: { key: string; label: string }[]; defaultGroupBy: string | null }
export interface ReportResult { columns: { key: string; label: string }[]; rows: (string | number | boolean | null)[][]; truncated: boolean }
export interface Saved { id: string; name: string }
export interface BizProfile { id: Id; name: string; description?: string; phone?: string; email?: string; website?: string; address?: string; city?: string; onlineBookingEnabled?: boolean; minBookingNoticeMinutes?: number; maxBookingDaysAhead?: number; cancellationWindowHours?: number; depositPercent?: number; googleReviewUrl?: string | null; logoUrl?: string }

export interface Ticket { ref: string; category: string; subject: string; status: string; lastMessageAt: string }
export interface Thread { ticket: Ticket; messages: { id: Id; authorType: string; authorName: string | null; body: string; createdAt: string }[] }
export interface SlotOffer { kind: 'QUIET' | 'LAST_MINUTE'; weekday?: number | null; startTime?: string | null; endTime?: string | null; hoursAhead?: number | null; percent: number }
export interface BranchRow { id: string; name: string; revenue: number | string | null; bookings: number | null; cancellations: number | null; noShows: number | null; newClients: number | null; averageTicket: number | string | null }
export interface OnlineSales { giftCardsEnabled: boolean; giftCardMin: number; giftCardMax: number; walletEnabled: boolean; walletMin: number; walletMax: number }
export interface Rota { weekStart: string; weekEnd: string; staff: { id: Id; name: string; position: string | null; days: { date: string; dayOfWeek: number; state: string; start?: string; end?: string }[] }[] }

export interface Membership { id: Id; name: string; price: number; billing_period_months: number; discount_percent: number; included_sessions: number; active: boolean }
export interface RefCode { id: Id; code: string; type: string; status: string; rewardAmount: number; currentUses: number; maxUses?: number }
export interface RefStats { totalReferralCodes: number; activeReferralCodes: number; totalUsages: number; successfulUsages: number; totalRewardsGiven: number }

export interface InboxItem { id: number; type: string; title: string; body: string | null; data: string | null; createdAt: string; readAt: string | null }
export interface PushPrefs { types: string[]; pushOff: string[]; inboxOff: string[]; emailOff: string[]; quietStart: string | null; quietEnd: string | null; staff: string[]; stockThreshold: number | null }

export const apiB = {
  inbox: (limit = 50) => request<{ unread: number; items: InboxItem[] }>(`/notifications/inbox?limit=${limit}`),
  inboxUnread: () => request<{ unread: number }>('/notifications/inbox/unread-count'),
  readInbox: (id?: number) => request<void>(id == null ? '/notifications/inbox/read' : `/notifications/inbox/${id}/read`, { method: 'POST', body: {} }),
  pushPrefs: () => request<PushPrefs>('/notifications/preferences'),
  savePushPrefs: (p: { pushOff: string[]; inboxOff: string[]; emailOff: string[]; quietStart: string | null; quietEnd: string | null; staff: string[]; stockThreshold: number | null }) => request<void>('/notifications/preferences', { method: 'PUT', body: p }),
  memberships: (b: Id) => request<Membership[]>(`${B(b)}/memberships?activeOnly=false`),
  createMembership: (b: Id, body: { name: string; price: number; billingPeriodMonths: number; discountPercent: number; includedSessions: number }) => request<Membership>(`${B(b)}/memberships`, { method: 'POST', body }),
  setMembershipActive: (b: Id, m: Membership, active: boolean) => request<Membership>(`${B(b)}/memberships/${m.id}`, { method: 'PUT', body: { name: m.name, price: m.price, billingPeriodMonths: m.billing_period_months, discountPercent: m.discount_percent, includedSessions: m.included_sessions, active } }),
  refCodes: (b: Id) => request<RefCode[]>(`/referral-codes/business/${b}`),
  refStats: (b: Id) => request<RefStats>(`/referral-analytics/business/${b}`),
  tracking: (b: Id) => request<{ tracking: { metaPixelId: string | null; gaMeasurementId: string | null } }>(`${B(b)}/integrations`),
  saveTracking: (b: Id, metaPixelId: string, gaMeasurementId: string) => request<unknown>(`${B(b)}/integrations/tracking`, { method: 'PUT', body: { metaPixelId, gaMeasurementId } }),
  tickets: () => request<Ticket[]>('/support/tickets'),
  ticket: (ref: string) => request<Thread>(`/support/tickets/${encodeURIComponent(ref)}`),
  createTicket: (body: { category: string; subject: string; message: string }) => request<Ticket>('/support/tickets', { method: 'POST', body }),
  replyTicket: (ref: string, body: string) => request<Thread>(`/support/tickets/${encodeURIComponent(ref)}/replies`, { method: 'POST', body: { body } }),
  slotOffers: (b: Id) => request<SlotOffer[]>(`/bookings/business/${b}/slot-discounts`),
  saveSlotOffers: (b: Id, offers: SlotOffer[]) => request<SlotOffer[]>(`/bookings/business/${b}/slot-discounts`, { method: 'PUT', body: offers }),
  branches: (from?: string, to?: string) => request<BranchRow[]>(`/analytics/owner/branch-comparison${rng(from, to).replace('from=', 'startDate=').replace('to=', 'endDate=')}`),
  onlineSales: (b: Id) => request<OnlineSales>(`${B(b)}/online-sales`),
  saveOnlineSales: (b: Id, body: Partial<OnlineSales>) => request<OnlineSales>(`${B(b)}/online-sales`, { method: 'PUT', body }),
  setShift: (b: Id, shift: { staffId: Id; date: string; start: string; end: string }) => request<unknown>(`${B(b)}/rota/shifts`, { method: 'PUT', body: shift }),
  clearShift: (b: Id, staffId: Id, date: string) => request<void>(`${B(b)}/rota/shifts?staffId=${staffId}&date=${date}`, { method: 'DELETE' }),
  copyWeek: (b: Id, from: string, to: string) => request<{ copied: number }>(`${B(b)}/rota/copy?from=${from}&to=${to}`, { method: 'POST', body: {} }),
  domain: (b: Id) => request<{ available: boolean; cnameTarget: string; domain: string | null; status?: string; lastError?: string | null }>(`${B(b)}/custom-domain`),
  setDomain: (b: Id, domain: string) => request<unknown>(`${B(b)}/custom-domain`, { method: 'PUT', body: { domain } }),
  verifyDomain: (b: Id) => request<{ status?: string }>(`${B(b)}/custom-domain/verify`, { method: 'POST', body: {} }),
  removeDomain: (b: Id) => request<void>(`${B(b)}/custom-domain`, { method: 'DELETE' }),
  loyaltySettings: (b: Id) => request<{ pointsPerUnit: number | null; visitsForReward: number | null }>(`${B(b)}/loyalty-settings`),
  saveLoyalty: (b: Id, body: { pointsPerUnit: number | null; visitsForReward: number | null }) => request<unknown>(`${B(b)}/loyalty-settings`, { method: 'PUT', body }),
  tiers: (b: Id) => request<{ name: string; minPoints: number; bonusPercent: number }[]>(`${B(b)}/loyalty-tiers`),
  saveTiers: (b: Id, tiers: { name: string; minPoints: number; bonusPercent: number }[]) => request<unknown>(`${B(b)}/loyalty-tiers`, { method: 'PUT', body: tiers }),
  rota: (b: Id, weekStart: string) => request<Rota>(`${B(b)}/rota?weekStart=${weekStart}`),
  products: (b: Id) => request<Product[]>(`/products/business/${b}`),
  createProduct: (b: Id, body: ProductInput) => request<Product>(`/products/business/${b}`, { method: 'POST', body }),
  updateProduct: (b: Id, id: Id, body: Partial<ProductInput>) => request<Product>(`/products/${id}/business/${b}`, { method: 'PUT', body }),
  deleteProduct: (b: Id, id: Id) => request<void>(`/products/${id}/business/${b}`, { method: 'DELETE' }),

  promos: (b: Id) => request<Promo[]>(`/promo-codes/business/${b}`),
  createPromo: (b: Id, body: { code: string; type: 'PERCENT' | 'FIXED'; value: number; maxUses?: number; validTo?: string }) => request<Promo>(`/promo-codes/business/${b}`, { method: 'POST', body }),
  deactivatePromo: (b: Id, id: Id) => request<void>(`/promo-codes/business/${b}/${id}`, { method: 'DELETE' }),
  campaigns: (b: Id) => request<Campaign[]>(`/marketing/campaigns/business/${b}`),
  createCampaign: (b: Id, body: { name: string; channel: string; segment: string; subject?: string; body: string }) => request<Campaign>(`/marketing/campaigns/business/${b}`, { method: 'POST', body }),
  queueCampaign: (b: Id, id: Id) => request<Campaign>(`/marketing/campaigns/business/${b}/${id}/queue`, { method: 'POST', body: {} }),
  audience: (b: Id, segment: string, channel: string) => request<{ segmentSize: number; reachable: number }>(`/marketing/campaigns/business/${b}/preview?segment=${encodeURIComponent(segment)}&channel=${channel}`),

  expenses: (b: Id, from: string, to: string) => request<Expense[]>(`${B(b)}/expenses?from=${from}&to=${to}`),
  addExpense: (b: Id, body: { category: string; amount: number; spentOn: string; description?: string; recursMonthly?: boolean }) => request<Expense>(`${B(b)}/expenses`, { method: 'POST', body }),
  deleteExpense: (b: Id, id: Id) => request<void>(`${B(b)}/expenses/${id}`, { method: 'DELETE' }),

  roles: (b: Id) => request<Role[]>(`${B(b)}/roles`),
  perms: () => request<Perm[]>('/team-permissions'),
  saveRole: (b: Id, id: Id | null, body: { name: string; description?: string; permissions: string[] }) => id == null ? request<Role>(`${B(b)}/roles`, { method: 'POST', body }) : request<Role>(`${B(b)}/roles/${id}`, { method: 'PUT', body }),
  deleteRole: (b: Id, id: Id) => request<void>(`${B(b)}/roles/${id}`, { method: 'DELETE' }),

  commissionRules: (b: Id) => request<CommissionRule[]>(`/commission-rules/business/${b}`),
  createCommissionRule: (body: CommissionRule) => request<CommissionRule>('/commission-rules', { method: 'POST', body }),
  deleteCommissionRule: (id: Id) => request<void>(`/commission-rules/${id}`, { method: 'DELETE' }),
  targets: (b: Id, month: string) => request<TargetRow[]>(`${B(b)}/staff-targets?month=${encodeURIComponent(month)}`),
  setTarget: (b: Id, staffId: Id, month: string, body: { revenueTarget: number; bookingsTarget: number }) => request<void>(`${B(b)}/staff-targets/${staffId}?month=${encodeURIComponent(month)}`, { method: 'PUT', body }),
  payrollRuns: (b: Id) => request<PayrollRun[]>(`${B(b)}/payroll`),
  payrollRun: (b: Id, id: Id) => request<PayrollRun>(`${B(b)}/payroll/${id}`),
  buildPayroll: (b: Id, from: string, to: string) => request<PayrollRun>(`${B(b)}/payroll?from=${from}&to=${to}`, { method: 'POST', body: {} }),
  approvePayroll: (b: Id, id: Id) => request<PayrollRun>(`${B(b)}/payroll/${id}/approve`, { method: 'POST', body: {} }),
  payPayroll: (b: Id, id: Id, paidOn: string, method: string) => request<PayrollRun>(`${B(b)}/payroll/${id}/paid`, { method: 'POST', body: { paidOn, method } }),

  clockedIn: (b: Id) => request<{ id: Id; staff_id: Id; staff_name: string; clock_in: string }[]>(`${B(b)}/timesheets/open`),
  clockIn: (b: Id, staffId: Id) => request<unknown>(`${B(b)}/timesheets/clock-in`, { method: 'POST', body: { staffId } }),
  clockOut: (b: Id, staffId: Id) => request<unknown>(`${B(b)}/timesheets/clock-out`, { method: 'POST', body: { staffId, breakMinutes: 0 } }),
  timesheets: (b: Id, from: string, to: string) => request<{ byStaff: { staff_id: Id; staff_name: string | null; shifts: number; hours: number; pay: number }[] }>(`${B(b)}/timesheets?from=${from}&to=${to}`),
  quickSale: (b: Id) => request<{ id: Id; serviceId: Id; serviceName: string; price?: number }[]>(`/quick-sale/business/${b}`),
  setQuickSale: (b: Id, serviceIds: Id[]) => request<unknown>(`/quick-sale/business/${b}`, { method: 'PUT', body: serviceIds }),
  automation: (b: Id) => request<Automation>(`${B(b)}/marketing-automation`),
  saveAutomation: (b: Id, body: Omit<Automation, 'sentLast30Days'>) => request<Automation>(`${B(b)}/marketing-automation`, { method: 'PUT', body }),
  tips: (b: Id, from?: string, to?: string) => request<TipSummary>(`${B(b)}/tips${rng(from, to)}`),
  payOutTips: (b: Id, staffId?: Id) => request<{ amount: number; lines: number }>(`${B(b)}/tips/payout`, { method: 'POST', body: { staffId: staffId ?? null, upTo: null } }),
  drawer: (b: Id) => request<Drawer | null>(`${B(b)}/cash-drawer`),
  openDrawer: (b: Id, openingFloat: number) => request<Drawer>(`${B(b)}/cash-drawer/open`, { method: 'POST', body: { openingFloat, staffId: null } }),
  closeDrawer: (b: Id, id: Id, countedCash: number) => request<Drawer>(`${B(b)}/cash-drawer/${id}/close`, { method: 'POST', body: { countedCash, notes: null } }),
  moveCash: (b: Id, id: Id, direction: 'IN' | 'OUT', amount: number, reason: string) => request<{ expected: number }>(`${B(b)}/cash-drawer/${id}/movements`, { method: 'POST', body: { direction, amount, reason } }),
  invoices: (b: Id, from?: string, to?: string) => request<InvoiceSum[]>(`${B(b)}/invoices${rng(from, to)}`),
  issueInvoice: (b: Id, saleId: Id, buyerName?: string) => request<InvoiceSum>(`${B(b)}/invoices`, { method: 'POST', body: { saleId, buyerName } }),
  voidInvoice: (b: Id, id: Id, reason: string) => request<InvoiceSum>(`${B(b)}/invoices/${id}/void`, { method: 'POST', body: { reason } }),
  profit: (b: Id, months: number) => request<Profit>(`${B(b)}/profit-and-loss/monthly?months=${months}`),
  tax: (b: Id, from: string, to: string) => request<Tax>(`${B(b)}/tax-summary?from=${from}&to=${to}`),
  issueGiftCard: (b: Id, amount: number, email?: string) => request<GiftCard>('/gift-cards', { method: 'POST', body: { businessId: b, amount, email: email || undefined } }),
  lookupGiftCard: (code: string) => request<GiftCard>(`/gift-cards/${encodeURIComponent(code)}`),

  apiKeys: (b: Id) => request<{ keys: ApiKey[] } | ApiKey[]>(`${B(b)}/api-keys`),
  createKey: (b: Id, name: string, scopes: string[]) => request<{ key: string; prefix: string }>(`${B(b)}/api-keys`, { method: 'POST', body: { name, scopes } }),
  revokeKey: (b: Id, id: string) => request<void>(`${B(b)}/api-keys/${id}`, { method: 'DELETE' }),
  webhooks: (b: Id) => request<{ webhooks: Webhook[]; events: string[] }>(`${B(b)}/webhooks`),
  createWebhook: (b: Id, url: string, events: string[]) => request<{ id: string; secret: string }>(`${B(b)}/webhooks`, { method: 'POST', body: { url, events } }),
  deleteWebhook: (b: Id, id: string) => request<void>(`${B(b)}/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (b: Id, id: string) => request<void>(`${B(b)}/webhooks/${id}/test`, { method: 'POST', body: {} }),

  addons: (b: Id) => request<Addon[]>(`/addons/business/${b}`),
  createAddon: (b: Id, body: { name: string; price?: number; priceType?: string }) => request<Addon>(`/addons/business/${b}`, { method: 'POST', body }),
  deleteAddon: (b: Id, id: Id) => request<void>(`/addons/${id}/business/${b}`, { method: 'DELETE' }),
  peak: (b: Id, s: Id) => request<PeakRule[]>(`/bookings/business/${b}/services/${s}/peak-pricing`),
  savePeak: (b: Id, s: Id, rules: PeakRule[]) => request<PeakRule[]>(`/bookings/business/${b}/services/${s}/peak-pricing`, { method: 'PUT', body: rules }),
  packages: (b: Id) => request<Pkg[]>(`/packages/business/${b}`),
  createPackage: (b: Id, body: { name: string; serviceId?: Id; sessionsTotal: number; price: number; validDays?: number }) => request<Pkg>(`/packages/business/${b}`, { method: 'POST', body }),
  setPackageActive: (b: Id, id: Id, active: boolean) => request<void>(`/packages/business/${b}/${id}/active`, { method: 'POST', body: { active } }),

  balance: (c: Id) => request<Balance>(`/clients/${c}/balance`),
  settle: (c: Id, amount: number, method: string) => request<Balance>(`/clients/${c}/balance/settle`, { method: 'POST', body: { amount, method } }),
  crm: (b: Id, c: Id) => request<Crm>(`${B(b)}/clients/${c}/crm`),
  block: (b: Id, c: Id, reason: string) => request<Crm>(`${B(b)}/clients/${c}/block`, { method: 'PUT', body: { reason } }),
  unblock: (b: Id, c: Id) => request<Crm>(`${B(b)}/clients/${c}/block`, { method: 'DELETE' }),
  setVip: (c: Id, vip: boolean) => request<unknown>(`/clients/${c}`, { method: 'PUT', body: { vip } }),
  loyalty: (b: Id, c: Id) => request<{ pointsBalance?: number; points_balance?: number }>(`/loyalty/business/${b}/client/${c}`),

  audit: (b: Id, limit = 50) => request<AuditRow[]>(`${B(b)}/audit-log?limit=${limit}&offset=0`),
  catalog: (b: Id) => request<ReportDataset[]>(`${B(b)}/custom-reports/catalog`),
  runReport: (b: Id, def: { dataset: string; columns: string[]; groupBy: string | null; from: string | null; to: string | null }) => request<ReportResult>(`${B(b)}/custom-reports/run`, { method: 'POST', body: { ...def, staffId: null, serviceId: null, statuses: [], sources: [] } }),
  savedReports: (b: Id) => request<Saved[]>(`${B(b)}/custom-reports`),
  business: (b: Id) => request<BizProfile>(`/businesses/${b}`),
  updateBusiness: (b: Id, body: Partial<BizProfile>) => request<BizProfile>(`/businesses/${b}`, { method: 'PUT', body }),

  offerWaitlist: (b: Id, id: Id, slots: { staffId: Id; date: string; startTime: string }[]) => request<void>(`/waitlist/business/${b}/${id}/offer`, { method: 'POST', body: { slots } }),
  addPhoto: (b: Id, upload: string) => request<{ id: Id; url: string }>(`${B(b)}/photos`, { method: 'POST', body: { upload } }),
  createLook: (b: Id, upload: string, title?: string) => request<unknown>(`${B(b)}/looks`, { method: 'POST', body: { upload, title } }),
};
