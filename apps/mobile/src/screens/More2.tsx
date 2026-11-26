import { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import * as Haptics from 'expo-haptics';
import { Choice, Line, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { toDay } from '@/lib/api';
import { apiB, type OnlineSales, type SlotOffer, type Thread } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { addDays, dateLabel, fromIso, money, startOfWeek } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const CATS = ['BOOKING', 'PAYMENT', 'ACCOUNT', 'SALON_PROFILE', 'BUG', 'FEEDBACK', 'OTHER'] as const;
const N = (v: number | string | null | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Dəstək: support tickets to the booqi team (list, new, thread, reply). */
export function Support({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const list = useLoad(() => apiB.tickets(), []);
  const [view, setView] = useState<'list' | 'new' | string>('list');
  const th = useLoad<Thread | null>(() => (view !== 'list' && view !== 'new' ? apiB.ticket(view) : Promise.resolve(null)), [view]);
  const [cat, setCat] = useState<(typeof CATS)[number]>('OTHER'); const [subject, setSubject] = useState(''); const [msg, setMsg] = useState(''); const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, after: () => void) => { setBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); } };
  if (view === 'new') return (
    <Screen>
      <Header title={tr('x2.newTicket')} onBack={() => setView('list')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Choice value={cat} onChange={setCat} options={CATS.map((c) => ({ value: c, label: tr(`x2.cat.${c}` as 'x2.cat.OTHER') }))} />
        <Field label={tr('mk.subject')} value={subject} onChangeText={setSubject} />
        <Field label={tr('mk.body')} value={msg} onChangeText={setMsg} multiline style={{ minHeight: 120, paddingTop: 14, textAlignVertical: 'top' }} />
        <Btn label={tr('mk.send')} loading={busy} disabled={!subject.trim() || !msg.trim()} onPress={() => void run(() => apiB.createTicket({ category: cat, subject: subject.trim(), message: msg.trim() }), () => { setSubject(''); setMsg(''); setView('list'); void list.reload(); })} />
      </ScrollView>
    </Screen>
  );
  if (view !== 'list') return (
    <Screen>
      <Header title={th.data?.ticket.subject ?? tr('x2.support')} onBack={() => setView('list')} />
      {th.loading && !th.data ? <Skeleton rows={3} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}>
          {(th.data?.messages ?? []).map((m) => (
            <View key={String(m.id)} style={{ alignSelf: m.authorType === 'USER' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: m.authorType === 'USER' ? t.violet : t.surface, borderRadius: 18, padding: 12 }}>
              <Text style={{ fontFamily: font.m, fontSize: 15, color: m.authorType === 'USER' ? '#fff' : t.ink }}>{m.body}</Text>
            </View>
          ))}
          <Field label={tr('rv.reply')} value={reply} onChangeText={setReply} multiline style={{ minHeight: 80, paddingTop: 14, textAlignVertical: 'top' }} />
          <Btn label={tr('msg.send')} loading={busy} disabled={!reply.trim()} onPress={() => void run(() => apiB.replyTicket(view, reply.trim()), () => { setReply(''); void th.reload(); })} />
        </ScrollView>
      )}
    </Screen>
  );
  const addBtn = <Pressable onPress={() => setView('new')} accessibilityRole="button" accessibilityLabel={tr('x2.newTicket')} haptic style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color="#fff" /></Pressable>;
  return (
    <Screen>
      <Header title={tr('x2.support')} onBack={onBack} right={addBtn} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={3} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(x) => x.ref} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={<StateView icon="help" title={tr('x2.noTickets')} actionLabel={tr('x2.newTicket')} onAction={() => setView('new')} />}
          renderItem={({ item: x }) => (
            <Card onPress={() => setView(x.ref)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{x.subject}</Text><Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{x.ref} · {x.lastMessageAt.slice(0, 10)}</Text></View>
              <Pill text={x.status} tone={x.status === 'RESOLVED' || x.status === 'CLOSED' ? 'ok' : 'violet'} />
            </Card>
          )} />
      )}
    </Screen>
  );
}

