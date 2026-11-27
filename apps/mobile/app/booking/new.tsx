import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Avatar, BackBar, Button, Card, Chip, ChipRow, CtaBar, KV, Photo, Pill, Skeleton, T } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, ApiError, toDay, validId, type ClientWithStats, type Service, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { rememberClients } from '@/lib/client-cache';
import { firstName } from '@/lib/day';
import { addDays, dayMonth, fromIso, fromMin, money, sameDay, startOfWeek, toMin, weekdayLong, weekdayMini } from '@/lib/format';
import { useSafeAreaInsets } from '@/lib/insets';
import { toast } from '@/lib/toast';
import { ToastHost } from '@/components/ToastHost';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { cardShadow, font } from '@/theme/tokens';

type Who = { id: string; name: string; avatarUrl?: string | null; phone?: string | null; email?: string | null } | null;
const ANY = '__any';
const askOverride = (msg: string) => new Promise<boolean>((res) => Alert.alert(tr('appt.conflict'), msg, [
  { text: tr('common.cancel'), style: 'cancel', onPress: () => res(false) }, { text: tr('common.confirm'), onPress: () => res(true) },
], { cancelable: false }));

/**
 * Yeni rezerv (artifact "Yeni rezerv" 1-4 + "Hazırdır"): Xidmət (photo cards + category chips), Usta (big avatars,
 * "İlk boş"), Vaxt (week strip + slot pills, taken times crossed out), Təsdiq (service photo card, client, salonda ödəniş).
 * Combos with a party, group classes, several services and repeats keep the full form at /booking/classic.
 */
