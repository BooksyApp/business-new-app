import type { Id } from '@booqi/business-shared';
import { Platform } from 'react-native';
import { businessAudience } from '@booqi/business-shared';
import { request, requestList, type AuthResponse, type Business } from '@/lib/api';
import { TERMS_VERSION } from '@/lib/config';

/** First-run endpoints: sign-up, password reset, team invite, additional salon, setup readiness. Paths and bodies verified against booksy-backend (see API-CONTRACT.md). */

export interface RegisterBody { firstName: string; lastName: string; email: string; password: string; phone?: string; businessName: string; marketingOptIn: boolean; referralCode?: string }
export interface BizCategory { slug: string; name: string; label: string }
export interface Readiness { bookable: boolean; missing: ('category' | 'services' | 'staff' | 'hours' | 'onlineBooking' | 'suspended')[]; recommended: ('photos' | 'verification')[] }
export interface InvitePreview { salonName: string; staffName: string; email: string; accountExists: boolean }
export interface PlatformFlags { businessSignupsOpen?: boolean; appMaintenance?: boolean; appMaintenanceMessage?: string }

export const apiO = {
  /** POST /api/auth/register/business: owner + first salon (named by businessName), 201 + AuthResponse. 409 = email taken. */
  register: (b: RegisterBody) =>
    request<AuthResponse>('/auth/register/business', {
      method: 'POST', auth: false,
      body: { firstName: b.firstName, lastName: b.lastName, email: b.email, password: b.password, phone: b.phone || undefined, businessName: b.businessName, referralCode: b.referralCode || undefined,
        consent: { acceptTerms: true, termsVersion: TERMS_VERSION, marketingOptIn: b.marketingOptIn, source: Platform.OS === 'ios' ? 'ios_business_register' : 'android_business_register' } },
    }),
  /** POST /api/public/auth/login (used right after sign-up is not needed: register already returns tokens). */
  login: (emailOrPhone: string, password: string) => request<AuthResponse>('/public/auth/login', { method: 'POST', auth: false, body: { emailOrPhone, password, app: businessAudience(Platform.OS) } }),
  /** POST /api/public/auth/password/forgot: always 200 {sent:true}, never says whether the address exists. */
  forgot: (email: string) => request<{ sent: boolean }>('/public/auth/password/forgot', { method: 'POST', auth: false, body: { email } }),
  /** POST /api/public/auth/password/reset with the emailed token. */
  reset: (token: string, newPassword: string) => request<{ reset: boolean }>('/public/auth/password/reset', { method: 'POST', auth: false, body: { token, newPassword } }),
  /** POST /api/auth/change-password (signed in). Other devices are signed out by the server. */
  changePassword: (currentPassword: string, newPassword: string) => request<{ changed: boolean }>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  /** GET /api/public/business-categories?locale=: `name` is the stable key to send, `label` is the display name. */
  categories: (locale: string) => requestList<BizCategory>(`/public/business-categories?locale=${encodeURIComponent(locale)}`, { auth: false }),
  /** GET /api/public/platform: business sign-ups can be closed by the platform. */
  platform: () => request<PlatformFlags>('/public/platform', { auth: false }),
  /** POST /api/businesses: an additional salon under the signed-in owner. category is required (400 otherwise). */
  createBusiness: (body: { ownerId: Id; name: string; category: string; address?: string; city?: string; country?: string; phone?: string }) =>
    request<Business>('/businesses', { method: 'POST', body }),
  /** GET /api/businesses/{id}/readiness: what is still missing before customers can book. */
  readiness: (b: Id) => request<Partial<Readiness> | null>(`/businesses/${b}/readiness`).then((r): Readiness => ({ bookable: r?.bookable !== false, missing: Array.isArray(r?.missing) ? r!.missing! : [], recommended: Array.isArray(r?.recommended) ? r!.recommended! : [] })),
  /** GET /api/public/staff-invites/{token}. */
  invitePreview: (token: string) => request<InvitePreview>(`/public/staff-invites/${encodeURIComponent(token)}`, { auth: false }),
  /** POST /api/public/staff-invites/{token}/accept: creates the account (or checks the password of an existing one). 409 when it is a customer account. */
  inviteAccept: (token: string, body: { firstName?: string; lastName?: string; password: string }) =>
    request<{ email?: string }>(`/public/staff-invites/${encodeURIComponent(token)}/accept`, { method: 'POST', auth: false, body }),
};

/** The invite token is the last path segment of the emailed link (".../invite/<token>") or the bare token. */
export function inviteTokenFrom(input: string): string {
  const s = input.trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

/** Server reasons (login 403 codes) the app turns into its own words: returns a string key, or null to show the server text. */
export function authErrorKey(e: unknown): 'ob.errCustomer' | 'login.wrongApp' | null {
  const code = (e instanceof Error ? e.message : '').toUpperCase();
  if (code.includes('ACCOUNT_IS_CUSTOMER')) return 'ob.errCustomer';
  if (code.includes('ACCOUNT_IS_ADMIN') || code.includes('ACCOUNT_NOT_FOR_THIS_APP') || code.includes('ACCOUNT_IS_BUSINESS')) return 'login.wrongApp';
  return null;
}
