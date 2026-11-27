import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import type { ClientWithStats } from '@/lib/api';
import * as Haptics from 'expo-haptics';
import { Choice, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Field, Screen, ServiceThumb } from '@/components/ui';
import { Avatar as KAvatar, BackBar, Button as KButton, Card as KCard, Chip as KChip, ChipRow, CtaBar, Pill as KPill, T, Title } from '@/components/kit';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX, type SaleBody } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { apiM } from '@/lib/api-more';
import { ItemPicker, ClientSelect, PlanRow, planSub, memberSub, type PickItem } from '@/screens/SalePick';
import { useApp } from '@/lib/app';
import { dateLabel, fromIso, hhmm, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Line = { key: number; serviceId?: string | number; productId?: string | number; name: string; price: number; qty: number };
type Tender = { key: number; method: 'CASH' | 'CARD_TERMINAL' | 'GIFT_CARD'; amount: string; code: string };
const METHODS = ['CASH', 'CARD_TERMINAL', 'SPLIT', 'GIFT_CARD', 'MEMBERSHIP', 'PACKAGE'] as const;

/** Till: pick services (or a custom item), staff, discount, tip, payment method (cash, card, gift card ...) and record the sale. */
export function NewSale({ onClose, onDone, apptId, apptDate, apptTime }: { onClose: () => void; onDone: () => void; apptId?: string; apptDate?: Date; apptTime?: string }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const cur = salon?.currency;
  const svc = useLoad(() => api.services(sid), [sid]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const prods = useLoad(() => apiB.products(sid).catch(() => []), [sid]);
  type Kind = 'items' | 'membership' | 'package' | 'gift';
  const [kind, setKind] = useState<Kind>('items');
  const [stage, setStage] = useState<'pick' | 'pay'>(apptId ? 'pay' : 'pick');
  const [pickClient, setPickClient] = useState<ClientWithStats | null>(null);
  const [pkgSel, setPkgSel] = useState<string>('');
  const [giftAmt, setGiftAmt] = useState('');
  const [giftEmail, setGiftEmail] = useState('');
  const [giftName, setGiftName] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftMsg, setGiftMsg] = useState('');
  const [payM, setPayM] = useState<'CASH' | 'CARD_TERMINAL'>('CASH');
  const [submitErr, setSubmitErr] = useState('');
  const pkgs = useLoad(() => apiB.packages(sid).catch(() => []), [sid]);
  const plans = useLoad(() => apiB.memberships(sid).catch(() => []), [sid]);
  const online = useLoad(() => apiB.onlineSales(sid).catch(() => null), [sid]);
  const clients = useLoad(() => api.clientsWithStats(sid).catch(() => [] as ClientWithStats[]), [sid]);
  const [multi, setMulti] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([{ key: 1, method: 'CASH', amount: '', code: '' }]);
  const quick = useLoad(() => apiB.quickSale(sid).catch(() => []), [sid]);
  const [lines, setLines] = useState<Line[]>([]);
  const [master, setMaster] = useState('');
  const [clientName, setClientName] = useState('');
  const [discount, setDiscount] = useState('');
  const [tip, setTip] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('CASH');
  const [gift, setGift] = useState('');
  const [cName, setCName] = useState('');
  const [cPrice, setCPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [splitCard, setSplitCard] = useState('');
  // Checkout of a booking: the till opens with its service, master and client and settles it (appointmentId), as the hub does.
  const [appt, setAppt] = useState<{ id: string; clientId?: string } | null>(null);
  const [when, setWhen] = useState<string>(() => [apptDate ? dateLabel(apptDate) : '', apptTime ?? ''].filter(Boolean).join(' · '));
  const [loadErr, setLoadErr] = useState('');
  useEffect(() => {
    if (!apptId) return;
    void api.appointment(apptId).then((a) => {
      setAppt({ id: String(a.id), clientId: a.clientId != null ? String(a.clientId) : undefined });
      if (a.appointmentDate) setWhen([dateLabel(fromIso(a.appointmentDate)), a.startTime ? `${hhmm(a.startTime)}${a.endTime ? `–${hhmm(a.endTime)}` : ''}` : ''].filter(Boolean).join(' · '));
      setLines([{ key: 1, serviceId: a.serviceId, name: a.serviceName ?? '', price: a.price ?? 0, qty: 1 }]);
      if (a.staffId != null) setMaster(String(a.staffId));
      if (a.clientName) setClientName(a.clientName);
    }).catch((e) => { const m = (e as Error).message || tr('common.error'); setLoadErr(m); toast(m, 'error'); });
  }, [apptId]);
  const sub = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const disc = Math.min(sub, Math.max(0, num(discount) || 0));
  const tipN = Math.max(0, num(tip) || 0);
  const total = useMemo(() => Math.max(0, sub - disc) + tipN, [sub, disc, tipN]);
  const add = (l: Omit<Line, 'key'>) => setLines((x) => [...x, { ...l, key: Date.now() + x.length }]);
  const qty = (k: number, d: number) => setLines((x) => x.flatMap((l) => (l.key !== k ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));

  const lineQty = (id: string, product: boolean) => lines.filter((l) => String(product ? l.productId : l.serviceId) === id && (product ? l.productId != null : l.productId == null && l.serviceId != null)).reduce((n, l) => n + l.qty, 0);
  const change = (it: PickItem, d: number) => {
    const ex = lines.find((l) => String(it.product ? l.productId : l.serviceId) === it.id && (it.product ? l.productId != null : l.productId == null));
    if (ex) qty(ex.key, d); else if (d > 0) add(it.product ? { productId: it.id, name: it.name, price: it.price, qty: 1 } : { serviceId: it.id, name: it.name, price: it.price, qty: 1 });
  };
  const cartCount = lines.reduce((n, l) => n + l.qty, 0);
  const pkgPicked = (pkgs.data ?? []).find((p) => String(p.id) === pkgSel);
  const giftN = num(giftAmt) || 0;
  const gMin = online.data?.giftCardMin ?? 0; const gMax = online.data?.giftCardMax ?? 0;
  const giftOk = giftN > 0 && (!gMin || giftN >= gMin) && (!gMax || giftN <= gMax);
  const otherTotal = kind === 'package' ? pkgPicked?.price ?? 0 : kind === 'gift' ? giftN : 0;
  const clientLabel = (c: ClientWithStats) => `${c.firstName} ${c.lastName ?? ''}`.trim();
  function switchKind(k: Kind) {
    if (k === kind) return;
    const go = () => { setKind(k); setLines([]); setPkgSel(''); setGiftAmt(''); setSubmitErr(''); };
    if (lines.length || pkgSel || giftAmt) Alert.alert(tr('sp.switchAsk'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('sp.switchOk'), onPress: go }]);
    else go();
  }
  async function submitOther() {
    if (kind === 'package' && (!pickClient || !pkgPicked)) { const m = tr('sp.needClient'); setSubmitErr(m); toast(m, 'error'); return; }
    if (kind === 'gift' && !giftOk) { const m = tr('sp.giftBad'); setSubmitErr(m); toast(m, 'error'); return; }
    setBusy(true); setSubmitErr('');
    let step: 'issue' | 'pay' = 'issue'; let code = '';
    try {
      let label = ''; let type = ''; let price = 0;
      if (kind === 'package' && pickClient && pkgPicked) { await apiM.buyPackage(sid, pickClient.id, pkgPicked.id); label = `${tr('sp.kPackage')}: ${pkgPicked.name}`; type = 'PACKAGE'; price = pkgPicked.price; }
      else { const g = await apiB.issueGiftCard(sid, giftN, giftEmail.trim() || undefined); code = g.code; label = `${tr('sp.kGift')} ${g.code}`; type = 'GIFT_CARD'; price = giftN; }
      step = 'pay';
      const notes = kind === 'gift' ? [giftName.trim(), giftPhone.trim(), giftMsg.trim()].filter(Boolean).join(' / ') || undefined : undefined;
      await apiX.confirmPayment({
        businessId: sid, clientId: pickClient ? String(pickClient.id) : undefined, clientName: pickClient ? clientLabel(pickClient) : giftName.trim() || undefined,
        items: [{ serviceName: label, serviceType: type, quantity: 1, unitPrice: price }], paymentMethod: payM, paymentAmount: price, notes,
        idempotencyKey: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); Alert.alert(tr('sl.done'), code ? `${tr('sp.giftCode')}: ${code}` : money(price, cur)); onDone();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const base = (e as Error).message || tr('common.error');
      const m = step === 'pay' ? `${kind === 'gift' ? tr('sp.soldGiftFail') : tr('sp.soldPkgFail')}${code ? `${code} · ` : ''}${base}` : base;
      setSubmitErr(m); toast(m, 'error');
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!lines.length) { toast(tr('sl.needItem'), 'error'); return; }
    if (method === 'GIFT_CARD' && !gift.trim()) { toast(tr('sl.needGift'), 'error'); return; }
    const paid = tenders.reduce((n, x) => n + (num(x.amount) || 0), 0);
    if (multi) {
      if (Math.abs(paid - total) > 0.009) { toast(tr('hx.tenderOver'), 'error'); return; }
      if (tenders.some((x) => x.method === 'GIFT_CARD' && !x.code.trim() && (num(x.amount) || 0) > 0)) { toast(tr('sl.needGift'), 'error'); return; }
    }
    const card = Math.min(total, Math.max(0, num(splitCard) || 0));
    if (method === 'SPLIT' && (card <= 0 || card >= total)) { toast(tr('ob.needSplit'), 'error'); return; }
    const cover = method === 'MEMBERSHIP' || method === 'PACKAGE' ? method : undefined;
    const body: SaleBody = {
      businessId: sid, staffId: master || undefined, clientId: appt?.clientId, clientName: clientName.trim() || undefined,
      items: lines.map((l, i) => ({ serviceId: l.serviceId != null ? String(l.serviceId) : undefined, productId: l.productId != null ? String(l.productId) : undefined, serviceName: l.name, serviceType: l.productId != null ? 'PRODUCT' : l.serviceId != null ? 'SERVICE' : 'OTHER', quantity: l.qty, unitPrice: l.price, coveredBy: cover, appointmentId: i === 0 ? appt?.id : undefined })),
      discountAmount: disc || undefined, tipAmount: tipN || undefined, paymentMethod: method, paymentAmount: total,
      giftCardCode: method === 'GIFT_CARD' ? gift.trim().toUpperCase() : undefined,
      splitCashAmount: method === 'SPLIT' ? Math.round((total - card) * 100) / 100 : undefined, splitCardAmount: method === 'SPLIT' ? card : undefined,
      payments: multi ? tenders.filter((x) => (num(x.amount) || 0) > 0).map((x) => ({ method: x.method, amount: num(x.amount) || 0, ...(x.method === 'GIFT_CARD' ? { giftCardCode: x.code.trim().toUpperCase() } : {}) })) : undefined,
      appointmentId: appt?.id, idempotencyKey: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    };
    setBusy(true); setSubmitErr('');
    try {
      await apiX.confirmPayment(body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); Alert.alert(tr('sl.done'), money(total, cur)); onDone();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const m = (e as Error).message || tr('common.error'); setSubmitErr(m); toast(m, 'error');
    } finally { setBusy(false); }
  }
  const [more, setMore] = useState(false);
  const [pct, setPct] = useState(0);
  const setTipPct = (p: number) => { setPct(p); setTip(p ? String(Math.round(sub * p) / 100) : ''); };
  const ICON: Record<string, string> = { CASH: 'cash', CARD_TERMINAL: 'card', SPLIT: 'wallet', GIFT_CARD: 'gift', MEMBERSHIP: 'crown', PACKAGE: 'box' };
  const kinds: { k: Kind; label: string }[] = [{ k: 'items', label: tr('sp.kItems') }, { k: 'package', label: tr('sp.kPackage') }, { k: 'membership', label: tr('sp.kMembership') }, { k: 'gift', label: tr('sp.kGift') }];
  const pickHead = (<>
    <BackBar label={tr('v2.back')} onBack={onClose} />
    <Title sub={salon?.name} style={{ paddingBottom: 10 }}>{tr('sl.title')}</Title>
    <ChipRow style={{ marginBottom: 10 }}>{kinds.map((x) => <KChip key={x.k} label={x.label} on={kind === x.k} onPress={() => switchKind(x.k)} />)}</ChipRow>
  </>);
  const bar = (label: string, enabled: boolean, onPress: () => void, sub?: string) => (
    <CtaBar>
      <View style={{ flex: 1 }}>
        {submitErr ? <T k="sm" color={t.gink} style={{ paddingBottom: 6 }}>{submitErr}</T> : null}
        <KButton kind="dk" size="lg" block label={sub ? `${label} · ${sub}` : label} disabled={!enabled} loading={busy} onPress={onPress} />
      </View>
    </CtaBar>
  );
  if (stage === 'pick') {
    return (
      <Screen>
        {pickHead}
        {kind === 'items' ? (<>
          <ItemPicker services={svc.data ?? []} products={prods.data ?? []} recent={quick.data ?? []} qty={lineQty} onChange={change} cur={cur} />
          {bar(tr('sp.next'), cartCount > 0, () => setStage('pay'), cartCount ? `${tr('sp.cartN', { n: cartCount })} · ${money(sub, cur)}` : undefined)}
        </>) : kind === 'package' ? (<>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>
            <T k="h3" style={{ marginBottom: 8 }}>{tr('sp.pickClient')}</T>
            <ClientSelect clients={clients.data ?? []} value={pickClient} onChange={setPickClient} />
            <T k="h3" style={{ marginTop: 18, marginBottom: 8 }}>{tr('sp.pickPkg')}</T>
            {(pkgs.data ?? []).filter((p) => p.active !== false).map((p) => <PlanRow key={String(p.id)} title={p.name} sub={planSub(p)} price={p.price} cur={cur} on={pkgSel === String(p.id)} onPress={() => setPkgSel(String(p.id))} />)}
            {pkgs.data && !(pkgs.data ?? []).some((p) => p.active !== false) ? <T k="sm" color={t.muted}>{tr('sp.noPackages')}</T> : null}
          </ScrollView>
          {bar(tr('sp.next'), !!pickClient && !!pkgPicked, () => setStage('pay'), pkgPicked ? money(pkgPicked.price, cur) : undefined)}
        </>) : kind === 'membership' ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
            {(plans.data ?? []).filter((m) => m.active).map((m) => <PlanRow key={String(m.id)} title={m.name} sub={memberSub(m)} price={m.price} cur={cur} />)}
            {plans.data && !(plans.data ?? []).some((m) => m.active) ? <T k="sm" color={t.muted}>{tr('sp.noMemberships')}</T> : null}
            <T k="sm" color={t.muted} style={{ marginTop: 10 }}>{tr('sp.memberNote')}</T>
          </ScrollView>
        ) : (<>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>
            {gMin > 0 || gMax > 0 ? (
              <ChipRow style={{ marginHorizontal: -20, marginBottom: 10 }}>
                {[gMin, gMax].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => <KChip key={v} label={money(v, cur)} on={giftN === v} onPress={() => setGiftAmt(String(v))} />)}
              </ChipRow>
            ) : null}
            <Field label={`${tr('sp.giftAmount')} (${cur ?? 'AZN'})`} value={giftAmt} onChangeText={setGiftAmt} keyboardType="decimal-pad" />
            {gMin > 0 || gMax > 0 ? <T k="xs" color={t.muted} style={{ marginTop: -4, marginBottom: 8 }}>{tr('sp.giftRange', { min: money(gMin, cur), max: gMax ? money(gMax, cur) : '∞' })}</T> : null}
            <Field label={tr('sp.giftName')} value={giftName} onChangeText={setGiftName} autoCapitalize="words" />
            <Field label={tr('sp.giftPhone')} value={giftPhone} onChangeText={setGiftPhone} keyboardType="phone-pad" />
            <Field label={tr('sp.giftEmail')} value={giftEmail} onChangeText={setGiftEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Field label={tr('sp.giftMsg')} value={giftMsg} onChangeText={setGiftMsg} />
          </ScrollView>
          {bar(tr('sp.next'), giftOk, () => setStage('pay'), giftN ? money(giftN, cur) : undefined)}
        </>)}
      </Screen>
    );
  }
  if (kind !== 'items') {
    return (
      <Screen>
        <BackBar label={tr('v2.back')} onBack={() => setStage('pick')} />
        <Title sub={salon?.name} style={{ paddingBottom: 10 }}>{kind === 'package' ? tr('sp.kPackage') : tr('sp.kGift')}</Title>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 170 }}>
          <KCard style={{ padding: 14 }}>
            <T k="h3" lines={2}>{kind === 'package' ? pkgPicked?.name : `${tr('sp.kGift')}${giftName ? ` · ${giftName}` : ''}`}</T>
            {pickClient ? <T k="sm" color={t.muted}>{clientLabel(pickClient)}</T> : null}
          </KCard>
          <T k="h2" style={{ marginTop: 22, marginBottom: 10 }}>{tr('sl.method')}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['CASH', 'CARD_TERMINAL'] as const).map((m) => <KChip key={m} label={tr(`sales.m.${m}` as 'sales.m.CASH')} on={payM === m} onPress={() => setPayM(m)} style={{ flex: 1, justifyContent: 'center' }} />)}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, paddingHorizontal: 4 }}>
            <T k="t1" color={t.muted}>{tr('sl.total')}</T>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.x, fontSize: 38, letterSpacing: -1.3, color: t.ink, flexShrink: 1 }}>{money(otherTotal, cur)}</Text>
          </View>
        </ScrollView>
        {bar(tr('sp.pay'), otherTotal > 0, () => void submitOther(), money(otherTotal, cur))}
      </Screen>
    );
  }
  return (
    <Screen>
      <BackBar label={tr('v2.back')} onBack={() => (apptId ? onClose() : setStage('pick'))} right={<KPill icon="receipt" text={tr('v3.saleNo')} />} />
      <Title sub={[when, salon?.name].filter(Boolean).join(' · ')} style={{ paddingBottom: 10 }}>{tr('v3.till')}</Title>
      {loadErr ? <T k="sm" color={t.gink} style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{loadErr}</T> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
        <KCard style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 }}>
            <KAvatar name={clientName || '?'} size={40} />
            <View style={{ flex: 1 }}>
              <TextInput value={clientName} onChangeText={setClientName} placeholder={tr('sl.client')} placeholderTextColor={t.ink3} autoCapitalize="words" accessibilityLabel={tr('sl.client')} style={{ fontFamily: font.b, fontSize: 15, color: t.ink, padding: 0, outlineStyle: 'none' } as never} />
              <T k="xs" color={t.muted}>{(staff.data ?? []).find((x) => String(x.id) === master)?.name ?? tr('sl.master')}</T>
            </View>
          </View>
          {lines.length === 0 ? <T k="sm" color={t.muted} style={{ paddingVertical: 14, textAlign: 'center', borderTopWidth: 1, borderTopColor: t.hair }}>{tr('sl.pickService')}</T> : null}
          {lines.map((l) => (
            <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.hair }}>
              <ServiceThumb name={l.name} size={46} />
              <View style={{ flex: 1 }}>
                <T k="h3" lines={1}>{l.name}</T>
                <T k="xs" color={t.muted}>{l.qty} × {money(l.price, cur)}</T>
              </View>
              <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{money(l.price * l.qty, cur)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.fill, borderRadius: 18, padding: 2 }}>
                <Pressable onPress={() => qty(l.key, -1)} accessibilityRole="button" accessibilityLabel={`${l.name} -1`} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={16} color={t.ink} /></Pressable>
                <Pressable onPress={() => qty(l.key, 1)} accessibilityRole="button" accessibilityLabel={`${l.name} +1`} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={16} color={t.ink} /></Pressable>
              </View>
            </View>
          ))}
        </KCard>
        <KButton kind="fl" size="sm" icon="plus" label={tr('sp.addMore')} onPress={() => setStage('pick')} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
          <T k="h2">{tr('sl.tip')}</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 5, 10, 15].map((p) => <KChip key={p} label={p ? `${p}%` : tr('v3.none')} on={pct === p && (p === 0 ? !tip : true)} onPress={() => setTipPct(p)} style={{ flex: 1, justifyContent: 'center' }} />)}
        </View>
        <T k="h2" style={{ marginTop: 22, marginBottom: 10 }}>{tr('sl.method')}</T>
        <ToggleRow label={tr('hx.tenders')} value={multi} onChange={(v) => { setMulti(v); if (v) setTenders([{ key: 1, method: 'CASH', amount: String(total || ''), code: '' }]); }} />
        {multi ? (<View style={{ gap: 6, marginBottom: 6 }}>
          {tenders.map((x) => (
            <KCard key={x.key} style={{ padding: 12, gap: 6 }}>
              <Choice value={x.method} onChange={(m) => setTenders((a) => a.map((y) => (y.key === x.key ? { ...y, method: m } : y)))} options={[{ value: 'CASH' as const, label: tr('sales.m.CASH') }, { value: 'CARD_TERMINAL' as const, label: tr('sales.m.CARD_TERMINAL') }, { value: 'GIFT_CARD' as const, label: tr('sales.m.GIFT_CARD') }]} />
              <Field label={`${tr('hx.tenderAmount')} (${cur ?? 'AZN'})`} value={x.amount} onChangeText={(v) => setTenders((a) => a.map((y) => (y.key === x.key ? { ...y, amount: v } : y)))} keyboardType="decimal-pad" />
              {x.method === 'GIFT_CARD' ? <Field label={tr('sl.giftCode')} value={x.code} onChangeText={(v) => setTenders((a) => a.map((y) => (y.key === x.key ? { ...y, code: v } : y)))} autoCapitalize="characters" autoCorrect={false} /> : null}
              {tenders.length > 1 ? <KButton kind="ghost" size="sm" icon="trash" label={tr('lk.delete')} onPress={() => setTenders((a) => a.filter((y) => y.key !== x.key))} /> : null}
            </KCard>
          ))}
          <T k="xs" color={t.muted}>{tr('hx.tenderLeft', { n: money(Math.max(0, total - tenders.reduce((n, x) => n + (num(x.amount) || 0), 0)), cur) })}</T>
          <KButton kind="fl" size="sm" icon="plus" label={tr('hx.tenderAdd')} onPress={() => setTenders((a) => [...a, { key: Date.now(), method: 'CARD_TERMINAL', amount: '', code: '' }])} />
        </View>) : null}
        {!multi ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {METHODS.map((m) => (
            <Pressable key={m} onPress={() => setMethod(m)} accessibilityRole="button" accessibilityState={{ selected: method === m }} noScale
              style={{ width: '31.5%', flexGrow: 1, height: 78, borderRadius: 18, backgroundColor: t.surface, borderWidth: method === m ? 2 : 1, borderColor: method === m ? t.ink : t.hair, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name={ICON[m] ?? 'wallet'} size={22} color={t.ink} />
              <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12.5, color: t.ink }}>{tr(`sales.m.${m}` as 'sales.m.CASH')}</Text>
            </Pressable>
          ))}
        </View> : null}
        {!multi && method === 'SPLIT' ? <View style={{ marginTop: 12 }}><Field label={`${tr('sales.m.CARD_TERMINAL')} (${cur ?? 'AZN'})`} value={splitCard} onChangeText={setSplitCard} keyboardType="decimal-pad" /><T k="xs" color={t.muted}>{`${tr('sales.m.CASH')}: ${money(Math.max(0, total - (num(splitCard) || 0)), cur)}`}</T></View> : null}
        {!multi && method === 'GIFT_CARD' ? <View style={{ marginTop: 12 }}><Field label={tr('sl.giftCode')} value={gift} onChangeText={setGift} autoCapitalize="characters" autoCorrect={false} /></View> : null}
        <KButton kind="ghost" size="sm" icon={more ? 'chevu' : 'chevd'} label={tr('v3.more')} onPress={() => setMore((v) => !v)} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
        {more ? (
          <View style={{ marginTop: 4 }}>
            <Field label={tr('sl.customName')} value={cName} onChangeText={setCName} />
            <Field label={`${tr('sl.price')} (${cur ?? 'AZN'})`} value={cPrice} onChangeText={setCPrice} keyboardType="decimal-pad" />
            <KButton kind="fl" icon="plus" label={tr('sl.custom')} disabled={!cName.trim() || !(num(cPrice) >= 0)} onPress={() => { add({ name: cName.trim(), price: num(cPrice), qty: 1 }); setCName(''); setCPrice(''); }} />
            <T k="h2" style={{ marginTop: 18, marginBottom: 8 }}>{tr('sl.master')}</T>
            <Choice value={master} onChange={setMaster} options={[{ value: '', label: '-' }, ...(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: String(s.id), label: s.name }))]} />
            <View style={{ marginTop: 10 }}><Field label={tr('sl.discount')} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" /></View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, paddingHorizontal: 4 }}>
          <T k="t1" color={t.muted}>{tr('sl.total')}</T>
          <Text style={{ fontFamily: font.x, fontSize: 38, letterSpacing: -1.3, color: t.ink }}>{money(total, cur)}</Text>
        </View>
        {disc > 0 || tipN > 0 ? <T k="xs" color={t.muted} style={{ textAlign: 'right' }}>{[disc > 0 ? `${tr('sl.discount')} -${money(disc, cur)}` : '', tipN > 0 ? `${tr('sl.tip')} +${money(tipN, cur)}` : ''].filter(Boolean).join(' · ')}</T> : null}
      </ScrollView>
      <CtaBar><View style={{ flex: 1 }}>{submitErr ? <T k="sm" color={t.gink} style={{ paddingBottom: 6 }}>{submitErr}</T> : null}<KButton kind="dk" size="lg" block label={busy ? '…' : `${tr('sl.charge')} · ${money(total, cur)}`} disabled={!lines.length} loading={busy} onPress={() => void submit()} /></View></CtaBar>
    </Screen>
  );
}