/** Təkliflər: quiet-hour and last-minute discounts that fill empty slots. */
export function Offers({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiB.slotOffers(sid), [sid]);
  const [rows, setRows] = useState<SlotOffer[]>([]);
  useEffect(() => { if (q.data) setRows(q.data); }, [q.data]);
  const [kind, setKind] = useState<'QUIET' | 'LAST_MINUTE'>('LAST_MINUTE'); const [pct, setPct] = useState('15'); const [hrs, setHrs] = useState('3');
  const [wd, setWd] = useState('2'); const [from, setFrom] = useState('10:00'); const [to, setTo] = useState('14:00');
  const [busy, setBusy] = useState(false);
  async function save(next: SlotOffer[]) {
    setBusy(true);
    try { setRows(await apiB.saveSlotOffers(sid, next)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  function add() {
    const p = Math.round(num(pct));
    if (!(p > 0 && p <= 90)) { Alert.alert(tr('common.error'), tr('x2.pctRange')); return; }
    if (kind === 'LAST_MINUTE') { const h = Math.round(num(hrs)); if (!(h > 0)) { Alert.alert(tr('common.error'), tr('x2.pctRange')); return; } void save([...rows, { kind, hoursAhead: h, percent: p }]); }
    else { const w = Number(wd); if (!(w >= 1 && w <= 7) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to) || to <= from) { Alert.alert(tr('common.error'), tr('hr.badTime')); return; } void save([...rows, { kind, weekday: w, startTime: from, endTime: to, percent: p }]); }
  }
  return (
    <Screen>
      <Header title={tr('x2.offers')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={3} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 10 }}>
          {rows.map((r, i) => (
            <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>-{r.percent}% · {r.kind === 'LAST_MINUTE' ? tr('x2.lastMinute') : tr('x2.quiet')}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{r.kind === 'LAST_MINUTE' ? tr('x2.hoursAhead', { n: r.hoursAhead ?? 0 }) : `${r.weekday} · ${(r.startTime ?? '').slice(0, 5)}-${(r.endTime ?? '').slice(0, 5)}`}</Text>
              </View>
              <Pressable onPress={() => void save(rows.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
            </Card>
          ))}
          {rows.length === 0 ? <StateView icon="tag" title={tr('x2.noOffers')} body={tr('x2.offersBody')} /> : null}
          <Choice value={kind} onChange={setKind} options={[{ value: 'LAST_MINUTE' as const, label: tr('x2.lastMinute') }, { value: 'QUIET' as const, label: tr('x2.quiet') }]} />
          {kind === 'LAST_MINUTE' ? <Field label={tr('x2.hoursAheadLabel')} value={hrs} onChangeText={setHrs} keyboardType="number-pad" /> : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label={tr('ad.weekday')} value={wd} onChangeText={setWd} keyboardType="number-pad" maxLength={1} /></View>
              <View style={{ flex: 1.3 }}><Field label="→" value={from} onChangeText={setFrom} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              <View style={{ flex: 1.3 }}><Field label=" " value={to} onChangeText={setTo} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            </View>
          )}
          <Field label={tr('x2.discountPct')} value={pct} onChangeText={setPct} keyboardType="number-pad" />
          <Btn label={tr('ad.addRule')} loading={busy} icon="plus" onPress={add} />
        </ScrollView>
      )}
    </Screen>
  );
}

