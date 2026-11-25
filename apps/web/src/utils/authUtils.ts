import { forgetSalons } from "@/lib/salonKey";
/**
 * Authentication utility functions for JWT token validation
 */

/**
 * A JWT segment is base64url ("-", "_", no padding); atob() only takes base64 and throws on
 * "-"/"_". A user whose token happened to contain one looked expired, so the API client
 * refreshed the session before every single request.
 */
const decodeJwtPart = (part: string): string => {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
};

/**
 * Checks if a JWT token is valid (exists, not expired, and properly formatted)
 */
export const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(decodeJwtPart(parts[1]));
    if (!payload.exp) return false;

    return Date.now() < payload.exp * 1000;
  } catch {
    return false;
  }
};

/**
 * Checks if a JWT token is expired
 */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(decodeJwtPart(parts[1]));
    if (!payload.exp) return true;
    
    const exp = payload.exp * 1000;
    return Date.now() >= exp;
  } catch (error) {
    return true;
  }
};

/**
 * Gets the expiration time of a token in milliseconds
 */
export const getTokenExpiration = (token: string | null): number | null => {
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(decodeJwtPart(parts[1]));
    if (!payload.exp) return null;
    
    return payload.exp * 1000;
  } catch (error) {
    return null;
  }
};

/**
 * Clears all authentication data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('currentBusinessId');
  localStorage.removeItem('currentBusiness');
  forgetSalons();
};

/**
 * Checks if user is authenticated (has valid token and user data)
 */
export const isAuthenticated = (): boolean => {
  const accessToken = localStorage.getItem('accessToken');
  const user = localStorage.getItem('user');
  
  if (!accessToken || !user) {
    return false;
  }
  
  return isTokenValid(accessToken);
};

/**
 * Gets the access token from localStorage
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

