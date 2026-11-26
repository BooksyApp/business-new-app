import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, ErrorState, Field, Skeleton, StateView } from '@/components/ui';
import { DayStrip } from '@/components/calendar';
import { t as tr } from '@/i18n';
import { api, toDay, type Client, type ClientWithStats, type Service, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { addDays, dateLabel, fromIso, fromMin, hhmm, money, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { circShadow, cardShadow, font } from '@/theme/tokens';

type Pick = { id: string; name: string };
const STEPS = ['create.stepClient', 'create.stepService', 'create.stepTime', 'create.stepConfirm'] as const;

/** New booking (BF04 "yeni rezerv"): back/close circles, 4-bar stepper, step breadcrumb, 30/800 title, dark `.bsk` summary bar with "Davam". */
export default function NewBooking() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { salon, bump } = useApp();
  const params = useLocalSearchParams<{ date?: string }>();
  const sid = salon?.id ?? '';
  const [step, setStep] = useState(0);
  const [client, setClient] = useState<Pick | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [master, setMaster] = useState<Staff | null>(null);
  const [date, setDate] = useState(() => (params.date ? fromIso(params.date) : new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const back = () => (step === 0 ? router.back() : setStep(step - 1));
  const can = [!!client, !!service, !!master && !!time, true][step];

  async function book() {
    if (!client || !service || !master || !time) return;
    setBusy(true);
    try {
      const len = service.durationMinutes ?? 30;
      await api.createAppointment({
        businessId: sid, staffId: master.id, clientId: client.id, clientName: client.name, serviceId: service.id,
        appointmentDate: toDay(date), startTime: time, endTime: fromMin(toMin(time) + len), price: service.price,
      });
      bump();
      router.back();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const titles = [tr('create.client'), tr('create.pickService'), tr('create.pickTime'), tr('create.confirmTitle')];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: ins.top, paddingHorizontal: 16 }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={tr('common.back')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', ...circShadow }}><Icon name="back" size={22} color={t.ink} /></Pressable>
          <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink }}>{tr('create.title')}</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', ...circShadow }}><Icon name="x" size={22} color={t.ink} /></Pressable>
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
          {step === 1 ? <ServiceStep sid={sid} sel={service} cur={salon?.currency} onPick={(s) => { setService(s); setMaster(null); setTime(null); }} /> : null}
          {step === 2 && service ? <TimeStep sid={sid} service={service} master={master} date={date} time={time} setMaster={(m) => { setMaster(m); setTime(null); }} setDate={(d) => { setDate(d); setTime(null); }} setTime={setTime} /> : null}
          {step === 3 && client && service && master && time ? (
            <View style={{ backgroundColor: t.surface, borderRadius: 22, padding: 18, gap: 12, ...cardShadow }}>
              {([[tr('create.client'), client.name], [tr('create.service'), service.name], [tr('create.master'), master.name], [tr('create.date'), dateLabel(date)], [tr('create.time'), `${time} – ${fromMin(toMin(time) + (service.durationMinutes ?? 30))}`], [tr('appt.price'), money(service.price, salon?.currency)]] as const).map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{k}</Text>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      {/* `.bsk` dark bar with the running summary and a white action button */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(ins.bottom, 20), borderRadius: 24, backgroundColor: t.dark ? '#2a2538' : '#1d1730', padding: 14, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14, color: 'rgba(255,255,255,.8)' }}>{time ? `${dateLabel(date)} · ${time}` : client?.name ?? tr(STEPS[step])}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, color: '#fff' }}>{service ? `${service.name}${master ? ` · ${master.name}` : ''}` : tr('create.title')}</Text>
        </View>
        <Pressable onPress={() => (step === 3 ? void book() : setStep(step + 1))} disabled={!can || busy} accessibilityRole="button" style={{ height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6, opacity: can ? 1 : 0.5 }}>
          {busy ? <ActivityIndicator color="#1d1730" /> : <Text style={{ fontFamily: font.b, fontSize: 14.5, color: '#1d1730' }}>{step === 3 ? tr('create.book') : tr('create.next')}</Text>}
          {step < 3 && !busy ? <Icon name="chev" size={18} color="#1d1730" /> : null}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ name, sub, on, onPress }: { name: string; sub?: string; on: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: t.surface, borderWidth: on ? 2 : 0, borderColor: t.violet, ...cardShadow }}>
      <Avatar name={name} size={44} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{name}</Text>
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
            return <Row name={name} sub={c.phone ?? undefined} on={sel?.id === c.id} onPress={() => onPick({ id: c.id, name })} />;
          }} />
      )}
    </View>
  );
}

function ServiceStep({ sid, sel, cur, onPick }: { sid: string; sel: Service | null; cur?: string; onPick: (s: Service) => void }) {
  const list = useLoad(() => api.services(sid), [sid]);
  const rows = (list.data ?? []).filter((s) => s.isActive);
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.reload()} />;
  if (list.loading && !list.data) return <Skeleton rows={4} height={72} />;
  if (!rows.length) return <StateView icon="scissors" title={tr('create.noServices')} />;
  return (
    <FlatList data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ gap: 10, paddingBottom: 140 }}
      renderItem={({ item: s }) => <Row name={s.name} sub={`${s.durationMinutes ?? 30} ${tr('common.min')} · ${money(s.price, cur)}`} on={sel?.id === s.id} onPress={() => onPick(s)} />} />
  );
}

function TimeStep({ sid, service, master, date, time, setMaster, setDate, setTime }: {
  sid: string; service: Service; master: Staff | null; date: Date; time: string | null; setMaster: (m: Staff) => void; setDate: (d: Date) => void; setTime: (s: string) => void;
}) {
  const { t } = useTheme();
  const staff = useLoad(() => api.staff(sid), [sid]);
  const masters = (staff.data ?? []).filter((m) => m.isActive !== false && (!service.staffIds?.length || service.staffIds.map(String).includes(String(m.id))));
  const slots = useLoad(() => (master ? api.slots(sid, service.id, date, master.id) : Promise.resolve(null)), [master?.id, service.id, date.toDateString()]);
  const list = slots.data?.availableSlots ?? [];
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
      {staff.error ? <ErrorState error={staff.error} onRetry={() => void staff.reload()} /> : staff.loading ? <Skeleton rows={1} height={72} /> : masters.length === 0 ? (
        <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{tr('create.noMasters')}</Text>
      ) : (
        <View style={{ gap: 10 }}>{masters.map((m) => <Row key={m.id} name={m.name} sub={`${service.name} · ${service.durationMinutes ?? 30} ${tr('common.min')}`} on={master?.id === m.id} onPress={() => setMaster(m)} />)}</View>
      )}
      {master ? (
        <>
          <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 18, marginBottom: 6, textTransform: 'capitalize' }}>{new Intl.DateTimeFormat('az-AZ', { month: 'long', year: 'numeric' }).format(date)}</Text>
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
