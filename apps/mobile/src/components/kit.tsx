/**
 * v2 primitives, ported from the approved artifact (artifacts/business-mobile-v2, `.ph` styles):
 * calm Instagram density, 20px gutter, 26/700 titles, violet only for primary actions and the active state, guava only for alerts.
 * Older screens keep using components/ui.tsx (restyled to the same tokens); new and rebuilt screens use this kit.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, Image, ImageStyle, ScrollView, StyleProp, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { useSafeAreaInsets } from '@/lib/insets';
import { useApp } from '@/lib/app';
import { initials } from '@/lib/format';
import { photoSource } from '@/lib/photo';
import { useTheme } from '@/theme/ThemeContext';
import { cardShadow, circShadow, ctaShadow, font, radius, storyRing, type } from '@/theme/tokens';

export { type };

/** Text with a v2 type role: <T k="h1">. */
export function T({ k = 'body', color, style, children, lines, ...rest }: { k?: keyof typeof type; color?: string; style?: StyleProp<TextStyle>; children: React.ReactNode; lines?: number; accessibilityRole?: 'header' | 'text' }) {
  const { t } = useTheme();
  return <Text numberOfLines={lines} style={[type[k], { color: color ?? t.ink }, style]} {...rest}>{children}</Text>;
}

/** Page title (h1 26/700) inside the 20px gutter. */
export function Title({ children, sub, style }: { children: React.ReactNode; sub?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <View style={[{ paddingHorizontal: 20 }, style]}>
      <T k="h1" accessibilityRole="header">{children}</T>
      {sub ? <T k="sm" color={t.muted} style={{ marginTop: 2 }}>{sub}</T> : null}
    </View>
  );
}

/** 44px round icon button (`.ib`); `dot` = small guava dot (unread), `circle` = white frosted circle over photos (`.ib.cir`). */
export function IconBtn({ icon, onPress, label, dot, circle, color, badge }: { icon: string; onPress?: () => void; label: string; dot?: boolean; circle?: boolean; color?: string; badge?: number }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} haptic accessibilityRole="button" accessibilityLabel={label} hitSlop={2}
      style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, circle ? { backgroundColor: 'rgba(255,255,255,.86)', ...circShadow } : null]}>
      <Icon name={icon} size={22} color={color ?? (circle ? '#1d1730' : t.ink)} />
      {dot ? <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: t.guava, borderWidth: 2, borderColor: t.canvas, boxSizing: 'content-box' } as ViewStyle} /> : null}
      {badge ? (
        <View style={{ position: 'absolute', top: 4, right: 2, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: t.guava, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.canvas }}>
          <Text style={{ fontFamily: font.b, fontSize: 10, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Tab-level top bar (`.tb`): 22/700 title (optional chevron = switcher), sub line, actions right. */
export function TopBar({ title, onTitle, sub, right, extra }: { title: string; onTitle?: () => void; sub?: string; right?: React.ReactNode; extra?: React.ReactNode }) {
  const { t } = useTheme();
  const { demo } = useApp();
  const ttl = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T k="bar" lines={1} accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</T>
      {onTitle ? <Icon name="chevd" size={16} color={t.muted} /> : null}
      {extra}
      {demo ? <View style={{ marginLeft: 4 }}><DemoPill /></View> : null}
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 14, paddingTop: 8, paddingBottom: 6, minHeight: 52 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {onTitle ? <Pressable onPress={onTitle} accessibilityRole="button" accessibilityLabel={title} noScale style={{ alignSelf: 'flex-start' }}>{ttl}</Pressable> : ttl}
        {sub ? <T k="sm" color={t.muted} style={{ marginTop: 1 }}>{sub}</T> : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: 6 }}>{right}</View> : null}
    </View>
  );
}

/** Pushed-screen bar (`backbar`): chevron + label on the left, actions right. */
export function BackBar({ label, onBack, right }: { label?: string; onBack: () => void; right?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, paddingRight: 14, paddingTop: 8, paddingBottom: 6, minHeight: 52 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={label ?? tr('common.back')} style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 4, paddingRight: 10 }}>
        <Icon name="back" size={22} color={t.ink} />
        {label ? <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{label}</Text> : null}
      </Pressable>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{right}</View> : null}
    </View>
  );
}

/** Section heading (`.sec-h`): h2 left, violet text link right. */
export function SecHead({ title, action, onAction, right, style }: { title: string; action?: string; onAction?: () => void; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 12, marginHorizontal: 20 }, style]}>
      <T k="h2" accessibilityRole="header">{title}</T>
      {action && onAction ? <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button"><Text style={{ fontFamily: font.s, fontSize: 13, color: t.vtext }}>{action}</Text></Pressable> : right}
    </View>
  );
}

