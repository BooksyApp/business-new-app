import React, { useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr, type StringKey } from '@/i18n';
import type { Appointment, Staff } from '@/lib/api';
import { useDockInset } from '@/lib/dock';
import { addDays, hhmm, monthLabel, sameDay, startOfWeek, toMin, weekdayShort } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

export type Density = 'comfy' | 'compact';
const GUTTER = 46;

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

/** Week strip: arrows move a week, tap a day to select. */
export function DayStrip({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const { t } = useTheme();
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Pressable onPress={() => onChange(addDays(date, -7))} hitSlop={12} accessibilityRole="button"><Icon name="back" size={22} color={t.ink} /></Pressable>
        <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink, textTransform: 'capitalize' }}>{monthLabel(date)}</Text>
        <Pressable onPress={() => onChange(addDays(date, 7))} hitSlop={12} accessibilityRole="button"><Icon name="chev" size={22} color={t.ink} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {days.map((d) => {
          const sel = sameDay(d, date);
          return (
            <Pressable key={d.toISOString()} onPress={() => onChange(d)} accessibilityRole="button" accessibilityState={{ selected: sel }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, backgroundColor: sel ? t.violet : t.surface, borderWidth: 1, borderColor: sel ? t.violet : sameDay(d, today) ? t.violet : t.line }}>
              <Text style={{ fontFamily: font.m, fontSize: 11.5, color: sel ? '#fff' : t.muted, textTransform: 'capitalize' }}>{weekdayShort(d)}</Text>
              <Text style={{ fontFamily: font.x, fontSize: 17, color: sel ? '#fff' : t.ink }}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Tile({ a, top, height, left, width, density, onOpen }: { a: Appointment; top: number; height: number; left: number; width: number; density: Density; onOpen: (a: Appointment) => void }) {
  const { t } = useTheme();
  const [bg, fg] = (t.dark ? TILE_D : TILE_L)[hash(String(a.serviceId ?? a.serviceName)) % 4];
  const markers = markersOf(a);
  const compact = density === 'compact';
  const pending = a.status === 'PENDING';
  const done = a.status === 'COMPLETED';
  const noShow = a.status === 'NO_SHOW';
  const late = (a.lateMinutes ?? 0) > 0;
  return (
    <Pressable onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''} ${a.serviceName ?? ''}`}
      style={{ position: 'absolute', top, height, left, width, borderRadius: compact ? 12 : 16, backgroundColor: noShow ? t.gsoft : bg, paddingHorizontal: compact ? 8 : 10, paddingVertical: compact ? 4 : 7, overflow: 'hidden', opacity: done ? 0.7 : 1,
        borderWidth: pending || late ? 1.5 : 0, borderStyle: pending ? 'dashed' : 'solid', borderColor: late ? '#e83e63' : fg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.x, fontSize: compact ? 12.5 : 14, color: noShow ? t.gink : fg, textDecorationLine: noShow ? 'line-through' : 'none' }}>{compact ? `${hhmm(a.startTime)} ${a.clientName || '-'}` : a.clientName || '-'}</Text>
        {compact ? markers.slice(0, 2).map((m) => <Icon key={m.key} name={m.icon} size={12} color={fg} />) : null}
      </View>
      {!compact && height >= 52 ? <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12.5, color: fg, opacity: 0.85 }}>{a.serviceName} · {hhmm(a.startTime)}</Text> : null}
      {!compact && height >= 74 && late ? (
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: t.gsoft }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#e83e63' }} />
          <Text style={{ fontFamily: font.b, fontSize: 11, color: t.gink }}>{tr('calendar.late', { min: a.lateMinutes ?? 0 })}</Text>
        </View>
      ) : null}
      {!compact && markers.length ? (
        <View style={{ position: 'absolute', right: 6, bottom: 5, flexDirection: 'row', gap: 4 }}>
          {markers.slice(0, 3).map((m) => (
            <View key={m.key} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={m.icon} size={12} color={fg} />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/** Day timeline: sticky staff header (avatar + name) over per-master columns, hours in a fixed gutter. */
export function Timeline({ date, masters, appts, density, startHour, endHour, refreshing, onRefresh, onOpen }: {
  date: Date; masters: Staff[]; appts: Appointment[]; density: Density; startHour: number; endHour: number;
  refreshing: boolean; onRefresh: () => void; onOpen: (a: Appointment) => void;
}) {
  const { t } = useTheme();
  const { width } = useWindowDimensions();
  const inset = useDockInset(24);
  const head = useRef<ScrollView>(null);
  const HOUR = density === 'compact' ? 52 : 78;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const total = hours.length * HOUR;
  const colW = Math.max(150, Math.floor((width - GUTTER - 8) / Math.max(1, Math.min(masters.length, 2))));
  const placed = useMemo(() => masters.map((m) => {
    const mine = appts.filter((a) => a.status !== 'CANCELLED' && (String(a.staffId) === String(m.id) || (m.id === '__none' && !masters.some((x) => String(x.id) === String(a.staffId)))));
    return { m, mine, lane: lanes(mine) };
  }), [masters, appts]);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = sameDay(date, now) && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const nowTop = ((nowMin - startHour * 60) / 60) * HOUR;

  return (
    <ScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: inset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.violet} />}>
      <View style={{ flexDirection: 'row', backgroundColor: t.canvas, paddingBottom: 6 }}>
        <View style={{ width: GUTTER }} />
        <ScrollView ref={head} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false}>
          {masters.map((m) => (
            <View key={m.id} style={{ width: colW, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 }}>
              <Avatar name={m.name} size={density === 'compact' ? 30 : 36} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.b, fontSize: 14, color: t.ink }}>{m.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: GUTTER, height: total }}>
          {hours.map((h, i) => (
            <Text key={h} style={{ position: 'absolute', top: i * HOUR - 7, left: 0, width: GUTTER - 8, textAlign: 'right', fontFamily: font.m, fontSize: 11.5, color: t.ink3 }}>{String(h).padStart(2, '0')}:00</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={(e) => head.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })}>
          <View style={{ width: colW * masters.length, height: total }}>
            {hours.map((h, i) => <View key={h} style={{ position: 'absolute', top: i * HOUR, left: 0, right: 0, height: 1, backgroundColor: t.line }} />)}
            {placed.map(({ m, mine, lane }, ci) => mine.map((a) => {
              const l = lane.get(a.id) ?? { lane: 0, n: 1 };
              const w = (colW - 8) / l.n;
              const top = ((toMin(a.startTime) - startHour * 60) / 60) * HOUR + 1;
              const h = Math.max(compactMin(density), ((toMin(a.endTime) - toMin(a.startTime)) / 60) * HOUR - 3);
              return <Tile key={`${m.id}-${a.id}`} a={a} top={top} height={h} left={ci * colW + 4 + l.lane * w} width={w - (l.n > 1 ? 2 : 0)} density={density} onOpen={onOpen} />;
            }))}
            {showNow ? (
              <View pointerEvents="none" style={{ position: 'absolute', top: nowTop - 1, left: 0, right: 0, height: 2, backgroundColor: '#e83e63' }}>
                <View style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: '#e83e63' }} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}
const compactMin = (d: Density) => (d === 'compact' ? 26 : 38);
