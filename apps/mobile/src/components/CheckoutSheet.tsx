import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { num } from '@/components/form';
import { Field } from '@/components/ui';
import { Button, Chip, T } from '@/components/kit';
import { t as tr } from '@/i18n';
import { api, type Appointment } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { apiX, type SaleBody } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';

type Method = 'CASH' | 'CARD_TERMINAL' | 'SPLIT' | 'GIFT_CARD';
type Extra = { key: number; name: string; price: number; productId?: string };
const METHODS: { k: Method; icon: string; label: () => string }[] = [
  { k: 'CASH', icon: 'cash', label: () => tr('n4.payCash') },
  { k: 'CARD_TERMINAL', icon: 'card', label: () => tr('n4.payCard') },
  { k: 'SPLIT', icon: 'wallet', label: () => tr('sales.m.SPLIT') },
  { k: 'GIFT_CARD', icon: 'gift', label: () => tr('n4.payGift') },
];

/**
 * ONE checkout for a booking ("Bitir və ödəniş al"): prefilled from the booking (service + price), optional extras, discount, tip,
 * payment method. Confirm calls POST /payment-confirmation (same as the till) which settles the booking: COMPLETED + PAID in one step.
 */
export function CheckoutSheet({ a, open, onClose, onDone }: { a: Appointment; open: boolean; onClose: () => void; onDone: () => void }) {
  return <BottomSheet open={open} onClose={onClose}>{open ? <CheckoutBody a={a} onClose={onClose} onDone={onDone} /> : null}</BottomSheet>;
}

