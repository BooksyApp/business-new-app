# Fix list 2 (startup + hardening)

Status: DONE = implemented (code-read, no device run, no local tsc); TODO = not started.

## Startup (priority 1)
1. DONE ROOT CAUSE app/index.tsx: redirected everyone to /calendar, which sits behind Stack.Protected(guard=signedIn). Signed-out launch had nothing renderable -> blank after splash. Now redirects to /login or /calendar by auth status.
2. DONE Root error boundary + expo-router ErrorBoundary export + ErrorUtils global handler: native fallback screen with message/stack and "Yenidən cəhd et" (src/lib/crash.tsx).
3. DONE Splash always hidden after 4s (timeout in _layout.tsx), preventAutoHideAsync wrapped.
4. DONE Fonts: a font error or >3s wait no longer returns null forever; falls back to system fonts.
5. DONE Session bootstrap: 6s timeout falls back to login; loadLocale/loadSession wrapped in try/catch.
6. DONE expo-notifications loaded lazily in try/catch (handler, listeners, token registration) so a broken push module cannot crash at import.

## Networking
7. DONE API requests time out after 25s (status 0 = offline) instead of hanging screens (packages/shared core.ts).
8. DONE Token refresh timeout 15s; network failure or 5xx during refresh no longer signs the user out (only a rejected refresh does).
9. DONE useLoad drops stale responses (only the newest request writes state).

## Not done (kept out of this pass, no device to verify)
10-55. TODO frame fidelity pass, calendar polish, validation copy, i18n audit, a11y, dark-mode audit, FlashList, dead-code sweep, jest utils tests (jest not configured). Native feature work was done in FIXES.md (1-20+); this pass prioritised the startup failure.
