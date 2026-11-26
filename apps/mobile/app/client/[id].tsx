import React, { useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, Linking, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { EditClientSheet } from '@/components/EditClientSheet';
import { ClientPackages } from '@/components/ClientPackages';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { apiM } from '@/lib/api-more';
import { Pressable } from '@/components/Pressable';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { ToggleRow, num } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, ErrorState, Field, Row, Screen } from '@/components/ui';
import { Avatar as KAvatar, BackBar, Button as KButton, Card as KCard, EmptyState, IconBtn, ListItem as KListItem, Photo as KPhoto, Pill as KPill, Skeleton as KSkel, T, UnderTabs } from '@/components/kit';
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
  const crmRun = async (fn: () => Promise<unknown>, after: () => void) => { setCrmBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after(); } catch (e) { toast((e as Error).message, 'error'); } finally { setCrmBusy(false); } };
  const consents = useLoad(() => (client?.id ? apiX.clientConsents(client.id).catch(() => []) : Promise.resolve([])), [client?.id]);
  const [note, setNote] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  const [ctab, setCtab] = useState<'overview' | 'visits' | 'notes' | 'photos'>('visits');
  const { width: W } = useWindowDimensions();
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
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function refresh() { await Promise.all([loaded.reload(), rec.reload()]); bump(); }

  const spent = stats.totalSpent;
  const since = (client as { createdAt?: string } | null)?.createdAt;
  const daysAgo = stats.lastVisitDate ? Math.max(0, Math.round((Date.now() - fromIso(stats.lastVisitDate).getTime()) / 86400000)) : null;
  const photosArr = ((rec.data as unknown as { photos?: { id: string | number; url: string }[] } | null)?.photos ?? []);
  const sub = [client?.phone, since ? tr('v3.clientSince', { d: since.slice(0, 7) }) : null].filter(Boolean).join(' · ');
  const L = (icon: string, text: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6 }}><Icon name={icon} size={18} color={t.ink} /><T k="h2">{text}</T></View>;
  return (
    <Screen>
      <BackBar label={tr('v2.clientsTitle')} onBack={() => router.back()} right={client ? <IconBtn icon="edit" label={tr('cx.edit')} onPress={() => setEditing(true)} /> : undefined} />
      {loaded.error ? <ErrorState error={loaded.error} onRetry={() => void loaded.reload()} /> : !client && !loaded.loading ? <EmptyState photo="demo:f04" title={tr('state.errorTitle')} action={{ label: tr('state.retry'), onPress: () => void loaded.reload() }} /> : !client ? <KSkel blocks={[{ h: 96 }, { h: 60 }, { h: 200 }]} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loaded.refreshing || rec.refreshing} onRefresh={() => void refresh()} tintColor={t.violet} />}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 20, paddingTop: 4 }}>
            <KAvatar name={name} size={92} uri={stats.avatarUrl} />
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {([[String(visits), tr('v3.visitsLabel')], [money(spent, salon?.currency), tr('v3.spentLabel')], [daysAgo != null ? String(daysAgo) : '–', tr('v3.daysAgoLabel')]] as const).map(([v, l]) => (
                <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.b, fontSize: 17, color: t.ink }}>{v}</Text>
                  <T k="xs" color={t.muted}>{l}</T>
                </View>
              ))}
            </View>
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: 12, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <T k="h1" style={{ fontSize: 22, lineHeight: 28 }}>{name}</T>
              {stats.vip ? <KPill icon="crown" tone="v" text="VIP" /> : visits === 1 ? <KPill tone="v" text={tr('cl.tagNew')} /> : visits >= 3 ? <KPill tone="ok" text={tr('cl.tagRegular')} /> : null}
              {noShows > 0 ? <KPill tone="g" text={tr('cl.noShowsN', { n: noShows })} /> : null}
            </View>
            {sub ? <T k="sm" color={t.muted}>{sub}</T> : !client.phone && !client.email ? <T k="sm" color={t.muted}>{tr('cl.noContact')}</T> : null}
            {stats.favouriteService ? <T k="sm" color={t.ink}>{tr('v3.fav')}: {[stats.favouriteMaster, stats.favouriteService].filter(Boolean).join(', ').toLowerCase()}</T> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14 }}>
            <KButton label={tr('v3.bookBtn')} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/booking/new', params: { clientId: String(client.id), clientName: name } })} />
            {client.phone ? <KButton kind="fl" label={tr('common.call')} style={{ flex: 1 }} onPress={() => void Linking.openURL(`tel:${(client.phone ?? '').replace(/\s+/g, '')}`).catch(() => {})} /> : null}
            {client.phone ? <Pressable onPress={() => void Linking.openURL(`https://wa.me/${digits(client.phone)}`).catch(() => {})} accessibilityRole="button" accessibilityLabel={tr('common.whatsapp')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name="chat" size={22} color={t.ink} /></Pressable> : null}
          </View>
          <View style={{ marginTop: 18 }}>
            <UnderTabs value={ctab} onChange={setCtab} items={[{ k: 'visits', label: tr('ux.tabVisits'), icon: 'cal' }, { k: 'notes', label: tr('ux.tabNotes'), icon: 'edit' }, { k: 'photos', label: tr('v3.photosTab'), icon: 'img' }, { k: 'overview', label: tr('v3.moreTab'), icon: 'dots' }]} />
          </View>
          {ctab === 'visits' ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
              {rec.error ? <ErrorState error={rec.error} onRetry={() => void rec.reload()} /> : rec.loading && !rec.data ? <KSkel blocks={[{ h: 56 }, { h: 56 }, { h: 56 }]} /> : (rec.data?.visits ?? []).length === 0 ? (
                <T k="body" color={t.muted} style={{ paddingVertical: 24, textAlign: 'center' }}>{tr('clients.noHistory')}</T>
              ) : (rec.data?.visits ?? []).map((v, i) => (
                <KListItem key={v.id} first={i === 0} title={v.service_name ?? '-'} sub={`${dateLabel(fromIso(v.appointment_date))}${v.staff_name ? ` · ${v.staff_name}` : ''}`}
                  right={<View style={{ alignItems: 'flex-end', gap: 4 }}><Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{money(v.price, salon?.currency)}</Text>{v.status !== 'COMPLETED' ? <KPill tone={v.status === 'NO_SHOW' ? 'g' : 'fl'} text={tr(`status.${v.status as keyof typeof TONE}`)} /> : null}</View>} />
              ))}
            </View>
          ) : null}
          {ctab === 'notes' ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 10 }}>
              {client.notes ? <KCard style={{ padding: 14 }}><T k="body">{client.notes}</T></KCard> : null}
              {(rec.data?.notes ?? []).map((n) => (
                <KCard key={n.id} style={{ padding: 14, gap: 4 }}>
                  <T k="body">{n.body}</T>
                  <T k="xs" color={t.muted}>{[n.author_name, n.created_at?.slice(0, 10)].filter(Boolean).join(' · ')}</T>
                </KCard>
              ))}
              {!client.notes && !(rec.data?.notes ?? []).length ? <T k="body" color={t.muted} style={{ textAlign: 'center', paddingVertical: 14 }}>{tr('clients.noNotes')}</T> : null}
              <Field placeholder={tr('clients.noteHint')} value={note} onChangeText={setNote} multiline style={{ minHeight: 70, paddingTop: 14, textAlignVertical: 'top' }} />
              <KButton label={tr('clients.addNote')} disabled={!note.trim()} loading={busy} onPress={() => void addNote()} />
            </View>
          ) : null}
          {ctab === 'photos' ? (
            photosArr.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
                {photosArr.map((p) => <KPhoto key={String(p.id)} src={p.url} style={{ width: (W - 4) / 3, height: (W - 4) / 3 }} />)}
              </View>
            ) : <EmptyState photo="demo:f05" artHeight={150} title={tr('v3.noPhotos')} body={tr('v3.noPhotosBody')} />
          ) : null}
          {ctab === 'overview' && client.id ? (
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {L('wallet', tr('v3.summary'))}
              <KCard style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                <Row label={tr('cl.avgCheck')} value={stats.avgPrice != null ? money(stats.avgPrice, salon?.currency) : '—'} />
                <Row label={tr('clients.lastVisit')} value={stats.lastVisitDate ? dateLabel(fromIso(stats.lastVisitDate)) : '-'} />
                {stats.nextVisitDate ? <Row label={tr('cl.nextVisit')} value={`${dateLabel(fromIso(stats.nextVisitDate))}${stats.nextVisitTime ? ` · ${hhmm(stats.nextVisitTime)}` : ''}`} /> : null}
                {stats.favouriteMaster ? <Row label={tr('cl.favMaster')} value={stats.favouriteMaster} /> : null}
              </KCard>
              <ClientPackages clientId={String(client.id)} clientName={name} />
              <KCard style={{ padding: 16, gap: 4 }}>
                <ToggleRow label={tr('ad.vip')} value={!!stats.vip} onChange={(v) => void crmRun(() => apiB.setVip(client.id, v), () => { stale.current = true; void loaded.reload(); })} />
                {pts.data ? <Row label={tr('ad.points')} value={String(pts.data.pointsBalance ?? pts.data.points_balance ?? 0)} /> : null}
                {bal.data ? <Row label={bal.data.outstanding > 0 ? tr('ad.owes') : tr('ad.credit')} value={money(bal.data.outstanding > 0 ? bal.data.outstanding : bal.data.credit, salon?.currency)} /> : null}
                {bal.data && bal.data.outstanding > 0 ? (
                  <>
                    <Field label={tr('ex.amount')} value={settle} onChangeText={setSettle} keyboardType="decimal-pad" />
                    <KButton kind="fl" label={tr('ad.settle')} loading={crmBusy} disabled={!(num(settle) > 0)} onPress={() => void crmRun(() => apiB.settle(client.id, Math.min(num(settle), bal.data!.outstanding), 'CASH'), () => { setSettle(''); void bal.reload(); })} />
                  </>
                ) : null}
                {crm.data?.blocked ? (
                  <>
                    <KPill text={tr('ad.blocked')} tone="g" />
                    <KButton kind="fl" label={tr('ad.unblock')} loading={crmBusy} onPress={() => salon && void crmRun(() => apiB.unblock(salon.id, client.id), () => void crm.reload())} />
                  </>
                ) : (
                  <>
                    <Field label={tr('ad.blockReason')} value={reason} onChangeText={setReason} />
                    <KButton kind="danger" label={tr('ad.block')} loading={crmBusy} disabled={!reason.trim()} onPress={() => salon && void crmRun(() => apiB.block(salon.id, client.id, reason.trim()), () => { setReason(''); void crm.reload(); })} />
                  </>
                )}
              </KCard>
              {L('shield', tr('cx.consents'))}
              <KCard style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                {(consents.data ?? []).length === 0 ? <T k="body" color={t.muted} style={{ paddingVertical: 8 }}>{tr('cx.noConsents')}</T> : (consents.data ?? []).map((c) => (
                  <Row key={c.id} label={c.formName ?? '-'} value={(c.signedAt ?? c.createdAt ?? '').slice(0, 10)} />
                ))}
              </KCard>
              <KButton kind="danger" icon="trash" label={tr('ux.deleteClient')} onPress={() => setDelOpen(true)} style={{ marginTop: 6 }} />
            </View>
          ) : null}
        </ScrollView>
      )}
      <BottomSheet open={delOpen} onClose={() => setDelOpen(false)}>
        <View style={{ paddingBottom: 18, gap: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.gsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={30} color={t.gink} /></View>
          <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink }}>{tr('ux.deleteClient')}</Text>
          <Text style={{ fontFamily: font.m, fontSize: 16, lineHeight: 23, color: t.muted }}>{name} — {tr('ux.deleteClientBody')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setDelOpen(false)} />
            <Btn label={tr('lk.delete')} variant="danger" style={{ flex: 1 }} loading={crmBusy} onPress={() => { if (!client) return; void crmRun(() => apiM.deleteClient(String(client.id)), () => { setDelOpen(false); toast(tr('ux.deleted'), 'success'); bump(); router.back(); }); }} />
          </View>
        </View>
      </BottomSheet>
      {client && editing ? <EditClientSheet client={client} open={editing} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); stale.current = true; void loaded.reload(); }} /> : null}
    </Screen>
  );
}