/** White card (`.card`): 22 radius, soft two-layer shadow. */
export function Card({ children, style, onPress, label }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const { t } = useTheme();
  const base: ViewStyle = { backgroundColor: t.surface, borderRadius: radius.card, ...cardShadow };
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[base, style]}>{children}</Pressable> : <View style={[base, style]}>{children}</View>;
}

type PillTone = 'fl' | 'v' | 'g' | 'ok' | 'dk' | 'wh';
/** Small status pill (`.pill`): 12/600, 4x9 padding. */
export function Pill({ text, tone = 'fl', icon, style }: { text: string; tone?: PillTone; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const c: Record<PillTone, [string, string]> = { fl: [t.fill, t.ink], v: [t.vsoft, t.vtext], g: [t.gsoft, t.gink], ok: [t.oksoft, t.ok], dk: ['rgba(29,23,48,.55)', '#fff'], wh: ['rgba(255,255,255,.92)', '#1d1730'] };
  const [bg, fg] = c[tone];
  return (
    <View style={[{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12, color: fg }}>{text}</Text>
    </View>
  );
}

type BtnKind = 'pr' | 'dk' | 'ol' | 'wh' | 'fl' | 'ghost' | 'danger';
/** Button (`.btn`): 48 high (lg 52 for the main CTA, sm 36), 15/600. pr = violet (primary only), dk = ink, ol = outline, wh = white, fl = soft fill. */
export function Button({ label, onPress, kind = 'pr', size = 'md', icon, loading, disabled, style, block }: {
  label: string; onPress?: () => void; kind?: BtnKind; size?: 'sm' | 'md' | 'lg'; icon?: string; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; block?: boolean;
}) {
  const { t } = useTheme();
  const h = size === 'sm' ? 36 : size === 'lg' ? 52 : 48;
  const bg = { pr: t.violet, dk: t.dark ? '#f5f2fa' : '#1d1730', ol: 'transparent', wh: '#fff', fl: t.fill, ghost: 'transparent', danger: t.gsoft }[kind];
  const fg = { pr: '#fff', dk: t.dark ? '#1d1730' : '#fff', ol: t.ink, wh: '#1d1730', fl: t.ink, ghost: t.ink, danger: t.gink }[kind];
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} haptic accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[{ minHeight: h, minWidth: 0, borderRadius: h / 2, paddingVertical: 6, paddingHorizontal: size === 'sm' ? 16 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: bg, opacity: off && !loading ? 0.5 : 1 },
        kind === 'pr' ? ctaShadow : null, kind === 'ol' ? { borderWidth: 1.5, borderColor: t.hair } : null, block ? { alignSelf: 'stretch' } : null, style]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: font.s, fontSize: size === 'sm' ? 13.5 : 15, color: fg, flexShrink: 1, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** Filter chip (`.chip`): 36 high, white with hairline; active = ink. Optional muted count. */
export function Chip({ label, on, onPress, count, style }: { label: string; on?: boolean; onPress?: () => void; count?: number | string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const fg = on ? (t.dark ? '#1d1730' : '#fff') : t.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} noScale
      style={[{ height: 36, paddingHorizontal: 15, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? (t.dark ? '#f5f2fa' : '#1d1730') : t.surface, borderWidth: on ? 0 : 1, borderColor: t.hair }, style]}>
      <Text style={{ fontFamily: font.s, fontSize: 13.5, color: fg }}>{label}</Text>
      {count != null ? <Text style={{ fontFamily: font.s, fontSize: 12, color: fg, opacity: 0.6 }}>{count}</Text> : null}
    </Pressable>
  );
}

/** Horizontal chip row with the 20px gutter. */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0, flexShrink: 0 }, style]} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>{children}</ScrollView>;
}

/** Photo with cover fit; `src` is an API path, an http URL, "demo:<key>" or a bundled asset. Shows the soft fill while empty. */
export function Photo({ src, style, children, label }: { src?: string | number | null; style?: StyleProp<ImageStyle>; children?: React.ReactNode; label?: string }) {
  const { t } = useTheme();
  const s = photoSource(src);
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: t.fill }, style as StyleProp<ViewStyle>]} accessible={!!label} accessibilityLabel={label} accessibilityRole={label ? 'image' : undefined}>
      {s ? <Image source={s} resizeMode="cover" accessibilityIgnoresInvertColors style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} /> : null}
      {children}
    </View>
  );
}

