import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, ErrorState, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useDockInset } from '@/lib/dock';
import { addDays, dateLabel, fromIso, hhmm } from '@/lib/format';
import { enablePush } from '@/lib/push';
import { findClient } from '@/lib/client-cache';
import { OfferSheet, WaitlistSheet } from '@/components/WaitlistSheet';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { routeOf } from '@/lib/push';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/**
 * No server-side inbox endpoint exists yet, so the list is derived (as in the old app): bookings waiting for the salon's
 * confirmation (next 30 days) and waitlist requests. The OS push prompt only appears after the button below.
 */
export default function Notifications() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version, bump } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const inset = useDockInset(16);
  const [pushState, setPushState] = useState<'idle' | 'on' | 'failed'>('idle');
  const data = useLoad(async () => {
    const today = new Date();
    const [appts, waitlist] = await Promise.all([api.appointments(salon?.id ?? '', today, addDays(today, 30)), api.waitlist(salon?.id ?? '').catch(() => [])]);
    return { pending: appts.filter((a) => a.status === 'PENDING').sort((a, b) => `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`)), waitlist };
  }, [salon?.id, version]);
  const [wlOpen, setWlOpen] = useState(false);
  const inbox = useLoad(() => apiB.inbox(30).catch(() => null), [salon?.id, version]);
  const [offerId, setOfferId] = useState<string | null>(null);
  const ev = useLoad(() => apiX.hubEvents(salon?.id ?? '').catch(() => null), [salon?.id, version]);
  const pending = data.data?.pending ?? [];
  const waitlist = data.data?.waitlist ?? [];
  async function confirm(id: string) {
    setBusyId(id);
    try {
      await api.confirmAppointment(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  const empty = !!data.data && !pending.length && !waitlist.length;

  return (
    <Screen>
      <Header title={tr('notifications.title')} subtitle={salon?.name} />
      {data.error && !data.data ? (
        <ErrorState error={data.error} onRetry={() => void data.reload()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: inset }}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.reload()} tintColor={t.violet} />}>
          <Card style={{ backgroundColor: t.vsoft, gap: 6 }}>
            <Text style={{ fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{pushState === 'on' ? tr('notifications.pushEnabled') : tr('notifications.pushOn')}</Text>
            <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginBottom: 6 }}>{pushState === 'failed' ? tr('notifications.pushFailed') : tr('notifications.pushOnHint')}</Text>
            {pushState !== 'on' ? <Btn label={tr('notifications.pushOn')} onPress={async () => setPushState((await enablePush()) ? 'on' : 'failed')} /> : null}
          </Card>
          {data.loading && !data.data ? <Skeleton rows={3} /> : null}
          {(inbox.data?.items ?? []).length ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, marginHorizontal: 4 }}>{tr('pp.inbox')}{inbox.data!.unread ? ` (${inbox.data!.unread})` : ''}</Text>
                {inbox.data!.unread ? <Pressable onPress={() => void apiB.readInbox().then(() => { void inbox.reload(); bump(); }).catch(() => {})} accessibilityRole="button"><Text style={{ fontFamily: font.b, fontSize: 13.5, color: t.vtext }}>{tr('pp.markAll')}</Text></Pressable> : null}
              </View>
              {inbox.data!.items.slice(0, 15).map((n) => {
                let d: unknown = null; try { d = n.data ? JSON.parse(n.data) : null; } catch { d = null; }
                return (
                  <Card key={n.id} onPress={() => { if (!n.readAt) void apiB.readInbox(n.id).then(() => { void inbox.reload(); bump(); }).catch(() => {}); router.push(routeOf(d) as never); }} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: n.readAt ? 0.65 : 1 }}>
                    {!n.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.guava }} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{n.title}</Text>
                      {n.body ? <Text numberOfLines={2} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{n.body}</Text> : null}
                      <Text style={{ fontFamily: font.m, fontSize: 12, color: t.ink3 }}>{n.createdAt.slice(0, 16).replace('T', ' ')}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : null}
          {(ev.data?.events ?? []).length ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, marginHorizontal: 4 }}>{tr('ev.title')}</Text>
                {ev.data!.unread ? <Pressable onPress={() => void apiX.readHubEvents(salon?.id ?? '').then(() => ev.reload()).catch(() => {})} accessibilityRole="button"><Text style={{ fontFamily: font.b, fontSize: 13.5, color: t.vtext }}>{tr('ev.markRead')}</Text></Pressable> : null}
              </View>
              {ev.data!.events.slice(0, 8).map((e) => (
                <Card key={e.id} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: e.unread ? 1 : 0.7 }}>
                  <Icon name={e.type === 'REVIEW' ? 'star' : e.type === 'WAITLIST' ? 'user-plus' : e.type === 'BOOKING_CANCELLED' ? 'x' : 'cal'} size={20} color={t.vtext} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{tr(`ev.${e.type}` as 'ev.REVIEW')}{e.who ? ` · ${e.who}` : ''}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{[e.what, e.date, e.time?.slice(0, 5)].filter(Boolean).join(' · ')}</Text>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}
          {empty ? <StateView icon="bell" title={tr('notifications.empty')} /> : null}
          {pending.length ? <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, marginHorizontal: 4, marginTop: 4 }}>{tr('notifications.pending')}</Text> : null}
          {pending.map((a) => (
            <Pressable key={a.id} onPress={() => router.push(`/booking/${a.id}`)} accessibilityRole="button" accessibilityLabel={`${a.clientName ?? ''} ${a.serviceName ?? ''}`}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar name={a.clientName ?? ''} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{a.clientName || '-'}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{a.serviceName}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{dateLabel(fromIso(a.appointmentDate))} · {hhmm(a.startTime)} · {a.staffName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Pill text={tr('status.PENDING')} tone="amber" />
                  <Pressable onPress={() => void confirm(a.id)} disabled={busyId === a.id} haptic accessibilityRole="button" accessibilityLabel={tr('appt.confirm')}
                    style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: t.violet, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: busyId === a.id ? 0.5 : 1 }}>
                    <Icon name="check" size={16} color="#fff" />
                    <Text style={{ fontFamily: font.b, fontSize: 13, color: '#fff' }}>{tr('appt.confirm')}</Text>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, marginHorizontal: 4 }}>{tr('notifications.waitlist')}</Text>
            <Pressable onPress={() => setWlOpen(true)} accessibilityRole="button" accessibilityLabel={tr('wl.add')} hitSlop={8}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.vtext }}>+ {tr('wl.add')}</Text></Pressable>
          </View>
          {waitlist.map((w) => (
            <Card key={w.id} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="user-plus" size={24} color={t.vtext} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{w.clientName || '-'}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{tr('notifications.waitingFor', { service: w.serviceName ?? '-' })}{w.preferredDate ? ` · ${toDay(fromIso(w.preferredDate))}` : ''}</Text>
              </View>
              <Pressable onPress={() => setOfferId(String(w.id))} accessibilityRole="button" accessibilityLabel={tr('ad.offer')}><Icon name="send" size={22} color={t.vtext} /></Pressable>
              <Pressable onPress={() => { const c = findClient(w.clientName, w.clientPhone); router.push({ pathname: '/booking/new', params: { ...(c ? { clientId: String(c.id), clientName: `${c.firstName} ${c.lastName ?? ''}`.trim() } : {}), date: w.preferredDate ?? undefined } }); }} accessibilityRole="button" accessibilityLabel={tr('wl.book')}><Icon name="cal" size={22} color={t.vtext} /></Pressable>
              <Pressable onPress={() => void apiX.removeWaitlist(salon?.id ?? '', w.id).then(() => { bump(); }).catch((e: Error) => Alert.alert(tr('common.error'), e.message))} accessibilityRole="button" accessibilityLabel={tr('wl.remove')}><Icon name="trash" size={22} color={t.gink} /></Pressable>
            </Card>
          ))}
        </ScrollView>
      )}
      <OfferSheet entryId={offerId} open={!!offerId} onClose={() => setOfferId(null)} onSent={() => setOfferId(null)} />
      <WaitlistSheet open={wlOpen} onClose={() => setWlOpen(false)} onAdded={() => { setWlOpen(false); void data.reload(); }} />
    </Screen>
  );
}
