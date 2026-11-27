import React, { useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr, type StringKey } from '@/i18n';
import type { Appointment, ClientWithStats, Staff, TimeOff } from '@/lib/api';
import { recallClient } from '@/lib/client-cache';
import { useDockInset } from '@/lib/dock';
import { addDays, fromMin, hhmm, sameDay, startOfWeek, toMin, weekdayShort } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { ctaShadow, font } from '@/theme/tokens';
import { salonNow } from '@/lib/salonClock';

/** Mobile BF02 numbers: hour label column 48 + line from x=58, 144-wide master columns 6 apart, 92 px per hour (`.lt`, `.lt-h`, `.lt-l`). */
const GUTTER = 58;
const COL_GAP = 6;
const HOUR_PX = 100;

// Tile palette of the design (.t1-.t4 on --c1..--c4), light and dark.
const TILE_L: [string, string][] = [['#ece6ff', '#3b2a96'], ['#ffe4ea', '#a02244'], ['#fbecd6', '#7a4a00'], ['#e2f1e9', '#0d5a3b']];
const TILE_D: [string, string][] = [['#272040', '#cfc4ff'], ['#3a2130', '#ffb0c1'], ['#342a1d', '#f0c27a'], ['#1b3028', '#9be0b9']];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export type Marker = { key: string; icon: string; label: StringKey };
/** Small tile icon markers (design `.ni`): booking fields plus client stats from the client list (VIP / new / returning). */
export function markersOf(a: Appointment): Marker[] {
  const out: Marker[] = [];
  const online = (a.bookingSource ?? '').toLowerCase().startsWith('web');
  const c = a.clientId != null ? recallClient(String(a.clientId)) as ClientWithStats | undefined : undefined;
  if (c?.vip) out.push({ key: 'vip', icon: 'crown', label: 'marker.vip' });
  else if (c) { const v = c.pastVisits ?? c.totalVisits ?? 0; out.push(v === 0 ? { key: 'new', icon: 'user-plus', label: 'marker.isNew' } : { key: 'ret', icon: 'user-check', label: 'marker.returning' }); }
  if (online) out.push({ key: 'online', icon: 'globe', label: 'marker.online' });
  if (online && a.staffAutoAssigned === false) out.push({ key: 'chosen', icon: 'user-check', label: 'marker.chosen' });
  if (a.guestName) out.push({ key: 'group', icon: 'users', label: 'marker.group' });
  if (a.notes?.trim() || a.clientAlert) out.push({ key: 'note', icon: 'note', label: 'marker.note' });
  if (a.paymentStatus === 'PAID' || a.depositPaid) out.push({ key: 'paid', icon: 'check-badge', label: 'marker.paid' });
  return out;
}

/** Overlapping bookings of one master sit side by side. */
export function lanes(list: Appointment[]) {
  const sorted = [...list].sort((a, b) => toMin(a.startTime) - toMin(b.startTime) || toMin(a.endTime) - toMin(b.endTime));
  const out = new Map<string, { lane: number; n: number }>();
  let cluster: Appointment[] = [];
  let end = -1;
  const flush = () => {
    const ends: number[] = [];
    const asg: [Appointment, number][] = [];
    for (const a of cluster) {
      let l = ends.findIndex((e) => e <= toMin(a.startTime));
      if (l < 0) { l = ends.length; ends.push(0); }
      ends[l] = toMin(a.endTime);
      asg.push([a, l]);
    }
    for (const [a, l] of asg) out.set(a.id, { lane: l, n: ends.length });
    cluster = [];
  };
  for (const a of sorted) {
    if (cluster.length && toMin(a.startTime) >= end) flush();
    end = cluster.length ? Math.max(end, toMin(a.endTime)) : toMin(a.endTime);
    cluster.push(a);
  }
  if (cluster.length) flush();
  return out;
}