/** Round avatar: photo or initials on soft violet. `ring` = story gradient ring (unseen), `seen` = beige ring. */
export function Avatar({ uri, name = '', size = 44, ring, seen, border }: { uri?: string | number | null; name?: string; size?: number; ring?: boolean; seen?: boolean; border?: string }) {
  const { t } = useTheme();
  const [failed, setFailed] = React.useState(false);
  const s = failed ? null : photoSource(uri);
  const pad = ring || seen ? 2.5 : 0; const gap = ring || seen ? 3 : 0;
  const inner = size - 2 * pad - 2 * gap;
  const face = (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}>
      {s ? <Image source={s} accessibilityIgnoresInvertColors onError={() => setFailed(true)} style={{ width: inner, height: inner }} /> : <Text style={{ fontFamily: font.b, fontSize: Math.round(inner * 0.36), color: t.vtext }}>{initials(name)}</Text>}
    </View>
  );
  if (!ring && !seen) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center', borderWidth: border ? 1.5 : 0, borderColor: border }}>
        {s ? <Image source={s} accessibilityIgnoresInvertColors onError={() => setFailed(true)} style={{ width: size, height: size }} /> : <Text style={{ fontFamily: font.b, fontSize: Math.round(size * 0.36), color: t.vtext }}>{initials(name)}</Text>}
      </View>
    );
  }
  const wrap = <View style={{ width: size - 2 * pad, height: size - 2 * pad, borderRadius: size / 2, backgroundColor: t.canvas, alignItems: 'center', justifyContent: 'center' }}>{face}</View>;
  return seen
    ? <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.dark ? '#3a3448' : '#ddd6cc', alignItems: 'center', justifyContent: 'center' }}>{wrap}</View>
    : <LinearGradient colors={[...storyRing]} start={{ x: 0.1, y: 0.9 }} end={{ x: 0.9, y: 0.1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>{wrap}</LinearGradient>;
}

/** Story bubble (`.story`): 66 ring + 11.5 name. `add` shows the violet plus badge (own story not posted yet). */
export function StoryBubble({ uri, name, label, seen, add, onPress, size = 66 }: { uri?: string | number | null; name?: string; label: string; seen?: boolean; add?: boolean; onPress?: () => void; size?: number }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: size, alignItems: 'center' }}>
      <View>
        {add ? <Avatar uri={uri} name={name} size={size} /> : <Avatar uri={uri} name={name} size={size} ring={!seen} seen={seen} />}
        {add ? (
          <View style={{ position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: t.violet, borderWidth: 2.5, borderColor: t.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={12} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 11.5, color: t.ink, marginTop: 5, maxWidth: size + 6 }}>{label}</Text>
    </Pressable>
  );
}

/** Hairline list row (`.li`): leading node, 15/600 title, 13 muted line, right meta. */
export function ListItem({ lead, title, sub, right, onPress, first, label }: { lead?: React.ReactNode; title: string; sub?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; first?: boolean; label?: string }) {
  const { t } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: t.hair }}>
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T k="t1" lines={1}>{title}</T>
        {sub != null ? (typeof sub === 'string' ? <T k="t2" color={t.muted} lines={1}>{sub}</T> : sub) : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label ?? title} noScale>{body}</Pressable> : body;
}

/** Key/value row with a soft icon tile (`.kv`), used in booking detail and confirm cards. */
export function KV({ icon, label, value, first, right, lead }: { icon?: string; label: string; value: string; first?: boolean; right?: React.ReactNode; lead?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: t.hair }}>
      {lead ?? <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon ?? 'info'} size={19} color={t.ink} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T k="xs" color={t.ink3}>{label}</T>
        <Text numberOfLines={2} style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{value}</Text>
      </View>
      {right}
    </View>
  );
}

/** Small area sparkline (`spark()`): 10% fill, 1.8 stroke, end dot. Stretches to the given width. */
export function Spark({ data, width, height = 26, color }: { data: number[]; width: number; height?: number; color?: string }) {
  const { t } = useTheme();
  const c = color ?? t.violet;
  if (data.length < 2 || width <= 0) return <View style={{ height }} />;
  const mx = Math.max(...data); const mn = Math.min(...data);
  const pts = data.map((y, i) => [i * (width / (data.length - 1)), height - 3 - ((y - mn) / (mx - mn || 1)) * (height - 6)] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={`${d}L${width} ${height}L0 ${height}Z`} fill={c} fillOpacity={0.1} />
      <Path d={d} fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={Math.min(last[0], width - 2.6)} cy={last[1]} r={2.6} fill={c} />
    </Svg>
  );
}