export default function NewBooking() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const p = useLocalSearchParams<{ date?: string; staff?: string; service?: string; clientId?: string; clientName?: string }>();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const [step, setStep] = useState(p.service ? 2 : 1);
  const [cat, setCat] = useState<string | null>(null);
  const [svcId, setSvcId] = useState<string | null>(p.service ?? null);
  const [pro, setPro] = useState<string>(p.staff ?? ANY);
  const [date, setDate] = useState(() => (p.date ? fromIso(p.date) : new Date()));
  const [slot, setSlot] = useState<string | null>(null);
  const [client, setClient] = useState<Who>(p.clientId ? { id: String(p.clientId), name: p.clientName ?? '' } : null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { client: string; service: string; when: string; who: string }>(null);

  const services = useLoad(() => api.services(sid), [sid]);
  const staff = useLoad<Staff[]>(() => api.staff(sid), [sid]);
  const clients = useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => [] as ClientWithStats[]); rememberClients(r); return r; }, [sid]);
  const list = (services.data ?? []).filter((s) => s.isActive !== false);
  const svc = list.find((s) => String(s.id) === String(svcId)) ?? null;
  const team = (staff.data ?? []).filter((s) => s.isActive !== false);
  const able = svc?.staffIds?.length ? team.filter((s) => svc.staffIds!.some((x) => String(x) === String(s.id))) : team;
  const master = team.find((s) => String(s.id) === pro) ?? null;
  const cats = useMemo(() => [...new Set(list.map((s) => s.categoryName).filter(Boolean) as string[])], [list]);
  const shown = cat ? list.filter((s) => s.categoryName === cat) : list;
  const cl = client && client.id ? (clients.data ?? []).find((c) => String(c.id) === client.id) : undefined;

  // Slots: one specialist, or "İlk boş" = every able specialist merged (first one free at each time gets the booking).
  const slots = useLoad(async () => {
    if (!svc || step < 3) return null;
    const who = pro === ANY ? able : master ? [master] : [];
    const res = await Promise.all(who.map(async (s) => ({ s, r: await api.slots(sid, svc.id, date, s.id).catch(() => null) })));
    const by = new Map<string, Staff>();
    for (const { s, r } of res) for (const x of r?.availableSlots ?? []) if (!by.has(x.slice(0, 5))) by.set(x.slice(0, 5), s);
    return by;
  }, [svc?.id, pro, date.toDateString(), step >= 3, able.length]);
  const free = slots.data ?? new Map<string, Staff>();
  const grid = useMemo(() => {
    const keys = [...free.keys()].sort();
    if (!keys.length) return [] as string[];
    const lo = toMin(keys[0]); const hi = toMin(keys[keys.length - 1]); const out: string[] = [];
    for (let m = lo; m <= hi; m += 30) out.push(fromMin(m));
    for (const k of keys) if (!out.includes(k)) out.push(k);
    return out.sort();
  }, [free]);
  const assigned = slot ? (pro === ANY ? free.get(slot) ?? null : master) : master;

  const titles = [tr('v2.pickService'), tr('v2.pickPro'), tr('v2.pickTime'), tr('v2.confirmStep')];
  const can = [!!svc, !!pro, !!slot, true][step - 1];
  const back = () => (step === 1 ? router.back() : setStep(step - 1));
  const next = () => { if (step < 4) { setStep(step + 1); if (step === 3 && !client) setPicker(true); } };

  const [submitErr, setSubmitErr] = useState('');
  async function create() {
    if (!svc || !slot || !assigned) return;
    if (!client) { setPicker(true); return; }
    const len = svc.durationMinutes ?? 30;
    const body = { businessId: sid, staffId: assigned.id, clientId: client.id, clientName: client.name, clientPhone: client.phone ?? undefined, clientEmail: client.email ?? undefined, serviceId: svc.id, appointmentDate: toDay(date), startTime: slot, endTime: fromMin(toMin(slot) + len), price: svc.price };
    setBusy(true); setSubmitErr('');
    try {
      try { await api.createAppointment(body); }
      catch (e) {
        const data = e instanceof ApiError ? (e.data as { code?: string; canOverride?: boolean } | null) : null;
        if (data?.code === 'BOOKING_CONFLICTS' && data.canOverride && (await askOverride(`${dayMonth(date)} · ${slot}\n${(e as Error).message}`))) await api.createAppointment(body, true);
        else throw e;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump();
      setDone({ client: client.name, service: svc.name, when: `${sameDay(date, new Date()) ? tr('v2.today') : `${weekdayLong(date)}, ${dayMonth(date)}`}, ${slot}`, who: firstName(assigned.name) });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const m = (e as Error).message || tr('common.error'); setSubmitErr(m); toast(m, 'error');
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: t.canvas }}>
        <View style={{ alignItems: 'center', paddingTop: ins.top + 118, paddingHorizontal: 28 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: t.oksoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={40} color={t.ok} /></View>
          <T k="h1" style={{ marginTop: 22, textAlign: 'center' }} accessibilityRole="header">{tr('v2.created')}</T>
          <T k="body" color={t.muted} style={{ marginTop: 8, textAlign: 'center' }}>{done.client} · {done.service}{'\n'}{done.when} · {done.who}</T>
          <T k="sm" color={t.ink3} style={{ marginTop: 6, textAlign: 'center' }}>{tr('v2.clientNotified')}</T>
        </View>
        <CtaBar>
          <Button kind="ol" label={tr('v2.oneMore')} style={{ flex: 1 }} onPress={() => { setDone(null); setStep(1); setSvcId(null); setSlot(null); setClient(p.clientId ? { id: String(p.clientId), name: p.clientName ?? '' } : null); }} />
          <Button label={tr('v2.seeCalendar')} style={{ flex: 1 }} onPress={() => { router.back(); router.navigate('/calendar'); }} />
        </CtaBar>
      </View>
    );
  }

  const err = (services.error || staff.error) as Error | null;
  const cardW = (W - 40 - 12) / 2;
  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: ins.top }}>
      <BackBar label={step > 1 ? tr('v2.back') : tr('v2.close')} onBack={back} right={<T k="sm" color={t.muted} style={{ paddingRight: 12 }}>{step}/4</T>} />
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 6 }}>
        {[1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.violet : t.fill2 }} />)}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}><T k="h1" accessibilityRole="header">{titles[step - 1]}</T></View>
        {err ? <ErrorState error={err} onRetry={() => { void services.reload(); void staff.reload(); }} /> : step === 1 ? (
          <>
            <ChipRow style={{ marginVertical: 14 }}>
              <Chip label={tr('v2.all')} on={!cat} onPress={() => setCat(null)} />
              {cats.map((c) => <Chip key={c} label={c} on={cat === c} onPress={() => setCat(c)} />)}
            </ChipRow>
            {services.loading && !services.data ? <Skeleton blocks={[{ h: 170 }, { h: 170 }]} /> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>
                {shown.map((s) => {
                  const on = String(s.id) === String(svcId);
                  return (
                    <Pressable key={String(s.id)} onPress={() => { setSvcId(String(s.id)); setSlot(null); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={s.name}
                      style={[{ width: cardW, borderRadius: 20, overflow: 'hidden', backgroundColor: t.surface }, cardShadow, on ? { boxShadow: `0 0 0 2px ${t.violet}, 0 6px 20px -10px rgba(29,23,48,.14)` } : null] as object}>
                      <Photo src={(s as { imageUrl?: string }).imageUrl} style={{ width: '100%', height: 118 }}>
                        {!(s as { imageUrl?: string }).imageUrl ? <LinearGradient colors={['#e6deff', '#ffe0e7']} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}><Icon name="scissors" size={30} color={t.vtext} /></LinearGradient> : null}
                      </Photo>
                      {on ? <View style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: t.violet, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={14} color="#fff" /></View> : null}
                      <View style={{ paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12 }}>
                        <Text numberOfLines={2} style={{ fontFamily: font.b, fontSize: 14, lineHeight: 17.5, color: t.ink }}>{s.name}</Text>
                        <T k="sm" color={t.muted}>{s.durationMinutes ?? 30} {tr('v2.min')} · {money(s.price, salon?.currency)}</T>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Pressable onPress={() => router.replace({ pathname: '/booking/classic', params: { ...(p.date ? { date: p.date } : {}), ...(p.clientId ? { clientId: p.clientId, clientName: p.clientName ?? '' } : {}) } })} accessibilityRole="button"
              style={{ marginTop: 18, marginHorizontal: 20, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="sliders" size={18} color={t.vtext} /><Text style={{ fontFamily: font.s, fontSize: 13.5, color: t.vtext }}>{tr('v2.fullForm')}</Text>
            </Pressable>
          </>
        ) : step === 2 && svc ? (
          <>
            <SvcCard s={svc} cur={salon?.currency} />
            <View style={{ marginTop: 22, marginBottom: 12, marginHorizontal: 20 }}><T k="h2">{tr('v2.whoDoes')}</T></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingVertical: 4 }}>
              <Big on={pro === ANY} label={tr('v2.firstFree')} sub={tr('v2.soonest')} onPress={() => { setPro(ANY); setSlot(null); }} />
              {able.map((s) => <Big key={String(s.id)} on={pro === String(s.id)} uri={s.avatarUrl} name={s.name} label={firstName(s.name)} sub={(s as { rating?: number }).rating ? `★ ${Number((s as { rating?: number }).rating).toFixed(1).replace('.', ',')}` : s.position ?? ''} onPress={() => { setPro(String(s.id)); setSlot(null); }} />)}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <Card style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.b, fontSize: 15, color: t.ink }}>{master?.name ?? tr('v2.firstFree')}</Text>
                  {master ? null : <Pill tone="ok" text={tr('v2.soonest')} />}
                </View>
                <T k="sm" color={t.muted} style={{ marginTop: 4 }}>{master ? `${master.position ?? ''}` : `${able.length} ${tr('v2.specialist').toLowerCase()}`}</T>
              </Card>
            </View>
          </>
        ) : step === 3 && svc ? (
          <>
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, marginTop: 14 }}>
              {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i)).map((d) => {
                const on = sameDay(d, date); const past = d < addDays(new Date(), -1) && !sameDay(d, new Date());
                return (
                  <Pressable key={d.toDateString()} disabled={past} onPress={() => { setDate(d); setSlot(null); }} noScale accessibilityRole="button" accessibilityState={{ selected: on, disabled: past }} accessibilityLabel={`${weekdayLong(d)}, ${dayMonth(d)}`}
                    style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, opacity: past ? 0.35 : 1 }}>
                    <Text style={{ fontFamily: font.s, fontSize: 11.5, color: t.ink3 }}>{weekdayMini(d)}</Text>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#1d1730' : 'transparent' }}>
                      <Text style={{ fontFamily: font.b, fontSize: 16, color: on ? '#fff' : t.ink }}>{d.getDate()}</Text>
                    </View>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.violet, opacity: past ? 0 : 0.7 }} />
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 12, marginHorizontal: 20 }}>
              <T k="h2">{dayMonth(date)}</T><T k="sm" color={t.muted}>{svc.durationMinutes ?? 30} {tr('v2.min')}</T>
            </View>
            {slots.loading ? <Skeleton blocks={[{ h: 44 }, { h: 44 }, { h: 44 }]} /> : grid.length === 0 ? (
              <T k="body" color={t.muted} style={{ paddingHorizontal: 20 }}>{tr('v2.noSlots')}</T>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 }}>
                  {grid.map((s) => {
                    const ok = free.has(s); const on = slot === s;
                    return (
                      <Pressable key={s} disabled={!ok} onPress={() => setSlot(s)} noScale accessibilityRole="button" accessibilityState={{ selected: on, disabled: !ok }} accessibilityLabel={s}
                        style={{ width: (W - 40 - 24) / 4, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#1d1730' : t.surface, borderWidth: on ? 0 : 1, borderColor: t.hair }}>
                        <Text style={{ fontFamily: font.s, fontSize: 14, color: on ? '#fff' : ok ? t.ink : '#cfc7bc', textDecorationLine: ok ? 'none' : 'line-through', fontVariant: ['tabular-nums'] }}>{s}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <T k="xs" color={t.ink3} style={{ paddingHorizontal: 20, marginTop: 12 }}>{tr('v2.slotsHint')}</T>
              </>
            )}
          </>
        ) : step === 4 && svc && slot ? (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Card style={{ overflow: 'hidden' }}>
              <Photo src={(svc as { imageUrl?: string }).imageUrl} style={{ height: 150 }}>
                <LinearGradient colors={['rgba(20,14,34,0)', 'rgba(20,14,34,.6)']} locations={[0.4, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
                <View style={{ position: 'absolute', left: 16, bottom: 12 }}>
                  <Text style={{ fontFamily: font.b, fontSize: 18, color: '#fff' }}>{svc.name}</Text>
                  <Text style={{ fontFamily: font.r, fontSize: 12.5, color: 'rgba(255,255,255,.85)' }}>{svc.durationMinutes ?? 30} {tr('v2.min')}</Text>
                </View>
              </Photo>
              <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                <KV first icon="user" label={tr('v2.specialist')} value={assigned?.name ?? '-'} />
                <KV icon="cal" label={tr('v2.time')} value={`${weekdayLong(date)}, ${dayMonth(date)} · ${slot}`} />
                <Pressable onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel={`${tr('v2.client')}: ${client?.name ?? tr('v2.pickClient')}`} noScale>
                  <KV lead={<Avatar uri={cl?.avatarUrl} name={client?.name ?? '?'} size={38} />} label={tr('v2.client')} value={client?.name ?? tr('v2.pickClient')}
                    right={<Text style={{ fontFamily: font.s, fontSize: 12.5, color: t.vtext }}>{tr('v2.change')}</Text>} />
                </Pressable>
              </View>
            </Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18 }}>
              <T k="body" color={t.muted}>{tr('v2.payLater')}</T>
              <Text style={{ fontFamily: font.x, fontSize: 32, letterSpacing: -0.96, color: t.ink, fontVariant: ['tabular-nums'] }}>{money(svc.price, salon?.currency)}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      {submitErr && step === 4 ? <T k="sm" color={t.gink} style={{ position: 'absolute', left: 20, right: 20, bottom: 96 + ins.bottom, textAlign: 'center' }}>{submitErr}</T> : null}
      <ToastHost modal />
      <CtaBar>
        {step < 4 ? <Button label={tr('v2.next')} style={{ flex: 1 }} disabled={!can} onPress={next} />
          : <Button kind="dk" icon="check" label={tr('v2.createBooking')} style={{ flex: 1 }} loading={busy} onPress={() => void create()} />}
      </CtaBar>
      <ClientPicker open={picker} sid={sid} list={clients.data ?? []} onClose={() => setPicker(false)} onPick={(c) => { setClient(c); setPicker(false); }} onCreated={() => void clients.reload()} />
    </View>
  );
}

function SvcCard({ s, cur }: { s: Service; cur?: string }) {
  const { t } = useTheme();
  return (
    <Card style={{ marginTop: 16, marginHorizontal: 20, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Photo src={(s as { imageUrl?: string }).imageUrl} style={{ width: 52, height: 52, borderRadius: 14 }} />
      <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{s.name}</Text><T k="sm" color={t.muted}>{s.durationMinutes ?? 30} {tr('v2.min')} · {money(s.price, cur)}</T></View>
    </Card>
  );
}

/** Specialist bubble (`.pro`, 76): violet border when chosen. */
function Big({ on, uri, name, label, sub, onPress }: { on: boolean; uri?: string | null; name?: string; label: string; sub: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ width: 76, alignItems: 'center' }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: on ? t.violet : 'transparent', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: t.fill }}>
        {name ? <Avatar uri={uri} name={name} size={70} /> : <Icon name="spark" size={22} color={t.muted} />}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 13, color: t.ink, marginTop: 6 }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 11.5, color: t.muted }}>{sub}</Text>
    </Pressable>
  );
}

