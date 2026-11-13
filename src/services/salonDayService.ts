import { apiClient } from '@/config/api';

/**
 * The salon's own day: the rota, timesheets, payroll, what it knows about a client, what
 * stock a service eats, where more of it comes from, what the salon spends, and the sheet
 * it prints for the front desk.
 *
 * All of it hangs off /businesses/{id}/… because that prefix is already tenant-checked on
 * the server. A rota and a payroll run are among the more sensitive things a salon holds.
 */

// ---------------------------------------------------------------- rota

export type DayState = 'SHIFT' | 'USUAL' | 'OFF' | 'TIME_OFF' | 'TIME_OFF_PENDING';

export interface RotaDay {
  date: string;
  dayOfWeek: number;
  state: DayState;
  start?: string;
  end?: string;
  notes?: string;
  reason?: string;
  blocks?: Array<{ label: string; start: string; end: string }>;
}

export interface RotaRow {
  id: number;
  name: string;
  position: string | null;
  hourly_rate: number | null;
  days: RotaDay[];
}

export interface Rota {
  weekStart: string;
  weekEnd: string;
  staff: RotaRow[];
}

export interface RecurringBlock {
  id: number;
  staff_id: number | null;
  staff_name: string | null;
  label: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
}

// ---------------------------------------------------------------- timesheets

export interface TimesheetRow {
  staff_id: number;
  staff_name: string | null;
  hourly_rate: number | null;
  shifts: number;
  minutes: number;
  hours: number;
  pay: number;
}

export interface TimeEntry {
  id: number;
  staff_id: number;
  staff_name: string | null;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  worked_minutes: number | null;
  note: string | null;
  edited_at: string | null;
}

// ---------------------------------------------------------------- payroll

export interface PayrollLine {
  id: number;
  staff_id: number;
  staff_name: string | null;
  hours: number;
  base_pay: number;
  commission: number;
  tips: number;
  adjustment: number;
  total: number;
  note: string | null;
}

export interface PayrollRun {
  id: number;
  period_start: string;
  period_end: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  total_amount: number;
  approved_at: string | null;
  lines?: PayrollLine[];
}

// ---------------------------------------------------------------- client record

export type NoteKind = 'NOTE' | 'FORMULA' | 'ALLERGY' | 'PREFERENCE' | 'VISIT';

export interface ClientNote {
  id: number;
  kind: NoteKind;
  body: string;
  pinned: boolean;
  appointment_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPhoto {
  id: number;
  url: string;
  kind: 'BEFORE' | 'AFTER';
  caption: string | null;
  taken_on: string;
  appointment_id: string | null;
}

export interface ClientRecord {
  notes: ClientNote[];
  photos: ClientPhoto[];
  visits: Array<{
    id: number;
    appointment_date: string;
    start_time: string;
    service_name: string | null;
    price: number | null;
    status: string;
    staff_name: string | null;
  }>;
}

// ---------------------------------------------------------------- stock

export interface LowStockItem {
  id: number;
  name: string;
  sku: string | null;
  quantity_on_hand: number;
  low_stock_threshold: number;
  weekly_use: number;
  /** Null when nothing has moved recently, so there is no rate to project from. */
  days_left: number | null;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  change: number;
  reason: 'SALE' | 'SERVICE' | 'DELIVERY' | 'COUNT' | 'WASTE' | 'RETURN' | 'ADJUSTMENT';
  sale_id: number | null;
  note: string | null;
  created_at: string;
}

export interface RecipeLine {
  id: number;
  product_id: number;
  name: string;
  sku: string | null;
  quantity: number;
  quantity_on_hand: number;
}

// ---------------------------------------------------------------- suppliers

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  is_active: boolean;
}

export interface PurchaseOrderLine {
  id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  quantity: number;
  received: number;
  unit_cost: number;
}

export interface PurchaseOrder {
  id: number;
  reference: string | null;
  status: 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  ordered_on: string | null;
  expected_on: string | null;
  received_on: string | null;
  total_amount: number;
  supplier_name: string | null;
  lines?: PurchaseOrderLine[];
}

// ---------------------------------------------------------------- expenses

export type ExpenseCategory =
  | 'RENT' | 'STOCK' | 'WAGES' | 'UTILITIES' | 'MARKETING'
  | 'EQUIPMENT' | 'INSURANCE' | 'SOFTWARE' | 'TRAVEL' | 'FEES' | 'OTHER';

export interface Expense {
  id: number;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  tax_amount: number;
  spent_on: string;
  payment_method: string | null;
  recurs_monthly: boolean;
  receipt_url: string | null;
  note: string | null;
  supplier_name: string | null;
}

export interface ProfitAndLoss {
  revenue: number;
  takings: number;
  refunds: number;
  wages: number;
  otherCosts: number;
  costs: number;
  profit: number;
  byCategory: Array<{ category: ExpenseCategory; amount: number; entries: number }>;
}

