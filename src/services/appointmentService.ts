import { apiClient } from '@/config/api';
import { format } from '@/i18n/dateFns';
import { t } from '@/i18n';

export interface Appointment {
  id: string;
  businessId: number;
  staffId: number;
  staffName?: string;
  clientId?: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceId: number;
  serviceName?: string;
  /** Set when the customer booked several services in one visit: one appointment each, same id here. */
  visitId?: string | null;
  /** Who cancelled it and what they said, when it is cancelled. */
  cancelledBy?: string | null;
  cancellationNote?: string | null;
  /** The customer's answers to the service's questions, as asked at booking. */
  answers?: { question: string; answer: string }[];
  appointmentDate: string;
  startTime: string;
  endTime: string;
  // #30: IN_PROGRESS was contract drift — no Java code produces it and
  // chk_appointment_status (V1/V22) rejects it, so it could never arrive.
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  // chk_payment_status allows PENDING, PENDING_DEPOSIT, PAID, REFUNDED, WAIVED or null.
  // This union had PARTIALLY_REFUNDED, which the database has never accepted, and was
  // missing both PENDING_DEPOSIT and the null that every pre-V77 booking actually holds —
  // so the one screen filtering on it could not match anything.
  paymentStatus: 'PENDING' | 'PENDING_DEPOSIT' | 'PAID' | 'REFUNDED' | 'WAIVED' | null;
  price?: number;
  /**
   * What it would have cost without the salon's offer, recorded when the booking was
   * priced. Undefined on most bookings; the calendar badges the ones where it is set, so
   * a block still shows the offer it was taken on after that offer has ended.
   */
  listPrice?: number | null;
  /**
   * Taken up front through the booking flow. The till subtracts it from what is due, so
   * the calendar has to say so — otherwise a cashier asks for the full price and only
   * finds out from the error message.
   */
  depositAmount?: number | null;
  depositPaid?: boolean | null;
  /**
   * What the customer owes for cancelling late. Computed from the salon's own window when
   * they cancelled; nothing collects it automatically, which is exactly why it has to be
   * visible.
   */
  cancellationFee?: number | null;
  color?: string;
  notes?: string;
  /** What the customer said they would pay with when booking: SALON, GIFT_CARD, WALLET. */
  paymentPreference?: string | null;
  giftCardCode?: string | null;
  /** The promo code the customer booked with; the till must apply it. */
  promoCode?: string | null;
  /** What the till took for this visit, net of tip. */
  paidAmount?: number | null;
  /** Taken from a gift card at booking and not yet used at the till (V114). */
  prepaidAmount?: number | null;
  /** Value of loyalty points spent at booking (V124); the till takes it off what is due. */
  pointsDiscount?: number | null;
  /** Saved despite schedule conflicts, after a manager's confirm (V129). */
  overrideApplied?: boolean;
  overrideReason?: string | null;
  overrideByName?: string | null;
  overrideAt?: string | null;
}

/** One reason the server would not save a booking as asked (409, code BOOKING_CONFLICTS). */
export interface BookingConflict {
  type: string;
  detail: string;
  params?: Record<string, string | number>;
}

export interface BookingOverride {
  confirm: true;
  reason?: string;
}

/** The person looked at the conflicts and chose not to book. */
export class BookingConflictDeclined extends Error {
  constructor() {
    super(t('bookingConflict.notSaved'));
    this.name = 'BookingConflictDeclined';
  }
}

type ConflictConfirmer = (c: { conflicts: BookingConflict[]; canOverride: boolean }) => Promise<{ reason?: string } | null>;
let conflictConfirmer: ConflictConfirmer | null = null;

/** The dialog registers itself here; without it a conflict just fails like any other error. */
export function setBookingConflictConfirmer(fn: ConflictConfirmer | null) {
  conflictConfirmer = fn;
}

/**
 * Run a booking save; if the server answers with schedule conflicts, ask the person
 * (the dialog lists them and, for a manager, offers "book anyway") and re-send with
 * `override`. Every create/edit/move in the hub goes through here.
 */
