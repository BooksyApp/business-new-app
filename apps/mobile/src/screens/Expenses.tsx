import { useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { toDay } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { dateLabel, fromIso, money, monthLabel } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const CATS = ['RENT', 'STOCK', 'WAGES', 'UTILITIES', 'MARKETING', 'EQUIPMENT', 'INSURANCE', 'SOFTWARE', 'TRAVEL', 'FEES', 'OTHER'] as const;

/** Xərclər: month by month, add and delete costs by category, month total. */
export function Expenses({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [m, setM] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const from = toDay(m); const to = toDay(new Date(m.getFullYear(), m.getMonth() + 1, 0));
  const list = useLoad(() => apiB.expenses(sid, from, to), [sid, from]);
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState<(typeof CATS)[number]>('OTHER');
  const [amount, setAmount] = useState(''); const [desc, setDesc] = useState(''); const [on, setOn] = useState(toDay(new Date())); const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = (list.data ?? []).reduce((n, e) => n + (Number(e.amount) || 0), 0);
  async function save() {
    const a = num(amount);
    if (!(a > 0)) { Alert.alert(tr('common.error'), tr('ex.amountRequired')); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) { Alert.alert(tr('common.error'), tr('wl.badDate')); return; }
    setBusy(true);
    try { await apiB.addExpense(sid, { category: cat, amount: a, spentOn: on, description: desc.trim() || undefined, recursMonthly: rec }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setAdding(false); setAmount(''); setDesc(''); void list.reload(); }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  const nav = (icon: string, d: number, l: string) => <Pressable onPress={() => setM(new Date(m.getFullYear(), m.getMonth() + d, 1))} hitSlop={10} accessibilityRole="button" accessibilityLabel={l} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={t.ink} /></Pressable>;
  const addBtn = <Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel={tr('ex.add')} haptic style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color="#fff" /></Pressable>;
  return (
    <Screen>
      <Header title={tr('ex.title')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        {nav('back', -1, tr('sales.prev'))}
        <Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink, textTransform: 'capitalize' }}>{monthLabel(m)}</Text>
        {nav('chev', 1, tr('sales.next'))}
      </View>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={5} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(e) => String(e.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={(list.data ?? []).length ? <Card style={{ backgroundColor: t.vsoft, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: font.s, color: t.vtext }}>{tr('sl.total')}</Text><Text style={{ fontFamily: font.x, fontSize: 20, color: t.vtext }}>{money(total, salon?.currency)}</Text></Card> : null}
          ListEmptyComponent={<StateView icon="receipt" title={tr('ex.empty')} />}
          renderItem={({ item: e }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{tr(`ex.c.${e.category}` as 'ex.c.OTHER')}{e.description ? ` · ${e.description}` : ''}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{dateLabel(fromIso(e.spent_on))}{e.recurs_monthly ? ` · ${tr('ex.monthly')}` : ''}</Text>
              </View>
              <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{money(Number(e.amount), salon?.currency)}</Text>
              <Pressable onPress={() => Alert.alert(tr('ex.confirmDelete'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => { void apiB.deleteExpense(sid, e.id).then(() => list.reload()).catch((x: Error) => Alert.alert(tr('common.error'), x.message)); } }])} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
            </Card>
          )} />
      )}
      <BottomSheet open={adding} onClose={() => setAdding(false)}>
        <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 10 }}>{tr('ex.add')}</Text>
        <View style={{ maxHeight: 130 }}><Choice value={cat} onChange={setCat} options={CATS.map((c) => ({ value: c, label: tr(`ex.c.${c}` as 'ex.c.OTHER') }))} /></View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={`${tr('ex.amount')} (${salon?.currency ?? 'AZN'})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label={tr('wl.date')} value={on} onChangeText={setOn} keyboardType="numbers-and-punctuation" maxLength={10} /></View>
        </View>
        <Field label={tr('sx.description')} value={desc} onChangeText={setDesc} />
        <ToggleRow label={tr('ex.monthly')} value={rec} onChange={setRec} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, paddingBottom: 16 }}>
          <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => void save()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
