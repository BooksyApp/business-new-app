/**
 * `app` audience sent to POST /api/public/auth/login (role isolation). Defined once; the backend accepts these
 * names (booksy-backend commit 41633b5) and maps the business ones to the hub audience.
 */
export const APP_AUDIENCE = {
  WEB_BUSINESS: "WEB_BUSINESS",
  IOS_BUSINESS: "IOS_BUSINESS",
  ANDROID_BUSINESS: "ANDROID_BUSINESS",
} as const;

export type AppAudience = (typeof APP_AUDIENCE)[keyof typeof APP_AUDIENCE];

/** Audience of the native business app for a React Native `Platform.OS` value (web falls back to Android). */
export function businessAudience(os: string): AppAudience {
  return os === "ios" ? APP_AUDIENCE.IOS_BUSINESS : APP_AUDIENCE.ANDROID_BUSINESS;
}
