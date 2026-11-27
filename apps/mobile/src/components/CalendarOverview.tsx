import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Icon } from '@/components/Icon';
import { IconBtn, Segmented, Skeleton, T } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { firstName, live, nowMin } from '@/lib/day';
import { addDays, dayMonth, hhmm, sameDay, startOfWeek, toMin, weekdayLong, weekdayMini } from '@/lib/format';
import { useSafeAreaInsets } from '@/lib/insets';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const PALETTE = ['#7c5cff', '#ff7aa2', '#2fbf8a', '#f0a63a', '#3aa0f0', '#c45cff'];
const GUTTER = 46;
const HOUR_PX = 60;
const HEAD = 52;

/**
 * "Ümumi": the whole salon at a glance. Day = every specialist as a column on one time grid (sticky time column and header,
 * horizontal scroll past 3-4 columns, now line, tap a tile to open it). Week = seven day columns, bookings as compact bars with counts.
 * Rendered as an overlay inside the calendar screen (not a Modal) so the booking sheet can still open on top of it.
 */
export function CalendarOverview({ date: initial, team, onClose, onOpen }: { date: Date; team: Staff[]; onClose: () => void; onOpen: (a: Appointment) => void }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { salon, version } = useApp();
  const sid = salon?.id ?? '';
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(initial);
  const ws = startOfWeek(date);
  const q = useLoad(() => api.appointments(sid, ws, addDays(ws, 6)), [sid, ws.toDateString(), version]);
  const all = useMemo(() => (q.data ?? []).filter(live), [q.data]);
  const step = mode === 'day' ? 1 : 7;
  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: ins.top + 6, paddingBottom: 8 }}>
      <IconBtn icon="back" label={tr('common.back')} onPress={onClose} />
      <View style={{ flex: 1 }}>
        <T k="h2" lines={1}>{tr('n4.overview')}</T>
        <T k="sm" color={t.muted} lines={1}>{mode === 'day' ? `${weekdayLong(date)}, ${dayMonth(date)}` : `${dayMonth(ws)} – ${dayMonth(addDays(ws, 6))}`}</T>
      </View>
      <IconBtn icon="back" label={tr('calendar.prevWeek')} onPress={() => setDate(addDays(date, -step))} />
      <IconBtn icon="chev" label={tr('calendar.nextWeek')} onPress={() => setDate(addDays(date, step))} />
    </View>
  );
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: t.canvas, zIndex: 20 }}>
      {head}
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <Segmented items={[{ k: 'day', label: tr('n4.dayTab') }, { k: 'week', label: tr('n4.weekTab') }]} value={mode} onChange={(m) => setMode(m)} />
      </View>
      {q.loading && !q.data ? <Skeleton blocks={[{ h: 64 }, { h: 64 }, { h: 64 }]} /> : mode === 'day'
        ? <DayGrid date={date} team={team} appts={all.filter((a) => a.appointmentDate.slice(0, 10) === toDay(date))} W={W} onOpen={onOpen} />
        : <WeekGrid ws={ws} appts={all} team={team} W={W} onOpen={onOpen} onPickDay={(d) => { setDate(d); setMode('day'); }} />}
    </View>
  );
}

