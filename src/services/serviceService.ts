import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';
import { t } from "@/i18n";

export interface StaffServiceOverride {
  staffId: Id;
  price?: number | null;
  durationMinutes?: number | null;
}

export interface Service {
  id: Id;
  businessId: Id;
  categoryId?: Id;
  categoryName?: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  serviceType?: string;
  color?: string;
  isActive: boolean;
  isVisible: boolean;
  staffIds?: Id[];
  /** Per-staff own price / duration; a staff member not listed uses the service's. */
  staffOverrides?: StaffServiceOverride[];
  mobileService?: boolean;
  /** FG-W3-02: fixed travel fee in AZN, mobile services only. */
  travelFee?: number | null;
  /** FG-W6-01: null/absent = salon default; 0 = no online payment; 1-99 = deposit %; 100 = full prepay. Send -1 to reset to the default. */
  depositPercent?: number | null;
  /** FG-W3-02: free-text service area, mobile services only. */
  serviceArea?: string | null;
  virtualAppointment?: boolean;
  bookingInterval?: number; // minutes between offered start times; 0 = step by duration
  paddingBefore?: number;   // buffer minutes reserved before the appointment
  paddingAfter?: number;    // buffer minutes reserved after the appointment
  processingDuring?: number; // client-visit minutes after active work where staff is free
  processingAfter?: number;  // additional client-visit minutes where staff is free
  /** Questions asked at booking. */
  questions?: { text: string; required?: boolean }[];
  /** Shown to the client after booking and in the confirmation email. */
  messageToClient?: string | null;
  /** Clients one staff member can take at once: 1 = one at a time, 0 = no limit. */
  parallelClients?: number;
  /** Percent VAT; null/absent = the business's own rate. */
  taxRate?: number | null;
  resourceTypeId?: Id | null; // #282: a shared room/equipment this service needs
  isClass?: boolean;          // FG-W1-12: group class
  maxParticipants?: number | null;
}

export interface CreateServiceRequest {
  categoryId?: Id;
  name: string;
  description?: string;
  durationMinutes?: number;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  serviceType?: string;
  color?: string;
  comboServiceIds?: Id[];
  timeBetweenMinutes?: number[];
  staffIds?: Id[];
  /** Per-staff own price / duration; a staff member not listed uses the service's. */
  staffOverrides?: StaffServiceOverride[];
  isVisible?: boolean;
  mobileService?: boolean;
  /** FG-W3-02: fixed travel fee in AZN, mobile services only. */
  travelFee?: number | null;
  /** FG-W6-01: null/absent = salon default; 0 = no online payment; 1-99 = deposit %; 100 = full prepay. Send -1 to reset to the default. */
  depositPercent?: number | null;
  /** FG-W3-02: free-text service area, mobile services only. */
  serviceArea?: string | null;
  virtualAppointment?: boolean;
  bookingInterval?: number;
  paddingBefore?: number;
  paddingAfter?: number;
  processingDuring?: number;
  processingAfter?: number;
  isClass?: boolean;
  maxParticipants?: number;
  questions?: { text: string; required?: boolean }[];
  messageToClient?: string;
  parallelClients?: number;
  taxRate?: number | null;
}

export interface UpdateServiceRequest {
  resourceTypeId?: Id;
  categoryId?: Id;
  name?: string;
  description?: string;
  durationMinutes?: number;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  serviceType?: string;
  color?: string;
  isActive?: boolean;
  isVisible?: boolean;
  comboServiceIds?: Id[];
  timeBetweenMinutes?: number[];
  staffIds?: Id[];
  /** Per-staff own price / duration; a staff member not listed uses the service's. */
  staffOverrides?: StaffServiceOverride[];
  mobileService?: boolean;
  /** FG-W3-02: fixed travel fee in AZN, mobile services only. */
  travelFee?: number | null;
  /** FG-W6-01: null/absent = salon default; 0 = no online payment; 1-99 = deposit %; 100 = full prepay. Send -1 to reset to the default. */
  depositPercent?: number | null;
  /** FG-W3-02: free-text service area, mobile services only. */
  serviceArea?: string | null;
  virtualAppointment?: boolean;
  bookingInterval?: number;
  paddingBefore?: number;
  paddingAfter?: number;
  processingDuring?: number;
  processingAfter?: number;
  isClass?: boolean;
  maxParticipants?: number;
  questions?: { text: string; required?: boolean }[];
  messageToClient?: string;
  parallelClients?: number;
  taxRate?: number | null;
}

