import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from '@/lib/insets';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ApiError } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { useOnline } from '@/lib/net';
import { initials } from '@/lib/format';
import { t as tr } from '@/i18n';
import { cardShadow, circShadow, ctaShadow, font, gradCta, gradRing, mesh } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeContext';

/** Full-screen canvas; `top` adds the status-bar inset (tab screens draw their own header). */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  return <View style={[{ flex: 1, backgroundColor: t.canvas, paddingTop: ins.top + 10 }, style]}>{children}</View>;
}

/** Round 44 px icon button (`.circ`): white with a soft shadow, or violet CTA. */
export function Circ({ icon, onPress, label, violet, size = 44, badge }: { icon: string; onPress: () => void; label: string; violet?: boolean; size?: number; badge?: number }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} haptic accessibilityRole="button" accessibilityLabel={label} style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: violet ? t.violet : t.surface }, violet ? ctaShadow : circShadow]}>
      <Icon name={icon} size={22} color={violet ? '#fff' : t.ink} />
      {badge ? <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: t.guava, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.x, fontSize: 11, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    </Pressable>
  );
}

/** Screen header. Top level: big left title (34/800) with an optional line under it. Pushed screen (onBack): round back button + 24/800 title. */
export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: onBack ? 10 : 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12 }}>
        {onBack ? <Circ icon="back" onPress={onBack} label={tr('common.back')} /> : null}
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontFamily: font.x, fontSize: onBack ? 24 : 34, lineHeight: onBack ? 30 : 42, letterSpacing: onBack ? -0.5 : -1.1, color: t.ink }}>{title}</Text>
        {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>{right}</View> : null}
      </View>
      {subtitle ? <Text numberOfLines={2} style={{ fontFamily: font.m, fontSize: 15, lineHeight: 21, color: t.muted, marginTop: onBack ? 0 : 2 }}>{subtitle}</Text> : null}
    </View>
  );
}

/** Section title (18/800) with an optional action link on the right. */
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8, marginBottom: 2 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 19, letterSpacing: -0.4, color: t.ink }}>{title}</Text>
      {action && onAction ? <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button"><Text style={{ fontFamily: font.b, fontSize: 15, color: t.vtext }}>{action}</Text></Pressable> : null}
    </View>
  );
}

/** Pill search field with an optional round violet action (filters). */
export function SearchBar({ value, onChangeText, placeholder, onAction, actionIcon = 'sliders', actionLabel }: { value: string; onChangeText: (v: string) => void; placeholder: string; onAction?: () => void; actionIcon?: string; actionLabel?: string }) {
  const { t } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 28, backgroundColor: t.surface, paddingLeft: 18, paddingRight: 6, gap: 10 }, cardShadow]}>
      <Icon name="search" size={22} color={t.muted} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.ink3} accessibilityLabel={placeholder} autoCorrect={false} returnKeyType="search"
        style={{ flex: 1, height: 56, fontFamily: font.m, fontSize: 16, color: t.ink, outlineStyle: 'none' } as any} />
      {onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel ?? tr('common.search')} style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }, ctaShadow]}>
          <Icon name={actionIcon} size={20} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** iOS-like switch in brand violet (track 52x32). */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => onChange(!on)} haptic accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} noScale hitSlop={8}
      style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: on ? t.violet : t.fill2, justifyContent: 'center' }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', marginLeft: on ? 23 : 3, boxShadow: '0 2px 6px rgba(29,23,48,.28)' } as any} />
    </Pressable>
  );
}

/** One white card holding a grouped list: rows separated by hairlines. */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ backgroundColor: t.surface, borderRadius: 26, paddingHorizontal: 16, paddingVertical: 4, ...cardShadow }, style]}>
      {kids.map((k, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: t.line + '99' } : null}>{k}</View>
      ))}
    </View>
  );
}

