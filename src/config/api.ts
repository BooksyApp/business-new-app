// API Configuration
// The manager site and the API are served from the same origin (Caddy on the VPS
// reverse-proxies /api/** to the backend, everything else is this SPA) — so both
// URLs are same-origin relative paths, no CORS or mixed-content workaround needed.
// In development, the Vite dev server proxies /api to http://localhost:8080.
export const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api');
// WebSocket Configuration — SockJS wants an HTTP(S) URL, empty = same origin.
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || '';

// Get current business ID from localStorage (set after login/registration)
// Note: In business-specific routes, use useBusinessId() hook instead
export const getCurrentBusinessId = (): number => {
  // First, try to get from currentBusinessId
  const businessId = localStorage.getItem('currentBusinessId');
  if (businessId) {
    const parsedId = parseInt(businessId, 10);
    if (!isNaN(parsedId) && parsedId > 0) {
      return parsedId;
    }
  }
  
  // Try to get from currentBusiness object
  const businessStr = localStorage.getItem('currentBusiness');
  if (businessStr) {
    try {
      const business = JSON.parse(businessStr);
      if (business && business.id) {
        const parsedId = parseInt(business.id.toString(), 10);
        if (!isNaN(parsedId) && parsedId > 0) {
          localStorage.setItem('currentBusinessId', parsedId.toString());
          return parsedId;
        }
      }
    } catch (e) {
      console.error('Error parsing currentBusiness from localStorage:', e);
    }
  }
  
  // Return a safe default that will cause an error on the backend
  // This is better than silently using business ID 1
  return 0; // Return 0 instead of 1, which should cause a validation error on backend
};

// Default business ID (fallback for development - use getCurrentBusinessId() instead)
export const DEFAULT_BUSINESS_ID = 1;

import { getAccessToken, isTokenValid, clearAuthData } from '@/utils/authUtils';
import { takeEarly } from '@/lib/authPrefetch';
import { t } from "@/i18n";

// Helper function to clear auth data and redirect to login
/**
 * Swap the refresh token for a new pair. The access token lives 24 hours and the panel
 * never used the 30-day refresh token, so a salon was signed out mid-shift every day.
 * One refresh at a time: the server rotates the refresh token, so two in parallel would
 * cancel each other out.
 */
let refreshing: Promise<string | null> | null = null;
export const refreshSession = (): Promise<string | null> => {
  if (refreshing) return refreshing;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return Promise.resolve(null);
  refreshing = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) return null;
      const data = await r.json();
      if (!data?.accessToken) return null;
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      return data.accessToken as string;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

const clearAuthAndRedirect = () => {
  clearAuthData();
  // The app's base path (vite `base`, "/" on business.getbooqi.tech).
  window.location.href = `${import.meta.env.BASE_URL}login`;
};

// API Client
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true,
    retried: boolean = false
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    let accessToken = getAccessToken();
    
    // An expired access token is renewed before giving up on the session.
    if (requireAuth && accessToken && !isTokenValid(accessToken)) {
      accessToken = await refreshSession();
      if (!accessToken) {
        console.warn('Session expired and could not be renewed, redirecting to login');
        clearAuthAndRedirect();
        throw new Error(t("utils.tokenInvalidOrExpired"));
      }
    }
    
    // If auth is required but no token, redirect to login
    if (requireAuth && !accessToken) {
      console.warn('No access token found, redirecting to login');
      clearAuthAndRedirect();
      throw new Error(t("utils.noAuthenticationToken"));
    }

    // The first screen's data may already be on its way (lib/authPrefetch, started with the
    // auth checks at startup). Used once; on any miss the request goes out as usual.
    if (requireAuth && !retried && (!options.method || options.method === 'GET')) {
      const earlyAnswer = takeEarly(endpoint, accessToken);
      const text = earlyAnswer ? await earlyAnswer : null;
      if (text !== null) return (text ? JSON.parse(text) : null) as T;
    }

    // A file upload (FormData) needs the browser's own multipart Content-Type with its boundary.
    const headers: Record<string, string> = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string> | undefined),
    };

    // Add Authorization header if auth is required and token exists
    if (requireAuth && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      // A 401 on a signed-in request: renew once and try again before signing out.
      if (response.status === 401 && requireAuth && !retried) {
        const renewed = await refreshSession();
        if (renewed) {
          return this.request<T>(endpoint, options, requireAuth, true);
        }
      }
      
      // Handle 401 Unauthorized - token invalid or expired
      if (response.status === 401) {
        console.warn('Unauthorized access, clearing auth and redirecting to login');
        clearAuthAndRedirect();
        throw new Error(t("utils.unauthorizedPleaseLoginAgain"));
      }
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText, message: response.statusText };
        }
        // The API answers RFC 7807 problem details: the sentence meant for a person is
        // `detail`. Reading only message/error showed "HTTP error! status: 409" instead of
        // "This time slot is already booked" across the whole panel.
        const error = new Error(
          errorData.detail || errorData.message || errorData.error || t("utils.httpErrorStatus", { status: response.status })
        );
        (error as Error & { response?: unknown }).response = { data: errorData, status: response.status };
        throw error;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      // An endpoint that answers `null` (e.g. "no drawer open") comes back as 200 with an
      // empty body; response.json() throws on that, which left the cash drawer screen
      // showing an error after every close instead of the shut drawer.
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    } catch (error) {
      console.error('API request failed:', error);
      
      // Handle connection timeout and network errors
      const e = error as { message?: string } | null;
      if (e?.message?.includes('ERR_CONNECTION_TIMED_OUT') || 
          e?.message?.includes('timeout') ||
          e?.message?.includes('Failed to fetch')) {
        const errorMessage = e?.message?.includes('ERR_CONNECTION_TIMED_OUT') 
          ? t("utils.connectionTimedOutTheApi")
          : t("utils.networkErrorUnableToConnect");
        throw new Error(errorMessage);
      }
      
      throw error;
    }
  }

  async get<T>(endpoint: string, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, requireAuth);
  }

  async post<T>(endpoint: string, data?: unknown, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }, requireAuth);
  }

  async put<T>(endpoint: string, data?: unknown, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, requireAuth);
  }

  async delete<T>(endpoint: string, requireAuth: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, requireAuth);
  }

  /** multipart/form-data POST (photo uploads). */
  async upload<T>(endpoint: string, form: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: form }, true);
  }
}

/**
 * Uploaded photos come back as "/api/public/uploads/<id>.jpg". In production the API shares
 * the hub's origin; in development it is another port, so prefix the API's own origin.
 */
/**
 * The public site (booqi-web), where a salon's page lives. Production serves it on the hub's
 * own origin; in development it is a separate server on :3000, so the hub's origin would
 * open the hub itself on a /salon/... path.
 */
export function publicSiteUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  const site = configured || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
  return site.replace(/\/+$/, "");
}

export function assetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.startsWith("/api/")) return url;
  const base = API_BASE_URL.replace(/\/api\/?$/, "");
  return base.startsWith("http") ? base + url : url;
}

export const apiClient = new ApiClient(API_BASE_URL);



// Force rebuild 1767801300