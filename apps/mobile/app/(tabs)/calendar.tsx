import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlockTimeSheet } from '@/components/BlockTimeSheet';
import { BottomSheet } from '@/components/BottomSheet';
import { BookingSheet } from '@/components/BookingSheet';
import { CalendarOverview } from '@/components/CalendarOverview';
import { Timeline, WeekView, lanes } from '@/components/calendar';
import { Icon } from '@/components/Icon';
import { Avatar, Button, EmptyState, IconBtn, ListItem, LoadRing, Pill, Segmented, Skeleton, T, TopBar } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState, Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type ClientWithStats, type Staff, type TimeOff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { rememberClients } from '@/lib/client-cache';
import { firstName, live, nowMin, staffLoad } from '@/lib/day';
import { useDockInset } from '@/lib/dock';
import { addDays, dayMonth, hhmm, monthLabel, sameDay, startOfWeek, toMin, weekdayLong, weekdayMini } from '@/lib/format';
import { useSafeAreaInsets } from '@/lib/insets';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { evTint, font } from '@/theme/tokens';
import { phoneZoneDiffers, salonCity, salonNow } from '@/lib/salonClock';

type Mode = 'day' | 'month';
type Layout = 'summary' | 'grid' | 'week';

/**
 * Təqvim (artifact "Təqvim"): Gün / Ay. Day = staff rail + week strip, then either the team summary (one row per
 * specialist with a load ring) or one specialist's single-column day with the now line. Month = dots + a day sheet.
 * The dense multi-column grid and the week view stay one tap away in the "..." sheet (progressive disclosure).
 */
