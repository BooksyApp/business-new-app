import React from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

/**
 * Last line of defence against a blank app: plain React Native only (no theme, fonts, i18n or router),
 * so it still renders when everything else failed to start. Shows the error so it can be screenshotted.
 */
type Info = { message: string; stack: string };
let fatal: Info | null = null;
const subs = new Set<() => void>();

export function describe(e: unknown): Info {
  if (e instanceof Error) return { message: e.message || String(e), stack: e.stack ?? '' };
  try { return { message: typeof e === 'string' ? e : JSON.stringify(e), stack: '' }; } catch { return { message: 'Unknown error', stack: '' }; }
}

export function reportFatal(e: unknown) {
  fatal = describe(e);
  subs.forEach((f) => { try { f(); } catch { /* ignore */ } });
}

/** Installs ErrorUtils global handler once: uncaught JS errors surface as the fallback screen instead of killing the app. */
export function installGlobalHandler() {
  try {
    const EU = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler?: () => (e: unknown, f?: boolean) => void; setGlobalHandler?: (h: (e: unknown, f?: boolean) => void) => void } }).ErrorUtils;
    if (!EU?.setGlobalHandler) return;
    const prev = EU.getGlobalHandler?.();
    EU.setGlobalHandler((e, isFatal) => {
      if (isFatal) reportFatal(e);
      else if (__DEV__) prev?.(e, isFatal);
    });
  } catch { /* never block startup */ }
}

export function CrashScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const i = error && typeof error === 'object' && 'message' in (error as object) && 'stack' in (error as object) ? (error as Info) : describe(error);
  return (
    <View style={{ flex: 1, backgroundColor: '#fbf7f2', paddingTop: Platform.OS === 'ios' ? 64 : 48, paddingHorizontal: 20, paddingBottom: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#1D1730' }}>Xəta baş verdi</Text>
      <Text style={{ fontSize: 14, color: '#5b5470', marginTop: 6 }}>Ekranın şəklini çəkib bizə göndərin.</Text>
      <ScrollView style={{ flex: 1, marginTop: 16, backgroundColor: '#fff', borderRadius: 12 }} contentContainerStyle={{ padding: 12 }}>
        <Text selectable style={{ fontSize: 13, fontWeight: '700', color: '#b3261e' }}>{i.message}</Text>
        {!!i.stack && <Text selectable style={{ fontSize: 10, color: '#333', marginTop: 8 }}>{i.stack.slice(0, 2500)}</Text>}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={onRetry} style={{ marginTop: 16, height: 52, borderRadius: 26, backgroundColor: '#1D1730', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Yenidən cəhd et</Text>
      </Pressable>
    </View>
  );
}

type BState = { error: unknown | null };
/** Class boundary for render errors plus the global-handler store; retry clears both and remounts children. */
export class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, BState & { key: number }> {
  state: BState & { key: number } = { error: null, key: 0 };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown) { if (__DEV__) console.error(error); }
  private sync = () => this.setState({ error: fatal });
  componentDidMount() { subs.add(this.sync); if (fatal) this.sync(); }
  componentWillUnmount() { subs.delete(this.sync); }
  retry = () => { fatal = null; this.setState((s) => ({ error: null, key: s.key + 1 })); };
  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} onRetry={this.retry} />;
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}
