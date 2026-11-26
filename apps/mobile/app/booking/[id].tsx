import React, { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Reschedule, WaReminder } from '@/components/BookingSheet';
import { Icon } from '@/components/Icon';
import { Button, Card, CtaBar, IconBtn, KV, Photo, Pill, Skeleton, T } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState, Field } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type ClientWithStats, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { markArrived, useArrived } from '@/lib/arrived';
import { recallClient } from '@/lib/client-cache';
import { clientPhoto } from '@/lib/day';
import { dateLabel, fromIso, hhmm, money, sameDay } from '@/lib/format';
import { useSafeAreaInsets } from '@/lib/insets';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Panel = null | 'more' | 'cancel' | 'move' | 'wa';

/**
 * Rezerv detalı (artifact "Rezerv detalı"): full-bleed client photo, 4-step status bar, four detail rows, the note,
 * big actions at the bottom. Rare actions live in the "..." sheet; cancel only there, in guava.
 * Also the deep-link / push target: booqibiz://booking/<id>.
 */
export default function BookingDetail() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => api.appointment(String(id)), [id]);
  const staff = useLoad<Staff[]>(() => api.staff(sid).catch(() => []), [sid]);
  const cl = useLoad(async () => {
    const cid = q.data?.clientId; if (cid == null) return null;
    return (recallClient(String(cid)) as ClientWithStats | undefined) ?? (await api.clientsWithStats(sid).catch(() => [] as ClientWithStats[])).find((c) => String(c.id) === String(cid)) ?? null;
  }, [q.data?.clientId, sid]);
  const isArrived = useArrived();
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/today'));

  if (q.error) return <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: ins.top + 40 }}><ErrorState error={q.error} onRetry={() => void q.reload()} /></View>;
  if (!q.data) return <View style={{ flex: 1, backgroundColor: t.canvas }}><Skeleton blocks={[{ h: 330, r: 0 }, { h: 220 }, { h: 80 }]} /></View>;
  const a = q.data;
  const c = cl.data;
  const m = (staff.data ?? []).find((s) => String(s.id) === String(a.staffId));
  const arrived = isArrived(a.id);
  const step = a.status === 'COMPLETED' ? 4 : arrived ? 3 : a.status === 'PENDING' ? 1 : a.status === 'CONFIRMED' ? 2 : 0;
  const open = a.status === 'PENDING' || a.status === 'CONFIRMED';
  const day = fromIso(a.appointmentDate);
  const tags: string[] = (c as { tags?: string[] } | null)?.tags ?? (c?.vip ? ['VIP'] : []);
  const visits = c?.totalVisits ? tr('v2.visits', { n: c.totalVisits, d: c.lastVisitDate ? ago(fromIso(c.lastVisitDate)) : '-' }) : tr('v2.firstVisit');
  const photo = clientPhoto(c);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); bump(); after?.(); await q.reload(); }
    catch (e) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  }
  const arrive = () => void run(async () => { if (a.status === 'PENDING') await api.confirmAppointment(a.id); markArrived(a.id); });
  const repeat = () => router.push({ pathname: '/booking/new', params: { date: toDay(new Date()), service: String(a.serviceId), staff: String(a.staffId), ...(a.clientId != null ? { clientId: String(a.clientId), clientName: a.clientName ?? '' } : {}) } });

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 330 }}>
          <Photo src={photo} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
            {!photo ? <LinearGradient colors={['#35276b', '#1d1730']} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} /> : null}
          </Photo>
          <LinearGradient pointerEvents="none" colors={['rgba(20,14,34,.35)', 'rgba(20,14,34,0)', 'rgba(20,14,34,0)', 'rgba(20,14,34,.75)']} locations={[0, 0.3, 0.5, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
          <View style={{ position: 'absolute', top: ins.top - 3, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconBtn circle icon="back" label={tr('common.back')} onPress={back} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {a.clientPhone ? <IconBtn circle icon="phone" label={tr('common.call')} onPress={() => void Linking.openURL(`tel:${a.clientPhone}`)} /> : null}
              <IconBtn circle icon="dots" label={tr('v2.tabMore')} onPress={() => setPanel('more')} />
            </View>
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 24 }}>
            {tags.length ? <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>{tags.map((x) => <Pill key={x} text={x} tone={x === 'VIP' ? 'wh' : 'dk'} icon={x === 'VIP' ? 'crown-f' : undefined} />)}</View> : null}
            <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 26, lineHeight: 30, letterSpacing: -0.65, color: '#fff' }}>{a.clientName || '-'}</Text>
            <Text style={{ fontFamily: font.r, fontSize: 14, color: 'rgba(255,255,255,.85)' }}>{visits}</Text>
          </View>
        </View>

        <View style={{ marginTop: -22, backgroundColor: t.canvas, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 20 }}>
          {step > 0 ? (
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 6 }} accessibilityLabel={tr(`status.${a.status}`)}>
              {[tr('v2.stCreated'), tr('v2.stConfirmed'), tr('v2.stArrived'), tr('v2.stDone')].map((l, i) => (
                <View key={l} style={{ flex: 1, gap: 7 }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: i < step ? t.violet : t.fill2 }} />
                  <Text style={{ fontFamily: font.s, fontSize: 11.5, color: i < step ? t.ink : t.ink3 }}>{l}</Text>
                </View>
              ))}
            </View>
          ) : <View style={{ paddingHorizontal: 20 }}><Pill tone={a.status === 'NO_SHOW' ? 'g' : 'fl'} text={tr(`status.${a.status}`)} /></View>}

          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
              <KV first icon="scissors" label={tr('v2.service')} value={a.serviceName ?? '-'} />
              <KV icon="user" label={tr('v2.specialist')} value={m?.name ?? a.staffName ?? '-'} />
              <KV icon="clock" label={tr('v2.time')} value={`${hhmm(a.startTime)} – ${hhmm(a.endTime)}, ${sameDay(day, new Date()) ? tr('v2.today').toLowerCase() : dateLabel(day)}`} />
              <KV icon="wallet" label={tr('v2.price')} value={a.paymentStatus === 'PAID' ? `${money(a.price, salon?.currency)} · ${tr('appt.paid')}` : `${money(a.price, salon?.currency)} · ${tr('v2.payAtSalon')}`} />
            </Card>
            {a.notes || c?.notes ? (
              <Card style={{ marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.gsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="info" size={19} color={t.guava} /></View>
                <View style={{ flex: 1 }}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink }}>{tr('v2.note')}</Text><T k="sm" color={t.muted}>{a.notes || c?.notes}</T></View>
              </Card>
            ) : null}
            {(a.lateMinutes ?? 0) > 0 ? <Pill tone="g" text={tr('calendar.late', { min: a.lateMinutes ?? 0 })} style={{ marginTop: 12 }} /> : null}
          </View>
        </View>
      </ScrollView>

      <CtaBar>
        {a.status === 'PENDING' ? (<>
          <Button kind="ol" label={tr('v2.reject')} style={{ flex: 1 }} onPress={() => setPanel('cancel')} />
          <Button label={tr('v2.confirm')} style={{ flex: 2 }} loading={busy} onPress={() => void run(() => api.confirmAppointment(a.id))} />
        </>) : a.status === 'COMPLETED' ? (
          <Button kind="dk" icon="receipt" label={tr('v2.receipt')} style={{ flex: 1 }} onPress={() => router.push('/section/sales')} />
        ) : open ? (<>
          <Button kind="ol" label={tr('v2.till')} style={{ flex: 1 }} onPress={() => router.push('/section/sales')} />
          {arrived
            ? <Button icon="check" label={tr('v2.stDone')} style={{ flex: 2 }} loading={busy} onPress={() => void run(() => api.completeAppointment(a.id))} />
            : <Button icon="check" label={tr('v2.arrived')} style={{ flex: 2 }} loading={busy} onPress={arrive} />}
        </>) : (
          <Button kind="ol" icon="repeat" label={tr('v2.repeat')} style={{ flex: 1 }} onPress={repeat} />
        )}
      </CtaBar>

      <BottomSheet open={panel === 'more'} onClose={() => setPanel(null)}>
        <View style={{ paddingBottom: Math.max(ins.bottom, 12) }}>
          {([
            open && ['clock', tr('v2.changeTime'), () => setPanel('move')],
            ['repeat', tr('v2.repeat'), () => { setPanel(null); repeat(); }],
            a.clientId != null && ['users', tr('v2.clientProfile'), () => { setPanel(null); router.push(`/client/${a.clientId}`); }],
            a.clientPhone && ['chat', tr('v2.whatsapp'), () => setPanel('wa')],
            open && ['check', tr('v2.complete'), () => { setPanel(null); void run(() => api.completeAppointment(a.id)); }],
            open && ['eyeoff', tr('v2.noShow'), () => { setPanel(null); void run(() => api.noShow(a.id)); }],
          ].filter(Boolean) as [string, string, () => void][]).map(([i, l, go], k) => (
            <Pressable key={l} onPress={go} noScale accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderTopWidth: k ? 1 : 0, borderTopColor: t.hair }}>
              <Icon name={i} size={21} color={t.ink} /><Text style={{ flex: 1, fontFamily: font.r, fontSize: 15, color: t.ink }}>{l}</Text>
            </Pressable>
          ))}
          {open ? (
            <Pressable onPress={() => setPanel('cancel')} noScale accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 54, borderTopWidth: 1, borderTopColor: t.hair }}>
              <Icon name="x" size={21} color={t.gink} /><Text style={{ flex: 1, fontFamily: font.r, fontSize: 15, color: t.gink }}>{tr('v2.cancelBooking')}</Text>
            </Pressable>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet open={panel === 'cancel'} onClose={() => setPanel(null)}>
        <View style={{ paddingBottom: Math.max(ins.bottom, 12), gap: 12 }}>
          <T k="h2" style={{ fontSize: 18 }}>{tr('appt.cancelTitle')}</T>
          <Field label={tr('appt.cancelReason')} value={reason} onChangeText={setReason} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button kind="fl" label={tr('common.back')} style={{ flex: 1 }} onPress={() => setPanel(null)} />
            <Button kind="danger" label={a.status === 'PENDING' ? tr('v2.reject') : tr('appt.cancel')} style={{ flex: 1 }} loading={busy} onPress={() => void run(() => api.cancelAppointment(a.id, reason), () => setPanel(null))} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet open={panel === 'move' || panel === 'wa'} onClose={() => setPanel(null)}>
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12, paddingBottom: Math.max(ins.bottom, 12) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {panel === 'move' ? <Reschedule a={a as Appointment} onBack={() => setPanel(null)} onDone={() => { bump(); setPanel(null); void q.reload(); }} /> : null}
          {panel === 'wa' ? <WaReminder a={a as Appointment} onBack={() => setPanel(null)} /> : null}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

/** "bu gün", "12 gün əvvəl", "3 həftə əvvəl" style relative day (AZ wording via ux strings where present). */
function ago(d: Date) {
  const days = Math.round((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return tr('v2.today').toLowerCase();
  return tr('v2.daysAgo', { n: days });
}
