import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Circ, ErrorState, Field, Header, Screen, ServiceThumb, Skeleton, StateView, Toggle } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const plus = (_t: { violet: string }, on: () => void, label: string) => <Circ icon="plus" violet label={label} onPress={on} />;

/** Paketlər: prepaid session packages (create, switch on/off). */
export function Packages({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiB.packages(sid), [sid]);
  const svc = useLoad(() => api.services(sid), [sid]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [service, setService] = useState(''); const [n, setN] = useState('5'); const [price, setPrice] = useState(''); const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    const sess = Math.round(num(n)); const p = num(price);
    if (!name.trim() || !(sess > 0) || !(p >= 0)) { toast(tr('sx.needName'), 'error'); return; }
    setBusy(true);
    try { await apiB.createPackage(sid, { name: name.trim(), serviceId: service || undefined, sessionsTotal: sess, price: p, validDays: days.trim() ? Math.round(num(days)) : undefined }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setOpen(false); setName(''); setPrice(''); void list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('ad.packages')} subtitle={salon?.name} onBack={onBack} right={plus(t, () => setOpen(true), tr('ad.newPackage'))} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={3} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}
          ListEmptyComponent={<StateView icon="gift" title={tr('sx.noPackages')} actionLabel={tr('ad.newPackage')} onAction={() => setOpen(true)} />}
          renderItem={({ item: p }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 92, opacity: p.active ? 1 : 0.6 }}>
              <ServiceThumb name={p.name} cat="gift" size={60} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17.5, letterSpacing: -0.3, color: t.ink }}>{p.name}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{tr('sx.sessions', { n: p.sessions_total })} · {money(p.price, salon?.currency)}</Text>
              </View>
              <Toggle on={p.active} onChange={(v) => void apiB.setPackageActive(sid, p.id, v).then(() => list.reload()).catch((e: Error) => toast(e.message, 'error'))} label={p.name} />
            </Card>
          )} />
      )}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 14 }}>{tr('ad.newPackage')}</Text>
        <Field label={tr('sx.name')} value={name} onChangeText={setName} />
        <View style={{ maxHeight: 100 }}><Choice value={service} onChange={setService} options={[{ value: '', label: tr('pr.everyone') }, ...(svc.data ?? []).filter((s) => s.isActive).slice(0, 12).map((s) => ({ value: String(s.id), label: s.name }))]} /></View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('ad.sessionsTotal')} value={n} onChangeText={setN} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label={tr('sl.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label={tr('ad.validDays')} value={days} onChangeText={setDays} keyboardType="number-pad" /></View>
        </View>
        <Btn label={tr('common.save')} loading={busy} onPress={() => void save()} />
        <View style={{ height: 16 }} />
      </BottomSheet>
    </Screen>
  );
}

/** Əlavələr (add-ons): small extras a client adds to a service. */
export function Addons({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiB.addons(sid), [sid]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [dur, setDur] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    const p = num(price);
    if (!name.trim() || !(p >= 0)) { toast(tr('sx.needName'), 'error'); return; }
    setBusy(true);
    try { await apiB.createAddon(sid, { name: name.trim(), price: p, priceType: 'FIXED', duration: Math.max(0, Math.round(num(dur)) || 0) }); setOpen(false); setName(''); setPrice(''); setDur(''); void list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('ad.addons')} subtitle={salon?.name} onBack={onBack} right={plus(t, () => setOpen(true), tr('ad.addAddon'))} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={3} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}
          ListEmptyComponent={<StateView icon="plus" title={tr('lk.empty')} actionLabel={tr('ad.addAddon')} onAction={() => setOpen(true)} />}
          renderItem={({ item: a }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 84 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color={t.vtext} /></View>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 17, letterSpacing: -0.2, color: t.ink }}>{a.name}</Text><Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{money(a.price, salon?.currency)}{a.duration ? ` · ${a.duration} ${tr('common.min')}` : ''}</Text></View>
              <Pressable onPress={() => Alert.alert(tr('lk.confirmDelete'), a.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => { void apiB.deleteAddon(sid, a.id).then(() => list.reload()).catch((e: Error) => toast(e.message, 'error')); } }])} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
            </Card>
          )} />
      )}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 14 }}>{tr('ad.addAddon')}</Text>
        <Field label={tr('sx.name')} value={name} onChangeText={setName} />
        <Field label={tr('sl.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <Field label={tr('n4.addonDur')} value={dur} onChangeText={setDur} keyboardType="number-pad" />
        <Btn label={tr('common.save')} loading={busy} onPress={() => void save()} />
        <View style={{ height: 16 }} />
      </BottomSheet>
    </Screen>
  );
}
