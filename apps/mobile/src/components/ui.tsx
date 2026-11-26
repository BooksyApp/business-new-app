import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from '@/lib/insets';
import { Icon } from '@/components/Icon';
import { BackBar } from '@/components/kit';
import Svg, { Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ApiError } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { photoSource } from '@/lib/photo';
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
  // v2: top-bar actions are quiet ink icons (the artifact's `.ib`); only `violet` + `size` > 44 would be a floating primary.
  return (
    <Pressable onPress={onPress} haptic accessibilityRole="button" accessibilityLabel={label} style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: violet && size > 44 ? t.violet : 'transparent' }, violet && size > 44 ? ctaShadow : null]}>
      <Icon name={icon} size={22} color={violet && size > 44 ? '#fff' : t.ink} />
      {badge ? <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: t.guava, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.x, fontSize: 11, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    </Pressable>
  );
}

/** Back circle of the customer app (BackCircle): 40, surface, 1px line, 18 chevron. */
export function BackCircle({ onPress }: { onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={tr('common.back')} hitSlop={2}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.line }}>
      <Icon name="back" size={18} color={t.ink} />
    </Pressable>
  );
}

/**
 * Same two header types as the customer app. Tab level = `Title` (34/800, -1 tracking, 14/600 muted line under it, actions on the right).
 * Pushed screen = `BookNav` (48 high: BackCircle, centred 15/800 title with a 12/600 line, right slot min 40).
 */
export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { t } = useTheme();
  if (onBack) {
    return (
      <View style={{ paddingBottom: 6 }}>
        <BackBar onBack={onBack} label={tr('common.back')} right={right} />
        <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 6 }}>
          <Text accessibilityRole="header" numberOfLines={2} style={{ fontFamily: font.b, fontSize: 26, lineHeight: 31, letterSpacing: -0.65, color: t.ink }}>{title}</Text>
          {subtitle ? <Text numberOfLines={2} style={{ fontFamily: font.r, fontSize: 12.5, lineHeight: 17, color: t.muted, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: font.b, fontSize: 26, lineHeight: 32, letterSpacing: -0.65, color: t.ink }}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={{ fontFamily: font.r, fontSize: 12.5, color: t.muted, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>{right}</View> : null}
    </View>
  );
}

/** Section title (18/800) with an optional action link on the right. */
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8, marginBottom: 2 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.b, fontSize: 16, letterSpacing: -0.16, color: t.ink }}>{title}</Text>
      {action && onAction ? <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button"><Text style={{ fontFamily: font.s, fontSize: 13, color: t.vtext }}>{action}</Text></Pressable> : null}
    </View>
  );
}

/** Pill search field with an optional round violet action (filters). */
export function SearchBar({ value, onChangeText, placeholder, onAction, actionIcon = 'sliders', actionLabel }: { value: string; onChangeText: (v: string) => void; placeholder: string; onAction?: () => void; actionIcon?: string; actionLabel?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 14, backgroundColor: t.fill, paddingLeft: 14, paddingRight: 4, gap: 10 }}>
      <Icon name="search" size={18} color={t.ink3} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.ink3} accessibilityLabel={placeholder} autoCorrect={false} returnKeyType="search"
        style={{ flex: 1, height: 44, fontFamily: font.r, fontSize: 15, color: t.ink, outlineStyle: 'none' } as any} />
      {onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel ?? tr('common.search')} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={actionIcon} size={20} color={t.ink} />
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
      style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? t.violet : '#e4ddd3', justifyContent: 'center' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', marginLeft: on ? 21 : 3, boxShadow: '0 2px 6px rgba(29,23,48,.28)' } as any} />
    </Pressable>
  );
}

/** One white card holding a grouped list: rows separated by hairlines. */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 0, ...cardShadow }, style]}>
      {kids.map((k, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: t.hair } : null}>{k}</View>
      ))}
    </View>
  );
}

