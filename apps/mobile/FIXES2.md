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

## Pass 2 (local, tsc-checked with customer-new-app node_modules)
10. DONE Btn: accessibilityLabel + busy state. 11. DONE Card with onPress is a button. 12. DONE Header title role=header.
13. DONE Skeleton labelled busy/loading (i18n). 14. DONE StateView live region. 15. DONE Chip (ui + calendar) accessibilityLabel.
16. DONE BottomSheet scrim label uses i18n (was hardcoded "Close"). 17. DONE Login: language buttons labelled/selected, disabled Google button state, textContentType.
18. DONE Android keyboard: KeyboardAvoidingView behavior 'height' (login, new booking, thread) + softwareKeyboardLayoutMode resize.
19. DONE Messages composer respects bottom safe area.
20. DONE Booking: blocks services running past midnight (new key create.pastMidnight AZ/EN/RU).
21. DONE Booking: double-submit guard. 22. DONE Booking: repeat loop stops on network loss. 23. DONE Monthly repeat clamps month-end.
24. DONE Calendar: "Bu gün" quick jump when not on today.
25. DONE Data refreshes when app returns after >30s and when the connection comes back.
26. DONE Settings: appearance (system/light/dark) switch (keys AZ/EN/RU). 27. DONE Settings: sign-out confirmation.
28. DONE Alerts: refresh error no longer hides loaded data; pending sorted by time.
29. DONE Client card: not-found state instead of endless skeleton; tel/wa/mailto links cannot throw (also Team, BookingSheet).
30. DONE Clients list: search keyboard/clear button, drag-dismiss keyboard, virtualization props; same props on Services/Sales/Messages/Team lists.
31. DONE Services edit: bounds (duration <=720, price <=100000) with error haptic.
32. DONE app/+not-found.tsx: unknown deep links go home. 33. DONE Dead imports removed (login LinearGradient, BlockTimeSheet toMin).
34. DONE README startup/safety section. 35. DONE Fixed a TS error in my first push (notification response type) caught by real tsc.

## Not done (needs device or backend; honest scope)
Frame pixel comparison vs BF frames, FlashList migration, jest tests (jest not configured), deep-link intent filters for https (no business web domain decided), per-screen RU/EN copy review, expo-blur Android, drag-free calendar tap-target audit. ~20 of the requested ~50 were realistic without a device; the rest is TODO.
