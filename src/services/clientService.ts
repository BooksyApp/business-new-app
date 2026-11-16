import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface ClientWithStats {
  id: Id;
  businessId: Id;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  notes: string | null;
  avatarUrl: string | null;
  preferredLanguage: string | null;
  preferredContactMethod: string | null;
  status: string;
  allowMarketingEmails: boolean | null;
  allowSmsNotifications: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  totalVisits: number;
  totalSpent: number | null;
  lastVisitDate: string | null;
  pendingAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  /** #36: the backend added this counter; the type never declared it. */
  noShowAppointments?: number;
  // Insights worked out on the server over ALL of the client's bookings at this salon
  // (list rows only). The list used to compute them from the last 500 bookings it had.
  /** Who the row is: "c:<id>", "e:<email>", "p:<phone>" or "n:<name>" — for walk-in history. */
  clientKey?: string;
  bookingCount?: number;
  liveBookingCount?: number;
  /** Bookings that have already started and were not cancelled / no-shows. */
  pastVisits?: number;
  lastBookingDate?: string | null;
  firstBookingDate?: string | null;
  avgPrice?: number | null;
  favouriteService?: string | null;
  favouriteMaster?: string | null;
  nextVisitDate?: string | null;
  /** HH:mm */
  nextVisitTime?: string | null;
  nextServiceName?: string | null;
  nextStaffName?: string | null;
}

export interface Client {
  id: Id;
  businessId: Id;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  notes: string | null;
  /** Visit counts the client list returns (the calendar's "regular" badge reads them). */
  totalVisits?: number;
  completedAppointments?: number;
  avatarUrl: string | null;
  preferredLanguage: string | null;
  preferredContactMethod: string | null;
  status: string;
  allowMarketingEmails: boolean | null;
  allowSmsNotifications: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClientAppointmentRow {
  id: Id;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  price: number | null;
  notes: string | null;
  service_name: string | null;
  staff_name: string | null;
}

class ClientService {
  /**
   * This client's visits at THIS salon. Scoped by business on the server, so a client who
   * also goes elsewhere does not bring those visits with them.
   */
  async getAppointmentsAtBusiness(businessId: Id, clientId: Id): Promise<ClientAppointmentRow[]> {
    return apiClient.get<ClientAppointmentRow[]>(
      `/businesses/${businessId}/clients/${clientId}/appointments`
    );
  }

  /**
   * Get clients who have booked appointments for a business
   */
  async getClientsWithAppointments(businessId: Id): Promise<ClientWithStats[]> {
    // The endpoint pages (default 500, max 1000 rows); a big salon has more clients than one
    // page, and the rest silently went missing. Fetch page after page.
    const PAGE = 1000;
    const all: ClientWithStats[] = [];
    for (let offset = 0; offset < 50 * PAGE; offset += PAGE) {
      const page = await apiClient.get<ClientWithStats[]>(
        `/bookings/business/${businessId}/clients?limit=${PAGE}&offset=${offset}`
      );
      all.push(...page);
      if (page.length < PAGE) break;
    }
    return all;
  }

  /** History of a client known only by the list's key (walk-ins without a record). */
  async getVisitsByKey(businessId: Id, clientKey: string): Promise<ClientAppointmentRow[]> {
    return apiClient.get<ClientAppointmentRow[]>(
      `/businesses/${businessId}/client-visits?key=${encodeURIComponent(clientKey)}`
    );
  }

  /**
   * Get all clients for a business (for dropdown selection)
   */
  async getClientsByBusiness(businessId: Id): Promise<Client[]> {
    return apiClient.get<Client[]>(`/clients/business/${businessId}`);
  }

  /**
   * Create a new client for a business
   */
  async createClient(businessId: Id, clientData: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    sendInvitation?: boolean;
    // #47: GDPR consent, recorded on create.
    allowMarketingEmails?: boolean;
    allowSmsNotifications?: boolean;
  }): Promise<Client> {
    return apiClient.post<Client>(`/clients/business/${businessId}`, clientData);
  }
}

export interface Invitation {
  id: Id;
  businessId: Id;
  clientId?: Id;
  recipientEmail: string;
  recipientPhone?: string;
  recipientName: string;
  referralCode: string;
  type: string;
  status: string;
  appointmentId?: string;
  message?: string;
  expiresAt?: string;
  acceptedAt?: string;
  createdAt: string;
}

class InvitationService {
  /**
   * Create an invitation for a client
   */
  async createInvitation(businessId: Id, invitationData: {
    clientId?: Id;
    recipientName: string;
    recipientEmail?: string;
    recipientPhone?: string;
    type: string;
    appointmentId?: string;
    message?: string;
    expirationDays?: number;
  }): Promise<Invitation> {
    return apiClient.post<Invitation>('/invitations', {
      businessId,
      ...invitationData,
    });
  }

  /**
   * Get invitations by business
   */
  async getInvitationsByBusiness(businessId: Id): Promise<Invitation[]> {
    return apiClient.get<Invitation[]>(`/invitations/business/${businessId}`);
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: Id): Promise<void> {
    return apiClient.put(`/invitations/${invitationId}/cancel`, {});
  }

  /**
   * Mark invitation as sent
   */
  async markAsSent(invitationId: Id): Promise<Invitation> {
    return apiClient.put<Invitation>(`/invitations/${invitationId}/sent`, {});
  }

  /**
   * Get invitation by referral code
   */
  async getInvitationByCode(referralCode: string): Promise<Invitation> {
    return apiClient.get<Invitation>(`/invitations/code/${referralCode}`);
  }
}

export const invitationService = new InvitationService();

export const clientService = new ClientService();

