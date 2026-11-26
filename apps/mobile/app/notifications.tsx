import React, { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, ErrorState, Group, Header, Hero, ListRow, Screen, SectionTitle, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type ClientWithStats } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useDockInset } from '@/lib/dock';
import { addDays, dateLabel, fromIso, hhmm } from '@/lib/format';
import { enablePush } from '@/lib/push';
import { findClient, recallClient } from '@/lib/client-cache';
import { OfferSheet, WaitlistSheet } from '@/components/WaitlistSheet';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { routeOf } from '@/lib/push';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { ctaShadow, font } from '@/theme/tokens';

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
      toast((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  }
  const empty = !!data.data && !pending.length && !waitlist.length && !(inbox.data?.items ?? []).length;
  const unread = inbox.data?.unread ?? 0;
  const iconOf = (type: string) => (/CANCEL/.test(type) ? 'x' : /REVIEW/.test(type) ? 'star' : /WAIT/.test(type) ? 'clock' : /STOCK/.test(type) ? 'box' : /PAY|SALE/.test(type) ? 'wallet' : 'cal');
  const when = (iso: string) => { const d = fromIso(iso); return `${dateLabel(d)} · ${iso.slice(11, 16)}`; };

  return (
    <Screen>
      <Header title={tr('notifications.title')} subtitle={salon?.name} onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        right={unread ? <Pressable onPress={() => void apiB.readInbox().then(() => { void inbox.reload(); bump(); }).catch(() => {})} accessibilityRole="button" hitSlop={10}><Text style={{ fontFamily: font.b, fontSize: 15, color: t.vtext }}>{tr('pp.markAll')}</Text></Pressable> : undefined} />
      {data.error && !data.data ? (
        <ErrorState error={data.error} onRetry={() => void data.reload()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: inset }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.reload()} tintColor={t.violet} />}>
          {pushState !== 'on' ? (
            <Hero>
              <View style={{ padding: 18, gap: 4 }}>
                <Text style={{ fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: t.ink }}>{tr('notifications.pushOn')}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 15, lineHeight: 21, color: t.muted, marginBottom: 12 }}>{pushState === 'failed' ? tr('notifications.pushFailed') : tr('notifications.pushOnHint')}</Text>
                <Btn label={tr('notifications.pushOn')} onPress={async () => setPushState((await enablePush()) ? 'on' : 'failed')} />
              </View>
            </Hero>
          ) : null}
          {data.loading && !data.data ? <Skeleton rows={3} /> : null}
          {pending.length ? <SectionTitle title={tr('ux.waitingConfirm')} /> : null}
          {pending.map((a) => {
            const c = a.clientId != null ? recallClient(String(a.clientId)) as ClientWithStats | undefined : undefined;
            return (
              <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 92 }}>
                <Pressable onPress={() => router.push(`/booking/${a.id}`)} accessibilityRole="button" accessibilityLabel={`${a.clientName ?? ''} ${a.serviceName ?? ''}`} noScale style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar name={a.clientName ?? ''} size={56} uri={c?.avatarUrl} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, letterSpacing: -0.3, color: t.ink }}>{a.clientName || '-'}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{a.serviceName}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14, color: t.ink3 }}>{dateLabel(fromIso(a.appointmentDate))} · {hhmm(a.startTime)}{a.staffName ? ` · ${a.staffName}` : ''}</Text>
                </View>
                </Pressable>
                <Pressable onPress={() => void confirm(a.id)} disabled={busyId === a.id} haptic accessibilityRole="button" accessibilityLabel={tr('appt.confirm')}
                  style={[{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.violet, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: busyId === a.id ? 0.5 : 1 }, ctaShadow]}>
                  <Icon name="check" size={18} color="#fff" />
                  <Text style={{ fontFamily: font.b, fontSize: 14.5, color: '#fff' }}>{tr('appt.confirm')}</Text>
                </Pressable>
              </Card>
            );
          })}
          {(inbox.data?.items ?? []).length ? (
            <>
              <SectionTitle title={tr('pp.inbox')} />
              <Group>
                {inbox.data!.items.slice(0, 15).map((n) => {
                  let d: unknown = null; try { d = n.data ? JSON.parse(n.data) : null; } catch { d = null; }
                  return (
                    <ListRow key={n.id} icon={iconOf(n.type)} title={n.title} sub={`${n.body ? `${n.body}\n` : ''}${when(n.createdAt)}`}
                      right={!n.readAt ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.guava }} /> : <View />}
                      onPress={() => { if (!n.readAt) void apiB.readInbox(n.id).then(() => { void inbox.reload(); bump(); }).catch(() => {}); router.push(routeOf(d) as never); }} />
                  );
                })}
              </Group>
            </>
          ) : null}
          {(ev.data?.events ?? []).length ? (
            <>
              <SectionTitle title={tr('ev.title')} action={ev.data!.unread ? tr('ev.markRead') : undefined} onAction={() => void apiX.readHubEvents(salon?.id ?? '').then(() => ev.reload()).catch(() => {})} />
              <Group>
                {ev.data!.events.slice(0, 8).map((e) => (
                  <ListRow key={e.id} icon={e.type === 'REVIEW' ? 'star' : e.type === 'WAITLIST' ? 'user-plus' : e.type === 'BOOKING_CANCELLED' ? 'x' : 'cal'} title={`${tr(`ev.${e.type}` as 'ev.REVIEW')}${e.who ? ` · ${e.who}` : ''}`} sub={[e.what, e.date, e.time?.slice(0, 5)].filter(Boolean).join(' · ')} />
                ))}
              </Group>
            </>
          ) : null}
          <SectionTitle title={tr('notifications.waitlist')} action={`+ ${tr('wl.add')}`} onAction={() => setWlOpen(true)} />
          {waitlist.map((w) => (
            <Card key={w.id} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="user-plus" size={22} color={t.vtext} /></View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16.5, color: t.ink }}>{w.clientName || '-'}</Text>
                <Text numberOfLines={2} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('notifications.waitingFor', { service: w.serviceName ?? '-' })}{w.preferredDate ? ` · ${dateLabel(fromIso(w.preferredDate))}` : ''}</Text>
              </View>
              <Pressable onPress={() => setOfferId(String(w.id))} accessibilityRole="button" accessibilityLabel={tr('ad.offer')} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="send" size={22} color={t.vtext} /></Pressable>
              <Pressable onPress={() => { const c = findClient(w.clientName, w.clientPhone); router.push({ pathname: '/booking/new', params: { ...(c ? { clientId: String(c.id), clientName: `${c.firstName} ${c.lastName ?? ''}`.trim() } : {}), date: w.preferredDate ?? undefined } }); }} accessibilityRole="button" accessibilityLabel={tr('wl.book')} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="cal" size={22} color={t.vtext} /></Pressable>
              <Pressable onPress={() => void apiX.removeWaitlist(salon?.id ?? '', w.id).then(() => { bump(); }).catch((e: Error) => toast(e.message, 'error'))} accessibilityRole="button" accessibilityLabel={tr('wl.remove')} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={22} color={t.gink} /></Pressable>
            </Card>
          ))}
          {empty ? <StateView icon="bell" title={tr('ux.nothingNew')} body={tr('ux.nothingNewBody')} /> : null}
        </ScrollView>
      )}
      <OfferSheet entryId={offerId} open={!!offerId} onClose={() => setOfferId(null)} onSent={() => setOfferId(null)} />
      <WaitlistSheet open={wlOpen} onClose={() => setWlOpen(false)} onAdded={() => { setWlOpen(false); void data.reload(); }} />
    </Screen>
  );
}