/** Same content without its own sheet: rendered inside BookingSheet (a nested Modal would be dropped by iOS). */
export function CheckoutBody({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: () => void }) {
  const open = true;
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const cur = salon?.currency;
  const products = useLoad(() => (open && sid ? apiB.products(sid).catch(() => []) : Promise.resolve([])), [open, sid]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [eName, setEName] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [tipPct, setTipPct] = useState(0);
  const [tipCustom, setTipCustom] = useState('');
  const [method, setMethod] = useState<Method>('CASH');
  const [gift, setGift] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const svc = useLoad(() => (open && sid && a.price == null ? api.services(sid).catch(() => []) : Promise.resolve([])), [open, sid, a.id]);
  const base = a.price ?? (Number((svc.data ?? []).find((x) => String(x.id) === String(a.serviceId))?.price) || 0);
  const sub = base + extras.reduce((n, x) => n + x.price, 0);
  const disc = Math.min(sub, Math.max(0, num(discount) || 0));
  const tip = tipCustom ? Math.max(0, num(tipCustom) || 0) : Math.round((sub - disc) * tipPct) / 100;
  const total = useMemo(() => Math.max(0, sub - disc) + tip, [sub, disc, tip]);

  const card = Math.min(total, Math.max(0, num(splitCard) || 0));
  function addExtra() {
    const p = num(ePrice) || 0;
    if (!eName.trim() || p <= 0) return;
    setExtras((x) => [...x, { key: Date.now(), name: eName.trim(), price: p }]);
    setEName(''); setEPrice('');
  }
  async function confirm() {
    if (method === 'GIFT_CARD' && !gift.trim()) { setErr(tr('sl.needGift')); return; }
    if (method === 'SPLIT' && (card <= 0 || card >= total)) { setErr(tr('ob.needSplit')); return; }
    setBusy(true); setErr('');
    const body: SaleBody = {
      businessId: sid, staffId: a.staffId != null ? String(a.staffId) : undefined, clientId: a.clientId != null ? String(a.clientId) : undefined, clientName: a.clientName || undefined,
      items: [
        { serviceId: String(a.serviceId), serviceName: a.serviceName || tr('v2.service'), serviceType: 'SERVICE', quantity: 1, unitPrice: base, appointmentId: String(a.id) },
        ...extras.map((x) => ({ productId: x.productId, serviceName: x.name, serviceType: x.productId ? 'PRODUCT' : 'OTHER', quantity: 1, unitPrice: x.price })),
      ],
      discountAmount: disc || undefined, tipAmount: tip || undefined, paymentMethod: method, paymentAmount: total,
      giftCardCode: method === 'GIFT_CARD' ? gift.trim().toUpperCase() : undefined,
      splitCashAmount: method === 'SPLIT' ? Math.round((total - card) * 100) / 100 : undefined, splitCardAmount: method === 'SPLIT' ? card : undefined,
      appointmentId: String(a.id), idempotencyKey: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    };
    try {
      await apiX.confirmPayment(body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); setDone(true);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErr((e as Error).message || tr('common.error'));
    } finally { setBusy(false); }
  }
  const close = () => { if (done) onDone(); else onClose(); };
  const row = (label: string, value: string, strong?: boolean) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <T k={strong ? 'h2' : 'body'} color={strong ? t.ink : t.muted}>{label}</T><T k={strong ? 'h2' : 'body'}>{value}</T>
    </View>
  );
  return (
    <>
      {done ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={36} color={t.vtext} /></View>
          <T k="h1" style={{ textAlign: 'center' }}>{tr('n4.paidDone')}</T>
          <T k="body" color={t.muted}>{money(total, cur)}</T>
          <Button label={tr('n4.ready')} block onPress={close} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      ) : (
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <T k="h1" style={{ fontSize: 22 }}>{tr('n4.checkoutTitle')}</T>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor: t.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 }}>
              {row(a.serviceName || tr('v2.service'), money(base, cur))}
              {extras.map((x) => (
                <Pressable key={x.key} onPress={() => setExtras((l) => l.filter((y) => y.key !== x.key))} accessibilityRole="button" accessibilityLabel={`${tr('lk.delete')} ${x.name}`}>
                  {row(`${x.name}  ✕`, money(x.price, cur))}
                </Pressable>
              ))}
            </View>
            <T k="h2">{tr('n4.extras')}</T>
            {(products.data ?? []).filter((p) => p.isActive).length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(products.data ?? []).filter((p) => p.isActive).slice(0, 12).map((p) => (
                  <Chip key={String(p.id)} label={`${p.name} · ${money(p.price, cur)}`} onPress={() => setExtras((x) => [...x, { key: Date.now() + x.length, name: p.name, price: p.price, productId: String(p.id) }])} />
                ))}
              </ScrollView>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 2 }}><Field placeholder={tr('n4.extraName')} value={eName} onChangeText={setEName} /></View>
              <View style={{ flex: 1 }}><Field placeholder={tr('n4.extraPrice')} value={ePrice} onChangeText={setEPrice} keyboardType="decimal-pad" /></View>
              <Button kind="fl" icon="plus" label="" onPress={addExtra} disabled={!eName.trim() || !(num(ePrice) > 0)} style={{ width: 48 }} />
            </View>
            <Field label={tr('sl.discount')} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" />
            <T k="h2">{tr('sl.tip')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0, 5, 10, 15].map((p) => <Chip key={p} label={p ? `${p}%` : tr('v3.none')} on={!tipCustom && tipPct === p} onPress={() => { setTipCustom(''); setTipPct(p); }} style={{ flex: 1, justifyContent: 'center' }} />)}
            </View>
            <Field placeholder={tr('n4.tipCustom')} value={tipCustom} onChangeText={setTipCustom} keyboardType="decimal-pad" />
            <T k="h2">{tr('n4.payMethod')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {METHODS.map((m) => {
                const on = method === m.k;
                return (
                  <Pressable key={m.k} onPress={() => setMethod(m.k)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={m.label()}
                    style={{ width: '48%', flexGrow: 1, borderRadius: 18, paddingVertical: 12, alignItems: 'center', gap: 6, backgroundColor: on ? t.vsoft : t.surface, borderWidth: 1.5, borderColor: on ? t.violet : t.hair }}>
                    <Icon name={m.icon} size={22} color={on ? t.vtext : t.ink} /><T k="sm" lines={1} color={on ? t.vtext : t.ink}>{m.label()}</T>
                  </Pressable>
                );
              })}
            </View>
            {method === 'SPLIT' ? (
              <View>
                <Field label={`${tr('sales.m.CARD_TERMINAL')} (${cur ?? 'AZN'})`} value={splitCard} onChangeText={setSplitCard} keyboardType="decimal-pad" />
                <T k="sm" color={t.muted} lines={1}>{`${tr('sales.m.CASH')}: ${money(Math.max(0, total - card), cur)}`}</T>
              </View>
            ) : null}
            {method === 'GIFT_CARD' ? <Field label={tr('n4.giftCode')} value={gift} onChangeText={setGift} autoCapitalize="characters" /> : null}
            <View style={{ borderTopWidth: 1, borderTopColor: t.hair, paddingTop: 6 }}>
              {disc > 0 ? row(tr('sl.discount'), `-${money(disc, cur)}`) : null}
              {tip > 0 ? row(tr('sl.tip'), `+${money(tip, cur)}`) : null}
              {row(tr('n4.total'), money(total, cur), true)}
            </View>
          </ScrollView>
          {err ? <T k="sm" color={t.gink}>{err}</T> : null}
          <Button label={tr('n4.confirmPay')} loading={busy} onPress={() => void confirm()} block />
        </View>
      )}
    </>
  );
}
