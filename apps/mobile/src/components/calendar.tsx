import React, { useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr, type StringKey } from '@/i18n';
import type { Appointment, Staff } from '@/lib/api';
import { useDockInset } from '@/lib/dock';
import { addDays, hhmm, sameDay, startOfWeek, toMin, weekdayShort } from '@/lib/format';
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
/** Small tile icon markers (design `.ni`), only from fields the booking response really carries.
 *  New / returning / VIP / birthday markers need client data the booking does not include: not shown. */
export function markersOf(a: Appointment): Marker[] {
  const out: Marker[] = [];
  const online = (a.bookingSource ?? '').toLowerCase() === 'web';
  if (online) out.push({ key: 'online', icon: 'globe', label: 'marker.online' });
  if (online && a.staffAutoAssigned === false) out.push({ key: 'chosen', icon: 'user', label: 'marker.chosen' });
  if (a.guestName) out.push({ key: 'group', icon: 'users', label: 'marker.group' });
  if (a.notes?.trim() || a.clientAlert) out.push({ key: 'note', icon: 'edit', label: 'marker.note' });
  if (a.paymentStatus === 'PAID' || a.depositPaid) out.push({ key: 'paid', icon: 'verified', label: 'marker.paid' });
  if ((a.lateMinutes ?? 0) > 0) out.unshift({ key: 'late', icon: 'timer', label: 'calendar.lateHint' });
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
export function Timeline({ date, masters, appts, startHour, endHour, refreshing, onRefresh, onOpen }: {
  date: Date; masters: Staff[]; appts: Appointment[]; startHour: number; endHour: number;
  refreshing: boolean; onRefresh: () => void; onOpen: (a: Appointment) => void;
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
