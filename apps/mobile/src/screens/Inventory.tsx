import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Circ, ErrorState, Field, Header, Pill, Screen, ServiceThumb, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiB, type Product } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Anbar: products with stock, low-stock flag, add / edit / delete. */
export function Inventory({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiB.products(sid), [sid]);
  const [edit, setEdit] = useState<Product | 'new' | null>(null);
  const [name, setName] = useState(''); const [sku, setSku] = useState(''); const [price, setPrice] = useState('');
  const [qty, setQty] = useState(''); const [low, setLow] = useState(''); const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const open = (p: Product | 'new') => { setEdit(p); const x = p === 'new' ? null : p; setName(x?.name ?? ''); setSku(x?.sku ?? ''); setPrice(x ? String(x.price) : ''); setQty(x ? String(x.quantityOnHand) : '0'); setLow(x ? String(x.lowStockThreshold) : '0'); setActive(x?.isActive ?? true); };
  async function save() {
    const p = num(price); const q = Math.round(num(qty)); const l = Math.round(num(low));
    if (!name.trim() || !(p >= 0) || !(q >= 0) || !(l >= 0)) { toast(tr('inv.invalid'), 'error'); return; }
    setBusy(true);
    try {
      const body = { name: name.trim(), sku: sku.trim() || undefined, price: p, quantityOnHand: q, lowStockThreshold: l, isActive: active };
      if (edit === 'new') await apiB.createProduct(sid, body); else if (edit) await apiB.updateProduct(sid, edit.id, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEdit(null); void list.reload();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  const del = () => { if (edit && edit !== 'new') Alert.alert(tr('inv.confirmDelete'), edit.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => { void apiB.deleteProduct(sid, edit.id).then(() => { setEdit(null); return list.reload(); }).catch((e: Error) => toast(e.message, 'error')); } }]); };
  const addBtn = <Circ icon="plus" violet label={tr('inv.add')} onPress={() => open('new')} />;
  return (
    <Screen>
      <Header title={tr('inv.title')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={5} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="box" title={tr('inv.empty')} actionLabel={tr('inv.add')} onAction={() => open('new')} />}
          renderItem={({ item: p }) => (
            <Card onPress={() => open(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, minHeight: 88, opacity: p.isActive ? 1 : 0.6 }}>
              <ServiceThumb name={p.name} cat="box" size={64} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, letterSpacing: -0.3, color: t.ink }}>{p.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{[p.sku, money(p.price, salon?.currency)].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontFamily: font.x, fontSize: 22, letterSpacing: -0.5, color: t.ink }}>{p.quantityOnHand}</Text>
                {p.lowStock ? <Pill text={tr('inv.low')} tone="guava" /> : null}
              </View>
            </Card>
          )} />
      )}
      <BottomSheet open={!!edit} onClose={() => setEdit(null)}>
        <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 10 }}>{edit === 'new' ? tr('inv.add') : tr('inv.edit')}</Text>
        <Field label={tr('sx.name')} value={name} onChangeText={setName} />
        <Field label="SKU" value={sku} onChangeText={setSku} autoCapitalize="characters" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('sl.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label={tr('inv.qty')} value={qty} onChangeText={setQty} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label={tr('inv.lowAt')} value={low} onChangeText={setLow} keyboardType="number-pad" /></View>
        </View>
        <ToggleRow label={tr('inv.active')} value={active} onChange={setActive} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, paddingBottom: 16 }}>
          {edit !== 'new' ? <Btn label={tr('lk.delete')} variant="danger" style={{ flex: 1 }} onPress={del} /> : null}
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => void save()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
