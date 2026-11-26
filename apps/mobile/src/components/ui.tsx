import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ApiError } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { useOnline } from '@/lib/net';
import { initials } from '@/lib/format';
import { t as tr } from '@/i18n';
import { cardShadow, circShadow, ctaShadow, font, gradCta, gradRing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeContext';

/** Full-screen canvas; `top` adds the status-bar inset (tab screens draw their own header). */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  return <View style={[{ flex: 1, backgroundColor: t.canvas, paddingTop: ins.top }, style]}>{children}</View>;
}

export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 56, gap: 12 }}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={tr('common.back')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', ...circShadow }}>
          <Icon name="back" size={22} color={t.ink} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: onBack ? 22 : 32, letterSpacing: onBack ? -0.44 : -0.96, color: t.ink }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14.5, color: t.muted, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { t } = useTheme();
  const base: ViewStyle = { backgroundColor: t.surface, borderRadius: 22, padding: 14, ...cardShadow };
  return onPress ? <Pressable onPress={onPress} style={[base, style]}>{children}</Pressable> : <View style={[base, style]}>{children}</View>;
}

export function Btn({ label, onPress, variant = 'primary', loading, disabled, icon, style }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean; disabled?: boolean; icon?: string; style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTheme();
  const off = disabled || loading;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? t.gink : t.ink;
  const inner = (
    <>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={{ fontFamily: font.b, fontSize: 15.5, color: fg }}>{label}</Text>
    </>
  );
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, paddingHorizontal: 18 };
  return (
    <Pressable onPress={onPress} disabled={off} haptic accessibilityRole="button" accessibilityState={{ disabled: !!off }} style={[{ opacity: off && !loading ? 0.5 : 1 }, style]}>
      {variant === 'primary' ? (
        <LinearGradient colors={[...gradCta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[row, ctaShadow]}>{inner}</LinearGradient>
      ) : (
        <View style={[row, { backgroundColor: variant === 'danger' ? t.gsoft : t.fill }]}>{inner}</View>
      )}
    </Pressable>
  );
}

export const Field = React.forwardRef<TextInput, TextInputProps & { label?: string }>(function Field({ label, style, ...rest }, ref) {
  const { t } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ fontFamily: font.s, fontSize: 13, color: t.muted, marginBottom: 6 }}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={t.ink3}
        accessibilityLabel={label}
        {...rest}
        style={[{ minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, paddingHorizontal: 16, fontFamily: font.m, fontSize: 16, color: t.ink }, style]}
      />
    </View>
  );
});

/** Photo URLs from the API are origin-relative ("/api/public/uploads/..."). */
export const photoUrl = (u?: string | null) => (u ? (/^https?:/i.test(u) ? u : `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`) : null);

/** Photo (when the URL loads) or initials, in a violet-to-pink ring (staff / client avatar). */
export function Avatar({ name, size = 44, uri }: { name: string; size?: number; uri?: string | null }) {
  const { t } = useTheme();
  const [failed, setFailed] = React.useState(false);
  const src = failed ? null : photoUrl(uri);
  return (
    <LinearGradient colors={[...gradRing]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {src ? (
          <Image source={{ uri: src }} accessibilityIgnoresInvertColors onError={() => setFailed(true)} style={{ width: size - 4, height: size - 4 }} />
        ) : (
          <Text style={{ fontFamily: font.b, fontSize: Math.round(size * 0.34), color: t.vtext }}>{initials(name)}</Text>
        )}
      </View>
    </LinearGradient>
  );
}

/** Thin strip under the status bar while the last request could not reach the server. */
export function OfflineBanner() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const online = useOnline();
  if (online) return null;
  return (
    <View accessibilityRole="alert" pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: ins.top + 4, paddingBottom: 6, paddingHorizontal: 16, backgroundColor: t.guava, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Icon name="wifioff" size={16} color="#fff" />
      <Text style={{ fontFamily: font.b, fontSize: 13, color: '#fff' }}>{tr('net.offline')}</Text>
    </View>
  );
}

export function Pill({ text, tone = 'violet' }: { text: string; tone?: 'violet' | 'ok' | 'guava' | 'muted' | 'amber' }) {
  const { t } = useTheme();
  const c = { violet: [t.vsoft, t.vtext], ok: [t.oksoft, t.ok], guava: [t.gsoft, t.gink], muted: [t.fill, t.muted], amber: t.dark ? ['#342a1d', '#f0c27a'] : ['#fbecd6', '#8a5200'] }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 11, borderRadius: 13, backgroundColor: c[0], justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.b, fontSize: 12.5, color: c[1] }}>{text}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 7 }}>
      <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{label}</Text>
      <Text style={{ fontFamily: font.s, fontSize: 14.5, color: t.ink, flexShrink: 1, textAlign: 'right' }}>{value || '-'}</Text>
    </View>
  );
}

function Pulse({ style }: { style: ViewStyle }) {
  const { t } = useTheme();
  const k = useSharedValue(0.5);
  useEffect(() => { k.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [k]);
  const a = useAnimatedStyle(() => ({ opacity: k.value }));
  return <Animated.View style={[{ backgroundColor: t.fill2, borderRadius: 16 }, style, a]} />;
}
/** Loading placeholder: a few pulsing rows. */
export function Skeleton({ rows = 5, height = 68 }: { rows?: number; height?: number }) {
  return <View style={{ paddingHorizontal: 18, gap: 10 }}>{Array.from({ length: rows }, (_, i) => <Pulse key={i} style={{ height }} />)}</View>;
}

/** Empty / error / offline / coming-soon block in the design style: soft round icon, title, body, optional action. */
export function StateView({ icon, title, body, actionLabel, onAction }: { icon: string; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 56, gap: 10 }}>
      <LinearGradient colors={[t.dark ? '#2a2538' : '#e6deff', t.dark ? '#33263a' : '#ffe0e7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Icon name={icon} size={34} color={t.vtext} />
      </LinearGradient>
      <Text style={{ fontFamily: font.x, fontSize: 21, color: t.ink, textAlign: 'center', letterSpacing: -0.3 }}>{title}</Text>
      {body ? <Text style={{ fontFamily: font.m, fontSize: 15, lineHeight: 22, color: t.muted, textAlign: 'center' }}>{body}</Text> : null}
      {actionLabel && onAction ? <View style={{ marginTop: 10, alignSelf: 'stretch' }}><Btn label={actionLabel} variant="secondary" onPress={onAction} /></View> : null}
    </View>
  );
}

/** Error state; a network failure (ApiError status 0 / message "offline") reads as offline. */
export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const offline = error instanceof ApiError ? error.status === 0 : error.message === 'offline';
  return offline
    ? <StateView icon="wifioff" title={tr('state.offlineTitle')} body={tr('state.offlineBody')} actionLabel={tr('state.retry')} onAction={onRetry} />
    : <StateView icon="info" title={tr('state.errorTitle')} body={error.message} actionLabel={tr('state.retry')} onAction={onRetry} />;
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: string }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: active ? t.vsoft : t.surface, borderWidth: 1, borderColor: active ? 'rgba(111,82,237,.35)' : t.line }}>
      {icon ? <Icon name={icon} size={16} color={active ? t.vtext : t.muted} /> : null}
      <Text style={{ fontFamily: active ? font.b : font.s, fontSize: 14, color: active ? t.vtext : t.ink }}>{label}</Text>
    </Pressable>
  );
}
