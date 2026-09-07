import { apiClient } from '@/config/api';
import { format } from 'date-fns';

export interface Appointment {
  id: number;
  businessId: number;
  staffId: number;
  staffName?: string;
  clientId?: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceId: number;
  serviceName?: string;
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
  color?: string;
  notes?: string;
  /** What the customer said they would pay with when booking: SALON, GIFT_CARD, WALLET. */
  paymentPreference?: string | null;
  giftCardCode?: string | null;
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
}

export const appointmentService = {
  async getAppointmentById(id: number): Promise<Appointment> {
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
    return apiClient.post<Appointment>('/bookings', {
      ...request,
      idempotencyKey: key,
    });
  },

  async updateAppointment(id: number, request: CreateAppointmentRequest): Promise<Appointment> {
    return apiClient.put<Appointment>(`/bookings/${id}`, request);
  },

  async deleteAppointment(id: number): Promise<void> {
    return apiClient.delete<void>(`/bookings/${id}`);
  },

  async confirmAppointment(id: number): Promise<Appointment> {
    return apiClient.put<Appointment>(`/bookings/${id}/confirm`, {});
  },

  // #30: PUT /api/bookings/{id}/no-show has existed on the backend since V22 with no
  // caller here, so a salon could never record that a client failed to turn up.
  async markNoShow(id: number): Promise<Appointment> {
    return apiClient.put<Appointment>(`/bookings/${id}/no-show`, {});
  },

  async cancelAppointment(id: number, reason: string): Promise<void> {
    return apiClient.put<void>(`/bookings/${id}/cancel`, { reason });
  },
};




