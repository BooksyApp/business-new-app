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
import { BackBar, Card as KCard, EmptyState, Field as KField, IconBtn, Photo, Pill as KPill, Skeleton as KSkel, T } from '@/components/kit';
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
  const { salon, demo } = useApp();
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
  const addBtn = <IconBtn icon="plus" label={tr('inv.add')} onPress={() => open('new')} />;
  const [q, setQ] = useState('');
  const rows = (list.data ?? []).filter((p) => !q.trim() || `${p.name} ${p.sku ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const lowN = (list.data ?? []).filter((p) => p.lowStock).length;
  const PH: string[] = ['demo:p4625620', 'demo:f01', 'demo:p3998417', 'demo:f02', 'demo:p5938286', 'demo:f03'];
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} right={addBtn} />
      <View style={{ paddingHorizontal: 20 }}>
        <T k="h1" accessibilityRole="header">{tr('inv.title')}</T>
        <T k="sm" color={t.muted} style={{ marginTop: 2 }}>{(list.data ?? []).length} {tr('v3.productsN')}{lowN ? <T k="sm" color={t.gink} style={{ fontFamily: font.b }}>{` · ${lowN} ${tr('v3.lowN')}`}</T> : null}</T>
      </View>
      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}><KField icon="search" placeholder={tr('v3.searchProduct')} value={q} onChangeText={setQ} /></View>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <KSkel blocks={[{ h: 200 }, { h: 200 }]} /> : (
        <FlatList numColumns={2} data={rows} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 12 }} columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<EmptyState photo={'demo:f01'} title={tr('inv.empty')} action={{ label: tr('inv.add'), icon: 'plus', onPress: () => open('new') }} style={{ marginHorizontal: 0 }} />}
          renderItem={({ item: p, index }) => (
            <KCard onPress={() => open(p)} label={p.name} style={{ flex: 1, overflow: 'hidden', opacity: p.isActive ? 1 : 0.6 }}>
              <Photo src={demo ? PH[index % PH.length] : (p as { imageUrl?: string }).imageUrl} style={{ height: 108 }}>
                {p.lowStock ? <View style={{ position: 'absolute', top: 10, left: 10 }}><KPill text={tr('inv.low')} tone="wh" /></View> : null}
                {!demo && !(p as { imageUrl?: string }).imageUrl ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="box" size={30} color={t.ink3} /></View> : null}
              </Photo>
              <View style={{ padding: 12, gap: 4 }}>
                <T k="h3" lines={1}>{p.name}</T>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <T k="sm" color={t.muted} lines={1} style={{ flexShrink: 1 }}>{p.sku || money(p.price, salon?.currency)}</T>
                  <Text style={{ fontFamily: font.b, fontSize: 14, color: p.lowStock ? t.gink : t.ink }}>{p.quantityOnHand} {tr('v3.pcs')}</Text>
                </View>
              </View>
            </KCard>
          )} />
      )}
      <BottomSheet open={!!edit} onClose={() => setEdit(null)}>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 14 }}>{edit === 'new' ? tr('inv.add') : tr('inv.edit')}</Text>
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