/** Row of a Group: soft icon tile, title 16/800, line 14, trailing node or chevron. min height 68, tap target well over 44. */
export function ListRow({ icon, title, sub, onPress, right, danger, photo }: { icon?: string; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; photo?: React.ReactNode }) {
  const { t } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 9 }}>
      {photo ?? (icon ? <Icon name={icon} size={21} color={danger ? t.gink : t.ink} /> : null)}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 15, color: danger ? t.gink : t.ink }}>{title}</Text>
        {sub ? <Text numberOfLines={2} style={{ fontFamily: font.r, fontSize: 13, lineHeight: 18, color: t.muted, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <Icon name="chev" size={16} color={t.ink3} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} noScale>{body}</Pressable> : body;
}

/** Soft violet/pink gradient surface for profile and hero blocks. */
export function Hero({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <View style={[{ borderRadius: 26, overflow: 'hidden', backgroundColor: t.surface, ...cardShadow }, style]}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, experimental_backgroundImage: mesh, opacity: t.dark ? 0.35 : 0.9 } as any} />
      {children}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { t } = useTheme();
  const base: ViewStyle = { backgroundColor: t.surface, borderRadius: 22, padding: 16, ...cardShadow };
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
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: small ? 13.5 : 15, color: fg, flexShrink: 1 }}>{label}</Text>
    </>
  );
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: small ? 40 : 48, borderRadius: small ? 20 : 24, paddingHorizontal: small ? 14 : 20 };
  return (
    <Pressable onPress={onPress} disabled={off} haptic accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off, busy: !!loading }} style={[{ opacity: off && !loading ? 0.5 : 1 }, style]}>
      {variant === 'primary' ? (
        <View style={[row, { backgroundColor: t.violet }, ctaShadow]}>{inner}</View>
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
    <View style={{ marginBottom: 12, minHeight: 54, borderRadius: 16, backgroundColor: t.surface, paddingHorizontal: 16, paddingTop: label ? 8 : 0, borderWidth: focus ? 1.5 : 1, borderColor: focus ? t.violet : t.line, justifyContent: 'center' }}>
      {label ? <Text style={{ fontFamily: font.r, fontSize: 11.5, color: focus ? t.vtext : t.ink3 }}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={t.ink3}
        accessibilityLabel={label}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        {...rest}
        style={[{ minHeight: label ? 30 : 52, paddingVertical: 2, fontFamily: font.s, fontSize: 15, color: t.ink, outlineStyle: 'none' } as any, style]}
      />
    </View>
  );
});

/** Photo URLs from the API are origin-relative ("/api/public/uploads/..."). */
export const photoUrl = (u?: string | null) => { const s = photoSource(u); return s && typeof s === 'object' && 'uri' in s ? (s.uri ?? null) : null; };

