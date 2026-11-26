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

/** Mobile BF02 numbers: hour label column 48 + line from x=58, 144-wide master columns 6 apart, 92 px per hour (`.lt`, `.lt-h`, `.lt-l`). */
const GUTTER = 58;
const COL_GAP = 6;
const HOUR_PX = 92;

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
  if ((a.lateMinutes ?? 0) > 0) out.unshift({ key: 'late', icon: 'clock-alert', label: 'calendar.lateHint' });
  return out;
}

/** Overlapping bookings of one master sit side by side. */
function lanes(list: Appointment[]) {
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
            style={[{ flex: 1, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: sel ? t.violet : 'transparent' }, sel ? ctaShadow : null]}>
            <Text style={{ fontFamily: font.s, fontSize: 14, color: sel ? 'rgba(255,255,255,.85)' : t.muted, textTransform: 'capitalize' }}>{weekdayShort(d).replace('.', '')}</Text>
            <Text style={{ fontFamily: font.x, fontSize: 19, color: sel ? '#fff' : t.ink }}>{d.getDate()}</Text>
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
  const cp = height < 70;
  const noShow = a.status === 'NO_SHOW';
  const bar = stripe(a.status, t.violet, t.ok);
  const mk = markers.slice(0, 3).map((m) => <Icon key={m.key} name={m.icon} size={16} color={m.key === 'late' ? t.guava : fg} />);
  return (
    <Pressable onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''} ${a.serviceName ?? ''}`} noScale
      style={{ position: 'absolute', top, height, left, width, borderRadius: 14, backgroundColor: noShow ? t.gsoft : bg, overflow: 'hidden', opacity: a.status === 'COMPLETED' ? 0.75 : 1,
        paddingTop: cp ? 0 : 7, paddingBottom: cp ? 0 : 6, paddingRight: cp ? 9 : 10, paddingLeft: cp ? 15 : 17, flexDirection: cp ? 'row' : 'column', alignItems: cp ? 'center' : 'stretch', gap: cp ? 8 : 1 }}>
      {bar ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: bar }} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: cp ? 14.5 : 15, lineHeight: 19, letterSpacing: -0.15, color: noShow ? t.gink : fg, textDecorationLine: noShow ? 'line-through' : 'none', flexShrink: cp ? 1 : 0 }}>{a.clientName || '-'}</Text>
      <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14, lineHeight: 18, color: fg, opacity: cp ? 0.75 : 0.82, flexShrink: cp ? 1 : 0 }}>{cp ? hhmm(a.startTime) : `${a.serviceName ?? ''} · ${hhmm(a.startTime)}`}</Text>
      {mk.length ? <View style={{ flexDirection: 'row', gap: 7, ...(cp ? { marginLeft: 'auto' } : { marginTop: 'auto', paddingTop: 2 }) }}>{mk}</View> : null}
    </Pressable>
  );
}

/** Day timeline `.lt` (BF02 390): sticky master header (`.colh`: ring avatar 36 + name 16/800), hour labels in a 48 px gutter, lines from x=58, now line with the guava dot and time pill. */
export function Timeline({ date, masters, appts, blocks = [], startHour, endHour, refreshing, onRefresh, onOpen, onBlock }: {
  date: Date; masters: Staff[]; appts: Appointment[]; blocks?: TimeOff[]; startHour: number; endHour: number;
  refreshing: boolean; onRefresh: () => void; onOpen: (a: Appointment) => void; onBlock?: (b: TimeOff) => void;
}) {
  const { t } = useTheme();
  const { width } = useWindowDimensions();
  const inset = useDockInset(24);
  const head = useRef<ScrollView>(null);
  const body = useRef<ScrollView>(null);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const total = hours.length * HOUR_PX;
  const colW = Math.floor((width - 32 - GUTTER - COL_GAP) / 2);
  const placed = useMemo(() => masters.map((m) => {
    const mine = appts.filter((a) => a.status !== 'CANCELLED' && (String(a.staffId) === String(m.id) || (m.id === '__none' && !masters.some((x) => String(x.id) === String(a.staffId)))));
    return { m, mine, lane: lanes(mine) };
  }), [masters, appts]);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = sameDay(date, now) && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const nowTop = ((nowMin - startHour * 60) / 60) * HOUR_PX;
  const contentW = masters.length * (colW + COL_GAP);
  // today opens about an hour above "now"; other days at the first booking
  const first = appts.length ? Math.min(...appts.map((a) => toMin(a.startTime))) : startHour * 60;
  const target = Math.max(0, (((showNow ? nowMin - 60 : first - 30) - startHour * 60) / 60) * HOUR_PX);
  const done = useRef('');
  const key = `${date.toDateString()}|${appts.length}`;
  const settle = () => { if (done.current !== key) { done.current = key; body.current?.scrollTo({ y: target, animated: false }); } };

  return (
    <ScrollView ref={body} onContentSizeChange={settle} stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: inset }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.violet} />}>
      <View style={{ flexDirection: 'row', backgroundColor: t.canvas, height: 56, paddingLeft: 16 }}>
        <View style={{ width: GUTTER }} />
        <ScrollView ref={head} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          {masters.map((m) => (
            <View key={m.id} style={{ width: colW, marginRight: COL_GAP, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.name} size={36} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.x, fontSize: 16, color: t.ink }}>{m.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={{ flexDirection: 'row', paddingLeft: 16, paddingTop: 10 }}>
        <View style={{ width: GUTTER, height: total }}>
          {hours.map((h, i) => (
            <Text key={h} style={{ position: 'absolute', top: i * HOUR_PX - 10, left: 0, width: 48, textAlign: 'right', fontFamily: font.s, fontSize: 14, color: t.ink3 }}>{h}:00</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={(e) => head.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })}>
          <View style={{ width: Math.max(contentW, width - 32 - GUTTER), height: total }}>
            {hours.map((h, i) => <View key={h} style={{ position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, height: 1, backgroundColor: t.line }} />)}
            {placed.map(({ m, mine, lane }, ci) => mine.map((a) => {
              const l = lane.get(a.id) ?? { lane: 0, n: 1 };
              const w = colW / l.n;
              const top = ((toMin(a.startTime) - startHour * 60) / 60) * HOUR_PX + 1;
              const h = Math.max(40, ((toMin(a.endTime) - toMin(a.startTime)) / 60) * HOUR_PX - 3);
              return <Tile key={`${m.id}-${a.id}`} a={a} top={top} height={h} left={ci * (colW + COL_GAP) + l.lane * w} width={w - (l.n > 1 ? 2 : 0)} onOpen={onOpen} />;
            }))}
            {masters.map((m, ci) => blocks.filter((b) => String(b.staffId) === String(m.id)).map((b) => {
              const from = b.isFullDay || !b.startTime ? startHour * 60 : Math.max(startHour * 60, toMin(b.startTime));
              const to = b.isFullDay || !b.endTime ? endHour * 60 : Math.min(endHour * 60, toMin(b.endTime));
              if (to <= from) return null;
              return (
                <Pressable key={`blk-${b.id}`} noScale onPress={() => onBlock?.(b)} accessibilityRole="button" accessibilityLabel={`${tr('block.title')} ${hhmm(fromMin(from))}-${hhmm(fromMin(to))} ${b.reason ?? ''}`}
                  style={{ position: 'absolute', top: ((from - startHour * 60) / 60) * HOUR_PX + 1, height: ((to - from) / 60) * HOUR_PX - 3, left: ci * (colW + COL_GAP), width: colW, borderRadius: 14, backgroundColor: t.fill2, borderWidth: 1, borderStyle: 'dashed', borderColor: t.ink3, padding: 8, overflow: 'hidden' }}>
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