/** Date strip `.dstrip`: 7 equal cells (gap 6, 64 tall, radius 20, weekday 14/600, day 19/800); the selected day is a violet pill with the CTA shadow. */
export function DayStrip({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const { t } = useTheme();
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((d) => {
        const sel = sameDay(d, date);
        return (
          <Pressable key={d.toISOString()} onPress={() => onChange(d)} accessibilityRole="button" accessibilityState={{ selected: sel }}
            style={[{ flex: 1, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: sel ? t.violet : 'transparent' }, sel ? ctaShadow : null]}>
            <Text style={{ fontFamily: font.s, fontSize: 14, color: sel ? 'rgba(255,255,255,.85)' : t.muted }}>{weekdayShort(d)}</Text>
            <Text style={{ fontFamily: font.x, fontSize: 20, color: sel ? '#fff' : t.ink }}>{d.getDate()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Status stripe colour of a tile (`.s-ok` / `.s-w` / `.s-v`). */
const stripe = (s: Appointment['status'], violet: string, ok: string) => (s === 'CONFIRMED' ? ok : s === 'PENDING' ? '#d99a1e' : s === 'COMPLETED' ? violet : null);

/** `.tile`: radius 14, padding 7/10/6/17, 5 px status stripe on the left, name 15/800, line 14/600 at .82, icon markers bottom; short tiles use the one-line `.cp` form. */
function Tile({ a, top, height, left, width, onOpen }: { a: Appointment; top: number; height: number; left: number; width: number; onOpen: (a: Appointment) => void }) {
  const { t } = useTheme();
  const [bg, fg] = (t.dark ? TILE_D : TILE_L)[hash(String(a.serviceId ?? a.serviceName)) % 4];
  const markers = markersOf(a);
  const narrow = width < 128;
  const cp = height < 70;
  const noShow = a.status === 'NO_SHOW';
  const bar = stripe(a.status, t.violet, t.ok);
  const mk = markers.slice(0, narrow ? 2 : 3).map((m) => <Icon key={m.key} name={m.icon} size={16} color={m.key === 'late' ? t.guava : fg} />);
  return (
    <Pressable onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''} ${a.serviceName ?? ''}`} noScale
      style={{ position: 'absolute', top, height, left, width, borderRadius: 14, backgroundColor: noShow ? t.gsoft : bg, overflow: 'hidden', opacity: a.status === 'COMPLETED' ? 0.75 : 1,
        paddingTop: cp ? 0 : 7, paddingBottom: cp ? 0 : 6, paddingRight: cp ? 9 : 10, paddingLeft: cp ? 15 : 17, flexDirection: cp ? 'row' : 'column', alignItems: cp ? 'center' : 'stretch', gap: cp ? 8 : 1 }}>
      {bar ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: bar }} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: cp ? 14.5 : 15, lineHeight: 19, letterSpacing: -0.15, color: noShow ? t.gink : fg, textDecorationLine: noShow ? 'line-through' : 'none', flexShrink: 1, minWidth: 48 }}>{narrow ? (a.clientName || '-').split(' ')[0] : a.clientName || '-'}</Text>
      {narrow && cp ? null : <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14, lineHeight: 18, color: fg, opacity: cp ? 0.75 : 0.82, flexShrink: cp ? 1 : 0 }}>{cp ? hhmm(a.startTime) : narrow ? hhmm(a.startTime) : `${a.serviceName ?? ''} · ${hhmm(a.startTime)}`}</Text>}
      {mk.length && !(narrow && cp) ? <View style={{ flexDirection: 'row', gap: 7, ...(cp ? { marginLeft: 'auto' } : { marginTop: 'auto', paddingTop: 2 }) }}>{mk}</View> : null}
    </Pressable>
  );
}

/** Day timeline `.lt` (BF02 390): sticky master header (`.colh`: ring avatar 36 + name 16/800), hour labels in a 48 px gutter, lines from x=58, now line with the guava dot and time pill. */
export function Timeline({ date, masters, appts, blocks = [], startHour, endHour, refreshing, onRefresh, onOpen, onBlock, onPickMaster, hourPx = HOUR_PX }: {
  date: Date; masters: Staff[]; appts: Appointment[]; blocks?: TimeOff[]; startHour: number; endHour: number;
  refreshing: boolean; onRefresh: () => void; onOpen: (a: Appointment) => void; onBlock?: (b: TimeOff) => void; onPickMaster?: (m: Staff) => void; hourPx?: number;
}) {
  const { t } = useTheme();
  const { width } = useWindowDimensions();
  const inset = useDockInset(24);
  const head = useRef<ScrollView>(null);
  const body = useRef<ScrollView>(null);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const total = hours.length * hourPx;
  const colW = Math.floor((width - 32 - GUTTER - COL_GAP) / 2);
  const placed = useMemo(() => masters.map((m) => {
    const mine = appts.filter((a) => a.status !== 'CANCELLED' && (String(a.staffId) === String(m.id) || (m.id === '__none' && !masters.some((x) => String(x.id) === String(a.staffId)))));
    return { m, mine, lane: lanes(mine) };
  }), [masters, appts]);
  const now = salonNow();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = sameDay(date, now) && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const nowTop = ((nowMin - startHour * 60) / 60) * hourPx;
  const contentW = masters.length * (colW + COL_GAP);
  // today opens about an hour above "now"; other days at the first booking
  const first = appts.length ? Math.min(...appts.map((a) => toMin(a.startTime))) : startHour * 60;
  const target = Math.max(0, (((showNow ? nowMin - 60 : first - 30) - startHour * 60) / 60) * hourPx);
  const done = useRef('');
  const key = `${date.toDateString()}|${appts.length}`;
  const settle = () => { if (done.current !== key) { done.current = key; body.current?.scrollTo({ y: target, animated: false }); } };

  return (
    <ScrollView ref={body} onContentSizeChange={settle} stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: inset }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.violet} />}>
      <View style={{ flexDirection: 'row', backgroundColor: t.canvas, height: 60, paddingLeft: 16 }}>
        <View style={{ width: GUTTER }} />
        <ScrollView ref={head} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          {masters.map((m) => (
            <Pressable key={m.id} onPress={() => onPickMaster?.(m)} disabled={!onPickMaster || m.id === '__none'} accessibilityRole="button" accessibilityLabel={m.name} noScale style={{ width: colW, marginRight: COL_GAP, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.name} size={40} uri={m.avatarUrl} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.x, fontSize: 16, color: t.ink }}>{m.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ flexDirection: 'row', paddingLeft: 16, paddingTop: 10 }}>
        <View style={{ width: GUTTER, height: total }}>
          {hours.map((h, i) => (
            <Text key={h} style={{ position: 'absolute', top: i * hourPx - 10, left: 0, width: 48, textAlign: 'right', fontFamily: font.s, fontSize: 14, color: t.ink3 }}>{h}:00</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={(e) => head.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })}>
          <View style={{ width: Math.max(contentW, width - 32 - GUTTER), height: total }}>
            {hours.map((h, i) => <View key={h} style={{ position: 'absolute', top: i * hourPx, left: 0, right: 0, height: 1, backgroundColor: t.line }} />)}
            {placed.map(({ m, mine, lane }, ci) => mine.map((a) => {
              const l = lane.get(a.id) ?? { lane: 0, n: 1 };
              const w = colW / l.n;
              const top = ((toMin(a.startTime) - startHour * 60) / 60) * hourPx + 1;
              const h = Math.max(40, ((toMin(a.endTime) - toMin(a.startTime)) / 60) * hourPx - 3);
              return <Tile key={`${m.id}-${a.id}`} a={a} top={top} height={h} left={ci * (colW + COL_GAP) + l.lane * w} width={w - (l.n > 1 ? 2 : 0)} onOpen={onOpen} />;
            }))}
            {masters.map((m, ci) => blocks.filter((b) => String(b.staffId) === String(m.id)).map((b) => {
              const from = b.isFullDay || !b.startTime ? startHour * 60 : Math.max(startHour * 60, toMin(b.startTime));
              const to = b.isFullDay || !b.endTime ? endHour * 60 : Math.min(endHour * 60, toMin(b.endTime));
              if (to <= from) return null;
              return (
                <Pressable key={`blk-${b.id}`} noScale onPress={() => onBlock?.(b)} accessibilityRole="button" accessibilityLabel={`${tr('block.title')} ${hhmm(fromMin(from))}-${hhmm(fromMin(to))} ${b.reason ?? ''}`}
                  style={{ position: 'absolute', top: ((from - startHour * 60) / 60) * hourPx + 1, height: ((to - from) / 60) * hourPx - 3, left: ci * (colW + COL_GAP), width: colW, borderRadius: 14, backgroundColor: t.fill2, borderWidth: 1, borderStyle: 'dashed', borderColor: t.ink3, padding: 8, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="lock" size={15} color={t.muted} />
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.b, fontSize: 13.5, color: t.muted }}>{b.reason || tr('block.title')}</Text>
                  </View>
                </Pressable>
              );
            }))}
            {showNow ? (
              <View pointerEvents="none" style={{ position: 'absolute', top: nowTop - 1, left: -10, right: 0, height: 2.5, backgroundColor: t.guava }}>
                <View style={{ position: 'absolute', left: -1, top: -5.25, width: 13, height: 13, borderRadius: 7, backgroundColor: t.guava, borderWidth: 4, borderColor: 'rgba(232,62,99,.2)', boxSizing: 'content-box', marginLeft: -4, marginTop: -4 } as any} />
              </View>
            ) : null}
          </View>
        </ScrollView>
        {showNow ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, top: 10 + nowTop - 13, backgroundColor: t.guava, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontFamily: font.x, fontSize: 14, color: '#fff' }}>{hhmm(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}


/** Single-master day (BF40 "Yığcam"): time column on the left, one full-width tile per booking, "now" marker, breathing room between plates. */
export function Agenda({ date, appts, blocks = [], refreshing, onRefresh, onOpen, onBlock, empty, compact }: {
  date: Date; appts: Appointment[]; blocks?: TimeOff[]; refreshing: boolean; onRefresh: () => void; onOpen: (a: Appointment) => void; onBlock?: (b: TimeOff) => void; empty?: React.ReactNode; compact?: boolean;
}) {
  const { t } = useTheme();
  const inset = useDockInset(24);
  const list = useMemo(() => [...appts].filter((a) => a.status !== 'CANCELLED').sort((a, b) => toMin(a.startTime) - toMin(b.startTime)), [appts]);
  const now = salonNow(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = sameDay(date, now);
  const nextIdx = isToday ? list.findIndex((a) => toMin(a.endTime) > nowMin) : -1;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: inset, gap: compact ? 8 : 14 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.violet} />}>
      {list.length === 0 && blocks.length === 0 ? empty : null}
      {list.map((a, i) => {
        const [bg, fg] = (t.dark ? TILE_D : TILE_L)[hash(String(a.serviceId ?? a.serviceName)) % 4];
        const noShow = a.status === 'NO_SHOW';
        const bar = stripe(a.status, t.violet, t.ok);
        const mk = markersOf(a).slice(0, 4);
        return (
          <View key={a.id}>
            {i === nextIdx ? (
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ backgroundColor: t.guava, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ fontFamily: font.x, fontSize: 13, color: '#fff' }}>{hhmm(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}</Text></View>
                <View style={{ flex: 1, height: 2, backgroundColor: t.guava, opacity: 0.8 }} />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ width: 52, paddingTop: 16 }}>
                <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{hhmm(a.startTime)}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13, color: t.ink3, marginTop: 1 }}>{Math.max(5, toMin(a.endTime) - toMin(a.startTime))} {tr('common.min')}</Text>
              </View>
              <Pressable onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''} ${a.serviceName ?? ''}`} noScale
                style={{ flex: 1, minHeight: compact ? 60 : 92, borderRadius: 22, backgroundColor: noShow ? t.gsoft : bg, overflow: 'hidden', paddingVertical: compact ? 10 : 16, paddingRight: 16, paddingLeft: 22, opacity: a.status === 'COMPLETED' ? 0.78 : 1, boxShadow: '0 8px 20px -14px rgba(29,23,48,.35)' } as any}>
                {bar ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: bar }} /> : null}
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17.5, letterSpacing: -0.3, color: noShow ? t.gink : fg, textDecorationLine: noShow ? 'line-through' : 'none' }}>{a.clientName || '-'}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 15, color: fg, opacity: 0.85, marginTop: 2 }}>{a.serviceName ?? ''} · {hhmm(a.startTime)} – {hhmm(a.endTime)}</Text>
                {mk.length && !compact ? <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>{mk.map((m) => <Icon key={m.key} name={m.icon} size={18} color={m.key === 'late' ? t.guava : fg} />)}</View> : null}
              </Pressable>
            </View>
          </View>
        );
      })}
      {blocks.map((b) => (
        <Pressable key={`b-${b.id}`} onPress={() => onBlock?.(b)} noScale accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: t.ink3, paddingHorizontal: 16, marginLeft: 66, backgroundColor: t.fill }}>
          <Icon name="lock" size={18} color={t.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.b, fontSize: 15, color: t.muted }}>{b.reason || tr('block.title')}{b.startTime ? ` · ${hhmm(b.startTime)} – ${hhmm(b.endTime)}` : ''}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const W_GUTTER = 34;