// ---------------------------------------------------------------- day sheet

export interface DaySheet {
  date: string;
  business: { name: string; address: string | null; phone: string | null };
  appointments: Array<{
    id: number;
    start_time: string;
    end_time: string;
    service_name: string | null;
    client_name: string | null;
    client_phone: string | null;
    price: number | null;
    status: string;
    payment_status: string | null;
    deposit_paid: boolean;
    deposit_amount: number | null;
    notes: string | null;
    staff_name: string | null;
    allergy: string | null;
  }>;
  working: Array<{ id: number; name: string; start_time: string | null; end_time: string | null }>;
  totals: { bookings: number; expected: number; already_paid: number };
}

// ----------------------------------------------------------------

const base = (businessId: number) => `/businesses/${businessId}`;

export const salonDayService = {
  // rota
  getRota: (businessId: number, weekStart: string) =>
    apiClient.get<Rota>(`${base(businessId)}/rota?weekStart=${weekStart}`),
  setShift: (
    businessId: number,
    shift: { staffId: number; date: string; start: string; end: string; notes?: string },
  ) => apiClient.put<unknown>(`${base(businessId)}/rota/shifts`, shift),
  clearShift: (businessId: number, staffId: number, date: string) =>
    apiClient.delete<void>(`${base(businessId)}/rota/shifts?staffId=${staffId}&date=${date}`),
  copyWeek: (businessId: number, from: string, to: string) =>
    apiClient.post<{ copied: number }>(`${base(businessId)}/rota/copy?from=${from}&to=${to}`, {}),
  getBlocks: (businessId: number) =>
    apiClient.get<RecurringBlock[]>(`${base(businessId)}/rota/blocks`),
  addBlock: (
    businessId: number,
    block: { staffId?: number | null; label: string; days: number[]; start: string; end: string },
  ) => apiClient.post<{ created: number }>(`${base(businessId)}/rota/blocks`, block),
  removeBlock: (businessId: number, blockId: number) =>
    apiClient.delete<void>(`${base(businessId)}/rota/blocks/${blockId}`),

  // timesheets
  getTimesheets: (businessId: number, from: string, to: string) =>
    apiClient.get<{ byStaff: TimesheetRow[]; entries: TimeEntry[] }>(
      `${base(businessId)}/timesheets?from=${from}&to=${to}`,
    ),
  getClockedIn: (businessId: number) =>
    apiClient.get<Array<{ id: number; staff_id: number; staff_name: string; clock_in: string }>>(
      `${base(businessId)}/timesheets/open`,
    ),
  clockIn: (businessId: number, staffId: number) =>
    apiClient.post<TimeEntry>(`${base(businessId)}/timesheets/clock-in`, { staffId }),
  clockOut: (businessId: number, staffId: number, breakMinutes = 0) =>
    apiClient.post<TimeEntry>(`${base(businessId)}/timesheets/clock-out`, { staffId, breakMinutes }),
  correctEntry: (
    businessId: number,
    entryId: number,
    change: { clockIn?: string; clockOut?: string; breakMinutes?: number; note?: string },
  ) => apiClient.put<TimeEntry>(`${base(businessId)}/timesheets/${entryId}`, change),

  // payroll
  getPayrollRuns: (businessId: number) =>
    apiClient.get<PayrollRun[]>(`${base(businessId)}/payroll`),
  getPayrollRun: (businessId: number, runId: number) =>
    apiClient.get<PayrollRun>(`${base(businessId)}/payroll/${runId}`),
  buildPayroll: (businessId: number, from: string, to: string) =>
    apiClient.post<PayrollRun>(`${base(businessId)}/payroll?from=${from}&to=${to}`, {}),
  adjustPayrollLine: (businessId: number, runId: number, lineId: number, amount: number, note?: string) =>
    apiClient.put<PayrollRun>(`${base(businessId)}/payroll/${runId}/lines/${lineId}`, { amount, note }),
  approvePayroll: (businessId: number, runId: number) =>
    apiClient.post<PayrollRun>(`${base(businessId)}/payroll/${runId}/approve`, {}),
  markPayrollPaid: (businessId: number, runId: number) =>
    apiClient.post<PayrollRun>(`${base(businessId)}/payroll/${runId}/paid`, {}),

  // client record
  getClientRecord: (businessId: number, clientId: number) =>
    apiClient.get<ClientRecord>(`${base(businessId)}/clients/${clientId}/record`),
  getClientAlerts: (businessId: number, clientId: number) =>
    apiClient.get<Array<{ id: number; kind: NoteKind; body: string }>>(
      `${base(businessId)}/clients/${clientId}/alerts`,
    ),
  addClientNote: (
    businessId: number,
    clientId: number,
    note: { kind: NoteKind; body: string; pinned?: boolean; appointmentId?: string; authorName?: string },
  ) => apiClient.post<ClientNote>(`${base(businessId)}/clients/${clientId}/notes`, note),
  updateClientNote: (businessId: number, noteId: number, change: { body?: string; pinned?: boolean }) =>
    apiClient.put<ClientNote>(`${base(businessId)}/client-notes/${noteId}`, change),
  deleteClientNote: (businessId: number, noteId: number) =>
    apiClient.delete<void>(`${base(businessId)}/client-notes/${noteId}`),
  addClientPhoto: (
    businessId: number,
    clientId: number,
    photo: { url: string; kind: 'BEFORE' | 'AFTER'; caption?: string; appointmentId?: string },
  ) => apiClient.post<ClientPhoto>(`${base(businessId)}/clients/${clientId}/photos`, photo),
  deleteClientPhoto: (businessId: number, photoId: number) =>
    apiClient.delete<void>(`${base(businessId)}/client-photos/${photoId}`),

  // stock
  getLowStock: (businessId: number) =>
    apiClient.get<{ items: LowStockItem[]; outOfStock: number }>(`${base(businessId)}/stock/low`),
  getStockMovements: (businessId: number, productId?: number, limit = 100) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (productId) params.set('productId', String(productId));
    return apiClient.get<StockMovement[]>(`${base(businessId)}/stock/movements?${params}`);
  },
  countStock: (businessId: number, productId: number, counted: number, note?: string) =>
    apiClient.post<{ difference: number }>(`${base(businessId)}/stock/count`, { productId, counted, note }),
  adjustStock: (businessId: number, productId: number, change: number, reason: string, note?: string) =>
    apiClient.post<unknown>(`${base(businessId)}/stock/adjust`, { productId, change, reason, note }),
  getRecipe: (businessId: number, serviceId: number) =>
    apiClient.get<RecipeLine[]>(`${base(businessId)}/services/${serviceId}/products`),
  setRecipeLine: (businessId: number, serviceId: number, productId: number, quantity: number) =>
    apiClient.put<unknown>(`${base(businessId)}/services/${serviceId}/products`, { productId, quantity }),

  // suppliers and orders
  getSuppliers: (businessId: number) =>
    apiClient.get<Supplier[]>(`${base(businessId)}/suppliers`),
  createSupplier: (businessId: number, body: Partial<Supplier>) =>
    apiClient.post<Supplier>(`${base(businessId)}/suppliers`, body),
  updateSupplier: (businessId: number, supplierId: number, body: Partial<Supplier>) =>
    apiClient.put<Supplier>(`${base(businessId)}/suppliers/${supplierId}`, body),
  getOrders: (businessId: number, status?: string) =>
    apiClient.get<PurchaseOrder[]>(`${base(businessId)}/purchase-orders${status ? `?status=${status}` : ''}`),
  getOrder: (businessId: number, orderId: number) =>
    apiClient.get<PurchaseOrder>(`${base(businessId)}/purchase-orders/${orderId}`),
  suggestOrder: (businessId: number) =>
    apiClient.get<Array<{ product_id: number; name: string; quantity_on_hand: number; suggested: number }>>(
      `${base(businessId)}/purchase-orders/suggest`,
    ),
  createOrder: (
    businessId: number,
    order: {
      supplierId?: number | null;
      reference?: string;
      expectedOn?: string;
      lines: Array<{ productId: number; quantity: number; unitCost: number }>;
    },
  ) => apiClient.post<PurchaseOrder>(`${base(businessId)}/purchase-orders`, order),
  markOrdered: (businessId: number, orderId: number) =>
    apiClient.post<PurchaseOrder>(`${base(businessId)}/purchase-orders/${orderId}/order`, {}),
  receiveOrder: (
    businessId: number,
    orderId: number,
    lines: Array<{ lineId: number; quantity: number }>,
  ) => apiClient.post<PurchaseOrder>(`${base(businessId)}/purchase-orders/${orderId}/receive`, { lines }),

  // expenses
  getExpenses: (businessId: number, from: string, to: string, category?: string) => {
    const params = new URLSearchParams({ from, to });
    if (category) params.set('category', category);
    return apiClient.get<Expense[]>(`${base(businessId)}/expenses?${params}`);
  },
  addExpense: (businessId: number, body: Record<string, unknown>) =>
    apiClient.post<Expense>(`${base(businessId)}/expenses`, body),
  deleteExpense: (businessId: number, expenseId: number) =>
    apiClient.delete<void>(`${base(businessId)}/expenses/${expenseId}`),
  getProfitAndLoss: (businessId: number, from: string, to: string) =>
    apiClient.get<ProfitAndLoss>(`${base(businessId)}/profit-and-loss?from=${from}&to=${to}`),

  // the printed sheet
  getDaySheet: (businessId: number, date: string) =>
    apiClient.get<DaySheet>(`${base(businessId)}/day-sheet?date=${date}`),
};