export interface ComboServiceItem {
  id: Id;
  comboServiceId: Id;
  serviceId: Id;
  serviceName?: string;
  displayOrder: number;
  timeBetweenMinutes?: number;
}

export interface PackageStep {
  position: number;
  serviceId: Id;
  serviceName: string;
  staffId: Id | null;
  staffName: string | null;
  parallel: boolean;
  durationMinutes: number;
  price: number;
}

export interface ServicePackage {
  serviceId: Id;
  maxPartySize: number;
  steps: PackageStep[];
  totalDurationMinutes: number;
  totalPrice: number;
}

export interface SavePackageRequest {
  businessId: Id;
  maxPartySize: number;
  /** Empty clears the package. */
  steps: { serviceId: Id; staffId: Id | null; parallel: boolean }[];
}

export const serviceService = {
  async getPackagesByBusiness(businessId: Id): Promise<ServicePackage[]> {
    return apiClient.get<ServicePackage[]>(`/services/business/${businessId}/packages`);
  },

  /** null when the service is an ordinary one (404). */
  async getPackage(serviceId: Id, businessId: Id): Promise<ServicePackage | null> {
    try {
      return await apiClient.get<ServicePackage>(`/services/${serviceId}/package?businessId=${businessId}`);
    } catch (e) {
      const err = e as { status?: number; response?: { status?: number }; message?: string };
      if (err?.status === 404 || err?.response?.status === 404 || /404/.test(err?.message ?? "")) return null;
      throw e;
    }
  },

  async savePackage(serviceId: Id, request: SavePackageRequest): Promise<ServicePackage | null> {
    return apiClient.put<ServicePackage | null>(`/services/${serviceId}/package`, request);
  },

  async getServicesByBusiness(businessId: Id): Promise<Service[]> {
    return apiClient.get<Service[]>(`/services/business/${businessId}`);
  },

  async getServicesByCategory(categoryId: Id): Promise<Service[]> {
    return apiClient.get<Service[]>(`/services/category/${categoryId}`);
  },

  async createService(businessId: Id, request: CreateServiceRequest): Promise<Service> {
    if (request.price !== undefined && request.price !== null && request.price < 0) {
      throw new Error(t("services.servicePriceCannotBeNegative"));
    }
    if (request.durationMinutes !== undefined && request.durationMinutes <= 0) {
      throw new Error(t("services.serviceDurationMustBeGreater"));
    }
    return apiClient.post<Service>(`/services/business/${businessId}`, request);
  },

  async updateService(id: Id, businessId: Id, request: UpdateServiceRequest): Promise<Service> {
    if (request.price !== undefined && request.price !== null && request.price < 0) {
      throw new Error(t("services.servicePriceCannotBeNegative"));
    }
    if (request.durationMinutes !== undefined && request.durationMinutes <= 0) {
      throw new Error(t("services.serviceDurationMustBeGreater"));
    }
    return apiClient.put<Service>(`/services/${id}/business/${businessId}`, request);
  },

  async deleteService(id: Id, businessId: Id): Promise<void> {
    return apiClient.delete<void>(`/services/${id}/business/${businessId}`);
  },

  async getComboServiceItems(serviceId: Id): Promise<ComboServiceItem[]> {
    return apiClient.get<ComboServiceItem[]>(`/services/${serviceId}/combo-items`);
  },

  // Service↔staff assignments viewed from the staff side. Assignments are owned by
  // service-catalog; these let the staff form load and save which services a staff
  // member can perform (the counterpart of the staffIds field on the service form).
  async getStaffServiceIds(businessId: Id, staffId: Id): Promise<Id[]> {
    return apiClient.get<Id[]>(`/services/assignments/business/${businessId}/staff/${staffId}`);
  },

  async setStaffServiceIds(businessId: Id, staffId: Id, serviceIds: Id[]): Promise<Id[]> {
    return apiClient.put<Id[]>(
      `/services/assignments/business/${businessId}/staff/${staffId}`,
      { serviceIds }
    );
  },
};


