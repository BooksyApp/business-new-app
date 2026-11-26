import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Choice, SectionTitle, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Chip, Field, Header, Screen, ServiceThumb } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX, type SaleBody } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Line = { key: number; serviceId?: string | number; name: string; price: number; qty: number };
const METHODS = ['CASH', 'CARD_TERMINAL', 'GIFT_CARD', 'MEMBERSHIP', 'PACKAGE'] as const;

/** Till: pick services (or a custom item), staff, discount, tip, payment method (cash, card, gift card ...) and record the sale. */
export function NewSale({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const cur = salon?.currency;
  const svc = useLoad(() => api.services(sid), [sid]);
  const staff = useLoad(() => api.staff(sid), [sid]);
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
  const sub = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const disc = Math.min(sub, Math.max(0, num(discount) || 0));
  const tipN = Math.max(0, num(tip) || 0);
  const total = useMemo(() => Math.max(0, sub - disc) + tipN, [sub, disc, tipN]);
  const add = (l: Omit<Line, 'key'>) => setLines((x) => [...x, { ...l, key: Date.now() + x.length }]);
  const qty = (k: number, d: number) => setLines((x) => x.flatMap((l) => (l.key !== k ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));

  async function submit() {
    if (!lines.length) { Alert.alert(tr('common.error'), tr('sl.needItem')); return; }
    if (method === 'GIFT_CARD' && !gift.trim()) { Alert.alert(tr('common.error'), tr('sl.needGift')); return; }
    const body: SaleBody = {
      businessId: sid, staffId: master || undefined, clientName: clientName.trim() || undefined,
      items: lines.map((l) => ({ serviceId: l.serviceId != null ? String(l.serviceId) : undefined, serviceName: l.name, serviceType: l.serviceId != null ? 'SERVICE' : 'OTHER', quantity: l.qty, unitPrice: l.price })),
      discountAmount: disc || undefined, tipAmount: tipN || undefined, paymentMethod: method, paymentAmount: total,
      giftCardCode: method === 'GIFT_CARD' ? gift.trim() : undefined,
    };
    setBusy(true);
    try {
      await apiX.createSale(body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); Alert.alert(tr('sl.done'), money(total, cur)); onDone();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('sl.title')} subtitle={salon?.name} onBack={onClose} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
        <SectionTitle>{tr('sl.items')}</SectionTitle>
        {lines.length ? (
          <Card style={{ padding: 6, marginBottom: 12 }}>
            {lines.map((l, i) => (
              <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line + '99' }}>
                <ServiceThumb name={l.name} size={52} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16.5, letterSpacing: -0.2, color: t.ink }}>{l.name}</Text>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: t.muted }}>{money(l.price * l.qty, cur)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.fill, borderRadius: 24, padding: 3 }}>
                  <Pressable onPress={() => qty(l.key, -1)} accessibilityRole="button" accessibilityLabel={`${l.name} -1`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={18} color={t.ink} /></Pressable>
                  <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink, minWidth: 22, textAlign: 'center' }}>{l.qty}</Text>
                  <Pressable onPress={() => qty(l.key, 1)} accessibilityRole="button" accessibilityLabel={`${l.name} +1`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} color={t.ink} /></Pressable>
                </View>
              </View>
            ))}
          </Card>
        ) : null}
        <Text style={{ fontFamily: font.s, fontSize: 13, color: t.muted, marginBottom: 6 }}>{tr('sl.pickService')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
          {(quick.data ?? []).map((q) => <Chip key={`q${q.id}`} icon="star" label={`${q.serviceName} · ${money(q.price, cur)}`} onPress={() => add({ serviceId: q.serviceId, name: q.serviceName, price: q.price ?? 0, qty: 1 })} />)}
          {(svc.data ?? []).filter((s) => s.isActive && !(quick.data ?? []).some((q) => String(q.serviceId) === String(s.id))).map((s) => <Chip key={s.id} label={`${s.name} · ${money(s.price, cur)}`} onPress={() => add({ serviceId: s.id, name: s.name, price: s.price ?? 0, qty: 1 })} />)}
        </ScrollView>
        <Field label={tr('sl.customName')} value={cName} onChangeText={setCName} />
        <Field label={`${tr('sl.price')} (${cur ?? 'AZN'})`} value={cPrice} onChangeText={setCPrice} keyboardType="decimal-pad" />
        <Btn label={tr('sl.custom')} variant="secondary" icon="plus" disabled={!cName.trim() || !(num(cPrice) >= 0)} onPress={() => { add({ name: cName.trim(), price: num(cPrice), qty: 1 }); setCName(''); setCPrice(''); }} />
        <SectionTitle>{tr('sl.master')}</SectionTitle>
        <Choice value={master} onChange={setMaster} options={[{ value: '', label: '-' }, ...(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: String(s.id), label: s.name }))]} />
        <Field label={tr('sl.client')} value={clientName} onChangeText={setClientName} autoCapitalize="words" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('sl.discount')} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label={tr('sl.tip')} value={tip} onChangeText={setTip} keyboardType="decimal-pad" /></View>
        </View>
        <SectionTitle>{tr('sl.method')}</SectionTitle>
        <Choice value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: tr(`sales.m.${m}` as 'sales.m.CASH') }))} />
        {method === 'GIFT_CARD' ? <Field label={tr('sl.giftCode')} value={gift} onChangeText={setGift} autoCapitalize="characters" autoCorrect={false} /> : null}
        <Card style={{ gap: 6, marginTop: 8 }}>
          {disc > 0 ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{tr('sl.discount')}</Text><Text style={{ fontFamily: font.b, fontSize: 15, color: t.ok }}>-{money(disc, cur)}</Text></View> : null}
          {tipN > 0 ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{tr('sl.tip')}</Text><Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{money(tipN, cur)}</Text></View> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontFamily: font.s, fontSize: 16, color: t.muted }}>{tr('sl.total')}</Text>
            <Text style={{ fontFamily: font.x, fontSize: 40, letterSpacing: -1.3, color: t.ink }}>{money(total, cur)}</Text>
          </View>
        </Card>
      </ScrollView>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 28 }}>
        <Pressable onPress={() => void submit()} disabled={!lines.length || busy} haptic accessibilityRole="button" accessibilityLabel={tr('sl.charge')} style={{ opacity: !lines.length ? 0.5 : 1 }}>
          <LinearGradient colors={['#1d1730', '#35276b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26, boxShadow: '0 16px 30px -12px rgba(29,23,48,.6)' } as any}>
            <Text style={{ fontFamily: font.x, fontSize: 19, color: '#fff' }}>{busy ? '…' : `${money(total, cur)} ${tr('sl.charge').toLowerCase()}`}</Text>
            <Icon name="chev" size={22} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </Screen>
  );
}