export default function Calendar() {
  const { t } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ staff?: string }>();
  const ins = useSafeAreaInsets();
  const inset = useDockInset(20);
  const { salon, version, bump } = useApp();
  const sid = salon?.id ?? '';
  const [date, setDate] = useState(() => new Date());
  const [mode, setMode] = useState<Mode>('day');
  const [layout, setLayout] = useState<Layout>('summary');
  const [focus, setFocus] = useState<string | null>(null);
  const [dense, setDense] = useState(false);
  const [menu, setMenu] = useState(false);
  const [overview, setOverview] = useState(false);
  const [sheetAppt, setSheetAppt] = useState<Appointment | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [block, setBlock] = useState<TimeOff | null>(null);
  useEffect(() => { if (params.staff) { setFocus(String(params.staff)); setMode('day'); setLayout('summary'); } }, [params.staff]);

  const weekStart = startOfWeek(date);
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const staff = useLoad<Staff[]>(() => api.staff(sid), [sid, version]);
  const q = useLoad(() => (mode === 'month' ? api.appointments(sid, gridStart, addDays(gridStart, 41)) : api.appointments(sid, weekStart, addDays(weekStart, 6))),
    [sid, mode, mode === 'month' ? `${date.getFullYear()}-${date.getMonth()}` : weekStart.toDateString(), version]);
  const off = useLoad<TimeOff[]>(() => (mode === 'day' ? api.timeOffOn(sid, date).catch(() => []) : Promise.resolve([])), [sid, mode, date.toDateString(), version]);
  const clients = useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => [] as ClientWithStats[]); rememberClients(r); return r; }, [sid, version]);
  const avatarOf = useMemo(() => new Map((clients.data ?? []).map((c) => [String(c.id), c.avatarUrl ?? null])), [clients.data]);

  const team = useMemo(() => (staff.data ?? []).filter((s) => s.isActive !== false), [staff.data]);
  const all = q.data ?? [];
  const dayKey = toDay(date);
  const dayList = useMemo(() => all.filter((a) => a.appointmentDate.slice(0, 10) === dayKey && live(a)).sort((a, b) => toMin(a.startTime) - toMin(b.startTime)), [all, dayKey]);
  const focused = team.find((s) => String(s.id) === focus) ?? null;
  const newBooking = (d = date) => router.push({ pathname: '/booking/new', params: { date: toDay(d), ...(focus ? { staff: focus } : {}) } });
  const open = (a: Appointment) => router.push(`/booking/${a.id}`);
  const err = (staff.error || q.error) as Error | null;
  const loading = (staff.loading && !staff.data) || (q.loading && !q.data);

  return (
    <Screen style={{ paddingTop: ins.top }}>
      <TopBar title={tr('calendar.title')} sub={`${weekdayLong(date)}, ${dayMonth(date)}`}
        right={<>
          <Pressable onPress={() => setOverview(true)} accessibilityRole="button" accessibilityLabel={tr('n4.overview')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: t.vsoft }}>
            <Icon name="grid" size={18} color={t.vtext} /><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14, color: t.vtext }}>{tr('n4.overviewShort')}</Text>
          </Pressable>
          <IconBtn icon="plus" label={tr('v2.newBooking')} onPress={() => newBooking()} />
          <IconBtn icon="dots" label={tr('v2.tabMore')} onPress={() => setMenu(true)} />
        </>} />
      {phoneZoneDiffers() ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginLeft: 20, marginBottom: 8, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: t.fill }}>
          <Icon name="clock" size={13} color={t.muted} /><Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12, color: t.muted }}>{tr('n4.salonTime', { city: salonCity(), t: hhmm(`${String(salonNow().getHours()).padStart(2, '0')}:${String(salonNow().getMinutes()).padStart(2, '0')}`) })}</Text>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 12 }}>
        <Segmented items={[{ k: 'day', label: tr('v2.day') }, { k: 'month', label: tr('v2.month') }]} value={mode} onChange={(m) => { setMode(m); setLayout('summary'); }} />
      </View>

      {err ? <ErrorState error={err} onRetry={() => { void staff.reload(); void q.reload(); }} /> : mode === 'month' ? (
        <Month date={date} appts={all} loading={loading} avatarOf={avatarOf}
          onMonth={(d) => setDate(d)} onPick={(d) => setDate(d)} onOpenDay={(d) => { setDate(d); setMode('day'); }} onOpen={open} onNew={newBooking} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: inset }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={() => { void q.reload(); void off.reload(); }} tintColor={t.violet} />}>
          {/* staff rail */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 4 }}>
            <Pro label={tr('v2.all')} on={!focus} onPress={() => setFocus(null)} />
            {team.map((s) => <Pro key={String(s.id)} label={firstName(s.name)} uri={s.avatarUrl} name={s.name} on={focus === String(s.id)} onPress={() => setFocus(String(s.id))} />)}
          </ScrollView>
          {/* week strip */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, marginTop: 12, marginBottom: 4 }}>
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
              const on = sameDay(d, date);
              const has = all.some((a) => a.appointmentDate.slice(0, 10) === toDay(d) && live(a) && (!focus || String(a.staffId) === focus));
              return (
                <Pressable key={d.toDateString()} onPress={() => setDate(d)} noScale accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${weekdayLong(d)}, ${dayMonth(d)}`}
                  style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: font.s, fontSize: 11.5, color: t.ink3 }}>{weekdayMini(d)}</Text>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (t.dark ? '#f5f2fa' : '#1d1730') : 'transparent' }}>
                    <Text style={{ fontFamily: font.b, fontSize: 16, color: on ? (t.dark ? '#1d1730' : '#fff') : t.ink }}>{d.getDate()}</Text>
                  </View>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.violet, opacity: has ? 0.7 : 0 }} />
                </Pressable>
              );
            })}
          </View>

          {loading ? <Skeleton blocks={[{ h: 64 }, { h: 64 }, { h: 64 }, { h: 64 }]} /> : layout === 'grid' && !focus ? (
            <View style={{ height: 640, marginTop: 8 }}>
              <Timeline date={date} masters={team} appts={dayList} blocks={off.data ?? []} startHour={hoursOf(dayList, sameDay(date, salonNow()))[0]} endHour={hoursOf(dayList, sameDay(date, salonNow()))[1]} refreshing={false} onRefresh={() => void q.reload()}
                onOpen={open} onBlock={(b) => { setBlock(b); setBlockOpen(true); }} onPickMaster={(m) => { setFocus(String(m.id)); setLayout('summary'); }} hourPx={dense ? 96 : 128} />
            </View>
          ) : layout === 'week' ? (
            <View style={{ height: 640, marginTop: 8 }}>
              <WeekView date={date} appts={focus ? all.filter((a) => String(a.staffId) === focus) : all} startHour={hoursOf(all, true)[0]} endHour={hoursOf(all, true)[1]} refreshing={false} onRefresh={() => void q.reload()}
                onOpen={open} onPickDay={(d) => { setDate(d); setLayout('summary'); }} />
            </View>
          ) : dayList.length === 0 && !(focus && (off.data ?? []).some((b) => String(b.staffId) === focus)) ? (
            <EmptyState photo="demo:p7518700" artHeight={170} style={{ marginTop: 14 }} title={sameDay(date, salonNow()) ? tr('v2.dayEmptyTitle') : tr('n5.emptyDay')} body={tr('v2.dayEmptyBody')} action={{ label: tr('v2.addBooking'), icon: 'plus', onPress: () => newBooking() }} />
          ) : focused ? (
            <DayColumn tint={Math.max(0, team.findIndex((s) => String(s.id) === focus))} date={date} list={dayList.filter((a) => String(a.staffId) === focus)} blocks={(off.data ?? []).filter((b) => String(b.staffId) === focus)} hourPx={dense ? 84 : 116}
              avatarOf={avatarOf} onOpen={open} onBlock={(b) => { setBlock(b); setBlockOpen(true); }} />
          ) : (
            <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
              {team.map((s, i) => {
                const { load, hours } = staffLoad(dayList, s);
                const n = dayList.find((a) => String(a.staffId) === String(s.id) && a.status !== 'COMPLETED' && (!sameDay(date, salonNow()) || toMin(a.endTime) > nowMin()));
                return (
                  <ListItem key={String(s.id)} first={i === 0} title={firstName(s.name)} onPress={() => setFocus(String(s.id))}
                    lead={<LoadRing value={load} size={56}><Avatar uri={s.avatarUrl} name={s.name} size={46} /></LoadRing>}
                    sub={n ? tr('v2.nextAt', { t: hhmm(n.startTime), n: firstName(n.clientName) }) : sameDay(date, salonNow()) ? tr('v2.freeToday') : tr('n5.freeOther')}
                    right={<View style={{ alignItems: 'flex-end' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink }}>{Math.round(load * 100)}%</Text><T k="sm" color={t.ink3}>{tr('v2.hours', { a: hours, b: 8 })}</T></View>} />
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <BottomSheet open={menu} onClose={() => setMenu(false)}>
        <View style={{ paddingBottom: 12 }}>
          <T k="h2" style={{ fontSize: 18, marginBottom: 12 }}>{tr('calendar.title')}</T>
          <Segmented items={[{ k: 'comfy', label: tr('v2.comfy') }, { k: 'compact', label: tr('v2.compact') }]} value={dense ? 'compact' : 'comfy'} onChange={(k) => setDense(k === 'compact')} />
          {([
            ['users', tr('calendar.day') + ' · ' + tr('v2.all'), () => { setMode('day'); setFocus(null); setLayout('grid'); }],
            ['cal', tr('calendar.week'), () => { setMode('day'); setLayout('week'); }],
            ['lock', tr('v2.block'), () => { setBlock(null); setBlockOpen(true); }],
            ['search', tr('ux.bookingsTitle'), () => router.push('/bookings')],
          ] as const).map(([i, l, go], k) => (
            <Pressable key={l} onPress={() => { setMenu(false); go(); }} accessibilityRole="button" noScale
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderTopWidth: k ? 1 : 0, borderTopColor: t.hair, marginTop: k ? 0 : 10 }}>
              <Icon name={i} size={21} color={t.ink} /><Text style={{ flex: 1, fontFamily: font.r, fontSize: 15, color: t.ink }}>{l}</Text><Icon name="chev" size={16} color={t.ink3} />
            </Pressable>
          ))}
        </View>
      </BottomSheet>
      {overview ? <CalendarOverview date={date} team={team} onClose={() => setOverview(false)} onOpen={(a) => setSheetAppt(a)} /> : null}
      <BookingSheet appt={sheetAppt} onClose={() => { setSheetAppt(null); bump(); }} />
      <BlockTimeSheet open={blockOpen} date={date} masters={team} preset={focus} existing={block} onClose={() => setBlockOpen(false)} onDone={() => { setBlockOpen(false); void off.reload(); bump(); }} />
    </Screen>
  );
}

/** Staff picker bubble (`.pro`, 58): violet ring when selected. */
function Pro({ label, uri, name, on, onPress }: { label: string; uri?: string | null; name?: string; on: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ width: 58, alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: on ? t.violet : 'transparent', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: name ? t.fill : t.fill }}>
        {name ? <Avatar uri={uri} name={name} size={on ? 52 : 58} /> : <Icon name="users" size={22} color={t.muted} />}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12, color: t.ink, marginTop: 6 }}>{label}</Text>
    </Pressable>
  );
}

/** Visible hour range: working day by default, stretched to every booking and, on today, to the current hour so the red "now" line is always on screen. */
function hoursOf(list: Appointment[], today: boolean, end = 21): [number, number] {
  let lo = Math.min(9, ...list.map((a) => Math.floor(toMin(a.startTime) / 60)));
  let hi = Math.max(end, ...list.map((a) => Math.ceil(toMin(a.endTime) / 60)));
  if (today) { const h = Math.floor(nowMin() / 60); lo = Math.min(lo, h); hi = Math.max(hi, h + 1); }
  return [Math.max(0, lo), Math.min(24, hi)];
}

/** One specialist's day (`.tl`): hour lines every hourPx, events as tinted cards, pending = white with guava outline, now line. */
const TINT = [0, 3, 1, 4, 2]; // artifact order: Aysel c1, Nigar c4, Lalə c2, Kamran c5, Rəna c3
function DayColumn({ date, list, blocks, hourPx, avatarOf, onOpen, onBlock, tint }: {
  tint: number; date: Date; list: Appointment[]; blocks: TimeOff[]; hourPx: number; avatarOf: Map<string, string | null>; onOpen: (a: Appointment) => void; onBlock: (b: TimeOff) => void;
}) {
  const { t } = useTheme();
  const [lo, hi] = hoursOf(list, sameDay(date, salonNow()), 20);
  const y = (m: number) => ((m - lo * 60) / 60) * hourPx;
  // Overlapping bookings of the same specialist share the row side by side instead of hiding each other.
  const { width: winW } = useWindowDimensions();
  const colW = winW - 20 - 66;
  const lane = lanes(list);
  const isToday = sameDay(date, salonNow());
  const n = nowMin();
  return (
    <View style={{ marginTop: 8, marginRight: 20, paddingLeft: 64, height: (hi - lo) * hourPx + 20 }}>
      {Array.from({ length: hi - lo }, (_, i) => (
        <View key={i} style={{ height: hourPx, borderTopWidth: 1, borderTopColor: t.hair }}>
          <Text style={{ position: 'absolute', left: -50, top: -9, fontFamily: font.r, fontSize: 11.5, color: t.ink3, fontVariant: ['tabular-nums'] }}>{String(lo + i).padStart(2, '0')}:00</Text>
        </View>
      ))}
      {blocks.map((b) => {
        const s = b.isFullDay ? lo * 60 : toMin(b.startTime ?? '00:00'); const e = b.isFullDay ? hi * 60 : toMin(b.endTime ?? '00:00');
        return (
          <Pressable key={String(b.id)} onPress={() => onBlock(b)} accessibilityRole="button" accessibilityLabel={b.reason ?? tr('v2.block')}
            style={{ position: 'absolute', left: 66, right: 0, top: y(s) + 2, height: Math.max(30, y(e) - y(s) - 4), borderRadius: 16, backgroundColor: t.fill, paddingHorizontal: 12, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="lock" size={15} color={t.muted} /><T k="sm" color={t.muted}>{b.reason || tr('v2.block')}</T></View>
          </Pressable>
        );
      })}
      {list.map((a) => {
        const top = y(toMin(a.startTime)); const h = Math.max(48, y(toMin(a.endTime)) - top - 4);
        const ln = lane.get(a.id) ?? { lane: 0, n: 1 }; const lw = colW / ln.n;
        const pend = a.status === 'PENDING'; const done = a.status === 'COMPLETED';
        return (
          <Pressable key={a.id} onPress={() => onOpen(a)} accessibilityRole="button" accessibilityLabel={`${a.clientName}, ${hhmm(a.startTime)}`}
            style={{ position: 'absolute', left: 66 + ln.lane * lw, width: lw - (ln.n > 1 ? 3 : 0), top: top + 2, height: h, borderRadius: 16, paddingVertical: 9, paddingHorizontal: ln.n > 1 ? 8 : 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', overflow: 'hidden', opacity: done ? 0.55 : 1,
              backgroundColor: pend ? t.surface : evTint[TINT[tint % TINT.length]], borderWidth: pend ? 1.5 : 0, borderColor: 'rgba(232,62,99,.35)' }}>
            {ln.n > 1 ? null : <Avatar uri={a.clientId != null ? avatarOf.get(String(a.clientId)) : null} name={a.clientName} size={30} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, lineHeight: 19, color: '#1d1730' }}>{a.clientName}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 13, color: '#6b6158' }}>{hhmm(a.startTime)}–{hhmm(a.endTime)} · {a.serviceName}</Text>
            </View>
            {pend && ln.n === 1 ? <Pill tone="g" text={tr('status.PENDING')} /> : null}
          </Pressable>
        );
      })}
      {isToday && n >= lo * 60 && n <= hi * 60 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 58, right: 0, top: y(n), height: 2, backgroundColor: t.guava, zIndex: 30, elevation: 30 }}>
          <View style={{ position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: t.guava }} />
        </View>
      ) : null}
    </View>
  );
}

/** Ay (`.mon`): 6-week grid with up to 3 dots (violet booking, guava pending, green done), and a resting day sheet. */
function Month({ date, appts, loading, avatarOf, onMonth, onPick, onOpenDay, onOpen, onNew }: {
  date: Date; appts: Appointment[]; loading: boolean; avatarOf: Map<string, string | null>; onMonth: (d: Date) => void; onPick: (d: Date) => void; onOpenDay: (d: Date) => void; onOpen: (a: Appointment) => void; onNew: (d: Date) => void;
}) {
  const { t } = useTheme();
  const pb = useDockInset(8);
  const start = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
  const today = new Date();
  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appts) if (live(a)) { const k = a.appointmentDate.slice(0, 10); m.set(k, [...(m.get(k) ?? []), a]); }
    return m;
  }, [appts]);
  const sel = (byDay.get(toDay(date)) ?? []).slice().sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const isToday = sameDay(date, today);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 14, marginBottom: 6 }}>
        <T k="h2">{monthLabel(date)}</T>
        <View style={{ flexDirection: 'row' }}>
          <IconBtn icon="back" label={tr('n5.prevMonth')} onPress={() => onMonth(new Date(date.getFullYear(), date.getMonth() - 1, 1))} />
          <IconBtn icon="chev" label={tr('n5.nextMonth')} onPress={() => onMonth(new Date(date.getFullYear(), date.getMonth() + 1, 1))} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14 }}>
        {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => (
          <Text key={`h${d.getDay()}`} style={{ width: `${100 / 7}%`, textAlign: 'center', fontFamily: font.s, fontSize: 11.5, color: t.ink3, paddingVertical: 6 }}>{weekdayMini(d)}</Text>
        ))}
        {Array.from({ length: 42 }, (_, i) => addDays(start, i)).map((d) => {
          const out = d.getMonth() !== date.getMonth(); const on = !out && sameDay(d, date); const tdy = !out && sameDay(d, today) && !on;
          const list = out ? [] : byDay.get(toDay(d)) ?? [];
          const dots = [list.some((a) => a.status === 'CONFIRMED') && t.violet, list.filter((a) => a.status === 'CONFIRMED').length > 2 && t.violet, list.some((a) => a.status === 'PENDING') && t.guava, list.some((a) => a.status === 'COMPLETED') && t.ok].filter(Boolean).slice(0, 3) as string[];
          return (
            <Pressable key={d.toDateString()} disabled={out} onPress={() => (on ? onOpenDay(d) : onPick(d))} noScale accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${dayMonth(d)}${list.length ? `, ${list.length}` : ''}`}
              style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', paddingTop: 6, gap: 4 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (t.dark ? '#f5f2fa' : '#1d1730') : 'transparent', borderWidth: tdy ? 1.5 : 0, borderColor: t.violet }}>
                <Text style={{ fontFamily: font.s, fontSize: 14.5, color: on ? (t.dark ? '#1d1730' : '#fff') : out ? t.faint : t.ink }}>{d.getDate()}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 2, height: 4 }}>{dots.map((c, k) => <View key={k} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c }} />)}</View>
            </Pressable>
          );
        })}
      </View>
      {/* resting day sheet */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8, paddingHorizontal: 20, paddingBottom: pb, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: t.dark ? t.surface : 'rgba(255,255,255,.96)', boxShadow: '0 -20px 50px -20px rgba(29,23,48,.35)' } as object}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(29,23,48,.18)', alignSelf: 'center', marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <T k="h2">{dayMonth(date)}{isToday ? ` · ${tr('v2.todayDot')}` : ''}</T>
          {sel.length ? <T k="sm" color={t.muted}>{tr('ux.nBookings', { n: sel.length })}</T> : null}
        </View>
        {loading ? <View style={{ height: 100 }} /> : sel.length ? (
          <View style={{ paddingTop: 6 }}>
            {sel.slice(0, 2).map((a, i) => (
              <ListItem key={a.id} first={i === 0} title={a.clientName ?? ''} onPress={() => onOpen(a)}
                lead={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ width: 46, fontFamily: font.b, fontSize: 14, color: t.ink }}>{hhmm(a.startTime)}</Text><Avatar uri={a.clientId != null ? avatarOf.get(String(a.clientId)) : null} name={a.clientName} size={40} /></View>}
                sub={`${a.serviceName} · ${firstName(a.staffName)}`} right={a.status === 'PENDING' ? <Pill tone="g" text={tr('status.PENDING')} /> : null} />
            ))}
            {sel.length > 2 ? <Pressable onPress={() => onOpenDay(date)} accessibilityRole="button" style={{ paddingTop: 4, minHeight: 32, justifyContent: 'center' }}><Text style={{ fontFamily: font.s, fontSize: 12.5, color: t.vtext }}>{tr('v2.nMore', { n: sel.length - 2 })}</Text></Pressable> : null}
          </View>
        ) : (
          <View style={{ alignItems: 'flex-start' }}>
            <T k="sm" color={t.muted} style={{ marginTop: 8, marginBottom: 10 }}>{isToday ? tr('v2.dayFree') : tr('n5.dayFreeOther')}</T>
            <Button label={tr('v2.booking')} icon="plus" size="sm" onPress={() => onNew(date)} />
          </View>
        )}
      </View>
    </View>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
