import React, { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState, Screen } from '@/components/ui';
import { Avatar, BackBar, Button, Card, Chip, ChipRow, EmptyState, IconBtn, Skeleton, T, Title } from '@/components/kit';
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
  const [pushState, setPushState] = useState<'idle' | 'on' | 'failed' | 'later'>('idle');
  const [filter, setFilter] = useState<'all' | 'bookings' | 'reviews' | 'stock'>('all');
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

  const typeOf = (type: string) => (/REVIEW/.test(type) ? 'reviews' : /STOCK/.test(type) ? 'stock' : 'bookings');
  const items = (inbox.data?.items ?? []).filter((n) => (filter === 'all' || typeOf(n.type) === filter) && !(pending.length && n.type === 'BOOKING_NEW'));
  const showPending = filter === 'all' || filter === 'bookings';
  const dayKey = (iso: string) => { const d = iso.slice(0, 10); const now = new Date(); const y = addDays(now, -1); const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; return d === f(now) ? tr('v2.today') : d === f(y) ? tr('v3.yesterday') : dateLabel(fromIso(d)); };
  const groups: { label: string; rows: typeof items }[] = [];
  items.slice(0, 20).forEach((n) => { const l = dayKey(n.createdAt); const g = groups.find((x) => x.label === l); if (g) g.rows.push(n); else groups.push({ label: l, rows: [n] }); });
  const markRead = (id?: string | number) => void apiB.readInbox(id as never).then(() => { void inbox.reload(); bump(); }).catch(() => {});
  const Group = ({ label }: { label: string }) => <T k="sm" color={t.muted} style={{ fontFamily: font.b, marginTop: 10, marginBottom: -2, marginLeft: 4 }}>{label}</T>;
  const lead = (icon: string, tint = false) => <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint ? t.gsoft : t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={tint ? t.gink : t.ink} /></View>;

  return (
    <Screen>
      <BackBar label={tr('v2.today')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        right={unread ? <IconBtn icon="check" label={tr('pp.markAll')} onPress={() => markRead()} /> : undefined} />
      <Title style={{ paddingBottom: 12 }}>{tr('notifications.title')}</Title>
      <ChipRow style={{ marginBottom: 6 }}>
        {([['all', tr('v2.all')], ['bookings', tr('v3.fBookings')], ['reviews', tr('v3.fReviews')], ['stock', tr('v3.fStock')]] as const).map(([k, l]) => <Chip key={k} label={l} on={filter === k} onPress={() => setFilter(k)} count={k === 'bookings' && pending.length ? pending.length : undefined} />)}
      </ChipRow>
      {data.error && !data.data ? (
        <ErrorState error={data.error} onRetry={() => void data.reload()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingTop: 6, paddingBottom: inset }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.reload()} tintColor={t.violet} />}>
          {pushState === 'idle' || pushState === 'failed' ? (
            <Card style={{ padding: 16, flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              {lead('bell')}
              <View style={{ flex: 1, gap: 4 }}>
                <T k="h3">{tr('push.title')}</T>
                <T k="t2" color={t.muted}>{pushState === 'failed' ? tr('notifications.pushFailed') : tr('push.body')}</T>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button size="sm" label={tr('push.allow')} onPress={async () => setPushState((await enablePush()) ? 'on' : 'failed')} />
                  <Button size="sm" kind="ghost" label={tr('push.later')} onPress={() => setPushState('later')} />
                </View>
              </View>
            </Card>
          ) : null}
          {data.loading && !data.data ? <Skeleton blocks={[{ h: 130 }, { h: 130 }, { h: 90 }]} /> : null}
          {showPending && pending.length ? <Group label={tr('ux.waitingConfirm')} /> : null}
          {showPending ? pending.map((a) => {
            const c = a.clientId != null ? recallClient(String(a.clientId)) as ClientWithStats | undefined : undefined;
            return (
              <Card key={a.id} style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
                <Avatar name={a.clientName ?? ''} size={48} uri={c?.avatarUrl} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: font.r, fontSize: 14.5, lineHeight: 20, color: t.ink }}><Text style={{ fontFamily: font.b }}>{a.clientName || '-'}</Text> {tr('v3.bookedOnline')}: {a.serviceName}, {hhmm(a.startTime)}</Text>
                  <T k="sm" color={t.muted}>{dateLabel(fromIso(a.appointmentDate))}{a.staffName ? ` · ${a.staffName}` : ''}</T>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button size="sm" label={tr('v2.confirm')} loading={busyId === a.id} onPress={() => void confirm(a.id)} />
                    <Button size="sm" kind="fl" label={tr('v3.otherTime')} onPress={() => router.push(`/booking/${a.id}`)} />
                  </View>
                </View>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.violet, marginTop: 6 }} />
              </Card>
            );
          }) : null}
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <Group label={g.label} />
              {g.rows.map((n) => {
                let d: unknown = null; try { d = n.data ? JSON.parse(n.data) : null; } catch { d = null; }
                const ty = typeOf(n.type);
                return (
                  <Card key={n.id} onPress={ty === 'bookings' ? () => { if (!n.readAt) markRead(n.id); router.push(routeOf(d) as never); } : undefined} label={n.title} style={{ padding: 14, flexDirection: 'row', gap: 12 }}>
                    {lead(iconOf(n.type), ty === 'stock')}
                    <View style={{ flex: 1, gap: 2 }}>
                      <T k="t1" style={{ fontFamily: font.b }}>{n.title}</T>
                      {n.body ? <T k="body" color={t.ink}>{n.body}</T> : null}
                      <T k="sm" color={t.muted}>{when(n.createdAt)}</T>
                      {ty === 'reviews' ? <Button size="sm" kind="fl" label={tr('v3.reply')} style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => router.push('/section/reviews')} /> : null}
                      {ty === 'stock' ? <Button size="sm" kind="fl" label={tr('v3.orderNote')} style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => router.push('/section/inventory')} /> : null}
                    </View>
                    {!n.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.violet, marginTop: 6 }} /> : null}
                  </Card>
                );
              })}
            </React.Fragment>
          ))}
          {filter === 'all' && (ev.data?.events ?? []).length ? (
            <>
              <Group label={tr('ev.title')} />
              {ev.data!.events.slice(0, 6).map((e) => (
                <Card key={e.id} style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {lead(e.type === 'REVIEW' ? 'star' : e.type === 'WAITLIST' ? 'user-plus' : e.type === 'BOOKING_CANCELLED' ? 'x' : 'cal')}
                  <View style={{ flex: 1 }}>
                    <T k="t1" lines={1}>{`${tr(`ev.${e.type}` as 'ev.REVIEW')}${e.who ? ` · ${e.who}` : ''}`}</T>
                    <T k="sm" color={t.muted} lines={1}>{[e.what, e.date, e.time?.slice(0, 5)].filter(Boolean).join(' · ')}</T>
                  </View>
                </Card>
              ))}
            </>
          ) : null}
          {filter === 'all' ? <Group label={tr('notifications.waitlist')} /> : null}
          {filter === 'all' ? waitlist.map((w) => (
            <Card key={w.id} style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {lead('user-plus')}
                <View style={{ flex: 1 }}>
                  <T k="t1" lines={1}>{w.clientName || '-'}</T>
                  <T k="sm" color={t.muted} lines={2}>{tr('notifications.waitingFor', { service: w.serviceName ?? '-' })}{w.preferredDate ? ` · ${dateLabel(fromIso(w.preferredDate))}` : ''}</T>
                </View>
                <IconBtn icon="trash" label={tr('wl.remove')} color={t.gink} onPress={() => void apiX.removeWaitlist(salon?.id ?? '', w.id).then(() => { bump(); }).catch((e: Error) => toast(e.message, 'error'))} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button size="sm" label={tr('wl.book')} onPress={() => { const c = findClient(w.clientName, w.clientPhone); router.push({ pathname: '/booking/new', params: { ...(c ? { clientId: String(c.id), clientName: `${c.firstName} ${c.lastName ?? ''}`.trim() } : {}), date: w.preferredDate ?? undefined } }); }} />
                <Button size="sm" kind="fl" label={tr('ad.offer')} onPress={() => setOfferId(String(w.id))} />
              </View>
            </Card>
          )) : null}
          {filter === 'all' ? <Button kind="ghost" size="sm" icon="plus" label={tr('wl.add')} onPress={() => setWlOpen(true)} style={{ alignSelf: 'flex-start' }} /> : null}
          {empty ? <EmptyState photo={'demo:f03'} title={tr('v2.allRead')} body={tr('v2.allReadBody')} /> : null}
        </ScrollView>
      )}
      <OfferSheet entryId={offerId} open={!!offerId} onClose={() => setOfferId(null)} onSent={() => setOfferId(null)} />
      <WaitlistSheet open={wlOpen} onClose={() => setWlOpen(false)} onAdded={() => { setWlOpen(false); void data.reload(); }} />
    </Screen>
  );
}