/** Row of a Group: soft icon tile, title 16/800, line 14, trailing node or chevron. min height 68, tap target well over 44. */
export function ListRow({ icon, title, sub, onPress, right, danger, photo }: { icon?: string; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; photo?: React.ReactNode }) {
  const { t } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingVertical: 12 }}>
      {photo ?? (icon ? <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: danger ? t.gsoft : t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={danger ? t.gink : t.vtext} /></View> : null)}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16.5, letterSpacing: -0.2, color: danger ? t.gink : t.ink }}>{title}</Text>
        {sub ? <Text numberOfLines={2} style={{ fontFamily: font.m, fontSize: 14, lineHeight: 19, color: t.muted, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <Icon name="chev" size={20} color={t.ink3} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} noScale>{body}</Pressable> : body;
}

/** Soft violet/pink gradient surface for profile and hero blocks. */
export function Hero({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <View style={[{ borderRadius: 30, overflow: 'hidden', backgroundColor: t.surface, ...cardShadow }, style]}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, experimental_backgroundImage: mesh, opacity: t.dark ? 0.35 : 0.9 } as any} />
      {children}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { t } = useTheme();
  const base: ViewStyle = { backgroundColor: t.surface, borderRadius: 26, padding: 16, ...cardShadow };
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={[base, style]}>{children}</Pressable> : <View style={[base, style]}>{children}</View>;
}

export function Btn({ label, onPress, variant = 'primary', loading, disabled, icon, style, small }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean; disabled?: boolean; icon?: string; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const { t } = useTheme();
  const off = disabled || loading;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? t.gink : t.ink;
  const inner = (
    <>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: small ? 15 : 16.5, color: fg, flexShrink: 1 }}>{label}</Text>
    </>
  );
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: small ? 50 : 56, borderRadius: 28, paddingHorizontal: small ? 14 : 20 };
  return (
    <Pressable onPress={onPress} disabled={off} haptic accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off, busy: !!loading }} style={[{ opacity: off && !loading ? 0.5 : 1 }, style]}>
      {variant === 'primary' ? (
        <LinearGradient colors={[...gradCta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[row, ctaShadow]}>{inner}</LinearGradient>
      ) : (
        <View style={[row, { backgroundColor: variant === 'danger' ? t.gsoft : t.fill }]}>{inner}</View>
      )}
    </Pressable>
  );
}

/** Text field in the frames' style: a card with the small label inside and a violet ring while focused. */
export const Field = React.forwardRef<TextInput, TextInputProps & { label?: string }>(function Field({ label, style, onFocus, onBlur, ...rest }, ref) {
  const { t } = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={{ marginBottom: 14, minHeight: 64, borderRadius: 20, backgroundColor: t.surface, paddingHorizontal: 16, paddingTop: label ? 10 : 0, borderWidth: focus ? 1.5 : 1, borderColor: focus ? t.violet : t.line, justifyContent: 'center' }}>
      {label ? <Text style={{ fontFamily: font.s, fontSize: 13, color: focus ? t.vtext : t.muted }}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={t.ink3}
        accessibilityLabel={label}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        {...rest}
        style={[{ minHeight: label ? 34 : 56, paddingVertical: 2, fontFamily: font.m, fontSize: 17, color: t.ink, outlineStyle: 'none' } as any, style]}
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
    <View style={{ alignSelf: 'flex-start', height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: c[0], justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.b, fontSize: 13, color: c[1] }}>{text}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value?: string | null }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10 }}>
      <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{label}</Text>
      <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink, flexShrink: 1, textAlign: 'right' }}>{value || '-'}</Text>
    </View>
  );
}