/** Load ring (`ring()`): 0..1 progress around an avatar. */
export function LoadRing({ value, size = 56, children, color }: { value: number; size?: number; children?: React.ReactNode; color?: string }) {
  const { t } = useTheme();
  const r = (size / 84) * 38; const c = 2 * Math.PI * r; const sw = Math.max(3, (size / 84) * 4);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.track} strokeWidth={sw} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? t.violet} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(c * Math.max(0, Math.min(1, value))).toFixed(1)} ${c.toFixed(1)}`} />
      </Svg>
      {children}
    </View>
  );
}

/** Segmented control (`.segc`): soft fill track, white raised active. */
export function Segmented<K extends string>({ items, value, onChange, style }: { items: { k: K; label: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: t.fill, borderRadius: 14, padding: 3, gap: 2 }, style]}>
      {items.map((it) => {
        const on = it.k === value;
        return (
          <Pressable key={it.k} onPress={() => onChange(it.k)} noScale accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ flex: 1, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: on ? t.surface : 'transparent', ...(on ? { boxShadow: '0 1px 3px rgba(29,23,48,.12)' } : null) } as ViewStyle}>
            <Text style={{ fontFamily: font.s, fontSize: 13.5, color: on ? t.ink : t.muted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Text field (`.field`): 54 high, 16 radius, hairline, leading icon, optional right node. */
export const Field = React.forwardRef<TextInput, TextInputProps & { icon?: string; right?: React.ReactNode; boxStyle?: StyleProp<ViewStyle> }>(function Field({ icon, right, boxStyle, style, onFocus, onBlur, ...rest }, ref) {
  const { t } = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={[{ height: 54, borderRadius: 16, backgroundColor: t.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, borderWidth: focus ? 1.5 : 1, borderColor: focus ? t.violet : t.hair }, boxStyle]}>
      {icon ? <Icon name={icon} size={19} color={t.muted} /> : null}
      <TextInput ref={ref} placeholderTextColor={t.ink3} onFocus={(e) => { setFocus(true); onFocus?.(e); }} onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        style={[{ flex: 1, height: 52, fontFamily: font.m, fontSize: 15, color: t.ink, outlineStyle: 'none' } as unknown as TextStyle, style]} {...rest} />
      {right}
    </View>
  );
});

/** Toggle (`.tog`): 46x28. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => onChange(!on)} haptic noScale accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} hitSlop={8}
      style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? t.violet : t.dark ? '#3a3448' : '#e4ddd3', justifyContent: 'center' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', marginLeft: on ? 21 : 3, boxShadow: '0 1px 3px rgba(0,0,0,.2)' } as ViewStyle} />
    </Pressable>
  );
}

/** Bottom action bar (`.ctabar`): canvas fade, 20 gutter, sits above the home indicator. Screens add ~120 bottom padding. */
export function CtaBar({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={t.dark ? ['rgba(20,17,29,0)', t.canvas, t.canvas] : ['rgba(251,247,242,0)', t.canvas, t.canvas]} locations={[0, 0.3, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(ins.bottom + 8, 22) }}>{children}</View>
    </View>
  );
}

/** Empty state (`.empty`): photo with a white wash, 19/700 title, one line, one primary action (+ optional quiet one). */
export function EmptyState({ photo, title, body, action, secondary, artHeight = 210, style }: {
  photo?: string | number | null; title: string; body?: string; action?: { label: string; icon?: string; onPress: () => void }; secondary?: { label: string; icon?: string; onPress: () => void }; artHeight?: number; style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={[{ marginHorizontal: 20, marginTop: 20, borderRadius: 28, overflow: 'hidden', backgroundColor: t.surface, ...cardShadow }, style]}>
      {photo ? (
        <Photo src={photo} style={{ height: artHeight }}>
          <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', t.surface]} locations={[0.4, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        </Photo>
      ) : <View style={{ height: 20 }} />}
      <View style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 22, alignItems: 'center' }}>
        <Text style={{ fontFamily: font.b, fontSize: 19, letterSpacing: -0.38, color: t.ink, textAlign: 'center' }}>{title}</Text>
        {body ? <T k="body" color={t.muted} style={{ textAlign: 'center', marginTop: 6 }}>{body}</T> : null}
        {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} block style={{ marginTop: 16 }} /> : null}
        {secondary ? <Button label={secondary.label} icon={secondary.icon} onPress={secondary.onPress} kind="ghost" block style={{ marginTop: 8 }} /> : null}
      </View>
    </View>
  );
}

function Pulse({ style }: { style: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const k = useSharedValue(0.55);
  useEffect(() => { k.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [k]);
  const a = useAnimatedStyle(() => ({ opacity: k.value }));
  return <Animated.View style={[{ backgroundColor: t.fill, borderRadius: 20 }, style, a]} />;
}
/** Skeleton blocks shaped like the screen they stand in for. */
export function Skeleton({ blocks = [{ h: 236 }, { h: 90 }, { h: 60 }] }: { blocks?: { h: number; w?: number | `${number}%`; r?: number }[] }) {
  return (
    <View accessible accessibilityLabel={tr('common.loading')} accessibilityState={{ busy: true }} style={{ paddingHorizontal: 20, gap: 12, marginTop: 12 }}>
      {blocks.map((b, i) => <Pulse key={i} style={{ height: b.h, width: b.w ?? '100%', borderRadius: b.r ?? 22 }} />)}
    </View>
  );
}

/** DEMO pill shown in the header while the demo salon is open. */
export function DemoPill() {
  return (
    <View accessibilityLabel={tr('v2.demoPill')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#1d1730' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#7fd8a4' }} />
      <Text style={{ fontFamily: font.b, fontSize: 11, letterSpacing: 0.44, color: '#fff' }}>DEMO</Text>
    </View>
  );
}

/** Tile (`.tile`) for the "Yarat" sheet: icon in a soft violet square, title, line. */
export function Tile({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={{ flex: 1, borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.hair, padding: 16, gap: 22 }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={t.vtext} /></View>
      <View><T k="h3">{title}</T><T k="sm" color={t.muted}>{sub}</T></View>
    </Pressable>
  );
}

/** Underline tabs (`.utabs`): icon + label, ink underline on the active one. */
export function UnderTabs<K extends string>({ items, value, onChange }: { items: { k: K; label: string; icon?: string }[]; value: K; onChange: (k: K) => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.hair, marginHorizontal: 20 }}>
      {items.map((it) => {
        const on = it.k === value;
        return (
          <Pressable key={it.k} onPress={() => onChange(it.k)} noScale accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderBottomWidth: 2, borderBottomColor: on ? t.ink : 'transparent', marginBottom: -1 }}>
            {it.icon ? <Icon name={it.icon} size={19} color={on ? t.ink : t.ink3} /> : null}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: font.s, fontSize: 14, color: on ? t.ink : t.ink3, flexShrink: 1 }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Five stars; filled in the star amber. */
export function Stars({ n, size = 16 }: { n: number; size?: number }) {
  const { t } = useTheme();
  return <View accessibilityLabel={`${n}/5`} style={{ flexDirection: 'row', gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} color={i <= Math.round(n) ? t.star : t.faint} filled={i <= Math.round(n)} />)}</View>;
};

/** Delta pill (`+12%`): green soft for up, guava soft for down, grey for flat. */
export function Delta({ v, suffix = '%' }: { v: number; suffix?: string }) {
  const { t } = useTheme();
  const up = v > 0; const dn = v < 0;
  return (
    <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: up ? t.oksoft : dn ? t.gsoft : t.fill, justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.b, fontSize: 12, color: up ? t.ok : dn ? t.gink : t.muted }}>{up ? '+' : ''}{v}{suffix}</Text>
    </View>
  );
}

/** Horizontal share bar row: label, violet bar over a track, value. */
export function BarRow({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 }}>
      <T k="body" lines={1} style={{ width: 92 }}>{label}</T>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.track, overflow: 'hidden' }}><View style={{ width: `${Math.max(3, Math.min(100, ratio * 100))}%`, height: 8, borderRadius: 4, backgroundColor: t.violet }} /></View>
      <Text style={{ fontFamily: font.b, fontSize: 13.5, color: t.ink, minWidth: 64, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

/** Photo-led row (`.svc`): rounded square photo, title, chips line, right meta. */
export function PhotoRow({ photo, title, chips, right, onPress, first }: { photo?: string | number | null; title: string; chips?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; first?: boolean }) {
  const { t } = useTheme();
  const main = (
    <>
      <Photo src={photo} style={{ width: 70, height: 70, borderRadius: 18 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <T k="h3" lines={2}>{title}</T>
        {chips ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{chips}</View> : null}
      </View>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginHorizontal: 20, borderTopWidth: first ? 0 : 1, borderTopColor: t.hair }}>
      {onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} noScale style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 0 }}>{main}</Pressable> : <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 0 }}>{main}</View>}
      {right}
    </View>
  );
}
