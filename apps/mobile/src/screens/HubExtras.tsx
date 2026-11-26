import { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, Share, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView, photoUrl } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay } from '@/lib/api';
import { apiH, type NotifTexts } from '@/lib/api-hub';
import { useApp } from '@/lib/app';
import { API_BASE } from '@/lib/config';
import { money } from '@/lib/format';
import { pickAndUpload } from '@/lib/pick';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const err = (e: unknown) => toast((e as Error).message, 'error');

/** Resurslar (rooms, chairs, equipment a service needs): list, add, remove. A service points at one in its editor. */
export function ResourceTypes({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiH.resourceTypes(sid), [sid]);
  const [name, setName] = useState(''); const [qty, setQty] = useState('1'); const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try { await apiH.addResourceType(sid, name.trim(), Math.max(1, Math.round(num(qty)) || 1)); setName(''); setQty('1'); await q.reload(); } catch (e) { err(e); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('hx.resTitle')} subtitle={tr('hx.resSub')} onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}>
        {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={3} height={56} /> : (q.data ?? []).length === 0 ? (
          <StateView icon="box" title={tr('hx.resEmpty')} body={tr('hx.resEmptyBody')} />
        ) : (q.data ?? []).map((r) => (
          <Card key={String(r.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{r.name}</Text><Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{tr('hx.resQty', { n: r.quantity })}</Text></View>
            <Pressable onPress={() => Alert.alert(tr('hx.resDelete'), r.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => void apiH.deleteResourceType(sid, r.id).then(() => q.reload()).catch(err) }])} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={20} color={t.gink} /></Pressable>
          </Card>
        ))}
        <Card style={{ gap: 4 }}>
          <Field label={tr('hx.resName')} value={name} onChangeText={setName} />
          <Field label={tr('hx.resQtyLabel')} value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <Btn label={tr('hx.resAdd')} icon="plus" loading={busy} disabled={!name.trim()} onPress={() => void add()} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

