import type { Id } from "@/types/id";
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
  id: Id;
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
  id: Id;
  staff_id: Id | null;
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
  staff_id: Id;
  staff_name: string | null;
  hourly_rate: number | null;
  shifts: number;
  minutes: number;
  hours: number;
  pay: number;
}

export interface TimeEntry {
  id: Id;
  staff_id: Id;
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
  id: Id;
  staff_id: Id;
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
  id: Id;
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
  id: Id;
  kind: NoteKind;
  body: string;
  pinned: boolean;
  appointment_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPhoto {
  id: Id;
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
    id: Id;
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
  id: Id;
  name: string;
  sku: string | null;
  quantity_on_hand: number;
  low_stock_threshold: number;
  weekly_use: number;
  /** Null when nothing has moved recently, so there is no rate to project from. */
  days_left: number | null;
}

export interface StockMovement {
  id: Id;
  product_id: Id;
  product_name: string;
  change: number;
  reason: 'SALE' | 'SERVICE' | 'DELIVERY' | 'COUNT' | 'WASTE' | 'RETURN' | 'ADJUSTMENT';
  sale_id: Id | null;
  note: string | null;
  created_at: string;
}

export interface RecipeLine {
  id: Id;
  product_id: Id;
  name: string;
  sku: string | null;
  quantity: number;
  quantity_on_hand: number;
}

// ---------------------------------------------------------------- suppliers

export interface Supplier {
  id: Id;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  is_active: boolean;
}

/** The save body is camelCase: the server reads contactName and accountNumber from it. */
export interface SupplierInput {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  accountNumber?: string;
  notes?: string;
  isActive?: boolean;
}

export interface PurchaseOrderLine {
  id: Id;
  product_id: Id;
  product_name: string;
  sku: string | null;
  quantity: number;
  received: number;
  unit_cost: number;
}

export interface PurchaseOrder {
  id: Id;
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
  id: Id;
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
    id: Id;
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
  working: Array<{ id: Id; name: string; start_time: string | null; end_time: string | null }>;
  totals: { bookings: number; expected: number; already_paid: number };
}

// ----------------------------------------------------------------

const base = (businessId: Id) => `/businesses/${businessId}`;

export const salonDayService = {
  // rota
  getRota: (businessId: Id, weekStart: string) =>
    apiClient.get<Rota>(`${base(businessId)}/rota?weekStart=${weekStart}`),
  setShift: (
    businessId: Id,
    shift: { staffId: Id; date: string; start: string; end: string; notes?: string },
  ) => apiClient.put<unknown>(`${base(businessId)}/rota/shifts`, shift),
  clearShift: (businessId: Id, staffId: Id, date: string) =>
    apiClient.delete<void>(`${base(businessId)}/rota/shifts?staffId=${staffId}&date=${date}`),
  copyWeek: (businessId: Id, from: string, to: string) =>
    apiClient.post<{ copied: number }>(`${base(businessId)}/rota/copy?from=${from}&to=${to}`, {}),
  getBlocks: (businessId: Id) =>
    apiClient.get<RecurringBlock[]>(`${base(businessId)}/rota/blocks`),
  addBlock: (
    businessId: Id,
    block: { staffId?: Id | null; label: string; days: number[]; start: string; end: string },
  ) => apiClient.post<{ created: number }>(`${base(businessId)}/rota/blocks`, block),
  removeBlock: (businessId: Id, blockId: Id) =>
    apiClient.delete<void>(`${base(businessId)}/rota/blocks/${blockId}`),

  // my day (FG-W2-10): the signed-in team member's own commissions for one day
  getMyEarnings: (businessId: Id, date: string) =>
    apiClient.get<{ date: string; total: number; count: number }>(`${base(businessId)}/my-day/earnings?date=${date}`),

  // timesheets
  getTimesheets: (businessId: Id, from: string, to: string) =>
    apiClient.get<{ byStaff: TimesheetRow[]; entries: TimeEntry[] }>(
      `${base(businessId)}/timesheets?from=${from}&to=${to}`,
    ),
  getClockedIn: (businessId: Id) =>
    apiClient.get<Array<{ id: Id; staff_id: Id; staff_name: string; clock_in: string }>>(
      `${base(businessId)}/timesheets/open`,
    ),
  clockIn: (businessId: Id, staffId: Id) =>
    apiClient.post<TimeEntry>(`${base(businessId)}/timesheets/clock-in`, { staffId }),
  clockOut: (businessId: Id, staffId: Id, breakMinutes = 0) =>
    apiClient.post<TimeEntry>(`${base(businessId)}/timesheets/clock-out`, { staffId, breakMinutes }),
  correctEntry: (
    businessId: Id,
    entryId: Id,
    change: { clockIn?: string; clockOut?: string; breakMinutes?: number; note?: string },
  ) => apiClient.put<TimeEntry>(`${base(businessId)}/timesheets/${entryId}`, change),

  // payroll
  getPayrollRuns: (businessId: Id) =>
    apiClient.get<PayrollRun[]>(`${base(businessId)}/payroll`),
  getPayrollRun: (businessId: Id, runId: Id) =>
    apiClient.get<PayrollRun>(`${base(businessId)}/payroll/${runId}`),
  buildPayroll: (businessId: Id, from: string, to: string) =>
    apiClient.post<PayrollRun>(`${base(businessId)}/payroll?from=${from}&to=${to}`, {}),
  adjustPayrollLine: (businessId: Id, runId: Id, lineId: Id, amount: number, note?: string) =>
    apiClient.put<PayrollRun>(`${base(businessId)}/payroll/${runId}/lines/${lineId}`, { amount, note }),
  approvePayroll: (businessId: Id, runId: Id) =>
    apiClient.post<PayrollRun>(`${base(businessId)}/payroll/${runId}/approve`, {}),
  markPayrollPaid: (businessId: Id, runId: Id) =>
    apiClient.post<PayrollRun>(`${base(businessId)}/payroll/${runId}/paid`, {}),

  // client record
  getClientRecord: (businessId: Id, clientId: Id) =>
    apiClient.get<ClientRecord>(`${base(businessId)}/clients/${clientId}/record`),
  getClientAlerts: (businessId: Id, clientId: Id) =>
    apiClient.get<Array<{ id: Id; kind: NoteKind; body: string }>>(
      `${base(businessId)}/clients/${clientId}/alerts`,
    ),
  addClientNote: (
    businessId: Id,
    clientId: Id,
    note: { kind: NoteKind; body: string; pinned?: boolean; appointmentId?: string; authorName?: string },
  ) => apiClient.post<ClientNote>(`${base(businessId)}/clients/${clientId}/notes`, note),
  updateClientNote: (businessId: Id, noteId: Id, change: { body?: string; pinned?: boolean }) =>
    apiClient.put<ClientNote>(`${base(businessId)}/client-notes/${noteId}`, change),
  deleteClientNote: (businessId: Id, noteId: Id) =>
    apiClient.delete<void>(`${base(businessId)}/client-notes/${noteId}`),
  addClientPhoto: (
    businessId: Id,
    clientId: Id,
    photo: { url: string; kind: 'BEFORE' | 'AFTER'; caption?: string; appointmentId?: string },
  ) => apiClient.post<ClientPhoto>(`${base(businessId)}/clients/${clientId}/photos`, photo),
  deleteClientPhoto: (businessId: Id, photoId: Id) =>
    apiClient.delete<void>(`${base(businessId)}/client-photos/${photoId}`),

  // stock
  getLowStock: (businessId: Id) =>
    apiClient.get<{ items: LowStockItem[]; outOfStock: number }>(`${base(businessId)}/stock/low`),
  getStockMovements: (businessId: Id, productId?: Id, limit = 100) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (productId) params.set('productId', String(productId));
    return apiClient.get<StockMovement[]>(`${base(businessId)}/stock/movements?${params}`);
  },
  countStock: (businessId: Id, productId: Id, counted: number, note?: string) =>
    apiClient.post<{ difference: number }>(`${base(businessId)}/stock/count`, { productId, counted, note }),
  adjustStock: (businessId: Id, productId: Id, change: number, reason: string, note?: string) =>
    apiClient.post<unknown>(`${base(businessId)}/stock/adjust`, { productId, change, reason, note }),
  getRecipe: (businessId: Id, serviceId: Id) =>
    apiClient.get<RecipeLine[]>(`${base(businessId)}/services/${serviceId}/products`),
  setRecipeLine: (businessId: Id, serviceId: Id, productId: Id, quantity: number) =>
    apiClient.put<unknown>(`${base(businessId)}/services/${serviceId}/products`, { productId, quantity }),

