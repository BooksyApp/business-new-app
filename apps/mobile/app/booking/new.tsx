import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '@/lib/insets';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Chip, ErrorState, Field, Skeleton, StateView } from '@/components/ui';
import { DayStrip } from '@/components/calendar';
import { t as tr } from '@/i18n';
import * as Haptics from 'expo-haptics';
import { api, ApiError, toDay, type Client, type ClientWithStats, type Service, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { recallClient } from '@/lib/client-cache';
import { addDays, dateLabel, fromIso, fromMin, hhmm, money, monthLabel, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { barBg, brandInk, circShadow, cardShadow, font } from '@/theme/tokens';

type Pick = { id: string; name: string };
type Repeat = 'none' | 'weekly' | 'biweekly' | 'monthly';
const REPEATS: { k: Repeat; label: 'create.repeatNone' | 'create.repeatWeekly' | 'create.repeatBiweekly' | 'create.repeatMonthly' }[] = [
  { k: 'none', label: 'create.repeatNone' }, { k: 'weekly', label: 'create.repeatWeekly' }, { k: 'biweekly', label: 'create.repeatBiweekly' }, { k: 'monthly', label: 'create.repeatMonthly' },
];
const nextDate = (d: Date, r: Repeat, i: number) => {
  if (r === 'weekly') return addDays(d, 7 * i);
  if (r === 'biweekly') return addDays(d, 14 * i);
  // Month step clamps to the last day (31 Jan + 1 month = 28/29 Feb, not 3 Mar).
  const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
  x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return x;
};
/** Resolves true when the user accepts a conflict the server reported as overridable. */
const askOverride = (msg: string) => new Promise<boolean>((res) => Alert.alert(tr('appt.conflict'), msg, [
  { text: tr('common.cancel'), style: 'cancel', onPress: () => res(false) }, { text: tr('common.confirm'), onPress: () => res(true) },
], { cancelable: false }));
const STEPS = ['create.stepClient', 'create.stepService', 'create.stepTime', 'create.stepConfirm'] as const;

/** New booking (BF04 "yeni rezerv"): back/close circles, 4-bar stepper, step breadcrumb, 30/800 title, dark `.bsk` summary bar with "Davam". */
export default function NewBooking() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { salon, bump } = useApp();
  const params = useLocalSearchParams<{ date?: string; clientId?: string; clientName?: string }>();
  const sid = salon?.id ?? '';
  const preset = params.clientId ? { id: String(params.clientId), name: String(params.clientName ?? '') } : null;
  const [step, setStep] = useState(preset ? 1 : 0);
  const [client, setClient] = useState<Pick | null>(preset);
  const [picked, setPicked] = useState<Service[]>([]);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [times, setTimes] = useState(4);
  const service = picked[0] ?? null;
  const totalMin = picked.reduce((n, x) => n + (x.durationMinutes ?? 30), 0);
  const totalPrice = picked.reduce((n, x) => n + (x.price ?? 0), 0);
  const [master, setMaster] = useState<Staff | null>(null);
  const [date, setDate] = useState(() => (params.date ? fromIso(params.date) : new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const back = () => (step === 0 ? router.back() : setStep(step - 1));
  const can = [!!client, picked.length > 0, !!master && !!time, true][step];

  async function book() {
    if (busy || !client || !service || !master || !time) return;
    if (toMin(time) + totalMin > 24 * 60) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); Alert.alert(tr('create.pastMidnight')); return; }
    setBusy(true);
    let offline = false;
    const failed: string[] = [];
    let created = 0;
    try {
      const n = repeat === 'none' ? 1 : times;
      for (let i = 0; i < n; i++) {
        const day = nextDate(date, repeat, i);
        let at = toMin(time);
        for (const sv of picked) {
          const len = sv.durationMinutes ?? 30;
          const body = {
            businessId: sid, staffId: master.id, clientId: client.id, clientName: client.name, serviceId: sv.id,
            appointmentDate: toDay(day), startTime: fromMin(at), endTime: fromMin(at + len), price: sv.price,
          };
          try {
            try {
              await api.createAppointment(body);
            } catch (e) {
              const data = e instanceof ApiError ? (e.data as { code?: string; canOverride?: boolean } | null) : null;
              if (data?.code === 'BOOKING_CONFLICTS' && data.canOverride && (await askOverride(`${dateLabel(day)} · ${fromMin(at)}\n${(e as Error).message}`))) await api.createAppointment(body, true);
              else throw e;
            }
            created++;
          } catch (e) {
            failed.push(`${dateLabel(day)} ${fromMin(at)}: ${(e as Error).message}`);
            if (e instanceof ApiError && e.status === 0) { offline = true; break; } // no network: stop instead of N identical failures
          }
          at += len;
        }
        if (offline) break;
      }
      if (created) bump();
      if (failed.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert(tr('create.partial', { ok: created, bad: failed.length }), failed.slice(0, 6).join('\n'), [{ text: tr('common.close'), onPress: () => { if (created) router.back(); } }]);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      }
    } finally {
      setBusy(false);
    }
  }

  const titles = [tr('create.client'), tr('create.pickService'), tr('create.pickTime'), tr('create.confirmTitle')];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, paddingTop: ins.top, paddingHorizontal: 16 }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={tr('common.back')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', ...circShadow }}><Icon name="back" size={22} color={t.ink} /></Pressable>
          <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink }}>{tr('create.title')}</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', ...circShadow }}><Icon name="x" size={22} color={t.ink} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i <= step ? t.violet : t.fill2 }} />)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {STEPS.map((k, i) => (
            <React.Fragment key={k}>
              <Text style={{ fontFamily: font.b, fontSize: 14, color: i === step ? t.vtext : t.muted }}>{i + 1} · {tr(k)}</Text>
              {i < STEPS.length - 1 ? <Text style={{ fontFamily: font.b, fontSize: 14, color: t.muted }}>·</Text> : null}
            </React.Fragment>
          ))}
        </View>
        <Text style={{ fontFamily: font.x, fontSize: 30, lineHeight: 33, letterSpacing: -0.9, color: t.ink, marginTop: 18, marginBottom: 16 }}>{titles[step]}</Text>
        <View style={{ flex: 1 }}>
          {step === 0 ? <ClientStep sid={sid} sel={client} onPick={setClient} /> : null}
          {step === 1 ? <ServiceStep sid={sid} sel={picked} cur={salon?.currency} onToggle={(s) => { setPicked((p) => (p.some((x) => x.id === s.id) ? p.filter((x) => x.id !== s.id) : [...p, s])); setMaster(null); setTime(null); }} /> : null}
          {step === 2 && service ? <TimeStep sid={sid} service={service} picked={picked} master={master} date={date} time={time} setMaster={(m) => { setMaster(m); setTime(null); }} setDate={(d) => { setDate(d); setTime(null); }} setTime={setTime} /> : null}
          {step === 3 && client && service && master && time ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140, gap: 14 }}>
              <View style={{ backgroundColor: t.surface, borderRadius: 22, padding: 18, gap: 12, ...cardShadow }}>
                {([[tr('create.client'), client.name], [tr('create.service'), picked.map((x) => x.name).join(' + ')], [tr('create.master'), master.name], [tr('create.date'), dateLabel(date)], [tr('create.time'), `${time} – ${fromMin(toMin(time) + totalMin)}`], [tr('appt.price'), money(totalPrice, salon?.currency)]] as const).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{k}</Text>
                    <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{tr('create.repeat')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
                {REPEATS.map((r) => <Chip key={r.k} label={tr(r.label)} active={repeat === r.k} onPress={() => setRepeat(r.k)} icon={r.k === 'none' ? undefined : 'repeat'} />)}
              </ScrollView>
              {repeat !== 'none' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface, borderRadius: 18, padding: 10, paddingLeft: 16 }}>
                  <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{tr('create.repeatTimes', { n: times })}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => setTimes((n) => Math.max(2, n - 1))} accessibilityRole="button" accessibilityLabel={tr('create.fewer')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={20} color={t.ink} /></Pressable>
                    <Pressable onPress={() => setTimes((n) => Math.min(12, n + 1))} accessibilityRole="button" accessibilityLabel={tr('create.more')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={20} color={t.ink} /></Pressable>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
      {/* `.bsk` dark bar with the running summary and a white action button */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(ins.bottom, 20), borderRadius: 24, backgroundColor: barBg(t.dark), padding: 14, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14, color: 'rgba(255,255,255,.8)' }}>{time ? `${dateLabel(date)} · ${time}` : client?.name ?? tr(STEPS[step])}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, color: '#fff' }}>{service ? `${picked.length > 1 ? `${service.name} +${picked.length - 1}` : service.name}${master ? ` · ${master.name}` : ''}` : tr('create.title')}</Text>
        </View>
        <Pressable onPress={() => (step === 3 ? void book() : setStep(step + 1))} disabled={!can || busy} accessibilityRole="button" style={{ height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6, opacity: can ? 1 : 0.5 }}>
          {busy ? <ActivityIndicator color={brandInk} /> : <Text style={{ fontFamily: font.b, fontSize: 14.5, color: brandInk }}>{step === 3 ? tr('create.book') : tr('create.next')}</Text>}
          {step < 3 && !busy ? <Icon name="chev" size={18} color={brandInk} /> : null}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ name, sub, on, onPress, uri }: { name: string; sub?: string; on: boolean; onPress: () => void; uri?: string | null }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 84, borderRadius: 26, backgroundColor: t.surface, borderWidth: on ? 2 : 0, borderColor: t.violet, ...cardShadow }}>
      <Avatar name={name} size={56} uri={uri} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, letterSpacing: -0.2, color: t.ink }}>{name}</Text>
        {sub ? <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{sub}</Text> : null}
      </View>
      {on ? <Icon name="check" size={22} color={t.vtext} /> : null}
    </Pressable>
  );
}