/** Gəlir planı: a target per month and the actual so far, for the year. */
export function RevenuePlan({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [year, setYear] = useState(new Date().getFullYear());
  const q = useLoad(() => apiH.plan(sid, year), [sid, year]);
  const [edit, setEdit] = useState<{ month: string; v: string } | null>(null);
  async function save() {
    if (!edit) return;
    const a = num(edit.v);
    if (!Number.isFinite(a) || a < 0) { toast(tr('hx.planBad'), 'error'); return; }
    try { await apiH.setPlan(sid, edit.month, a); setEdit(null); await q.reload(); toast(tr('ns.saved'), 'success'); } catch (e) { err(e); }
  }
  const mn = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long' });
  return (
    <Screen>
      <Header title={tr('hx.planTitle')} subtitle={salon?.name} onBack={onBack} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 8 }}>
        <Pressable onPress={() => setYear(year - 1)} accessibilityRole="button" accessibilityLabel={String(year - 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={20} color={t.ink} /></Pressable>
        <Text style={{ fontFamily: font.x, fontSize: 20, color: t.ink }}>{year}</Text>
        <Pressable onPress={() => setYear(year + 1)} accessibilityRole="button" accessibilityLabel={String(year + 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="chev" size={20} color={t.ink} /></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 8 }}>
        {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={6} height={58} /> : (q.data ?? []).map((m) => {
          const ratio = m.plan > 0 ? Math.min(1, m.actual / m.plan) : 0;
          const on = edit?.month === m.month;
          return (
            <Card key={m.month} style={{ gap: 8 }}>
              <Pressable onPress={() => setEdit(on ? null : { month: m.month, v: m.plan ? String(m.plan) : '' })} accessibilityRole="button" accessibilityLabel={mn(m.month)} noScale style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ flex: 1, fontFamily: font.b, fontSize: 15.5, color: t.ink, textTransform: 'capitalize' }}>{mn(m.month)}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{money(m.actual, salon?.currency)} / {m.plan ? money(m.plan, salon?.currency) : tr('hx.planNone')}</Text>
              </Pressable>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.track }}><View style={{ width: `${ratio * 100}%`, height: 6, borderRadius: 3, backgroundColor: ratio >= 1 ? t.ok : t.violet }} /></View>
              {on ? (<><Field label={`${tr('hx.planTarget')} (${salon?.currency ?? 'AZN'})`} value={edit!.v} onChangeText={(v) => setEdit({ month: m.month, v })} keyboardType="decimal-pad" /><Btn label={tr('common.save')} onPress={() => void save()} /></>) : null}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

/** Sadiqlik kartları: stamp cards (visits for a reward). Create, end, holders, add a stamp. */
export function LoyaltyCards({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiH.loyaltyCards(sid), [sid]);
  const svc = useLoad(() => api.services(sid), [sid]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(''); const [visits, setVisits] = useState('10'); const [reward, setReward] = useState(''); const [until, setUntil] = useState('');
  const holders = useLoad(() => (open ? apiH.cardHolders(sid, open) : Promise.resolve([])), [sid, open]);
  const clients = useLoad(() => api.clientsWithStats(sid).catch(() => []), [sid]);
  const [find, setFind] = useState('');
  async function create() {
    const v = Math.round(num(visits));
    if (!name.trim() || !(v >= 2)) { toast(tr('hx.cardBad'), 'error'); return; }
    try {
      const c = await apiH.createCard(sid, { name: name.trim(), visitsRequired: v, rewardServiceId: reward || null, validUntil: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null });
      setAdding(false); setName(''); setUntil(''); await q.reload(); toast(tr('hx.cardMade', { n: c.assignedTo ?? 0 }), 'success');
    } catch (e) { err(e); }
  }
  const found = find.trim().length > 1 ? (clients.data ?? []).filter((c) => `${c.firstName} ${c.lastName ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(find.trim().toLowerCase())).slice(0, 5) : [];
  return (
    <Screen>
      <Header title={tr('hx.cardsTitle')} subtitle={tr('hx.cardsSub')} onBack={onBack} right={<Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel={tr('hx.cardNew')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color="#fff" /></Pressable>} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 12 }}>
        {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={3} height={96} /> : (q.data ?? []).length === 0 ? (
          <StateView icon="heart" title={tr('hx.cardsEmpty')} body={tr('hx.cardsEmptyBody')} actionLabel={tr('hx.cardNew')} onAction={() => setAdding(true)} />
        ) : (q.data ?? []).map((c) => (
          <Card key={String(c.id)} style={{ gap: 8, opacity: c.active ? 1 : 0.6 }}>
            <Pressable onPress={() => setOpen(open === String(c.id) ? null : String(c.id))} accessibilityRole="button" accessibilityLabel={c.name} noScale style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.x, fontSize: 17, color: t.ink }}>{c.name}</Text>
                {c.expired ? <Pill text={tr('hx.cardExpired')} tone="muted" /> : !c.active ? <Pill text={tr('hx.cardEnded')} tone="muted" /> : <Pill text={tr('hx.cardVisits', { n: c.visits_required })} />}
              </View>
              <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{[c.reward_service_name ? `${tr('hx.cardReward')}: ${c.reward_service_name}` : tr('hx.cardRewardAny'), tr('hx.cardHolders', { n: c.holders }), tr('hx.cardWaiting', { n: c.rewards_waiting })].join(' · ')}</Text>
            </Pressable>
            {open === String(c.id) ? (<>
              {holders.loading && !holders.data ? <Skeleton rows={2} height={44} /> : (holders.data ?? []).map((h) => (
                <View key={String(h.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
                  <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{h.client_name}</Text><Text style={{ fontFamily: font.m, fontSize: 12.5, color: t.muted }}>{h.stamps}/{c.visits_required} · {tr('hx.cardWaiting', { n: h.rewards_available })}</Text></View>
                  <Btn small label="-1" variant="secondary" onPress={() => void apiH.stamp(sid, c.id, h.client_id, -1).then(() => { void holders.reload(); void q.reload(); }).catch(err)} />
                  <Btn small label="+1" icon="plus" onPress={() => void apiH.stamp(sid, c.id, h.client_id, 1).then(() => { void holders.reload(); void q.reload(); }).catch(err)} />
                </View>
              ))}
              {c.active ? (<>
                <Field label={tr('hx.cardAddHolder')} value={find} onChangeText={setFind} autoCorrect={false} />
                {found.map((cl) => <Btn key={String(cl.id)} small variant="secondary" icon="plus" label={`${cl.firstName} ${cl.lastName ?? ''}`.trim()} onPress={() => void apiH.addHolder(sid, c.id, cl.id).then(() => { setFind(''); void holders.reload(); void q.reload(); }).catch(err)} />)}
                <Btn label={tr('hx.cardEnd')} variant="danger" icon="trash" onPress={() => Alert.alert(tr('hx.cardEnd'), tr('hx.cardEndBody'), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('hx.cardEnd'), style: 'destructive', onPress: () => void apiH.endCard(sid, c.id).then(() => q.reload()).catch(err) }])} />
              </>) : null}
            </>) : null}
          </Card>
        ))}
      </ScrollView>
      <BottomSheet open={adding} onClose={() => setAdding(false)}>
        <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 8 }}>{tr('hx.cardNew')}</Text>
        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
          <Field label={tr('hx.cardName')} value={name} onChangeText={setName} />
          <Field label={tr('hx.cardVisitsLabel')} value={visits} onChangeText={setVisits} keyboardType="number-pad" />
          <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 4 }}>{tr('hx.cardReward')}</Text>
          <Choice value={reward} onChange={setReward} options={[{ value: '', label: tr('hx.cardRewardAny') }, ...(svc.data ?? []).filter((s) => s.isActive).map((s) => ({ value: String(s.id), label: s.name }))]} />
          <Field label={tr('hx.cardUntil')} value={until} onChangeText={setUntil} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
          <Text style={{ fontFamily: font.m, fontSize: 12.5, color: t.muted, marginTop: 4 }}>{tr('hx.cardHint')}</Text>
        </ScrollView>
        <Btn label={tr('ob.create')} style={{ marginTop: 12, marginBottom: 12 }} onPress={() => void create()} />
      </BottomSheet>
    </Screen>
  );
}

const KINDS = ['CONFIRMATION', 'REMINDER', 'CANCELLATION'] as const;
const LOCS = ['az', 'en', 'ru'] as const;
/** Bildiriş mətnləri: one extra paragraph (max 500) per message kind and language, added to the emails clients get. */
export function NotifTextsEditor({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiH.texts(sid), [sid]);
  const [v, setV] = useState<NotifTexts | null>(null);
  const [loc, setLoc] = useState<(typeof LOCS)[number]>('az');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setV(q.data); }, [q.data]);
  async function save() { if (!v) return; setBusy(true); try { await apiH.saveTexts(sid, v); toast(tr('ns.saved'), 'success'); onBack(); } catch (e) { err(e); } finally { setBusy(false); } }
  return (
    <Screen>
      <Header title={tr('hx.textsTitle')} subtitle={tr('hx.textsSub')} onBack={onBack} />
      <Choice value={loc} onChange={setLoc} options={LOCS.map((l) => ({ value: l, label: l.toUpperCase() }))} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 }}>
        {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !v ? <Skeleton rows={3} height={110} /> : KINDS.map((k) => (
          <View key={k}>
            <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, marginTop: 10 }}>{tr(`hx.kind${k}` as 'hx.kindREMINDER')}</Text>
            <Field label={`${v[k][loc].length}/500`} value={v[k][loc]} onChangeText={(x) => setV({ ...v, [k]: { ...v[k], [loc]: x.slice(0, 500) } })} multiline maxLength={500} style={{ minHeight: 84, paddingTop: 14, textAlignVertical: 'top' }} />
          </View>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 24 }}><Btn label={tr('common.save')} loading={busy} disabled={!v} onPress={() => void save()} /></View>
    </Screen>
  );
}

/** Portfolio of one specialist: add (library), caption, remove, move up/down (the order clients see). */
export function PortfolioSheet({ staffId, name, open, onClose }: { staffId: string; name: string; open: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => (open ? apiH.portfolio(sid, staffId) : Promise.resolve([])), [sid, staffId, open]);
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);
  const list = q.data ?? [];
  async function add() {
    setBusy(true);
    try { const up = await pickAndUpload('STAFF_PORTFOLIO'); if (up) { await apiH.addPortfolio(sid, staffId, up.id, cap); setCap(''); await q.reload(); } }
    catch (e) { toast((e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function move(i: number, d: -1 | 1) {
    const to = i + d; if (to < 0 || to >= list.length) return;
    const ids = list.map((p) => p.id); [ids[i], ids[to]] = [ids[to], ids[i]];
    try { await apiH.reorderPortfolio(sid, staffId, ids); await q.reload(); } catch (e) { err(e); }
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink }}>{tr('hx.portTitle')}</Text>
      <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginBottom: 8 }}>{name} · {list.length}/30</Text>
      <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
        {list.length === 0 && !q.loading ? <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, paddingVertical: 14 }}>{tr('hx.portEmpty')}</Text> : null}
        {list.map((p, i) => (
          <View key={String(p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            {photoUrl(p.url) ? <Image source={{ uri: photoUrl(p.url)! }} style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: t.fill }} /> : <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: t.fill }} />}
            <Text numberOfLines={2} style={{ flex: 1, fontFamily: font.m, fontSize: 13.5, color: t.ink }}>{p.caption || tr('hx.portNoCaption')}</Text>
            <Pressable onPress={() => void move(i, -1)} accessibilityRole="button" accessibilityLabel="up" style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevu" size={18} color={i ? t.ink : t.faint} /></Pressable>
            <Pressable onPress={() => void move(i, 1)} accessibilityRole="button" accessibilityLabel="down" style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevd" size={18} color={i < list.length - 1 ? t.ink : t.faint} /></Pressable>
            <Pressable onPress={() => void apiH.removePortfolio(sid, staffId, p.id).then(() => q.reload()).catch(err)} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={18} color={t.gink} /></Pressable>
          </View>
        ))}
      </ScrollView>
      <Field label={tr('hx.portCaption')} value={cap} onChangeText={setCap} maxLength={200} />
      <Btn label={tr('hx.portAdd')} icon="img" loading={busy} disabled={list.length >= 30} style={{ marginBottom: 14 }} onPress={() => void add()} />
    </BottomSheet>
  );
}

/** Chair rent of a renting specialist: terms (weekly / monthly, amount, due day) and the ledger with "mark paid". */
export function ChairRentSheet({ staffId, name, open, onClose }: { staffId: string; name: string; open: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => (open ? apiH.chairRent(sid, staffId) : Promise.resolve(null)), [sid, staffId, open]);
  const [period, setPeriod] = useState<'WEEKLY' | 'MONTHLY'>('MONTHLY'); const [amount, setAmount] = useState(''); const [day, setDay] = useState('1');
  useEffect(() => { const r = q.data?.rental; if (r) { setPeriod(r.period); setAmount(String(r.amount)); setDay(String(r.dueDay)); } }, [q.data]);
  const act = q.data?.rental?.active;
  async function save(renter: boolean) {
    const a = num(amount); const d = Math.round(num(day));
    if (renter && (!(a > 0) || !(d >= 1 && d <= (period === 'WEEKLY' ? 7 : 28)))) { toast(tr('hx.rentBad'), 'error'); return; }
    try { await apiH.saveChairRent(sid, staffId, renter ? { renter: true, period, amount: a, dueDay: d, startsOn: q.data?.rental?.startsOn ?? toDay(new Date()) } : { renter: false }); await q.reload(); toast(tr('ns.saved'), 'success'); } catch (e) { err(e); }
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink }}>{tr('hx.rentTitle')}</Text>
      <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginBottom: 8 }}>{name}{q.data?.overdueCount ? ` · ${tr('hx.rentOverdue', { n: q.data.overdueCount })}` : ''}</Text>
      <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
        <Choice value={period} onChange={setPeriod} options={[{ value: 'MONTHLY', label: tr('hx.rentMonthly') }, { value: 'WEEKLY', label: tr('hx.rentWeekly') }]} />
        <Field label={`${tr('hx.rentAmount')} (${salon?.currency ?? 'AZN'})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label={period === 'WEEKLY' ? tr('hx.rentDayWeek') : tr('hx.rentDayMonth')} value={day} onChangeText={setDay} keyboardType="number-pad" />
        {(q.data?.rows ?? []).slice(0, 12).map((r) => (
          <View key={r.dueOn} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderTopWidth: 1, borderTopColor: t.hair }}>
            <Text style={{ flex: 1, fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{r.dueOn} · {money(r.amount, salon?.currency)}</Text>
            {r.status === 'PAID' ? <Pill text={tr('hx.rentPaid')} tone="ok" /> : (<><Pill text={r.status === 'OVERDUE' ? tr('hx.rentOver') : tr('hx.rentDue')} tone={r.status === 'OVERDUE' ? 'guava' : 'muted'} /><Btn small label={tr('hx.rentMark')} onPress={() => void apiH.payChairRent(sid, staffId, { dueOn: r.dueOn, paidOn: toDay(new Date()), method: 'CASH' }).then(() => q.reload()).catch(err)} /></>)}
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 14 }}>
        {act ? <Btn label={tr('hx.rentStop')} variant="secondary" style={{ flex: 1 }} onPress={() => void save(false)} /> : null}
        <Btn label={act ? tr('common.save') : tr('hx.rentStart')} style={{ flex: 1.4 }} onPress={() => void save(true)} />
      </View>
    </BottomSheet>
  );
}

/** Calendar feed (ICS) of one specialist: the secret subscribe link for Google / Apple / Outlook; regenerate invalidates the old one. */
export function FeedSheet({ staffId, name, open, onClose }: { staffId: string; name: string; open: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const q = useLoad(() => (open ? apiH.feedPath(staffId).catch(() => null) : Promise.resolve(null)), [staffId, open]);
  const [fresh, setFresh] = useState<string | null>(null);
  const path = fresh ?? q.data;
  const url = path ? `${API_BASE}${path}` : '';
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink }}>{tr('hx.feedTitle')}</Text>
      <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginBottom: 10 }}>{name} · {tr('hx.feedBody')}</Text>
      <View style={{ borderRadius: 14, backgroundColor: t.fill, padding: 12 }}><Text selectable style={{ fontFamily: font.m, fontSize: 12.5, color: t.ink }}>{url || tr('hx.feedOff')}</Text></View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 14 }}>
        <Btn label={tr('hx.feedShare')} icon="share" disabled={!url} style={{ flex: 1 }} onPress={() => void Share.share({ message: url }).catch(() => undefined)} />
        <Btn label={tr('hx.feedOpen')} variant="secondary" disabled={!url} style={{ flex: 1 }} onPress={() => void Linking.openURL(url.replace(/^https?:/, 'webcal:')).catch(() => undefined)} />
      </View>
      <Btn label={tr('hx.feedNew')} variant="secondary" icon="refresh" disabled={!url} style={{ marginBottom: 14 }} onPress={() => Alert.alert(tr('hx.feedNew'), tr('hx.feedNewBody'), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('hx.feedNew'), onPress: () => void apiH.newFeedPath(staffId).then(setFresh).catch(err) }])} />
    </BottomSheet>
  );
}

