import React, { useMemo, useState } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookingSheet } from '@/components/BookingSheet';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Chip as KChip, ChipRow } from '@/components/kit';
import { Circ, ErrorState, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment } from '@/lib/api';
import { useApp } from '@/lib/app';
import { rememberClients } from '@/lib/client-cache';
import { addDays, dayMonth, fromIso, hhmm, sameDay, toMin, weekdayShort } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';
import { salonNow } from '@/lib/salonClock';

type F = 'all' | 'PENDING' | 'CONFIRMED';
type Sec = { key: string; title: string; data: Appointment[] };
const SPAN = 7;
const TONE = { PENDING: 'amber', CONFIRMED: 'ok', COMPLETED: 'violet', CANCELLED: 'muted', NO_SHOW: 'guava' } as const;

/** Rezervlər: the next 7 days from the chosen day, grouped by day (light headers), one calm line per booking, one filter chip row. */
export default function Bookings() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version } = useApp();
  const sid = salon?.id ?? '';
  const [date, setDate] = useState(() => new Date());
  const [f, setF] = useState<F>('all');
  const [open, setOpen] = useState<Appointment | null>(null);
  const end = addDays(date, SPAN - 1);
  const data = useLoad(() => api.appointments(sid, date, end), [sid, date.toDateString(), version]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => []); rememberClients(r); return r.length; }, [sid]);
  const sections = useMemo<Sec[]>(() => {
    const rows = (data.data ?? []).filter((a) => a.status !== 'CANCELLED').filter((a) => (f === 'all' ? true : a.status === f))
      .sort((a, b) => (a.appointmentDate || '').localeCompare(b.appointmentDate || '') || toMin(a.startTime) - toMin(b.startTime));
    const out: Sec[] = [];
    const now = salonNow();
    for (const a of rows) {
      const k = (a.appointmentDate || '').slice(0, 10);
      let s = out[out.length - 1];
      if (!s || s.key !== k) {
        const d = fromIso(k);
        const title = sameDay(d, now) ? tr('common.today') : sameDay(d, addDays(now, 1)) ? tr('n4.tomorrow') : `${weekdayShort(d)}, ${dayMonth(d)}`;
        s = { key: k, title, data: [] };
        out.push(s);
      }
      s.data.push(a);
    }
    return out;
  }, [data.data, f]);
  const staffName = (a: Appointment) => (staff.data ?? []).find((s) => String(s.id) === String(a.staffId))?.name ?? a.staffName ?? '';
  return (
    <Screen>
      <Header title={tr('ux.bookingsTitle')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        subtitle={`${sameDay(date, salonNow()) ? tr('common.today') : dayMonth(date)} – ${dayMonth(end)}`}
        right={<><Circ icon="back" label={tr('calendar.prevWeek')} onPress={() => setDate(addDays(date, -SPAN))} /><Circ icon="chev" label={tr('calendar.nextWeek')} onPress={() => setDate(addDays(date, SPAN))} /></>} />
      <ChipRow style={{ marginBottom: 8 }}>
        {([['all', tr('ux.fStatusAll')], ['PENDING', tr('ux.fPending')], ['CONFIRMED', tr('ux.fConfirmed')]] as const).map(([k, l]) => <KChip key={k} label={l} on={f === k} onPress={() => setF(k)} />)}
      </ChipRow>
      {data.error && !data.data ? <ErrorState error={data.error} onRetry={() => void data.reload()} /> : data.loading && !data.data ? <Skeleton rows={6} height={56} /> : (
        <SectionList sections={sections} keyExtractor={(a) => a.id} stickySectionHeadersEnabled={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="cal" title={tr('ux.emptyBookings')} body={tr('ux.emptyBookingsBody')} actionLabel={tr('calendar.newAppointment')} onAction={() => router.push({ pathname: '/booking/new', params: { date: toDay(date) } })} />}
          renderSectionHeader={({ section }) => <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13, color: t.muted, paddingTop: 16, paddingBottom: 6 }}>{section.title}</Text>}
          renderItem={({ item, index }) => {
            const meta = [item.serviceName, staffName(item)].filter(Boolean).join(' · ');
            return (
              <Pressable onPress={() => setOpen(item)} accessibilityRole="button" accessibilityLabel={`${hhmm(item.startTime)} ${item.clientName ?? ''} ${meta}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderTopColor: t.hair }}>
                <Text numberOfLines={1} style={{ width: 46, fontFamily: font.b, fontSize: 14, color: t.ink }}>{hhmm(item.startTime)}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{item.clientName || '-'}</Text>
                  {meta ? <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 13, color: t.muted }}>{meta}</Text> : null}
                </View>
                <Pill text={tr(`status.${item.status}`)} tone={TONE[item.status] ?? 'violet'} />
              </Pressable>
            );
          }} />
      )}
      <BookingSheet appt={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