async function withConflictConfirm<T>(send: (override?: BookingOverride) => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (err) {
    const data = (err as { response?: { data?: { code?: string; conflicts?: BookingConflict[]; canOverride?: boolean } } })?.response?.data;
    if (data?.code !== 'BOOKING_CONFLICTS' || !Array.isArray(data.conflicts) || !conflictConfirmer) throw err;
    const answer = await conflictConfirmer({ conflicts: data.conflicts, canOverride: !!data.canOverride });
    if (!answer) throw new BookingConflictDeclined();
    return send({ confirm: true, reason: answer.reason || undefined });
  }
}

export interface CreateAppointmentRequest {
  businessId: number;
  staffId: number;
  clientId?: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceId: number;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  price?: number;
  color?: string;
  notes?: string;
  /** H-01: shared by every service of one multi-service visit (like a web cart). */
  visitId?: string;
  /** H-01: more services of this visit follow — the backend holds the confirmation email. */
  visitPending?: boolean;
}

export const appointmentService = {
  async getAppointmentById(id: string): Promise<Appointment> {
    return apiClient.get<Appointment>(`/bookings/${id}`);
  },

  async getAppointmentsByBusiness(businessId: number, date?: Date): Promise<Appointment[]> {
    // Always provide a date - use provided date or default to today
    const targetDate = date || new Date();
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    // API requires either 'date' OR 'startDate'/'endDate'
    // Using startDate/endDate for single day query (both set to the same date)
    const params = new URLSearchParams();
    params.append('startDate', dateStr);
    params.append('endDate', dateStr);
    
    return apiClient.get<Appointment[]>(`/bookings/business/${businessId}?${params.toString()}`);
  },

  /** Every booking between two dates (inclusive), e.g. for the client list's insights. */
  async getAppointmentsInRange(businessId: number, start: Date, end: Date): Promise<Appointment[]> {
    const params = new URLSearchParams();
    params.append('startDate', format(start, 'yyyy-MM-dd'));
    params.append('endDate', format(end, 'yyyy-MM-dd'));
    return apiClient.get<Appointment[]>(`/bookings/business/${businessId}?${params.toString()}`);
  },

  async getAppointmentsByStaff(staffId: number, date?: Date): Promise<Appointment[]> {
    // Always provide a date - use provided date or default to today
    const targetDate = date || new Date();
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    // API requires either 'date' OR 'startDate'/'endDate'
    // Using startDate/endDate for single day query (both set to the same date)
    const params = new URLSearchParams();
    params.append('startDate', dateStr);
    params.append('endDate', dateStr);
    
    return apiClient.get<Appointment[]>(`/bookings/staff/${staffId}?${params.toString()}`);
  },

  async createAppointment(request: CreateAppointmentRequest & { idempotencyKey?: string }): Promise<Appointment> {
    // idempotencyKey must be generated BEFORE the form submit (when form opens),
    // not here at call time — so retries reuse the same key.
    // If caller doesn't provide one, fall back to a time+random key (single-use, not retry-safe).
    const key = request.idempotencyKey
      ?? `${request.businessId}-${request.staffId}-${request.appointmentDate}-${request.startTime}-${Date.now()}-${Math.random()}`;
    return withConflictConfirm((override) => apiClient.post<Appointment>('/bookings', {
      ...request,
      idempotencyKey: key,
      ...(override ? { override } : {}),
    }));
  },

  async updateAppointment(id: string, request: CreateAppointmentRequest): Promise<Appointment> {
    return withConflictConfirm((override) =>
      apiClient.put<Appointment>(`/bookings/${id}`, override ? { ...request, override } : request));
  },

  async deleteAppointment(id: string): Promise<void> {
    return apiClient.delete<void>(`/bookings/${id}`);
  },

  async confirmAppointment(id: string): Promise<Appointment> {
    return apiClient.put<Appointment>(`/bookings/${id}/confirm`, {});
  },

  // #30: PUT /api/bookings/{id}/no-show has existed on the backend since V22 with no
  // caller here, so a salon could never record that a client failed to turn up.
  async markNoShow(id: string): Promise<Appointment> {
    return apiClient.put<Appointment>(`/bookings/${id}/no-show`, {});
  },

  /** wholeVisit: cancel every service of the visit this belongs to, with one message to the customer. */
  async cancelAppointment(id: string, reason: string, wholeVisit = false): Promise<void> {
    return apiClient.put<void>(`/bookings/${id}/cancel`, wholeVisit ? { reason, wholeVisit: true } : { reason });
  },
};