  // suppliers and orders
  getSuppliers: (businessId: Id) =>
    apiClient.get<Supplier[]>(`${base(businessId)}/suppliers`),
  createSupplier: (businessId: Id, body: SupplierInput) =>
    apiClient.post<Supplier>(`${base(businessId)}/suppliers`, body),
  updateSupplier: (businessId: Id, supplierId: Id, body: Partial<SupplierInput>) =>
    apiClient.put<Supplier>(`${base(businessId)}/suppliers/${supplierId}`, body),
  getOrders: (businessId: Id, status?: string) =>
    apiClient.get<PurchaseOrder[]>(`${base(businessId)}/purchase-orders${status ? `?status=${status}` : ''}`),
  getOrder: (businessId: Id, orderId: Id) =>
    apiClient.get<PurchaseOrder>(`${base(businessId)}/purchase-orders/${orderId}`),
  suggestOrder: (businessId: Id) =>
    apiClient.get<Array<{ product_id: Id; name: string; quantity_on_hand: number; suggested: number }>>(
      `${base(businessId)}/purchase-orders/suggest`,
    ),
  createOrder: (
    businessId: Id,
    order: {
      supplierId?: Id | null;
      reference?: string;
      expectedOn?: string;
      lines: Array<{ productId: Id; quantity: number; unitCost: number }>;
    },
  ) => apiClient.post<PurchaseOrder>(`${base(businessId)}/purchase-orders`, order),
  markOrdered: (businessId: Id, orderId: Id) =>
    apiClient.post<PurchaseOrder>(`${base(businessId)}/purchase-orders/${orderId}/order`, {}),
  receiveOrder: (
    businessId: Id,
    orderId: Id,
    lines: Array<{ lineId: Id; quantity: number }>,
  ) => apiClient.post<PurchaseOrder>(`${base(businessId)}/purchase-orders/${orderId}/receive`, { lines }),

  // expenses
  getExpenses: (businessId: Id, from: string, to: string, category?: string) => {
    const params = new URLSearchParams({ from, to });
    if (category) params.set('category', category);
    return apiClient.get<Expense[]>(`${base(businessId)}/expenses?${params}`);
  },
  addExpense: (businessId: Id, body: Record<string, unknown>) =>
    apiClient.post<Expense>(`${base(businessId)}/expenses`, body),
  deleteExpense: (businessId: Id, expenseId: Id) =>
    apiClient.delete<void>(`${base(businessId)}/expenses/${expenseId}`),
  getProfitAndLoss: (businessId: Id, from: string, to: string) =>
    apiClient.get<ProfitAndLoss>(`${base(businessId)}/profit-and-loss?from=${from}&to=${to}`),

  // the printed sheet
  getDaySheet: (businessId: Id, date: string) =>
    apiClient.get<DaySheet>(`${base(businessId)}/day-sheet?date=${date}`),
};