const W_HOUR = 48;

/** Həftə: seven day columns on one shared hour scale (staff filter applied by the caller); tapping a header opens that day, a tile opens the booking. */
export function WeekView({ date, appts, startHour, endHour, refreshing, onRefresh, onOpen, onPickDay }: {
  date: Date; appts: Appointment[]; startHour: number; endHour: number;
  refreshing: boolean; onRefresh: () => void; onOpen: (a: Appointment) => void; onPickDay: (d: Date) => void;
}) {
  const { t } = useTheme();
  const { width } = useWindowDimensions();
  const inset = useDockInset(24);
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const colW = (width - 32 - W_GUTTER) / 7;
  const total = hours.length * W_HOUR;
  const today = new Date();
  return (
    <ScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: inset }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.violet} />}>
      <View style={{ flexDirection: 'row', paddingLeft: 16 + W_GUTTER, paddingRight: 16, backgroundColor: t.canvas, height: 52 }}>
        {days.map((d) => {
          const sel = sameDay(d, date);
          const isToday = sameDay(d, today);
          return (
            <Pressable key={d.toISOString()} onPress={() => onPickDay(d)} accessibilityRole="button" accessibilityLabel={`${weekdayShort(d)} ${d.getDate()}`} style={{ width: colW, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.s, fontSize: 12, color: t.muted, textTransform: 'capitalize' }}>{weekdayShort(d).replace('.', '').slice(0, 3)}</Text>
              <View style={{ marginTop: 2, minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? t.violet : isToday ? t.vsoft : 'transparent' }}>
                <Text style={{ fontFamily: font.x, fontSize: 14.5, color: sel ? '#fff' : isToday ? t.vtext : t.ink }}>{d.getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', paddingLeft: 16, paddingRight: 16, paddingTop: 8 }}>
        <View style={{ width: W_GUTTER, height: total }}>
          {hours.map((h, i) => <Text key={h} style={{ position: 'absolute', top: i * W_HOUR - 8, left: 0, fontFamily: font.s, fontSize: 11.5, color: t.ink3 }}>{h}:00</Text>)}
        </View>
        <View style={{ flex: 1, height: total }}>
          {hours.map((h, i) => <View key={h} style={{ position: 'absolute', top: i * W_HOUR, left: 0, right: 0, height: 1, backgroundColor: t.line }} />)}
          {days.map((d, di) => {
            const mine = appts.filter((a) => a.status !== 'CANCELLED' && a.appointmentDate.slice(0, 10) === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            const lane = lanes(mine);
            return mine.map((a) => {
              const l = lane.get(a.id) ?? { lane: 0, n: 1 };
              const w = (colW - 2) / l.n;
              const [bg, fg] = (t.dark ? TILE_D : TILE_L)[hash(String(a.serviceId ?? a.serviceName)) % 4];
              const top = ((toMin(a.startTime) - startHour * 60) / 60) * W_HOUR + 1;
              const h = Math.max(22, ((toMin(a.endTime) - toMin(a.startTime)) / 60) * W_HOUR - 2);
              const bar = stripe(a.status, t.violet, t.ok);
              return (
                <Pressable key={a.id} noScale onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''} ${a.serviceName ?? ''}`}
                  style={{ position: 'absolute', top, height: h, left: di * colW + l.lane * w + 1, width: w - 1, borderRadius: 8, backgroundColor: a.status === 'NO_SHOW' ? t.gsoft : bg, overflow: 'hidden', paddingLeft: 5, paddingTop: 2, opacity: a.status === 'COMPLETED' ? 0.75 : 1 }}>
                  {bar ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: bar }} /> : null}
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 10.5, color: fg }}>{(a.clientName ?? '-').split(' ')[0]}</Text>
                  {h > 34 ? <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 10, color: fg, opacity: 0.8 }}>{hhmm(a.startTime)}</Text> : null}
                </Pressable>
              );
            });
          })}
        </View>
      </View>
    </ScrollView>
  );
}


/** Instagram-style rail: "Komanda" + one gradient-ringed photo per specialist; the picked one gets an ink ring. */
export function StaffRail({ masters, focus, onPick }: { masters: Staff[]; focus: string | null; onPick: (id: string | null) => void }) {
  const { t } = useTheme();
  const item = (key: string | null, label: string, body: React.ReactNode) => {
    const on = focus === key;
    return (
      <Pressable key={String(key)} onPress={() => onPick(key)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ width: 72, alignItems: 'center', gap: 6 }}>
        <View style={{ width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: on ? t.ink : 'transparent' }}>{body}</View>
        <Text numberOfLines={1} style={{ fontFamily: on ? font.x : font.s, fontSize: 13.5, color: on ? t.ink : t.muted, maxWidth: 72 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
      {item(null, tr('calendar.allTeam'), <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={26} color={t.vtext} /></View>)}
      {masters.map((m) => item(String(m.id), m.name, <Avatar name={m.name} size={58} uri={m.avatarUrl} />))}
    </ScrollView>
  );
}

/** Ay: month grid with a count pill per day; tapping a day opens it. */
export function MonthView({ date, appts, onPickDay, refreshing, onRefresh }: { date: Date; appts: Appointment[]; onPickDay: (d: Date) => void; refreshing: boolean; onRefresh: () => void }) {
  const { t } = useTheme();
  const inset = useDockInset(24);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i)).filter((d, i) => i < 35 || d.getMonth() === date.getMonth());
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const a of appts) if (a.status !== 'CANCELLED') m.set(a.appointmentDate.slice(0, 10), (m.get(a.appointmentDate.slice(0, 10)) ?? 0) + 1); return m; }, [appts]);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const byDay = useMemo(() => { const m = new Map<string, string[]>(); for (const a of appts) { if (a.status === 'CANCELLED') continue; const k = a.appointmentDate.slice(0, 10); const c = a.status === 'PENDING' ? '#d99a1e' : a.status === 'COMPLETED' ? t.ok : a.status === 'NO_SHOW' ? t.guava : t.violet; m.set(k, [...(m.get(k) ?? []), c]); } return m; }, [appts, t]);
  const today = new Date();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: inset }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.violet} />}>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {cells.slice(0, 7).map((d) => <Text key={d.getDay()} style={{ flex: 1, textAlign: 'center', fontFamily: font.s, fontSize: 14, color: t.muted }}>{weekdayShort(d)}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: t.surface, borderRadius: 26, padding: 6 }}>
        {cells.map((d) => {
          const n = counts.get(key(d)) ?? 0; const sel = sameDay(d, date); const isToday = sameDay(d, today); const other = d.getMonth() !== date.getMonth();
          return (
            <Pressable key={d.toISOString()} onPress={() => onPickDay(d)} accessibilityRole="button" accessibilityLabel={`${d.getDate()} ${n}`} noScale style={{ width: `${100 / 7}%`, height: 64, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? t.violet : isToday ? t.vsoft : 'transparent' }}>
                <Text style={{ fontFamily: font.x, fontSize: 16, color: sel ? '#fff' : other ? t.ink3 : isToday ? t.vtext : t.ink }}>{d.getDate()}</Text>
              </View>
              {n ? <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>{(byDay.get(key(d)) ?? []).slice(0, 3).map((c, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: other ? t.line : c }} />)}{n > 3 ? <Text style={{ fontFamily: font.b, fontSize: 11, color: other ? t.ink3 : t.muted }}>+{n - 3}</Text> : null}</View> : <View style={{ height: 6 }} />}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