function DayGrid({ date, team, appts, W, onOpen }: { date: Date; team: Staff[]; appts: Appointment[]; W: number; onOpen: (a: Appointment) => void }) {
  const { t } = useTheme();
  const colW = Math.max(96, Math.floor((W - GUTTER - 8) / Math.min(Math.max(team.length, 1), 3.5)));
  const lo = Math.min(9, ...appts.map((a) => Math.floor(toMin(a.startTime) / 60)));
  const hi = Math.max(20, ...appts.map((a) => Math.ceil(toMin(a.endTime) / 60)));
  const y = (m: number) => ((m - lo * 60) / 60) * HOUR_PX;
  const isToday = sameDay(date, new Date());
  const hRef = useRef<ScrollView>(null);
  const bRef = useRef<ScrollView>(null);
  const sync = (x: number, from: 'h' | 'b') => (from === 'h' ? bRef : hRef).current?.scrollTo({ x, animated: false });
  const bodyH = (hi - lo) * HOUR_PX;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', height: HEAD, borderBottomWidth: 1, borderBottomColor: t.hair }}>
        <View style={{ width: GUTTER }} />
        <ScrollView ref={hRef} horizontal scrollEventThrottle={16} onScroll={(e) => sync(e.nativeEvent.contentOffset.x, 'h')} showsHorizontalScrollIndicator={false}>
          {team.map((s, i) => (
            <View key={String(s.id)} style={{ width: colW, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE[i % PALETTE.length] }} />
              <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 13, color: t.ink }}>{firstName(s.name)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', height: bodyH + 10 }}>
          <View style={{ width: GUTTER }}>
            {Array.from({ length: hi - lo }, (_, i) => (
              <Text key={i} style={{ position: 'absolute', top: i * HOUR_PX - 7 + 8, left: 6, fontFamily: font.r, fontSize: 11.5, color: t.ink3, fontVariant: ['tabular-nums'] }}>{String(lo + i).padStart(2, '0')}:00</Text>
            ))}
          </View>
          <ScrollView ref={bRef} horizontal scrollEventThrottle={16} onScroll={(e) => sync(e.nativeEvent.contentOffset.x, 'b')} showsHorizontalScrollIndicator={false}>
            <View style={{ width: colW * team.length, height: bodyH + 10, paddingTop: 8 }}>
              {Array.from({ length: hi - lo }, (_, i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 8 + i * HOUR_PX, borderTopWidth: 1, borderTopColor: t.hair }} />)}
              {team.map((s, i) => (
                <View key={String(s.id)} style={{ position: 'absolute', left: i * colW, width: colW, top: 0, bottom: 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: t.hair }}>
                  {appts.filter((a) => String(a.staffId) === String(s.id)).map((a) => {
                    const c = PALETTE[i % PALETTE.length];
                    const top = 8 + y(toMin(a.startTime));
                    const h = Math.max(30, y(toMin(a.endTime)) - y(toMin(a.startTime)) - 2);
                    return (
                      <Pressable key={a.id} onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''} ${a.serviceName ?? ''}`}
                        style={{ position: 'absolute', left: 3, right: 3, top, height: h, borderRadius: 10, backgroundColor: `${c}26`, borderLeftWidth: 3, borderLeftColor: c, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', borderWidth: a.status === 'PENDING' ? 1 : 0, borderColor: c }}>
                        <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 12, color: t.ink }}>{firstName(a.clientName) || '-'}</Text>
                        <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 11, color: t.muted }}>{a.serviceName}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {isToday && nowMin() >= lo * 60 && nowMin() <= hi * 60 ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 8 + y(nowMin()), height: 2, backgroundColor: t.guava }} /> : null}
            </View>
          </ScrollView>
          {isToday && nowMin() >= lo * 60 && nowMin() <= hi * 60 ? <View pointerEvents="none" style={{ position: 'absolute', left: GUTTER - 5, top: 8 + y(nowMin()) - 4, width: 10, height: 10, borderRadius: 5, backgroundColor: t.guava }} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function WeekGrid({ ws, appts, team, W, onOpen, onPickDay }: { ws: Date; appts: Appointment[]; team: Staff[]; W: number; onOpen: (a: Appointment) => void; onPickDay: (d: Date) => void }) {
  const { t } = useTheme();
  const colW = Math.floor((W - 16) / 7);
  const colorOf = (id: unknown) => PALETTE[Math.max(0, team.findIndex((s) => String(s.id) === String(id))) % PALETTE.length];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row' }}>
        {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => {
          const list = appts.filter((a) => a.appointmentDate.slice(0, 10) === toDay(d)).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
          const today = sameDay(d, new Date());
          return (
            <View key={d.toDateString()} style={{ width: colW, paddingHorizontal: 2 }}>
              <Pressable onPress={() => onPickDay(d)} accessibilityRole="button" accessibilityLabel={`${weekdayLong(d)}, ${dayMonth(d)}`} style={{ alignItems: 'center', paddingVertical: 6, borderRadius: 12, backgroundColor: today ? t.vsoft : 'transparent' }}>
                <Text style={{ fontFamily: font.s, fontSize: 11, color: t.ink3 }}>{weekdayMini(d)}</Text>
                <Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{d.getDate()}</Text>
                <Text style={{ fontFamily: font.s, fontSize: 11, color: list.length ? t.vtext : t.ink3 }}>{list.length}</Text>
              </Pressable>
              <View style={{ gap: 3, marginTop: 4 }}>
                {list.slice(0, 14).map((a) => (
                  <Pressable key={a.id} onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''}`}
                    style={{ height: 22, borderRadius: 6, backgroundColor: `${colorOf(a.staffId)}30`, borderLeftWidth: 3, borderLeftColor: colorOf(a.staffId), justifyContent: 'center', paddingLeft: 3, overflow: 'hidden' }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 9.5, color: t.ink }}>{hhmm(a.startTime)}</Text>
                  </Pressable>
                ))}
                {list.length > 14 ? <T k="xs" color={t.muted} style={{ textAlign: 'center' }}>+{list.length - 14}</T> : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingHorizontal: 8 }}>
        {team.map((s, i) => <View key={String(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE[i % PALETTE.length] }} /><T k="xs" color={t.muted}>{firstName(s.name)}</T></View>)}
      </View>
    </ScrollView>
  );
}
