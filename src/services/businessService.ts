import { rememberSalons } from "@/lib/salonKey";
import { apiClient } from '@/config/api';

export interface BusinessRequest {
  currency?: string;
  taxRate?: number;
  depositPercent?: number;
  cancellationWindowHours?: number;
  lateCancellationFee?: number;
  ownerId: number;
  name: string;
  description?: string;
  category?: string;
  /**
   * customer-app #4: the photo customers see for this salon. Until V74 there was no
   * image column at all, so every salon in the customer app showed the same stock shot.
   * A URL the salon supplies — there is no file storage yet. Empty string clears it.
   */
  coverImageUrl?: string;
  /** Branding: a URL, since this system has no file storage. */
  logoUrl?: string;
  brandColor?: string;
  receiptFooter?: string;
  /** Booking policy — see booksy-backend V81. Each changes real behaviour. */
  onlineBookingEnabled?: boolean;
  minBookingNoticeMinutes?: number;
  maxBookingDaysAhead?: number;
  /** Comma-separated: any of CASH, CARD, ONLINE. */
  acceptedPaymentMethods?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface Business {
  /** Public URL reference, e.g. "krakow-cuts_482913" (backend V118). */
  slug?: string;
  /** businesses.public_id (V143): the salon's UUID, what panel URLs carry instead of the id. */
  publicId?: string;
  /** The panel's address segment: `<name-slug>_<publicId>` (business.getbooqi.tech/<panelKey>/calendar). */
  panelKey?: string;
  /** #12: ISO code from businesses.currency (V17). Drives every price display. */
  currency?: string;
  taxRate?: number;
  /**
   * #37: the deposit and cancellation policy. Backed by businesses.deposit_percent /
   * cancellation_window_hours / late_cancellation_fee (V41), read and written by the
   * backend since #244/#308 — no screen had ever exposed them, so a feature that
   * shipped complete on the server was unreachable from the manager app.
   */
  depositPercent?: number;
  cancellationWindowHours?: number;
  lateCancellationFee?: number;
  id: number;
  ownerId: number;
  name: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  /** customer-app #4: the photo customers see for this salon. */
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  subscriptionPlan: string;
  createdAt: string;
  updatedAt?: string;
  verifiedAt?: string;
  /** Booking policy (V81) and branding — the API returns them; the pages read them. */
  onlineBookingEnabled?: boolean;
  minBookingNoticeMinutes?: number;
  maxBookingDaysAhead?: number;
  /** Comma-separated: any of CASH, CARD, ONLINE. */
  acceptedPaymentMethods?: string;
  brandColor?: string;
  receiptFooter?: string;
  timezone?: string;
  /** From the account's salon list: what the signed-in person is here. */
  myRole?: string;
  isOwner?: boolean;
  myPermissions?: string[];
  myStaffId?: number;
}

export interface BranchRequest {
  businessId: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
}

export interface Branch {
  id: number;
  businessId: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt?: string;
}

class BusinessService {
  async createBusiness(data: BusinessRequest, _accessToken?: string): Promise<Business> {
    const created = await apiClient.post<Business>('/businesses', data);
    rememberSalons([created]);
    return created;
  }

  /**
   * The salon behind a panel URL segment, for its owner/team only — anyone else gets 404
   * (ApiError status 404). `canonical: false` = the name part is stale, move to `panelKey`.
   */
  async resolvePanelKey(key: string): Promise<{ id: number; publicId: string; name: string; panelKey: string; canonical: boolean }> {
    const r = await apiClient.get<{ id: number; publicId: string; name: string; panelKey: string; canonical: boolean }>(
      `/businesses/panel/${encodeURIComponent(key)}`,
    );
    rememberSalons([r]);
    return r;
  }

  async getBusiness(id: number, _accessToken?: string): Promise<Business> {
    return apiClient.get<Business>(`/businesses/${id}`);
  }

  /** What is still missing before customers can book this salon (same rules as admin Activation). */
  async getReadiness(id: number): Promise<{ bookable: boolean; missing: string[]; recommended: string[] }> {
    return apiClient.get(`/businesses/${id}/readiness`);
  }

  async getBusinessesByOwner(ownerId: number, _accessToken?: string): Promise<Business[]> {
    const list = await apiClient.get<Business[]>(`/businesses/owner/${ownerId}`);
    rememberSalons(list ?? []);
    return list;
  }

  async updateBusiness(id: number, data: Partial<BusinessRequest>, _accessToken?: string): Promise<Business> {
    const updated = await apiClient.put<Business>(`/businesses/${id}`, data);
    // Every price on every screen reads the currency from this cache (lib/currency). A
    // location change can move the salon to another country — and so another currency —
    // so refresh it here, once, rather than in each page that saves the business.
    if (localStorage.getItem("currentBusinessId") === String(id)) {
      localStorage.setItem("currentBusiness", JSON.stringify(updated));
    }
    return updated;
  }

  async createBranch(data: BranchRequest, _accessToken?: string): Promise<Branch> {
    return apiClient.post<Branch>(`/businesses/${data.businessId}/branches`, data);
  }

  /** GET has existed since the branches endpoint shipped; nothing had ever called it. */
  async getBranches(businessId: number): Promise<Branch[]> {
    return apiClient.get<Branch[]>(`/businesses/${businessId}/branches`);
  }

  /** Signed-in user's own password. Every other session is signed out by the change. */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`/auth/change-password`, { currentPassword, newPassword });
  }
}

export const businessService = new BusinessService();
