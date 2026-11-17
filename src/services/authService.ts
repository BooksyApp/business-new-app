import type { Id } from "@/types/id";
import { API_BASE_URL } from "@/config/api";
import { getErrorMessage, ErrorResponse } from "@/utils/errorHandler";
import { t } from "@/i18n";

export interface RegisterRequest {
  /** What the owner agreed to on the form; the server records it with the wording version. */
  consent?: { acceptTerms: boolean; termsVersion: string; marketingOptIn: boolean; source: string };
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  businessName: string;
  category?: string;
  address?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  businessHours?: string; // JSON string
  weeklySchedule?: string;
  workLocation?: string;
  teamSize?: string;
  profileLiveDate?: string;
  helpOptions?: string; // JSON array as string
  previousTools?: string; // JSON array as string
  hasUsedTools?: string;
  staffMembers?: string; // JSON array as string
  services?: string; // JSON array as string
}

export interface LoginRequest {
  email: string;
  password: string;
}

// #9 (salon-hub QA): this used to declare a nested { user: {...}, business: {...} }
// shape that /api/auth/login, /register/business and /refresh never actually return —
// AuthController sends one flat record for all three. LoginPage destructured
// `authResponse.user` / `.business` against this wrong type, got `undefined` for both
// at runtime, and stored the literal string "undefined" into localStorage under the
// "user" key on every login (only masked because ProtectedRoute's own /auth/validate
// call happens to overwrite it moments later — a race, not a fix).
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: Id;
  fullName: string;
  email: string;
  role: string;
  businessId: Id | null;
}

// Use API_BASE_URL from config which handles both dev (proxy) and production (full URL)
// In development, Vite proxy routes /api to http://localhost:8080
// In production, this uses the full GCP API URL
const AUTH_API_BASE = API_BASE_URL;

class AuthService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${AUTH_API_BASE}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      // Check if response is ok
      if (!response.ok) {
        // Try to parse error response from backend
        let errorData: ErrorResponse;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch (parseError) {
            // If JSON parsing fails, create a basic error object
            errorData = {
              status: response.status,
              error: response.statusText,
              message: t("services.requestFailedWithStatus", { status: response.status }),
            };
          }
        } else {
          // Non-JSON response
          const text = await response.text();
          errorData = {
            status: response.status,
            error: response.statusText,
            message: text || t("services.requestFailedWithStatus", { status: response.status }),
          };
        }

        // Extract user-friendly message from error response
        const errorMessage = getErrorMessage(errorData);
        const error = new Error(errorMessage);
        
        // Attach the full error response for debugging
        const e = error as Error & { response?: unknown; status?: number };
        e.response = errorData;
        e.status = response.status;
        
        console.error('API Error Response:', errorData);
        throw error;
      }

      return await response.json();
    } catch (error) {
      // If it's already our formatted error, re-throw it
      if (error instanceof Error && error.message && !error.message.includes('Failed to fetch')) {
        console.error('Auth API request failed:', error.message, error);
        throw error;
      }
      
      // Handle network errors (Failed to fetch, CORS, connection refused, timeout, etc.)
      const e = error as { message?: string; name?: string } | null;
      if (e?.message?.includes('Failed to fetch') || 
          e?.message?.includes('NetworkError') ||
          e?.message?.includes('ERR_CONNECTION_TIMED_OUT') ||
          e?.message?.includes('ERR_CONNECTION_REFUSED') ||
          e?.message?.includes('timeout') ||
          e?.name === 'TypeError') {
        console.error('Network error:', error);
        
        // Provide specific error messages based on error type
        let errorMessage = t("services.unableToConnectToThe");
        if (e?.message?.includes('ERR_CONNECTION_TIMED_OUT') || e?.message?.includes('timeout')) {
          errorMessage += t("services.connTimedOut");
        } else if (e?.message?.includes('ERR_CONNECTION_REFUSED')) {
          errorMessage += t("services.connRefused");
        } else {
          errorMessage += t("services.checkConnection");
        }
        
        throw new Error(errorMessage);
      }
      
      // Handle other unexpected errors
      console.error('Auth API request failed:', error);
      const errorMessage = error?.message || t("services.anUnexpectedErrorOccurredPlease");
      throw new Error(errorMessage);
    }
  }

  async registerBusiness(data: RegisterRequest): Promise<AuthResponse> {
    // Backend endpoint: POST /api/auth/register/business (public, whitelisted in SecurityConfig)
    return this.request<AuthResponse>('/auth/register/business', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      return await this.loginOnce(data);
    } catch (error) {
      // Role isolation: a customer or booqi-team account is told why, not "wrong password".
      // The API answers application/problem+json, which request() keeps as raw text, so the
      // code is looked for in whatever came back.
      const e = error as Error & { status?: number; response?: unknown };
      const raw = e?.status === 403 ? `${JSON.stringify(e.response ?? '')} ${e.message ?? ''}` : '';
      const code = ['ACCOUNT_IS_CUSTOMER', 'ACCOUNT_IS_ADMIN'].find((c) => raw.includes(c));
      if (code === 'ACCOUNT_IS_CUSTOMER') {
        throw Object.assign(new Error(t("auth.wrongAccountCustomer")), { status: 403 });
      }
      if (code === 'ACCOUNT_IS_ADMIN') {
        throw Object.assign(new Error(t("auth.wrongAccountStaff")), { status: 403 });
      }
      throw error;
    }
  }

  private async loginOnce(data: LoginRequest): Promise<AuthResponse> {
    // Backend AuthController: /api/public/auth/login expects { emailOrPhone, password }.
    // `app: 'hub'`: the panel signs in salon owners and their team only (role isolation).
    try {
      return await this.request<AuthResponse>('/public/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrPhone: data.email,
          password: data.password,
          app: 'hub',
        }),
      });
    } catch (primaryError) {
      // Fallback to the admin alias at /api/auth/login (also public, accepts {email} too)
      const fallbackStatus = (primaryError as { status?: number } | null)?.status;
      const shouldTryPublicFallback =
        !fallbackStatus ||
        [400, 404, 500, 502, 503, 504].includes(fallbackStatus);
      if (!shouldTryPublicFallback) {
        throw primaryError;
      }
      return this.request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrPhone: data.email,
          password: data.password,
          app: 'hub',
        }),
      });
    }
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await this.request<void>('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Silently ignore — clear local state regardless
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      // The endpoint reads {"refreshToken": "..."}; a bare string was rejected.
      body: JSON.stringify({ refreshToken }),
    });
  }

  async validateToken(token: string): Promise<{ valid: boolean; message: string; user?: unknown }> {
    try {
      const response = await fetch(`${AUTH_API_BASE}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Only the server saying no ends the session. A restart (every deploy) answered
      // with a network error or a 5xx, and that signed every open manager out.
      if (response.status === 401 || response.status === 403) {
        return { valid: false, message: t("services.tokenValidationFailed") };
      }
      if (!response.ok) {
        return { valid: true, message: t("services.couldNotCheckTheSession") };
      }

      const data = await response.json();
      return {
        valid: data.valid || false,
        message: data.message || t("services.tokenValidationFailed"),
        user: data.user,
      };
    } catch (error) {
      console.warn('Could not reach the server to check the session; keeping it:', error);
      return { valid: true, message: t("services.couldNotCheckTheSession") };
    }
  }
}

export const authService = new AuthService();