function ClientStep({ sid, sel, onPick }: { sid: string; sel: Pick | null; onPick: (c: Pick) => void }) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useLoad<(Client | ClientWithStats)[]>(() => api.clientsWithStats(sid), [sid]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = list.data ?? [];
    return (s ? all.filter((c) => `${c.firstName} ${c.lastName ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(s)) : all).slice(0, 80);
  }, [q, list.data]);
  async function create() {
    setBusy(true);
    try {
      const c = await api.createClient(sid, { firstName: first.trim(), lastName: last.trim() || undefined, phone: phone.trim() || undefined });
      onPick({ id: c.id, name: `${c.firstName} ${c.lastName ?? ''}`.trim() });
      setAdding(false);
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (adding) {
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
        <Field label={tr('create.firstName')} value={first} onChangeText={setFirst} />
        <Field label={tr('create.lastName')} value={last} onChangeText={setLast} />
        <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label={tr('common.back')} variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} disabled={!first.trim()} onPress={() => void create()} />
        </View>
      </ScrollView>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: 26, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
        <Icon name="search" size={20} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={tr('create.searchClient')} placeholderTextColor={t.ink3} autoCorrect={false} style={{ flex: 1, fontFamily: font.m, fontSize: 15, color: t.ink }} />
      </View>
      <Pressable onPress={() => setAdding(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 }}>
        <Icon name="plus" size={20} color={t.vtext} />
        <Text style={{ fontFamily: font.b, fontSize: 15, color: t.vtext }}>{tr('create.newClient')}</Text>
      </Pressable>
      {list.error ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={4} height={72} /> : (
        <FlatList data={rows} keyExtractor={(c, i) => String(c.id ?? i)} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 140 }}
          renderItem={({ item: c }) => {
            const name = `${c.firstName} ${c.lastName ?? ''}`.trim();
            return <Row uri={(recallClient(String(c.id)) as { avatarUrl?: string | null } | undefined)?.avatarUrl} name={name} sub={c.phone ?? undefined} on={sel?.id === c.id} onPress={() => onPick({ id: c.id, name })} />;
          }} />
      )}
    </View>
  );
}

function ServiceStep({ sid, sel, cur, onToggle }: { sid: string; sel: Service[]; cur?: string; onToggle: (s: Service) => void }) {
  const { t } = useTheme();
  const list = useLoad(() => api.services(sid), [sid]);
  const rows = (list.data ?? []).filter((s) => s.isActive);
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.reload()} />;
  if (list.loading && !list.data) return <Skeleton rows={4} height={72} />;
  if (!rows.length) return <StateView icon="scissors" title={tr('create.noServices')} />;
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginTop: -6, marginBottom: 10 }}>{tr('create.multiHint')}</Text>
      <FlatList data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ gap: 10, paddingBottom: 140 }}
        renderItem={({ item: s }) => <Row name={s.name} sub={`${s.durationMinutes ?? 30} ${tr('common.min')} · ${money(s.price, cur)}`} on={sel.some((x) => x.id === s.id)} onPress={() => onToggle(s)} />} />
    </View>
  );
}

function TimeStep({ sid, service, picked, master, date, time, setMaster, setDate, setTime }: {
  sid: string; service: Service; picked: Service[]; master: Staff | null; date: Date; time: string | null; setMaster: (m: Staff) => void; setDate: (d: Date) => void; setTime: (s: string) => void;
}) {
  const { t } = useTheme();
  const staff = useLoad(() => api.staff(sid), [sid]);
  const masters = (staff.data ?? []).filter((m) => m.isActive !== false && picked.every((sv) => !sv.staffIds?.length || sv.staffIds.map(String).includes(String(m.id))));
  const slots = useLoad(() => (master ? api.slots(sid, service.id, date, master.id) : Promise.resolve(null)), [master?.id, service.id, date.toDateString()]);
  const list = slots.data?.availableSlots ?? [];
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
      {staff.error ? <ErrorState error={staff.error} onRetry={() => void staff.reload()} /> : staff.loading ? <Skeleton rows={1} height={72} /> : masters.length === 0 ? (
        <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{tr('create.noMasters')}</Text>
      ) : (
        <View style={{ gap: 10 }}>{masters.map((m) => <Row key={m.id} uri={m.avatarUrl} name={m.name} sub={`${picked.map((x) => x.name).join(' + ')} · ${picked.reduce((n, x) => n + (x.durationMinutes ?? 30), 0)} ${tr('common.min')}`} on={master?.id === m.id} onPress={() => setMaster(m)} />)}</View>
      )}
      {master ? (
        <>
          <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 18, marginBottom: 6, textTransform: 'capitalize' }}>{monthLabel(date)}</Text>
          <DayStrip date={date} onChange={(d) => setDate(d < new Date(new Date().setHours(0, 0, 0, 0)) ? addDays(new Date(), 0) : d)} />
          <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 20, marginBottom: 8 }}>{tr('create.freeTimes')}</Text>
          {slots.loading ? <ActivityIndicator color={t.violet} /> : list.length === 0 ? (
            <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('create.noSlots')}</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {list.map((s) => {
                const on = time === s;
                return (
                  <Pressable key={s} onPress={() => setTime(s)} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ width: '31.5%', height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.violet : t.vsoft }}>
                    <Text style={{ fontFamily: font.b, fontSize: 14.5, color: on ? '#fff' : t.vtext }}>{hhmm(s)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
