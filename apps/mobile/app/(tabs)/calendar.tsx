import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookingSheet } from '@/components/BookingSheet';
import { DayStrip, Timeline, type Density } from '@/components/calendar';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Chip, ErrorState, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { dateLabel, sameDay, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const DENSITY_KEY = 'booqi.biz.density';

export default function Calendar() {
  const { t } = useTheme();
  const { salon, version } = useApp();
  const [date, setDate] = useState(() => new Date());
  const [density, setDensity] = useState<Density>('comfy');
  const [open, setOpen] = useState<Appointment | null>(null);
  useEffect(() => { AsyncStorage.getItem(DENSITY_KEY).then((v) => { if (v === 'compact' || v === 'comfy') setDensity(v); }).catch(() => {}); }, []);
  const pick = (d: Density) => { setDensity(d); AsyncStorage.setItem(DENSITY_KEY, d).catch(() => {}); };

  const sid = salon?.id ?? '';
  const staff = useLoad<Staff[]>(() => api.staff(sid), [sid]);
  const day = useLoad(async () => {
    const [appts, waitlist] = await Promise.all([api.appointments(sid, date), api.waitlist(sid).catch(() => [])]);
    return { appts, waitlist };
  }, [sid, date.toDateString(), version]);

  const masters = useMemo(() => {
    const list = (staff.data ?? []).filter((s) => s.isActive !== false);
    const known = new Set(list.map((s) => String(s.id)));
    const orphan = (day.data?.appts ?? []).some((a) => !known.has(String(a.staffId)));
    return orphan ? [...list, { id: '__none', name: tr('calendar.unassigned') } as Staff] : list;
  }, [staff.data, day.data]);

  // Visible hour range from data, never less than 9-19.
  const { startHour, endHour } = useMemo(() => {
    const a = day.data?.appts ?? [];
    const lo = Math.min(9, ...a.map((x) => Math.floor(toMin(x.startTime) / 60)));
    const hi = Math.max(19, ...a.map((x) => Math.ceil(toMin(x.endTime) / 60)));
    return { startHour: lo, endHour: Math.min(24, hi + 1) };
  }, [day.data]);

  const waiting = (day.data?.waitlist ?? []).filter((w) => w.status !== 'CANCELLED' && (!w.preferredDate || w.preferredDate.slice(0, 10) === toDay(date)));
  const err = (staff.error || day.error) as Error | null;
  const isToday = sameDay(date, new Date());

  return (
    <Screen>
      <Header title={tr('calendar.title')} subtitle={`${salon?.name ?? ''} · ${dateLabel(date)}`}
        right={!isToday ? <Chip label={tr('calendar.goToday')} onPress={() => setDate(new Date())} /> : undefined} />
      <DayStrip date={date} onChange={setDate} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 14, paddingBottom: 8 }}>
        <Text style={{ fontFamily: font.s, fontSize: 12.5, color: t.muted, marginRight: 4 }}>{tr('calendar.density')}</Text>
        {(['comfy', 'compact'] as const).map((d) => (
          <Pressable key={d} onPress={() => pick(d)} accessibilityRole="button" accessibilityState={{ selected: density === d }}
            style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center', backgroundColor: density === d ? t.vsoft : t.fill }}>
            <Text style={{ fontFamily: density === d ? font.b : font.s, fontSize: 13, color: density === d ? t.vtext : t.muted }}>{d === 'comfy' ? tr('calendar.densityComfy') : tr('calendar.densityCompact')}</Text>
          </Pressable>
        ))}
      </View>
      {waiting.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 8, gap: 8 }}>
          {waiting.map((w) => (
            <View key={w.id} style={{ backgroundColor: t.gsoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e83e63' }}>
              <Text style={{ fontFamily: font.b, fontSize: 12.5, color: t.gink }}>{tr('calendar.waiting')} · {w.clientName || '-'}</Text>
              <Text style={{ fontFamily: font.m, fontSize: 11.5, color: t.gink }}>{[w.serviceName, w.staffName].filter(Boolean).join(' · ')}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
      {err ? (
        <ErrorState error={err} onRetry={() => { void staff.reload(); void day.reload(); }} />
      ) : staff.loading || (day.loading && !day.data) ? (
        <Skeleton rows={5} height={80} />
      ) : masters.length === 0 ? (
        <StateView icon="users" title={tr('calendar.empty')} body={tr('sections.teamHint')} />
      ) : (
        <Timeline date={date} masters={masters} appts={day.data?.appts ?? []} density={density} startHour={startHour} endHour={endHour}
          refreshing={day.refreshing} onRefresh={() => void day.reload()} onOpen={setOpen} />
      )}
      <BookingSheet appt={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}
