import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { FlatList, TextInput, ScrollView, View, useWindowDimensions } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { ToastHost } from '@/components/ToastHost';
import * as Haptics from 'expo-haptics';
import { Choice, Line, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Chip, Circ, ErrorState, Field, Header, HeroCard, Pill, Screen, Section, Skeleton, StatCard, StateView, StickyCta } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay } from '@/lib/api';
import { apiB, type OnlineSales, type SlotOffer, type Thread } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { addDays, dateLabel, fromIso, money, sameDay, startOfWeek, weekdayShort } from '@/lib/format';
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
  const run = async (fn: () => Promise<unknown>, after: () => void) => { setBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } };
  if (view === 'new') return (
    <Screen>
      <Header title={tr('x2.newTicket')} onBack={() => setView('list')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}>
        <HeroCard icon="help" title={tr('x2.newTicket')} sub={tr('x2.support')} />
        <Section title={tr('ux.secBasics')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{CATS.map((c) => <Chip key={c} soft label={tr(`x2.cat.${c}` as 'x2.cat.OTHER')} active={cat === c} onPress={() => setCat(c)} />)}</View>
          <Field label={tr('mk.subject')} value={subject} onChangeText={setSubject} />
          <Field label={tr('mk.body')} value={msg} onChangeText={setMsg} multiline style={{ minHeight: 120, paddingTop: 6, textAlignVertical: 'top' }} />
        </Section>
        <Btn label={tr('mk.send')} loading={busy} disabled={!subject.trim() || !msg.trim()} onPress={() => void run(() => apiB.createTicket({ category: cat, subject: subject.trim(), message: msg.trim() }), () => { setSubject(''); setMsg(''); setView('list'); void list.reload(); })} />
      </ScrollView>
    </Screen>
  );
  if (view !== 'list') return (
    <Screen>
      <Header title={th.data?.ticket.subject ?? tr('x2.support')} onBack={() => setView('list')} />
      {th.loading && !th.data ? <Skeleton rows={3} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 8 }}>
          {(th.data?.messages ?? []).map((m) => { const mine = m.authorType === 'USER'; return (
            <View key={String(m.id)} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: mine ? t.violet : t.surface, borderRadius: 24, borderBottomRightRadius: mine ? 8 : 24, borderBottomLeftRadius: mine ? 24 : 8, paddingHorizontal: 16, paddingVertical: 12, gap: 2, boxShadow: mine ? '0 10px 20px -10px rgba(91,63,214,.6)' : '0 1px 2px rgba(29,23,48,.05)' } as any}>
              <Text style={{ fontFamily: font.s, fontSize: 13, color: mine ? 'rgba(255,255,255,.8)' : t.muted }}>{mine ? tr('ux.me' as never) === 'ux.me' ? 'Siz' : tr('ux.me' as never) : m.authorName ?? 'booqi'}</Text>
              <Text style={{ fontFamily: font.m, fontSize: 16, lineHeight: 22, color: mine ? '#fff' : t.ink }}>{m.body}</Text>
            </View>
          ); })}
        </ScrollView>
      )}
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 32, backgroundColor: t.surface, boxShadow: '0 12px 30px -10px rgba(29,23,48,.35)' } as any}>
        <TextInput value={reply} onChangeText={setReply} placeholder={tr('rv.reply')} placeholderTextColor={t.ink3} accessibilityLabel={tr('rv.reply')} multiline style={{ flex: 1, minHeight: 48, maxHeight: 110, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: t.fill, fontFamily: font.m, fontSize: 16, color: t.ink, outlineStyle: 'none' } as any} />
        <Pressable onPress={() => void run(() => apiB.replyTicket(view, reply.trim()), () => { setReply(''); void th.reload(); })} disabled={busy || !reply.trim()} haptic accessibilityRole="button" accessibilityLabel={tr('msg.send')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center', opacity: !reply.trim() ? 0.45 : 1 }}><Icon name="send" size={22} color="#fff" /></Pressable>
      </View>
    </Screen>
  );
  const addBtn = <Circ icon="plus" violet label={tr('x2.newTicket')} onPress={() => setView('new')} />;
  return (
    <Screen>
      <Header title={tr('x2.support')} onBack={onBack} right={addBtn} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={3} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(x) => x.ref} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 10 }}
          ListEmptyComponent={<StateView icon="help" title={tr('x2.noTickets')} actionLabel={tr('x2.newTicket')} onAction={() => setView('new')} />}
          renderItem={({ item: x }) => (
            <Card onPress={() => setView(x.ref)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 84 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: x.status === 'RESOLVED' || x.status === 'CLOSED' ? t.oksoft : t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.status === 'RESOLVED' || x.status === 'CLOSED' ? 'check' : 'chat'} size={22} color={x.status === 'RESOLVED' || x.status === 'CLOSED' ? t.ok : t.vtext} /></View>
              <View style={{ flex: 1, gap: 2 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, letterSpacing: -0.2, color: t.ink }}>{x.subject}</Text><Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{x.ref} · {x.category}</Text></View>
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
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'QUIET' | 'LAST_MINUTE'>('LAST_MINUTE'); const [pct, setPct] = useState('15'); const [hrs, setHrs] = useState(3);
  const [wd, setWd] = useState(2); const [from, setFrom] = useState('10:00'); const [to, setTo] = useState('14:00');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const dayName = (w: number) => weekdayShort(new Date(2024, 0, w));
  async function save(next: SlotOffer[]): Promise<boolean> {
    setBusy(true);
    try { setRows(await apiB.saveSlotOffers(sid, next)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); return true; }
    catch (e) { setErr((e as Error).message); return false; } finally { setBusy(false); }
  }
  function openNew() { setErr(''); setOpen(true); }
  async function add() {
    setErr('');
    const p = Math.round(num(pct));
    if (!(p > 0 && p <= 90)) { setErr(tr('x2.pctRange')); return; }
    let rule: SlotOffer;
    if (kind === 'LAST_MINUTE') { rule = { kind, hoursAhead: hrs, percent: p }; }
    else {
      if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to) || to <= from) { setErr(tr('hr.badTime')); return; }
      rule = { kind, weekday: wd, startTime: from, endTime: to, percent: p };
    }
    if (await save([...rows, rule])) setOpen(false);
  }
  const summary = (r: SlotOffer) => r.kind === 'LAST_MINUTE'
    ? tr('x2.ruleLastSum', { p: r.percent, n: r.hoursAhead ?? 0 })
    : tr('x2.ruleQuietSum', { p: r.percent, d: dayName(Number(r.weekday ?? 1)), a: (r.startTime ?? '').slice(0, 5), b: (r.endTime ?? '').slice(0, 5) });
  return (
    <Screen>
      <Header title={tr('x2.offers')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={3} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 10 }}>
          <Text style={{ fontFamily: font.m, fontSize: 14, lineHeight: 20, color: t.muted, marginBottom: 6 }}>{tr('x2.offersIntro')}</Text>
          {rows.map((r, i) => (
            <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 4 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 15, color: t.vtext }}>-{r.percent}%</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 15, color: t.ink }}>{r.kind === 'LAST_MINUTE' ? tr('x2.lastMinute') : tr('x2.quiet')}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{summary(r)}</Text>
              </View>
              <Pill text={tr('x2.ruleActive')} tone="ok" />
              <Pressable onPress={() => void save(rows.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={20} color={t.gink} /></Pressable>
            </Card>
          ))}
          {rows.length === 0 ? <StateView icon="tag" title={tr('x2.noOffers')} body={tr('x2.offersBody')} actionLabel={tr('x2.newOffer')} onAction={openNew} /> : <Btn label={tr('x2.newOffer')} icon="plus" onPress={openNew} />}
        </ScrollView>
      )}
      <ToastHost modal />
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink, marginBottom: 12 }}>{tr('x2.editOffer')}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}><Chip soft active={kind === 'LAST_MINUTE'} label={tr('x2.lastMinute')} onPress={() => setKind('LAST_MINUTE')} /><Chip soft active={kind === 'QUIET'} label={tr('x2.quiet')} onPress={() => setKind('QUIET')} /></View>
          <View style={{ gap: 8 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13, color: t.muted }}>{tr('x2.discountPct')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[10, 15, 20, 30].map((p) => <Chip key={p} soft active={pct === String(p)} label={`${p}%`} onPress={() => setPct(String(p))} />)}</View>
            <Field value={pct} onChangeText={setPct} keyboardType="number-pad" maxLength={2} />
          </View>
          {kind === 'LAST_MINUTE' ? (
            <View style={{ gap: 8 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13, color: t.muted }}>{tr('x2.hoursBefore')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1, 2, 3, 6, 12, 24].map((h) => <Chip key={h} soft active={hrs === h} label={String(h)} onPress={() => setHrs(h)} />)}</View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13, color: t.muted }}>{tr('x2.ruleDay')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1, 2, 3, 4, 5, 6, 7].map((w) => <Chip key={w} soft active={wd === w} label={dayName(w)} onPress={() => setWd(w)} />)}</View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Field label={tr('x2.ruleFrom')} value={from} onChangeText={setFrom} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
                <View style={{ flex: 1 }}><Field label={tr('x2.ruleTo')} value={to} onChangeText={setTo} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              </View>
            </View>
          )}
          {err ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.gink }}>{err}</Text> : null}
          <Btn label={tr('common.save')} loading={busy} onPress={() => void add()} />
        </ScrollView>
      </BottomSheet>
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
        <FlatList data={q.data ?? []} keyExtractor={(r) => r.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 10 }}
          ListEmptyComponent={<StateView icon="store" title={tr('rp.empty')} />}
          renderItem={({ item: r }) => (
            <Card style={{ gap: 14, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={r.name} size={52} />
                <Text numberOfLines={2} style={{ flex: 1, fontFamily: font.x, fontSize: 19, letterSpacing: -0.4, color: t.ink }}>{r.name}</Text>
              </View>
              <Text style={{ fontFamily: font.x, fontSize: 38, letterSpacing: -1.2, color: t.ink }}>{money(N(r.revenue), salon?.currency)}<Text style={{ fontFamily: font.s, fontSize: 14, color: t.muted }}>  {tr('rp.revenue')}</Text></Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatCard label={tr('rp.bookings')} value={String(N(r.bookings))} style={{ backgroundColor: t.fill, boxShadow: 'none' } as any} />
                <StatCard label={tr('rp.newClients')} value={String(N(r.newClients))} style={{ backgroundColor: t.fill, boxShadow: 'none' } as any} />
              </View>
            </Card>
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
    try { await apiB.saveOnlineSales(sid, { giftCardsEnabled: s.giftCardsEnabled, giftCardMin: s.giftCardMin, giftCardMax: s.giftCardMax, walletEnabled: s.walletEnabled, walletMin: s.walletMin, walletMax: s.walletMax }); toast(tr('ns.saved'), 'success'); onBack(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  const n = (k: keyof OnlineSales) => (v: string) => s && setS({ ...s, [k]: Math.max(0, num(v) || 0) });
  return (
    <Screen>
      <Header title={tr('x2.shop')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !s ? <Skeleton rows={4} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }}>
          <HeroCard dark icon="gift" title={tr('x2.shop')} sub={tr('x2.giftOnline')} />
          <ToggleRow label={tr('x2.giftOnline')} value={s.giftCardsEnabled} onChange={(v) => setS({ ...s, giftCardsEnabled: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label={tr('x2.min')} value={String(s.giftCardMin)} onChangeText={n('giftCardMin')} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label={tr('x2.max')} value={String(s.giftCardMax)} onChangeText={n('giftCardMax')} keyboardType="decimal-pad" /></View></View>
          <ToggleRow label={tr('x2.walletOnline')} value={s.walletEnabled} onChange={(v) => setS({ ...s, walletEnabled: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label={tr('x2.min')} value={String(s.walletMin)} onChangeText={n('walletMin')} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label={tr('x2.max')} value={String(s.walletMax)} onChangeText={n('walletMax')} keyboardType="decimal-pad" /></View></View>
        </ScrollView>
      )}
      {s ? <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} /> : null}
    </Screen>
  );
}

/** Növbə cədvəli: the week's shifts, time off and days off per specialist. */
export function RotaView({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const { width: screenW } = useWindowDimensions();
  const sid = salon?.id ?? '';
  const thisWeek = startOfWeek(new Date());
  const [w, setW] = useState(() => thisWeek);
  const q = useLoad(() => apiB.rota(sid, toDay(w)), [sid, toDay(w)]);
  const staffQ = useLoad(() => api.staff(sid).catch(() => []), [sid]);
  const [sel, setSel] = useState<{ id: string; name: string; date: string } | null>(null);
  const [st, setSt] = useState('09:00'); const [en, setEn] = useState('18:00');
  const [repW, setRepW] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(''); try { await fn(); setSel(null); void q.reload(); } catch (e) { if (sel) setErr((e as Error).message); else toast((e as Error).message, 'error'); } finally { setBusy(false); } };
  const okT = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const compact = screenW < 360;
  const hh = (s: string) => String(Number(s.slice(0, 2)));
  const isThis = toDay(w) === toDay(thisWeek);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(w, i));
  const today = new Date();
  const nav = (icon: string, d: number, l: string) => <Pressable onPress={() => setW(addDays(w, d))} hitSlop={8} accessibilityRole="button" accessibilityLabel={l} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={18} color={t.ink} /></Pressable>;
  const dot = (c: string, label: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 12, color: t.muted }}>{label}</Text></View>;
  const weekHead = (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: t.canvas }}>
      {days.map((d) => { const td = sameDay(d, today); return (
        <View key={toDay(d)} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4, borderRadius: 12, backgroundColor: td ? t.vsoft : 'transparent' }}>
          <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 11.5, color: td ? t.vtext : t.muted }}>{weekdayShort(d).charAt(0).toUpperCase()}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 14, color: td ? t.vtext : t.ink }}>{d.getDate()}</Text>
        </View>
      ); })}
    </View>
  );
  return (
    <Screen>
      <Header title={tr('x2.rota')} subtitle={salon?.name} onBack={onBack} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 6 }}>
        {nav('back', -7, tr('calendar.prevWeek'))}
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{dateLabel(w)} – {dateLabel(addDays(w, 6))}</Text>
          {!isThis ? <Pressable onPress={() => setW(thisWeek)} hitSlop={8} accessibilityRole="button"><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 13, color: t.vtext }}>{tr('x2.rotaThisWeek')}</Text></Pressable> : null}
        </View>
        {nav('chev', 7, tr('calendar.nextWeek'))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>{dot(t.vsoft, tr('x2.rotaLegWork'))}{dot(t.fill, tr('x2.rotaLegOff'))}{dot(t.gsoft, tr('x2.rotaLegTimeOff'))}</View>
        <Pressable onPress={() => !busy && void run(() => apiB.copyWeek(sid, toDay(addDays(w, -7)), toDay(w)))} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('x3.copyWeek')} style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12.5, color: t.ink }}>{tr('x3.copyWeek')}</Text>
        </Pressable>
      </View>
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={3} height={96} /> : (
        <FlatList data={q.data?.staff ?? []} keyExtractor={(s) => String(s.id)} stickyHeaderIndices={[0]} ListHeaderComponent={weekHead}
          contentContainerStyle={{ paddingBottom: 60 }}
          ListEmptyComponent={<StateView icon="users" title={tr('rp.empty')} />}
          renderItem={({ item: s }) => {
            const total = s.days.reduce((a, d) => (d.state === 'OFF' || d.state.startsWith('TIME_OFF') || !d.start || !d.end ? a : a + Math.max(0, mins(d.end) - mins(d.start))), 0) / 60;
            return (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: t.hair }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={s.name} size={36} uri={(staffQ.data ?? []).find((x) => String(x.id) === String(s.id))?.avatarUrl} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 15.5, letterSpacing: -0.2, color: t.ink }}>{s.name}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 12.5, color: t.muted }}>{tr('x2.rotaHours', { n: Math.round(total * 10) / 10 })}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {s.days.map((d) => {
                    const off = d.state === 'OFF'; const to = d.state.startsWith('TIME_OFF');
                    const bg = off ? t.fill : to ? t.gsoft : t.vsoft; const fg = off ? t.faint : to ? t.gink : t.vtext;
                    const a = (d.start ?? '').slice(0, 5); const b = (d.end ?? '').slice(0, 5);
                    return (
                      <Pressable key={d.date} onPress={() => { setErr(''); setSel({ id: String(s.id), name: s.name, date: d.date }); setSt((d.start ?? '09:00').slice(0, 5)); setEn((d.end ?? '18:00').slice(0, 5)); }} accessibilityRole="button" accessibilityLabel={`${s.name} ${dateLabel(fromIso(d.date))} ${off ? tr('tm.closed') : a ? `${a}-${b}` : ''}`}
                        style={{ flex: 1, height: 40, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                        {off ? <Text style={{ fontFamily: font.b, fontSize: 13, color: fg }}>–</Text>
                          : to ? <Text style={{ fontFamily: font.b, fontSize: 12, color: fg }}>✕</Text>
                          : compact && a && b ? <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 10.5, color: fg }}>{hh(a)}–{hh(b)}</Text>
                          : <><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 10.5, lineHeight: 13, color: fg }}>{a}</Text><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 10.5, lineHeight: 13, color: fg }}>{b}</Text></>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          }} />
      )}
      <BottomSheet open={!!sel} onClose={() => setSel(null)}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 22, letterSpacing: -0.5, lineHeight: 28, color: t.ink, marginBottom: 12 }}>{sel ? `${sel.name} · ${dateLabel(fromIso(sel.date))}` : ''}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('hr.open')} value={st} onChangeText={setSt} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          <View style={{ flex: 1 }}><Field label={tr('hr.closed')} value={en} onChangeText={setEn} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
        </View>
        <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14.5, color: t.muted, marginBottom: 8 }}>{tr('ux.repeatShiftWeeks')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>{[0, 2, 4, 8].map((n) => <Chip key={n} soft label={n === 0 ? tr('ux.repNone') : tr('ux.repWeeks', { n })} active={repW === n} onPress={() => setRepW(n)} />)}</View>
        {err ? <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.gink, marginBottom: 10 }}>{err}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
          <Btn label={tr('tm.closed')} variant="secondary" style={{ flex: 1 }} loading={busy} onPress={() => sel && void run(async () => { for (let i = 0; i <= repW; i++) await apiB.clearShift(sid, sel.id, toDay(addDays(fromIso(sel.date), 7 * i))); })} />
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => { if (!sel) return; if (!okT(st) || !okT(en) || en <= st) { setErr(tr('hr.badTime')); return; } void run(async () => { for (let i = 0; i <= repW; i++) await apiB.setShift(sid, { staffId: sel.id, date: toDay(addDays(fromIso(sel.date), 7 * i)), start: st, end: en }); if (repW) toast(tr('ux.shiftSeries'), 'success'); }); }} />
        </View>
        <ToastHost modal />
      </BottomSheet>
    </Screen>
  );
}
