import React, { useMemo } from 'react';
import { toast } from '@/lib/toast';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BookingRow } from '@/components/BookingRow';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Card, Circ, SectionTitle, Skeleton } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type ClientWithStats } from '@/lib/api';
import { useApp } from '@/lib/app';
import { recallClient, rememberClients } from '@/lib/client-cache';
import { useDockInset } from '@/lib/dock';
import { dayMonth, hhmm, money, toMin, weekdayLong } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { circShadow, cardShadow, font } from '@/theme/tokens';

/** BF01 "Bu gün": greeting, dark next-client hero, quick actions, the day's numbers and the next bookings. */
export function TodayHome({ onOpen, onBlock, onCalendar }: { onOpen: (a: Appointment) => void; onBlock: () => void; onCalendar: () => void }) {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, user, version, bump, badges } = useApp();
  const inset = useDockInset(24);
  const sid = salon?.id ?? '';
  const now = new Date();
  const day = useLoad(() => api.appointments(sid, now), [sid, version]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const sheet = useLoad(() => api.daySheet(sid, now).catch(() => null), [sid, version]);
  useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => []); rememberClients(r); return r.length; }, [sid]);
  const list = useMemo(() => (day.data ?? []).filter((a) => a.status !== 'CANCELLED').sort((a, b) => toMin(a.startTime) - toMin(b.startTime)), [day.data]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = list.filter((a) => toMin(a.endTime) > nowMin && a.status !== 'COMPLETED' && a.status !== 'NO_SHOW');
  const next = upcoming[0] ?? null;
  const rest = (next ? upcoming.filter((a) => a.id !== next.id) : upcoming).slice(0, 3);
  const first = (user?.fullName ?? '').split(/\s+/)[0] || '';
  const c = next?.clientId != null ? (recallClient(String(next.clientId)) as ClientWithStats | undefined) : undefined;
  const minsTo = next ? toMin(next.startTime) - nowMin : 0;
  const pending = list.filter((a) => a.status === 'PENDING').length;
  const tot = sheet.data?.totals;

  async function arrived(a: Appointment) {
    if (a.status !== 'PENDING') { onOpen(a); return; }
    try { await api.confirmAppointment(a.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); bump(); } catch (e) { toast((e as Error).message, 'error'); }
  }
  const quick = [
    { k: 'new', icon: 'plus', label: tr('ux.quickNew'), bg: t.vsoft, fg: t.vtext, on: () => router.push({ pathname: '/booking/new', params: { date: toDay(now) } }) },
    { k: 'break', icon: 'timer', label: tr('ux.quickBreak'), bg: t.gsoft, fg: t.gink, on: onBlock },
    { k: 'svc', icon: 'tag', label: tr('ux.quickService'), bg: t.dark ? '#342a1d' : '#fbecd6', fg: t.dark ? '#f0c27a' : '#8a5200', on: () => router.push('/section/services') },
    { k: 'story', icon: 'spark', label: tr('ux.quickStory'), bg: t.oksoft, fg: t.ok, on: () => router.push('/section/views') },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: inset, gap: 16 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={day.refreshing} onRefresh={() => { void day.reload(); void sheet.reload(); }} tintColor={t.violet} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 }}>
        <Avatar name={salon?.name ?? ''} size={46} uri={(salon as { logoUrl?: string } | null)?.logoUrl} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.b, fontSize: 16, color: t.muted }}>{salon?.name}</Text>
        <Circ icon="cal" label={tr('calendar.title')} onPress={onCalendar} />
        <Circ icon="bell" label={tr('tabs.notifications')} badge={badges.pending + badges.waitlist + badges.inbox} onPress={() => router.navigate('/notifications')} />
      </View>
      <View>
        <Text style={{ fontFamily: font.s, fontSize: 15.5, color: t.muted }}>{weekdayLong(now)} · {dayMonth(now)}</Text>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 38, lineHeight: 46, letterSpacing: -1.2, color: t.ink }}>{tr('ux.todayGreeting', { name: first })}</Text>
      </View>

      {day.loading && !day.data ? <Skeleton rows={2} height={160} /> : next ? (
        <LinearGradient colors={['#1d1730', '#35276b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 30, padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: font.x, fontSize: 14, letterSpacing: 1.6, color: 'rgba(255,255,255,.75)' }}>{tr('ux.nextClient').toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.14)' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff7aa2' }} />
              <Text style={{ fontFamily: font.x, fontSize: 14, color: '#fff' }}>{hhmm(next.startTime)}{minsTo > 0 && minsTo < 180 ? ` · ${tr('ux.inMin', { n: minsTo })}` : ''}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Avatar name={next.clientName ?? ''} size={76} uri={c?.avatarUrl} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 30, letterSpacing: -0.9, color: '#fff' }}>{next.clientName}</Text>
              <Text numberOfLines={2} style={{ fontFamily: font.s, fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,.8)' }}>{next.serviceName}{next.staffName ? ` · ${next.staffName}` : ''}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => void arrived(next)} haptic accessibilityRole="button" accessibilityLabel={tr('ux.arrived')} style={{ flex: 1.3, height: 54, borderRadius: 27, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="check" size={20} color="#1d1730" /><Text style={{ fontFamily: font.x, fontSize: 16.5, color: '#1d1730' }}>{tr('ux.arrived')}</Text>
            </Pressable>
            <Pressable onPress={() => onOpen(next)} accessibilityRole="button" accessibilityLabel={tr('ux.delay')} style={{ flex: 1, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,.14)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="clock" size={20} color="#fff" /><Text style={{ fontFamily: font.b, fontSize: 16, color: '#fff' }}>{tr('ux.delay')}</Text>
            </Pressable>
          </View>
        </LinearGradient>
      ) : (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 28 }}>
          <Icon name="cal" size={40} color={t.vtext} />
          <Text style={{ fontFamily: font.x, fontSize: 21, color: t.ink }}>{tr('ux.noBookingsToday')}</Text>
          <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted, textAlign: 'center' }}>{tr('ux.emptyBookingsBody')}</Text>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {quick.map((q) => (
          <Pressable key={q.k} onPress={q.on} haptic accessibilityRole="button" accessibilityLabel={q.label} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
            <View style={{ width: '100%', height: 74, borderRadius: 24, backgroundColor: q.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={q.icon} size={28} color={q.fg} /></View>
            <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14, color: t.ink }}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([[tr('ux.kpiBookings'), String(list.length)], [tr('ux.kpiExpected'), money(tot?.expected ?? list.reduce((n, a) => n + (a.price ?? 0), 0), salon?.currency)], [tr('ux.kpiWaiting'), String(pending)]] as const).map(([k, v]) => (
          <View key={k} style={[{ flex: 1, backgroundColor: t.surface, borderRadius: 22, padding: 14, gap: 2 }, cardShadow]}>
            <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13.5, color: t.muted }}>{k}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.x, fontSize: 24, letterSpacing: -0.6, color: t.ink }}>{v}</Text>
          </View>
        ))}
      </View>

      {rest.length ? (
        <>
          <SectionTitle title={tr('ux.todayTitle')} action={tr('ux.all')} onAction={() => router.push('/bookings')} />
          <View style={{ gap: 12 }}>{rest.map((a) => <BookingRow key={a.id} a={a} staff={staff.data ?? []} onPress={() => onOpen(a)} />)}</View>
        </>
      ) : null}
    </ScrollView>
  );
}
