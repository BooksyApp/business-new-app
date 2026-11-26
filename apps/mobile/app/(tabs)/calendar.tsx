import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookingSheet } from '@/components/BookingSheet';
import { BlockTimeSheet } from '@/components/BlockTimeSheet';
import { DayStrip, Timeline, WeekView } from '@/components/calendar';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type Staff, type TimeOff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { addDays, monthLabel, startOfWeek, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { circShadow, ctaShadow, font } from '@/theme/tokens';

/** Round 42 px icon button (`.circ`). */
function Circ({ icon, onPress, label, violet }: { icon: string; onPress: () => void; label: string; violet?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: violet ? t.violet : t.surface }, violet ? ctaShadow : circShadow]}>
      <Icon name={icon} size={22} color={violet ? '#fff' : t.ink} />
    </Pressable>
  );
}

/** `.chip`: 38 tall, pill, 14/600; `on` = ink fill, `vo` = soft violet with a 1.5 violet ring. */
function Chip38({ label, on, vo, icon, onPress }: { label: string; on?: boolean; vo?: boolean; icon?: string; onPress?: () => void }) {
  const { t } = useTheme();
  const fg = on ? t.canvas : vo ? t.vtext : t.ink;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityState={{ selected: !!(on || vo) }}
      style={{ height: 38, paddingHorizontal: 15, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? t.ink : vo ? t.vsoft : t.surface, borderWidth: on ? 0 : vo ? 1.5 : 1, borderColor: vo ? t.violet : t.line }}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: font.s, fontSize: 14, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export default function Calendar() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version } = useApp();
  const [date, setDate] = useState(() => new Date());
  const [open, setOpen] = useState<Appointment | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [chips, setChips] = useState(true);
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [blockOpen, setBlockOpen] = useState(false);
  const [block, setBlock] = useState<TimeOff | null>(null);

  const sid = salon?.id ?? '';
  const staff = useLoad<Staff[]>(() => api.staff(sid), [sid]);
  const weekStart = startOfWeek(date);
  const day = useLoad(() => (mode === 'day' ? api.appointments(sid, date) : api.appointments(sid, weekStart, addDays(weekStart, 6))), [sid, mode, mode === 'day' ? date.toDateString() : weekStart.toDateString(), version]);
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
  const month = monthLabel(date);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: font.x, fontSize: 32, lineHeight: 35, letterSpacing: -0.96, color: t.ink }}>{tr('calendar.title')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Circ icon="sliders" label={tr('calendar.allTeam')} onPress={() => setChips((v) => !v)} />
            <Circ icon="clock-alert" label={tr('block.new')} onPress={() => { setBlock(null); setBlockOpen(true); }} />
            <Circ icon="plus" violet label={tr('calendar.newAppointment')} onPress={() => router.push({ pathname: '/booking/new', params: { date: toDay(date) } })} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 14 }}>
          <Text style={{ fontFamily: font.s, fontSize: 14.5, color: t.muted, textTransform: 'capitalize' }}>{month}</Text>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <Pressable onPress={() => setDate(addDays(date, -7))} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('calendar.prevWeek')}><Icon name="back" size={20} color={t.muted} /></Pressable>
            <Pressable onPress={() => setDate(addDays(date, 7))} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('calendar.nextWeek')}><Icon name="chev" size={20} color={t.muted} /></Pressable>
          </View>
        </View>
        <DayStrip date={date} onChange={setDate} />
        {chips ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
            <Chip38 label={tr('calendar.day')} on={mode === 'day'} onPress={() => setMode('day')} />
            <Chip38 label={tr('calendar.week')} on={mode === 'week'} onPress={() => setMode('week')} />
            <Chip38 label={tr('calendar.allTeam')} icon="users" vo={!focus} onPress={() => setFocus(null)} />
            {all.map((m) => <Chip38 key={m.id} label={m.name} vo={focus === String(m.id)} onPress={() => setFocus(focus === String(m.id) ? null : String(m.id))} />)}
          </ScrollView>
        ) : null}
      </View>
      <View style={{ flex: 1, marginTop: 12 }}>
        {err ? (
          <ErrorState error={err} onRetry={() => { void staff.reload(); void day.reload(); }} />
        ) : staff.loading || (day.loading && !day.data) ? (
          <Skeleton rows={5} height={80} />
        ) : masters.length === 0 ? (
          <StateView icon="users" title={tr('calendar.empty')} body={tr('sections.teamHint')} />
        ) : mode === 'week' ? (
          <WeekView date={date} appts={weekAppts} startHour={startHour} endHour={endHour} refreshing={day.refreshing}
            onRefresh={() => void day.reload()} onOpen={setOpen} onPickDay={(d) => { setDate(d); setMode('day'); }} />
        ) : (
          <Timeline date={date} masters={masters} appts={day.data ?? []} blocks={off.data ?? []} startHour={startHour} endHour={endHour}
            refreshing={day.refreshing} onRefresh={() => { void day.reload(); void off.reload(); }} onOpen={setOpen} onBlock={(b) => { setBlock(b); setBlockOpen(true); }} />
        )}
      </View>
      <BookingSheet appt={open} onClose={() => setOpen(null)} />
      <BlockTimeSheet open={blockOpen} date={date} masters={all} preset={focus} existing={block} onClose={() => setBlockOpen(false)} onDone={() => { setBlockOpen(false); void off.reload(); }} />
    </Screen>
  );
}
