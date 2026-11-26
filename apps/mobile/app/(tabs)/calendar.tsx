import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookingSheet } from '@/components/BookingSheet';
import { BlockTimeSheet } from '@/components/BlockTimeSheet';
import { Agenda, DayStrip, Timeline, WeekView } from '@/components/calendar';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Chip, Circ, ErrorState, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type Staff, type TimeOff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { rememberClients } from '@/lib/client-cache';
import { addDays, dayMonth, sameDay, startOfWeek, toMin, weekdayLong } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

export default function Calendar() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version } = useApp();
  const [date, setDate] = useState(() => new Date());
  const [open, setOpen] = useState<Appointment | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [blockOpen, setBlockOpen] = useState(false);
  const [block, setBlock] = useState<TimeOff | null>(null);

  const sid = salon?.id ?? '';
  const staff = useLoad<Staff[]>(() => api.staff(sid), [sid]);
  const weekStart = startOfWeek(date);
  const day = useLoad(() => (mode === 'day' ? api.appointments(sid, date) : api.appointments(sid, weekStart, addDays(weekStart, 6))), [sid, mode, mode === 'day' ? date.toDateString() : weekStart.toDateString(), version]);
  // Client stats feed the VIP / new / returning tile markers; failure just means no such markers.
  const clientsQ = useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => []); rememberClients(r); return r.length; }, [sid, version]);
  const off = useLoad<TimeOff[]>(() => (mode === 'day' ? api.timeOffOn(sid, date).catch(() => []) : Promise.resolve([])), [sid, mode, date.toDateString(), version]);

  const all = useMemo(() => {
    const list = (staff.data ?? []).filter((s) => s.isActive !== false);
    const known = new Set(list.map((s) => String(s.id)));
    const orphan = (day.data ?? []).some((a) => !known.has(String(a.staffId)));
    return orphan ? [...list, { id: '__none', name: tr('calendar.unassigned') } as Staff] : list;
  }, [staff.data, day.data]);
  const masters = focus ? all.filter((m) => String(m.id) === focus) : all;
  const weekAppts = useMemo(() => (focus ? (day.data ?? []).filter((a) => String(a.staffId) === focus) : day.data ?? []), [day.data, focus]);

  // Visible hour range from data, never less than 9-19.
  const { startHour, endHour } = useMemo(() => {
    const a = day.data ?? [];
    const lo = Math.min(9, ...a.map((x) => Math.floor(toMin(x.startTime) / 60)));
    const hi = Math.max(19, ...a.map((x) => Math.ceil(toMin(x.endTime) / 60)));
    return { startHour: lo, endHour: Math.min(24, hi + 1) };
  }, [day.data]);

  const err = (staff.error || day.error) as Error | null;

  return (
    <Screen>
      <Header title={tr('calendar.title')}
        right={<>
          <Circ icon="clock-alert" label={tr('block.new')} onPress={() => { setBlock(null); setBlockOpen(true); }} />
          <Circ icon="plus" violet label={tr('calendar.newAppointment')} onPress={() => router.push({ pathname: '/booking/new', params: { date: toDay(date) } })} />
        </>}
        subtitle={`${weekdayLong(date)}, ${dayMonth(date)}${day.data && mode === 'day' ? ` · ${(day.data ?? []).filter((a) => a.status !== 'CANCELLED').length} ${tr('calendar.bookingsWord')}` : ''}`} />
      <View style={{ paddingHorizontal: 20 }}>
        <DayStrip date={date} onChange={setDate} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <View style={{ flexDirection: 'row', backgroundColor: t.fill, borderRadius: 24, padding: 4 }}>
            {(['day', 'week'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="button" accessibilityState={{ selected: mode === m }} noScale
                style={{ height: 40, paddingHorizontal: 22, borderRadius: 20, justifyContent: 'center', backgroundColor: mode === m ? t.surface : 'transparent', ...(mode === m ? { boxShadow: '0 4px 12px -6px rgba(29,23,48,.4)' } : null) } as any}>
                <Text style={{ fontFamily: mode === m ? font.b : font.s, fontSize: 15, color: mode === m ? t.ink : t.muted }}>{tr(m === 'day' ? 'calendar.day' : 'calendar.week')}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            {!sameDay(date, new Date()) ? <Pressable onPress={() => setDate(new Date())} hitSlop={10} accessibilityRole="button" style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: t.vsoft, justifyContent: 'center', marginRight: 4 }}><Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.vtext }}>{tr('common.today')}</Text></Pressable> : null}
            <Pressable onPress={() => setDate(addDays(date, mode === 'week' ? -7 : -1))} hitSlop={6} accessibilityRole="button" accessibilityLabel={tr('calendar.prevWeek')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} color={t.muted} /></Pressable>
            <Pressable onPress={() => setDate(addDays(date, mode === 'week' ? 7 : 1))} hitSlop={6} accessibilityRole="button" accessibilityLabel={tr('calendar.nextWeek')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="chev" size={22} color={t.muted} /></Pressable>
          </View>
        </View>
      </View>
      {focus ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        <Chip label={tr('calendar.allTeam')} icon="users" active={!focus} onPress={() => setFocus(null)} />
        {all.map((m) => <Chip key={m.id} label={m.name} active={focus === String(m.id)} avatar={<Avatar name={m.name} size={28} uri={m.avatarUrl} />} onPress={() => setFocus(focus === String(m.id) ? null : String(m.id))} />)}
      </ScrollView> : null}
      <View style={{ flex: 1, marginTop: 12 }}>
        {err ? (
          <ErrorState error={err} onRetry={() => { void staff.reload(); void day.reload(); }} />
        ) : staff.loading || (day.loading && !day.data) ? (
          <Skeleton rows={5} height={80} />
        ) : masters.length === 0 ? (
          <StateView icon="users" title={tr('calendar.empty')} body={tr('sections.teamHint')} />
        ) : mode === 'day' && !focus && !day.loading && (day.data ?? []).filter((a) => a.status !== 'CANCELLED').length === 0 && (off.data ?? []).length === 0 ? (
          <StateView icon="cal" title={tr('ux.emptyToday')} body={tr('ux.emptyBookingsBody')} actionLabel={tr('calendar.newAppointment')} onAction={() => router.push({ pathname: '/booking/new', params: { date: toDay(date) } })} />
        ) : mode === 'week' ? (
          <WeekView date={date} appts={weekAppts} startHour={startHour} endHour={endHour} refreshing={day.refreshing}
            onRefresh={() => void day.reload()} onOpen={setOpen} onPickDay={(d) => { setDate(d); setMode('day'); }} />
        ) : focus ? (
          <Agenda date={date} appts={weekAppts} blocks={(off.data ?? []).filter((b) => String(b.staffId) === focus)} refreshing={day.refreshing}
            onRefresh={() => { void day.reload(); void off.reload(); }} onOpen={setOpen} onBlock={(b) => { setBlock(b); setBlockOpen(true); }}
            empty={<StateView icon="cal" title={tr('calendar.freeDay')} body={tr('calendar.freeDayBody')} />} />
        ) : (
          <Timeline date={date} masters={masters} appts={day.data ?? []} blocks={off.data ?? []} startHour={startHour} endHour={endHour}
            refreshing={day.refreshing} onRefresh={() => { void day.reload(); void off.reload(); }} onOpen={setOpen} onBlock={(b) => { setBlock(b); setBlockOpen(true); }} onPickMaster={(m) => setFocus(String(m.id))} />
        )}
      </View>
      <BookingSheet appt={open} onClose={() => setOpen(null)} />
      <BlockTimeSheet open={blockOpen} date={date} masters={all} preset={focus} existing={block} onClose={() => setBlockOpen(false)} onDone={() => { setBlockOpen(false); void off.reload(); }} />
    </Screen>
  );
}