/** Filiallar: compare the owner's salons over the last 30 days. */
export function Branches({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const q = useLoad(() => apiB.branches(toDay(addDays(new Date(), -29)), toDay(new Date())), []);
  return (
    <Screen>
      <Header title={tr('x2.branches')} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={3} height={110} /> : (
        <FlatList data={q.data ?? []} keyExtractor={(r) => r.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={<StateView icon="store" title={tr('rp.empty')} />}
          renderItem={({ item: r }) => (
            <Card><Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{r.name}</Text>
              <Line label={tr('rp.revenue')} value={money(N(r.revenue), salon?.currency)} bold /><Line label={tr('rp.bookings')} value={String(N(r.bookings))} /><Line label={tr('rp.newClients')} value={String(N(r.newClients))} /><Line label={tr('rp.averageTicket')} value={money(N(r.averageTicket), salon?.currency)} /><Line label={tr('rp.cancellationRate')} value={String(N(r.cancellations))} /></Card>
          )} />
      )}
    </Screen>
  );
}

/** Onlayn satış: switch gift cards and wallet top-ups on or off and set limits. */
export function OnlineShop({ onBack }: { onBack: () => void }) {
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiB.onlineSales(sid), [sid]);
  const [s, setS] = useState<OnlineSales | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  async function save() {
    if (!s) return;
    setBusy(true);
    try { await apiB.saveOnlineSales(sid, { giftCardsEnabled: s.giftCardsEnabled, giftCardMin: s.giftCardMin, giftCardMax: s.giftCardMax, walletEnabled: s.walletEnabled, walletMin: s.walletMin, walletMax: s.walletMax }); Alert.alert(tr('ns.saved')); onBack(); }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  const n = (k: keyof OnlineSales) => (v: string) => s && setS({ ...s, [k]: Math.max(0, num(v) || 0) });
  return (
    <Screen>
      <Header title={tr('x2.shop')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !s ? <Skeleton rows={4} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          <ToggleRow label={tr('x2.giftOnline')} value={s.giftCardsEnabled} onChange={(v) => setS({ ...s, giftCardsEnabled: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label={tr('x2.min')} value={String(s.giftCardMin)} onChangeText={n('giftCardMin')} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label={tr('x2.max')} value={String(s.giftCardMax)} onChangeText={n('giftCardMax')} keyboardType="decimal-pad" /></View></View>
          <ToggleRow label={tr('x2.walletOnline')} value={s.walletEnabled} onChange={(v) => setS({ ...s, walletEnabled: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label={tr('x2.min')} value={String(s.walletMin)} onChangeText={n('walletMin')} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label={tr('x2.max')} value={String(s.walletMax)} onChangeText={n('walletMax')} keyboardType="decimal-pad" /></View></View>
          <Btn label={tr('common.save')} loading={busy} onPress={() => void save()} />
        </ScrollView>
      )}
    </Screen>
  );
}

/** Növbə cədvəli: the week's shifts, time off and days off per specialist. */
export function RotaView({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [w, setW] = useState(() => startOfWeek(new Date()));
  const q = useLoad(() => apiB.rota(sid, toDay(w)), [sid, toDay(w)]);
  const [sel, setSel] = useState<{ id: string; name: string; date: string } | null>(null);
  const [st, setSt] = useState('09:00'); const [en, setEn] = useState('18:00');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); setSel(null); void q.reload(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); } };
  const okT = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const nav = (icon: string, d: number, l: string) => <Pressable onPress={() => setW(addDays(w, d))} hitSlop={10} accessibilityRole="button" accessibilityLabel={l} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={t.ink} /></Pressable>;
  return (
    <Screen>
      <Header title={tr('x2.rota')} subtitle={salon?.name} onBack={onBack} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>{nav('back', -7, tr('calendar.prevWeek'))}<Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{dateLabel(w)} - {dateLabel(addDays(w, 6))}</Text>{nav('chev', 7, tr('calendar.nextWeek'))}</View>
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={3} height={120} /> : (
        <FlatList data={q.data?.staff ?? []} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={<StateView icon="users" title={tr('rp.empty')} />}
          renderItem={({ item: s }) => (
            <Card>
              <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink, marginBottom: 4 }}>{s.name}</Text>
              {s.days.map((d) => <Pressable key={d.date} onPress={() => { setSel({ id: String(s.id), name: s.name, date: d.date }); setSt((d.start ?? '09:00').slice(0, 5)); setEn((d.end ?? '18:00').slice(0, 5)); }} accessibilityRole="button"><Line key={d.date} label={dateLabel(fromIso(d.date))} value={d.state === 'OFF' ? tr('tm.closed') : d.state.startsWith('TIME_OFF') ? tr('tm.timeOff') : `${(d.start ?? '').slice(0, 5)}-${(d.end ?? '').slice(0, 5)}`} /></Pressable>)}
            </Card>
          )} />
      )}
      <Pressable onPress={() => void run(() => apiB.copyWeek(sid, toDay(addDays(w, -7)), toDay(w)))} accessibilityRole="button" style={{ position: 'absolute', left: 16, right: 16, bottom: 16, height: 48, borderRadius: 24, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 15, color: t.vtext }}>{tr('x3.copyWeek')}</Text></Pressable>
      <BottomSheet open={!!sel} onClose={() => setSel(null)}>
        <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 4 }}>{sel?.name}</Text>
        <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, marginBottom: 10 }}>{sel ? dateLabel(fromIso(sel.date)) : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('hr.open')} value={st} onChangeText={setSt} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          <View style={{ flex: 1 }}><Field label={tr('hr.closed')} value={en} onChangeText={setEn} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
          <Btn label={tr('tm.closed')} variant="secondary" style={{ flex: 1 }} loading={busy} onPress={() => sel && void run(() => apiB.clearShift(sid, sel.id, sel.date))} />
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => { if (!sel) return; if (!okT(st) || !okT(en) || en <= st) { Alert.alert(tr('common.error'), tr('hr.badTime')); return; } void run(() => apiB.setShift(sid, { staffId: sel.id, date: sel.date, start: st, end: en })); }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
