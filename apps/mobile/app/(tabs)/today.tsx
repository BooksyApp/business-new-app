import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlockTimeSheet } from '@/components/BlockTimeSheet';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Avatar, Button, EmptyState, IconBtn, Photo, Pill, SecHead, Skeleton, Spark, StoryBubble, T, Tile, TopBar } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState, Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type ClientWithStats, type Staff } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { markArrived } from '@/lib/arrived';
import { rememberClients } from '@/lib/client-cache';
import { clientPhoto, firstName, live, nextUp, nowMin, series } from '@/lib/day';
import { useDockInset } from '@/lib/dock';
import { useSafeAreaInsets } from '@/lib/insets';
import { addDays, hhmm, money, toMin } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font, heroShadow } from '@/theme/tokens';

/**
 * Bu gün (artifact "Bu gün"): at most four blocks. Story rail, the next client as a photo card, three small KPI cards
 * with 7-day sparklines, and the bookings waiting for confirmation (guava only here). Everything else sits behind "+".
 */
export default function Today() {
  const { t } = useTheme();
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const { salon, salons, version, bump, badges } = useApp();
  const inset = useDockInset(24);
  const ins = useSafeAreaInsets();
  const sid = salon?.id ?? '';
  const now = new Date();
  const [quick, setQuick] = useState(false);
  const [link, setLink] = useState(false);
  const [block, setBlock] = useState(false);

  const range = useLoad(() => api.appointments(sid, addDays(now, -6), addDays(now, 14)), [sid, version]);
  const staff = useLoad<Staff[]>(() => api.staff(sid), [sid, version]);
  const clients = useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => [] as ClientWithStats[]); rememberClients(r); return r; }, [sid, version]);
  const stories = useLoad(() => apiX.stories(sid).catch(() => []), [sid, version]);

  const all = range.data ?? [];
  const todayKey = toDay(now);
  const list = useMemo(() => all.filter((a) => a.appointmentDate.slice(0, 10) === todayKey && live(a)).sort((a, b) => toMin(a.startTime) - toMin(b.startTime)), [all, todayKey]);
  const team = (staff.data ?? []).filter((s) => s.isActive !== false);
  const next = nextUp(list);
  const byId = useMemo(() => new Map((clients.data ?? []).map((c) => [String(c.id), c])), [clients.data]);
  const pend = all.filter((a) => a.status === 'PENDING' && a.appointmentDate.slice(0, 10) >= todayKey).sort((a, b) => (a.appointmentDate + a.startTime).localeCompare(b.appointmentDate + b.startTime));
  const pendCount = Math.max(pend.length, badges.pending);
  const s7 = series(all, now, 7, team.length || 1);
  const td = s7[s7.length - 1] ?? { revenue: 0, bookings: 0, occ: 0 };
  const prev = s7.slice(0, -1).filter((d) => d.bookings > 0);
  const avg = (k: 'revenue' | 'bookings' | 'occ') => (prev.length ? prev.reduce((n, d) => n + d[k], 0) / prev.length : 0);
  const pct = (v: number, b: number) => (b > 0 ? `${v >= b ? '+' : ''}${Math.round(((v - b) / b) * 100)}%` : '');
  const kpis = [
    { l: tr('v2.revenue'), v: money(td.revenue, salon?.currency), d: pct(td.revenue, avg('revenue')), s: s7.map((d) => d.revenue) },
    { l: tr('v2.bookings'), v: String(td.bookings), d: prev.length ? `${td.bookings >= avg('bookings') ? '+' : ''}${Math.round(td.bookings - avg('bookings'))}` : '', s: s7.map((d) => d.bookings) },
    { l: tr('v2.occupancy'), v: `${Math.round(td.occ * 100)}%`, d: prev.length ? `${td.occ >= avg('occ') ? '+' : ''}${Math.round((td.occ - avg('occ')) * 100)}%` : '', s: s7.map((d) => d.occ) },
  ];
  const kpiW = (W - 40 - 20) / 3 - 26;
  const loading = range.loading && !range.data;
  const ownStory = (stories.data ?? []).length > 0;
  const shortName = (salon?.name ?? '').split(/\s+/)[0] || salon?.name || '';
  const newBooking = () => router.push({ pathname: '/booking/new', params: { date: toDay(now) } });

  async function arrived(a: Appointment) {
    try {
      if (a.status === 'PENDING') await api.confirmAppointment(a.id);
      markArrived(a.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(`${firstName(a.clientName)} · ${tr('v2.arrived')}`, 'success');
      bump();
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <Screen style={{ paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top, paddingBottom: inset }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={range.refreshing} onRefresh={() => { void range.reload(); void staff.reload(); }} tintColor={t.violet} />}>
        <TopBar title={shortName} onTitle={salons.length > 1 ? () => router.push('/salons') : undefined}
          right={<>
            <IconBtn icon="bell" label={tr('v2.notifications')} dot={badges.inbox > 0 || badges.waitlist > 0} onPress={() => router.push('/notifications')} />
            <IconBtn icon="plus" label={tr('v2.create')} onPress={() => setQuick(true)} />
          </>} />

        {/* story rail: own story first, then the team */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 }}>
          <StoryBubble uri={(salon as { logoUrl?: string } | null)?.logoUrl} name={salon?.name} label={ownStory ? tr('v2.yourStory') : tr('v2.addStory')} add={!ownStory} onPress={() => router.navigate('/looks')} />
          {team.map((s, i) => (
            <StoryBubble key={String(s.id)} uri={s.avatarUrl} name={s.name} label={firstName(s.name)} seen={i === team.length - 1 && team.length > 3}
              onPress={() => router.navigate({ pathname: '/calendar', params: { staff: String(s.id) } })} />
          ))}
        </ScrollView>

        {range.error ? <ErrorState error={range.error} onRetry={() => void range.reload()} /> : loading ? (
          <Skeleton blocks={[{ h: 236, r: 26 }, { h: 104, r: 20 }, { h: 60, r: 18 }]} />
        ) : next ? (
          <Hero a={next} c={byId.get(String(next.clientId))} staff={team.find((s) => String(s.id) === String(next.staffId))} onOpen={() => router.push(`/booking/${next.id}`)} onArrived={() => void arrived(next)} />
        ) : (
          <EmptyState photo="demo:p7755458" title={tr('v2.emptyTodayTitle')} body={tr('v2.emptyTodayBody')}
            action={{ label: tr('v2.addBooking'), icon: 'plus', onPress: newBooking }} secondary={{ label: tr('v2.shareLink'), icon: 'share', onPress: () => setLink(true) }} />
        )}

        {!loading && !range.error ? (
          <>
            {next ? <SecHead title={tr('v2.today')} action={tr('v2.report')} onAction={() => router.push('/section/reports')} /> : <View style={{ height: 16 }} />}
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
              {kpis.map((k) => (
                <Pressable key={k.l} onPress={() => router.push('/section/reports')} accessibilityRole="button" accessibilityLabel={`${k.l} ${k.v}`}
                  style={{ flex: 1, backgroundColor: t.surface, borderRadius: 20, paddingTop: 13, paddingHorizontal: 13, paddingBottom: 11, boxShadow: '0 1px 2px rgba(29,23,48,.04), 0 6px 20px -10px rgba(29,23,48,.14)' } as object}>
                  <T k="sm" color={t.muted} style={{ fontSize: 12 }}>{k.l}</T>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.b, fontSize: 20, letterSpacing: -0.4, color: list.length ? t.ink : t.ink3, marginTop: 2, fontVariant: ['tabular-nums'] }}>{k.v}</Text>
                  {list.length ? <View style={{ marginTop: 6 }}><Spark data={k.s} width={kpiW} /></View> : null}
                  {list.length && k.d ? <Text style={{ fontFamily: font.s, fontSize: 11.5, color: k.d.startsWith('-') ? t.gink : t.ok }}>{k.d}</Text> : null}
                </Pressable>
              ))}
            </View>
            {pendCount > 0 ? (
              <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel={tr('v2.pendingN', { n: pendCount })}
                style={{ marginTop: 14, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.surface, boxShadow: '0 1px 2px rgba(29,23,48,.04), 0 6px 20px -10px rgba(29,23,48,.14)' } as object}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.gsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" filled size={19} color={t.guava} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{tr('v2.pendingN', { n: pendCount })}</Text>
                  <T k="sm" color={t.muted} lines={1}>{pend.slice(0, 2).map((a) => `${firstName(a.clientName)} ${a.appointmentDate.slice(0, 10) === todayKey ? hhmm(a.startTime) : a.appointmentDate.slice(5, 10).split('-').reverse().join('.')}`).join(' · ')}</T>
                </View>
                <Icon name="chev" size={18} color={t.ink3} />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* "+" : Yarat */}
      <BottomSheet open={quick} onClose={() => setQuick(false)}>
        <T k="h2" style={{ fontSize: 18, marginBottom: 12 }}>{tr('v2.create')}</T>
        <View style={{ gap: 10, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Tile icon="cal" title={tr('v2.newBooking')} sub={tr('v2.newBookingSub')} onPress={() => { setQuick(false); newBooking(); }} />
            <Tile icon="spark" title={tr('v2.story')} sub={tr('v2.storySub')} onPress={() => { setQuick(false); router.navigate('/looks'); }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Tile icon="receipt" title={tr('v2.sale')} sub={tr('v2.saleSub')} onPress={() => { setQuick(false); router.push('/section/sales'); }} />
            <Tile icon="lock" title={tr('v2.block')} sub={tr('v2.blockSub')} onPress={() => { setQuick(false); setBlock(true); }} />
          </View>
        </View>
      </BottomSheet>

      {/* salon link */}
      <BottomSheet open={link} onClose={() => setLink(false)}>
        <T k="h2" style={{ fontSize: 18 }}>{tr('v2.salonLink')}</T>
        <T k="sm" color={t.muted} style={{ marginTop: 6, marginBottom: 14 }}>{tr('v2.salonLinkBody')}</T>
        <View style={{ height: 54, borderRadius: 16, borderWidth: 1, borderColor: t.hair, backgroundColor: t.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <Text style={{ flex: 1, fontFamily: font.s, fontSize: 15, color: t.ink }}>{salonUrl(salon)}</Text>
        </View>
        <Button label={tr('v2.share')} icon="share" onPress={() => { setLink(false); void Share.share({ message: `${salon?.name ?? 'booqi'} · https://${salonUrl(salon)}` }).catch(() => {}); }} style={{ marginTop: 12 }} />
      </BottomSheet>

      <BlockTimeSheet open={block} date={now} masters={team} onClose={() => setBlock(false)} onDone={() => { setBlock(false); bump(); }} />
    </Screen>
  );
}

const salonUrl = (s: unknown) => `booqi.az/${(s as { slug?: string } | null)?.slug ?? String((s as { id?: string } | null)?.id ?? '')}`;


/** Next client photo card (`.hero`): 236 high, dark wash, time pills, name 21/700, specialist row, white "Gəldi". */
function Hero({ a, c, staff, onOpen, onArrived }: { a: Appointment; c?: ClientWithStats; staff?: Staff; onOpen: () => void; onArrived: () => void }) {
  const mins = toMin(a.startTime) - nowMin();
  const photo = clientPhoto(c);
  return (
    <View style={[{ marginTop: 18, marginHorizontal: 20, height: 236, borderRadius: 26, overflow: 'hidden' }, heroShadow]}>
      <Photo src={photo} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {!photo ? <LinearGradient colors={['#35276b', '#1d1730']} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} /> : null}
      </Photo>
      <LinearGradient pointerEvents="none" colors={['rgba(20,14,34,0)', 'rgba(20,14,34,.78)']} locations={[0.3, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      <Pressable onPress={onOpen} noScale accessibilityRole="button" accessibilityLabel={`${tr('v2.nextClient')}: ${a.clientName}, ${hhmm(a.startTime)}`} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pill tone="dk" icon="clock" text={mins > 0 ? tr('v2.inMin', { n: mins }) : tr('v2.nowOn')} />
        <Pill tone="wh" text={hhmm(a.startTime)} />
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
        <View pointerEvents="none">
          <Text style={{ fontFamily: font.m, fontSize: 12.5, color: 'rgba(255,255,255,.85)' }}>{tr('v2.nextClient')}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 21, letterSpacing: -0.42, color: '#fff', marginTop: 2, marginBottom: 10 }}>{a.clientName}</Text>
        </View>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <Avatar uri={staff?.avatarUrl} name={staff?.name ?? a.staffName} size={26} border="rgba(255,255,255,.8)" />
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.r, fontSize: 13, color: '#fff' }}>{a.serviceName} · {firstName(staff?.name ?? a.staffName)}</Text>
          </View>
          <Button label={tr('v2.arrived')} kind="wh" size="sm" onPress={onArrived} />
        </View>
      </View>
    </View>
  );
}
