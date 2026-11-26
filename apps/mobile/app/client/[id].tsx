import React, { useRef, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { EditClientSheet } from '@/components/EditClientSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { ToggleRow, num } from '@/components/form';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, ErrorState, Field, Header, Hero, Pill, Row, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type Client, type ClientWithStats } from '@/lib/api';
import { useApp } from '@/lib/app';
import { recallClient, rememberClients } from '@/lib/client-cache';
import { dateLabel, digits, fromIso, hhmm, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const TONE = { PENDING: 'violet', CONFIRMED: 'violet', COMPLETED: 'ok', CANCELLED: 'muted', NO_SHOW: 'guava' } as const;

/** Client card (BF49 mobile): contact actions, stats, next visit and favourites, notes (add only), visit history, "new appointment" for this client. */
export default function ClientCard() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, bump } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = decodeURIComponent(String(id));
  const stale = useRef(false);
  const fromList = recallClient(key);
  const loaded = useLoad<Client | ClientWithStats | null>(async () => {
    if (fromList && !stale.current) return fromList;
    const all = await api.clients(salon?.id ?? '');
    rememberClients(all);
    stale.current = false;
    return all.find((c) => String(c.id) === key) ?? null;
  }, [key]);
  const client = loaded.data;
  const rec = useLoad(() => (client?.id ? api.clientRecord(salon?.id ?? '', client.id) : Promise.resolve(null)), [client?.id]);
  const [editing, setEditing] = useState(false);
  const crm = useLoad(() => (client?.id && salon ? apiB.crm(salon.id, client.id).catch(() => null) : Promise.resolve(null)), [client?.id]);
  const bal = useLoad(() => (client?.id ? apiB.balance(client.id).catch(() => null) : Promise.resolve(null)), [client?.id]);
  const pts = useLoad(() => (client?.id && salon ? apiB.loyalty(salon.id, client.id).catch(() => null) : Promise.resolve(null)), [client?.id]);
  const [reason, setReason] = useState('');
  const [settle, setSettle] = useState('');
  const [crmBusy, setCrmBusy] = useState(false);
  const crmRun = async (fn: () => Promise<unknown>, after: () => void) => { setCrmBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setCrmBusy(false); } };
  const consents = useLoad(() => (client?.id ? apiX.clientConsents(client.id).catch(() => []) : Promise.resolve([])), [client?.id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const stats = (client ?? {}) as Partial<ClientWithStats>;
  const name = client ? `${client.firstName} ${client.lastName ?? ''}`.trim() : '';
  const visits = stats.pastVisits ?? stats.totalVisits ?? 0;
  const noShows = stats.noShowAppointments ?? 0;

  async function addNote() {
    if (!client || !salon) return;
    setBusy(true);
    try {
      await api.addClientNote(salon.id, client.id, note.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNote('');
      await rec.reload();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() { await Promise.all([loaded.reload(), rec.reload()]); bump(); }

  return (
    <Screen>
      <Header title={name || tr('clients.title')} onBack={() => router.back()} right={client ? <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={tr('cx.edit')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="edit" size={20} color={t.ink} /></Pressable> : undefined} />
      {loaded.error ? <ErrorState error={loaded.error} onRetry={() => void loaded.reload()} /> : !client && !loaded.loading ? <StateView icon="users" title={tr('state.errorTitle')} actionLabel={tr('state.retry')} onAction={() => void loaded.reload()} /> : !client ? <Skeleton rows={3} height={90} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loaded.refreshing || rec.refreshing} onRefresh={() => void refresh()} tintColor={t.violet} />}>
          <Hero><View style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <Avatar name={name} size={84} uri={stats.avatarUrl} />
              <View style={{ flex: 1, gap: 3 }}>
                {client.phone ? <Text style={{ fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{client.phone}</Text> : null}
                {client.email ? <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{client.email}</Text> : null}
                {!client.phone && !client.email ? <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('cl.noContact')}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {visits === 0 ? null : visits === 1 ? <Pill text={tr('cl.tagNew')} tone="violet" /> : visits >= 3 ? <Pill text={tr('cl.tagRegular')} tone="ok" /> : null}
                  {noShows > 0 ? <Pill text={tr('cl.noShowsN', { n: noShows })} tone="guava" /> : null}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {client.phone ? <Btn small label={tr('common.call')} icon="phone" variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`tel:${(client.phone ?? '').replace(/\s+/g, '')}`).catch(() => {})} /> : null}
              {client.phone ? <Btn small label={tr('common.whatsapp')} icon="chat" variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`https://wa.me/${digits(client.phone)}`).catch(() => {})} /> : null}
            </View>
            <Btn label={tr('cl.newBooking')} icon="plus" style={{ marginTop: 10 }}
              onPress={() => router.push({ pathname: '/booking/new', params: { clientId: String(client.id), clientName: name } })} />
          </View></Hero>
          <Card style={{ paddingVertical: 8 }}>
            <Row label={tr('clients.visits')} value={String(visits)} />
            <Row label={tr('clients.spent')} value={money(stats.totalSpent, salon?.currency)} />
            <Row label={tr('cl.avgCheck')} value={stats.avgPrice != null ? money(stats.avgPrice, salon?.currency) : '—'} />
            <Row label={tr('clients.lastVisit')} value={stats.lastVisitDate ? dateLabel(fromIso(stats.lastVisitDate)) : '-'} />
            {stats.nextVisitDate ? <Row label={tr('cl.nextVisit')} value={`${dateLabel(fromIso(stats.nextVisitDate))}${stats.nextVisitTime ? ` · ${hhmm(stats.nextVisitTime)}` : ''}`} /> : null}
            {stats.favouriteService ? <Row label={tr('cl.favService')} value={stats.favouriteService} /> : null}
            {stats.favouriteMaster ? <Row label={tr('cl.favMaster')} value={stats.favouriteMaster} /> : null}
          </Card>
          {client.id ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Icon name="note" size={20} color={t.vtext} />
                <Text style={{ fontFamily: font.x, fontSize: 19, color: t.ink }}>{tr('clients.notes')}</Text>
              </View>
              <Card>
                {client.notes ? <Text style={{ fontFamily: font.m, fontSize: 15, color: t.ink, marginBottom: 8 }}>{client.notes}</Text> : null}
                {(rec.data?.notes ?? []).map((n) => (
                  <View key={n.id} style={{ paddingVertical: 6 }}>
                    <Text style={{ fontFamily: font.m, fontSize: 15, color: t.ink }}>{n.body}</Text>
                    <Text style={{ fontFamily: font.m, fontSize: 12, color: t.muted }}>{[n.author_name, n.created_at?.slice(0, 10)].filter(Boolean).join(' · ')}</Text>
                  </View>
                ))}
                {!client.notes && !(rec.data?.notes ?? []).length ? <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted, marginBottom: 12 }}>{tr('clients.noNotes')}</Text> : null}
                <Field placeholder={tr('clients.noteHint')} value={note} onChangeText={setNote} multiline style={{ minHeight: 80, paddingTop: 14, textAlignVertical: 'top' }} />
                <Btn label={tr('clients.addNote')} disabled={!note.trim()} loading={busy} onPress={() => void addNote()} />
              </Card>
              <Card style={{ gap: 4 }}>
                <ToggleRow label={tr('ad.vip')} value={!!stats.vip} onChange={(v) => void crmRun(() => apiB.setVip(client.id, v), () => { stale.current = true; void loaded.reload(); })} />
                {pts.data ? <Row label={tr('ad.points')} value={String(pts.data.pointsBalance ?? pts.data.points_balance ?? 0)} /> : null}
                {bal.data ? <Row label={bal.data.outstanding > 0 ? tr('ad.owes') : tr('ad.credit')} value={money(bal.data.outstanding > 0 ? bal.data.outstanding : bal.data.credit, salon?.currency)} /> : null}
                {bal.data && bal.data.outstanding > 0 ? (
                  <>
                    <Field label={tr('ex.amount')} value={settle} onChangeText={setSettle} keyboardType="decimal-pad" />
                    <Btn label={tr('ad.settle')} variant="secondary" loading={crmBusy} disabled={!(num(settle) > 0)} onPress={() => void crmRun(() => apiB.settle(client.id, Math.min(num(settle), bal.data!.outstanding), 'CASH'), () => { setSettle(''); void bal.reload(); })} />
                  </>
                ) : null}
                {crm.data?.blocked ? (
                  <>
                    <Pill text={tr('ad.blocked')} tone="guava" />
                    <Btn label={tr('ad.unblock')} variant="secondary" loading={crmBusy} onPress={() => salon && void crmRun(() => apiB.unblock(salon.id, client.id), () => void crm.reload())} />
                  </>
                ) : (
                  <>
                    <Field label={tr('ad.blockReason')} value={reason} onChangeText={setReason} />
                    <Btn label={tr('ad.block')} variant="danger" loading={crmBusy} disabled={!reason.trim()} onPress={() => salon && void crmRun(() => apiB.block(salon.id, client.id, reason.trim()), () => { setReason(''); void crm.reload(); })} />
                  </>
                )}
              </Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Icon name="shield" size={20} color={t.vtext} />
                <Text style={{ fontFamily: font.x, fontSize: 19, color: t.ink }}>{tr('cx.consents')}</Text>
              </View>
              <Card>
                {(consents.data ?? []).length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('cx.noConsents')}</Text> : (consents.data ?? []).map((c) => (
                  <Row key={c.id} label={c.formName ?? '-'} value={(c.signedAt ?? c.createdAt ?? '').slice(0, 10)} />
                ))}
              </Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Icon name="clock" size={20} color={t.vtext} />
                <Text style={{ fontFamily: font.x, fontSize: 19, color: t.ink }}>{tr('clients.history')}</Text>
              </View>
              {rec.error ? <ErrorState error={rec.error} onRetry={() => void rec.reload()} /> : rec.loading && !rec.data ? <Skeleton rows={2} height={64} /> : (rec.data?.visits ?? []).length === 0 ? (
                <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('clients.noHistory')}</Text>
              ) : (
                (rec.data?.visits ?? []).map((v) => (
                  <Card key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{v.service_name}</Text>
                      <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{dateLabel(fromIso(v.appointment_date))} · {hhmm(v.start_time)}{v.staff_name ? ` · ${v.staff_name}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 13.5, color: t.ink }}>{money(v.price, salon?.currency)}</Text>
                      <Pill text={tr(`status.${v.status as keyof typeof TONE}`)} tone={TONE[v.status as keyof typeof TONE] ?? 'muted'} />
                    </View>
                  </Card>
                ))
              )}
            </>
          ) : null}
        </ScrollView>
      )}
      {client && editing ? <EditClientSheet client={client} open={editing} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); stale.current = true; void loaded.reload(); }} /> : null}
    </Screen>
  );
}
