import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookingRow } from '@/components/BookingRow';
import { BookingSheet } from '@/components/BookingSheet';
import { Chip, Circ, ErrorState, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment } from '@/lib/api';
import { useApp } from '@/lib/app';
import { rememberClients } from '@/lib/client-cache';
import { addDays, dayMonth, sameDay, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { salonNow } from '@/lib/salonClock';

type F = 'all' | 'PENDING' | 'CONFIRMED';

/** BF03 Rezervlər: the day's bookings as photo rows with a status filter. */
export default function Bookings() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version } = useApp();
  const sid = salon?.id ?? '';
  const [date, setDate] = useState(() => new Date());
  const [f, setF] = useState<F>('all');
  const [open, setOpen] = useState<Appointment | null>(null);
  const data = useLoad(() => api.appointments(sid, date), [sid, date.toDateString(), version]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => []); rememberClients(r); return r.length; }, [sid]);
  const rows = useMemo(() => (data.data ?? []).filter((a) => a.status !== 'CANCELLED').filter((a) => f === 'all' ? true : a.status === f).sort((a, b) => toMin(a.startTime) - toMin(b.startTime)), [data.data, f]);
  return (
    <Screen>
      <Header title={tr('ux.bookingsTitle')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        subtitle={`${sameDay(date, salonNow()) ? tr('common.today') : toDay(date)} · ${dayMonth(date)}`}
        right={<><Circ icon="back" label={tr('calendar.prevWeek')} onPress={() => setDate(addDays(date, -1))} /><Circ icon="chev" label={tr('calendar.nextWeek')} onPress={() => setDate(addDays(date, 1))} /></>} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginBottom: 14 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {([['all', tr('ux.fStatusAll')], ['PENDING', tr('ux.fPending')], ['CONFIRMED', tr('ux.fConfirmed')]] as const).map(([k, l]) => <Chip key={k} label={l} active={f === k} onPress={() => setF(k)} />)}
      </ScrollView>
      {data.error && !data.data ? <ErrorState error={data.error} onRetry={() => void data.reload()} /> : data.loading && !data.data ? <Skeleton rows={4} height={110} /> : (
        <FlatList data={rows} keyExtractor={(a) => a.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="cal" title={tr('ux.emptyBookings')} body={tr('ux.emptyBookingsBody')} actionLabel={tr('calendar.newAppointment')} onAction={() => router.push({ pathname: '/booking/new', params: { date: toDay(date) } })} />}
          renderItem={({ item }) => <BookingRow a={item} staff={staff.data ?? []} onPress={() => setOpen(item)} />} />
      )}
      <BookingSheet appt={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