/** Client picker sheet: search, list, quick "new client" (first name, phone). */
function ClientPicker({ open, sid, list, onClose, onPick, onCreated }: { open: boolean; sid: string; list: ClientWithStats[]; onClose: () => void; onPick: (c: NonNullable<Who>) => void; onCreated: () => void }) {
  const { t } = useTheme();
  const { height: H } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [first, setFirst] = useState(''); const [phone, setPhone] = useState(''); const [busy, setBusy] = useState(false);
  const s = q.trim().toLowerCase();
  const rows = list.filter((c) => !s || `${c.firstName} ${c.lastName ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(s)).slice(0, 60);
  async function create() {
    setBusy(true);
    try {
      const [f, ...l] = first.trim().split(/\s+/);
      const c = await api.createClient(sid, { firstName: f, lastName: l.join(' ') || undefined, phone: phone.trim() || undefined });
      onCreated(); onPick({ id: validId(c?.id) ?? '', name: first.trim(), phone: phone.trim() || null }); setAdding(false); setFirst(''); setPhone('');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  const input = { height: 48, borderRadius: 14, backgroundColor: t.fill, paddingHorizontal: 14, fontFamily: font.r, fontSize: 15, color: t.ink, outlineStyle: 'none' } as object;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={{ height: H * 0.68 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <T k="h2" style={{ fontSize: 18 }}>{tr('v2.pickClient')}</T>
          <Button size="sm" kind="fl" icon={adding ? 'x' : 'plus'} label={adding ? tr('common.cancel') : tr('v2.newClient')} onPress={() => setAdding((v) => !v)} />
        </View>
        {adding ? (
          <View style={{ gap: 10 }}>
            <TextInput value={first} onChangeText={setFirst} placeholder={tr('v2.firstName')} placeholderTextColor={t.ink3} style={input} accessibilityLabel={tr('v2.client')} />
            <TextInput value={phone} onChangeText={setPhone} placeholder="+994" keyboardType="phone-pad" placeholderTextColor={t.ink3} style={input} accessibilityLabel="phone" />
            <Button label={tr('common.save')} disabled={!first.trim()} loading={busy} onPress={() => void create()} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, borderRadius: 14, backgroundColor: t.fill, paddingHorizontal: 14 }}>
              <Icon name="search" size={18} color={t.ink3} />
              <TextInput value={q} onChangeText={setQ} placeholder={tr('v2.searchClient')} placeholderTextColor={t.ink3} accessibilityLabel={tr('v2.searchClient')} style={{ flex: 1, fontFamily: font.r, fontSize: 15, color: t.ink, outlineStyle: 'none' } as object} />
            </View>
            <FlatList data={rows} keyExtractor={(c) => String(c.id)} keyboardShouldPersistTaps="handled" style={{ marginTop: 8 }}
              renderItem={({ item: c, index }) => (
                <Pressable onPress={() => onPick({ id: validId(c.id) ?? '', name: `${c.firstName} ${c.lastName ?? ''}`.trim(), phone: c.phone, email: c.email })} noScale accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: t.hair }}>
                  <Avatar uri={c.avatarUrl} name={c.firstName} size={40} />
                  <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{c.firstName} {c.lastName ?? ''}</Text><T k="t2" color={t.muted}>{c.phone ?? ''}</T></View>
                </Pressable>
              )} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