function Pulse({ style }: { style: ViewStyle }) {
  const { t } = useTheme();
  const k = useSharedValue(0.5);
  useEffect(() => { k.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [k]);
  const a = useAnimatedStyle(() => ({ opacity: k.value }));
  return <Animated.View style={[{ backgroundColor: t.fill2, borderRadius: 24 }, style, a]} />;
}
/** Loading placeholder: a few pulsing rows. */
export function Skeleton({ rows = 5, height = 68 }: { rows?: number; height?: number }) {
  return <View accessible accessibilityLabel={tr('common.loading')} accessibilityState={{ busy: true }} style={{ paddingHorizontal: 20, gap: 12 }}>{Array.from({ length: rows }, (_, i) => <Pulse key={i} style={{ height }} />)}</View>;
}

/** Empty / error / offline / coming-soon block in the design style: soft round icon, title, body, optional action. */
export function StateView({ icon, title, body, actionLabel, onAction, secondary }: { icon: string; title: string; body?: string; actionLabel?: string; onAction?: () => void; secondary?: boolean }) {
  const { t } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', paddingHorizontal: 36, paddingTop: 56, paddingBottom: 24, gap: 10 }}>
      <View style={{ width: 148, height: 148, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <View style={{ position: 'absolute', width: 148, height: 148, borderRadius: 74, backgroundColor: t.vsoft, opacity: 0.7 }} />
        <View style={{ position: 'absolute', left: 6, top: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: t.blush, opacity: 0.8 }} />
        <View style={{ position: 'absolute', right: 10, bottom: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: t.lilac }} />
        <LinearGradient colors={[t.dark ? '#2a2538' : '#e6deff', t.dark ? '#33263a' : '#ffe0e7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center' }, cardShadow]}>
          <Icon name={icon} size={46} color={t.vtext} />
        </LinearGradient>
      </View>
      <Text style={{ fontFamily: font.x, fontSize: 24, lineHeight: 30, color: t.ink, textAlign: 'center', letterSpacing: -0.6 }}>{title}</Text>
      {body ? <Text style={{ fontFamily: font.m, fontSize: 16, lineHeight: 23, color: t.muted, textAlign: 'center' }}>{body}</Text> : null}
      {actionLabel && onAction ? <View style={{ marginTop: 14, alignSelf: 'stretch' }}><Btn label={actionLabel} variant={secondary ? 'secondary' : 'primary'} onPress={onAction} /></View> : null}
    </View>
  );
}

/** Error state; a network failure (ApiError status 0 / message "offline") reads as offline. */
export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const offline = error instanceof ApiError ? error.status === 0 : error.message === 'offline';
  return offline
    ? <StateView icon="wifioff" title={tr('state.offlineTitle')} body={tr('state.offlineBody')} actionLabel={tr('state.retry')} onAction={onRetry} secondary />
    : <StateView icon="info" title={tr('state.errorTitle')} body={error.message} actionLabel={tr('state.retry')} onAction={onRetry} secondary />;
}

export function Chip({ label, active, onPress, icon, avatar, soft }: { label: string; active?: boolean; onPress: () => void; icon?: string; avatar?: React.ReactNode; soft?: boolean }) {
  const { t } = useTheme();
  const fg = active ? (soft ? t.vtext : t.canvas) : t.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}
      style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: active ? (soft ? t.vsoft : t.ink) : t.surface, borderWidth: active ? (soft ? 1.5 : 0) : 1, borderColor: active && soft ? t.violet : t.line }}>
      {avatar}
      {icon ? <Icon name={icon} size={18} color={active ? (soft ? t.vtext : t.canvas) : t.muted} /> : null}
      <Text style={{ fontFamily: active ? font.b : font.s, fontSize: 15, color: fg }}>{label}</Text>
    </Pressable>
  );
}

const THUMB: [string, string][] = [['#e6deff', '#ffe0e7'], ['#ffe4ea', '#ffd9a1'], ['#e2f1e9', '#d8ccff'], ['#fbecd6', '#ffc2cf']];
/** Square service picture: the uploaded photo when there is one, otherwise a soft gradient tile with the category glyph. */
export function ServiceThumb({ name, cat, uri, size = 88 }: { name: string; cat?: string; uri?: string | null; size?: number }) {
  const { t } = useTheme();
  const h = [...(cat || name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % THUMB.length;
  const src = photoUrl(uri);
  const icon = /dırnaq|nail|ногт/i.test(cat ?? '') ? 'spark' : /saç|hair|волос/i.test(cat ?? '') ? 'scissors' : /üz|face|лиц|qaş|brow/i.test(cat ?? '') ? 'heart' : 'spark';
  return src ? <Image source={{ uri: src }} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size * 0.24 }} /> : (
    <LinearGradient colors={[...THUMB[h]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.24, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.4} color={t.dark ? t.vtext : '#5b3fd6'} />
    </LinearGradient>
  );
}