/** Salon photo gallery shown on the public page: add from the library, remove. */
export function GallerySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => (open ? apiH.salonPhotos(sid) : Promise.resolve([])), [sid, open]);
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try { const up = await pickAndUpload('BUSINESS_PHOTO'); if (up) { await apiH.addSalonPhoto(sid, up.id); await q.reload(); } }
    catch (e) { toast((e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 8 }}>{tr('hx.galTitle')}</Text>
      <ScrollView style={{ maxHeight: 420 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(q.data ?? []).map((p) => (
            <View key={String(p.id)} style={{ width: '31%', aspectRatio: 1 }}>
              {photoUrl(p.url) ? <Image source={{ uri: photoUrl(p.url)! }} style={{ width: '100%', height: '100%', borderRadius: 12, backgroundColor: t.fill }} /> : <View style={{ flex: 1, borderRadius: 12, backgroundColor: t.fill }} />}
              <Pressable onPress={() => void apiH.deleteSalonPhoto(sid, p.id).then(() => q.reload()).catch(err)} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} style={{ position: 'absolute', top: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(20,14,34,.6)', alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={16} color="#fff" /></Pressable>
            </View>
          ))}
        </View>
        {(q.data ?? []).length === 0 && !q.loading ? <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, paddingVertical: 12 }}>{tr('hx.galEmpty')}</Text> : null}
      </ScrollView>
      <Btn label={tr('hx.portAdd')} icon="img" loading={busy} style={{ marginTop: 12, marginBottom: 14 }} onPress={() => void add()} />
    </BottomSheet>
  );
}