/** Photo (when the URL loads) or initials, in a violet-to-pink ring (staff / client avatar). */
export function Avatar({ name, size = 44, uri }: { name: string; size?: number; uri?: string | null }) {
  const { t } = useTheme();
  const [failed, setFailed] = React.useState(false);
  const src = failed ? null : photoSource(uri);
  return (
    <LinearGradient colors={[...gradRing]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {src ? (
          <Image source={src} accessibilityIgnoresInvertColors onError={() => setFailed(true)} style={{ width: size - 4, height: size - 4 }} />
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
    <View style={{ alignSelf: 'flex-start', height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: c[0], justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.s, fontSize: 12, color: c[1] }}>{text}</Text>
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
    <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', paddingHorizontal: 36, paddingTop: 64, paddingBottom: 24, gap: 8 }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon name={icon} size={34} color={t.vtext} />
      </View>
      <Text accessibilityRole="header" style={{ fontFamily: font.b, fontSize: 19, lineHeight: 24, color: t.ink, textAlign: 'center', letterSpacing: -0.38 }}>{title}</Text>
      {body ? <Text style={{ fontFamily: font.r, fontSize: 14, lineHeight: 20, color: t.muted, textAlign: 'center' }}>{body}</Text> : null}
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
      style={{ height: 36, paddingHorizontal: 15, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: active ? (soft ? t.vsoft : t.ink) : t.surface, borderWidth: active ? (soft ? 1.5 : 0) : 1, borderColor: active && soft ? t.violet : t.hair }}>
      {avatar}
      {icon ? <Icon name={icon} size={18} color={active ? (soft ? t.vtext : t.canvas) : t.muted} /> : null}
      <Text style={{ fontFamily: font.s, fontSize: 13.5, color: fg }}>{label}</Text>
    </Pressable>
  );
}

const THUMB: [string, string][] = [['#e6deff', '#ffe0e7'], ['#ffe4ea', '#ffd9a1'], ['#e2f1e9', '#d8ccff'], ['#fbecd6', '#ffc2cf']];
/** Square service picture: the uploaded photo when there is one, otherwise a soft gradient tile with the category glyph. */
export function ServiceThumb({ name, cat, uri, size = 88 }: { name: string; cat?: string; uri?: string | null; size?: number }) {
  const { t } = useTheme();
  const h = [...(cat || name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % THUMB.length;
  const src = photoSource(uri);
  const icon = cat === 'box' ? 'box' : /dırnaq|nail|ногт/i.test(cat ?? '') ? 'spark' : /saç|hair|волос/i.test(cat ?? '') ? 'scissors' : /üz|face|лиц|qaş|brow/i.test(cat ?? '') ? 'heart' : 'spark';
  return src ? <Image source={src} accessibilityIgnoresInvertColors style={{ width: size, height: size, borderRadius: size * 0.24 }} /> : (
    <LinearGradient colors={[...THUMB[h]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.24, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.4} color={t.dark ? t.vtext : '#5b3fd6'} />
    </LinearGradient>
  );
}

/** Smooth area sparkline (react-native-svg). `data` needs >= 2 points; width follows the parent via `width`. */
export function Spark({ data, width = 160, height = 48, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  const { t } = useTheme();
  const c = color ?? t.violet;
  if (data.length < 2) return null;
  const lo = Math.min(...data); const hi = Math.max(...data); const span = hi - lo || 1; const pad = 4;
  const pts = data.map((v, i) => [pad + (i * (width - 2 * pad)) / (data.length - 1), pad + (1 - (v - lo) / span) * (height - 2 * pad)] as const);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const mx = (x0 + x1) / 2; d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`; }
  const area = `${d} L${pts[pts.length - 1][0]} ${height} L${pts[0][0]} ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs><SvgGrad id="sp" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c} stopOpacity="0.28" /><Stop offset="1" stopColor={c} stopOpacity="0" /></SvgGrad></Defs>
      <Path d={area} fill="url(#sp)" />
      <Path d={d} fill="none" stroke={c} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Two bars: previous period (soft) vs current (violet), heights relative to the larger one. */
export function MiniBars({ prev, cur }: { prev: number; cur: number }) {
  const { t } = useTheme();
  const m = Math.max(prev, cur, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 34 }}>
      <View style={{ width: 12, height: Math.max(4, (prev / m) * 34), borderRadius: 5, backgroundColor: t.lilac }} />
      <View style={{ width: 12, height: Math.max(4, (cur / m) * 34), borderRadius: 5, backgroundColor: t.violet }} />
    </View>
  );
}

/** Circular progress (0..1) with a centred label. */
export function Ring({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const { t } = useTheme();
  const v = Math.max(0, Math.min(1, value)); const r = (size - 10) / 2; const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Path d={`M${size / 2} 5 a${r} ${r} 0 1 1 0 ${2 * r} a${r} ${r} 0 1 1 0 ${-2 * r}`} fill="none" stroke={t.fill2} strokeWidth={7} />
        <Path d={`M${size / 2} 5 a${r} ${r} 0 1 1 0 ${2 * r} a${r} ${r} 0 1 1 0 ${-2 * r}`} fill="none" stroke={v >= 1 ? t.ok : t.violet} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />
      </Svg>
      <Text style={{ fontFamily: font.x, fontSize: size * 0.24, color: t.ink }}>{label ?? `${Math.round(v * 100)}%`}</Text>
    </View>
  );
}

/** Gradient / photo hero for a screen: icon tile, title, line, optional big stat (Airbnb account-page feel). */
export function HeroCard({ icon, title, sub, stat, statLabel, photo, dark, children }: { icon?: string; title: string; sub?: string; stat?: string; statLabel?: string; photo?: string | null; dark?: boolean; children?: React.ReactNode }) {
  const { t } = useTheme();
  const fg = dark ? '#fff' : t.ink; const mu = dark ? 'rgba(255,255,255,.78)' : t.muted;
  const body = (
    <View style={{ padding: 20, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {photo !== undefined ? <Avatar name={title} size={64} uri={photo} /> : icon ? <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: dark ? 'rgba(255,255,255,.16)' : t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={28} color={dark ? '#fff' : t.vtext} /></View> : null}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: font.x, fontSize: 22, lineHeight: 27, letterSpacing: -0.6, color: fg }}>{title}</Text>
          {sub ? <Text numberOfLines={2} style={{ fontFamily: font.s, fontSize: 14.5, lineHeight: 20, color: mu, marginTop: 2 }}>{sub}</Text> : null}
        </View>
      </View>
      {stat ? <View><Text style={{ fontFamily: font.x, fontSize: 40, lineHeight: 44, letterSpacing: -1.3, color: fg }}>{stat}</Text>{statLabel ? <Text style={{ fontFamily: font.s, fontSize: 14, color: mu }}>{statLabel}</Text> : null}</View> : null}
      {children}
    </View>
  );
  return dark
    ? <LinearGradient colors={['#1d1730', '#35276b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 30 }}>{body}</LinearGradient>
    : <Hero>{body}</Hero>;
}

/** Small number card: label, big value, optional hint pill. */
export function StatCard({ label, value, hint, tone = 'muted', style }: { label: string; value: string; hint?: string; tone?: 'ok' | 'guava' | 'muted'; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const c = tone === 'ok' ? [t.oksoft, t.ok] : tone === 'guava' ? [t.gsoft, t.gink] : [t.fill, t.muted];
  return (
    <View style={[{ flex: 1, backgroundColor: t.surface, borderRadius: 20, padding: 13, gap: 2, ...cardShadow }, style]}>
      <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 12, color: t.muted }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.b, fontSize: 20, letterSpacing: -0.4, color: t.ink }}>{value}</Text>
      {hint ? <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: c[0], justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 13, color: c[1] }}>{hint}</Text></View> : null}
    </View>
  );
}

/** Titled block of grouped content (title 19/800 + children with 12 gap). */
export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: 4, marginTop: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.b, fontSize: 16, letterSpacing: -0.16, color: t.ink }}>{title}</Text>
        {hint ? <Text style={{ fontFamily: font.r, fontSize: 13, lineHeight: 20, color: t.muted, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Sticky bottom primary action (56 px) over a canvas fade; screens add ~110 px bottom padding. */
export function StickyCta({ label, onPress, loading, disabled, secondary }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; secondary?: { label: string; onPress: () => void; danger?: boolean } }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={t.dark ? ['rgba(20,17,29,0)', 'rgba(20,17,29,.96)'] : ['rgba(251,247,242,0)', 'rgba(251,247,242,.96)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: -30 }} />
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(ins.bottom, 18) }}>
        {secondary ? <Btn label={secondary.label} variant={secondary.danger ? 'danger' : 'secondary'} onPress={secondary.onPress} style={{ flex: 1 }} /> : null}
        <Btn label={label} onPress={onPress} loading={loading} disabled={disabled} style={{ flex: secondary ? 1.4 : 1 }} />
      </View>
    </View>
  );
}
