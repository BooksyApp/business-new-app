import { EmptyState, ListItem as KListItem, Pill as KPill, T } from '@/components/kit';
import React, { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { BottomSheet } from '@/components/BottomSheet';
import { NewSale } from '@/screens/NewSale';
import { apiX } from '@/lib/api-ext';
import { Btn, Card, Circ, ErrorState, Field, Header, Hero, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr, type StringKey } from '@/i18n';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app';
import { addDays, dateLabel, hhmm, money, sameDay } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const METHODS = ['CASH', 'CARD_TERMINAL', 'CHECK', 'SPLIT', 'MEMBERSHIP', 'GIFT_CARD', 'PACKAGE'] as const;

/** Kassa: the day's sales with a day switcher and the day's total (read only). */
export function Sales({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, version } = useApp();
  const [date, setDate] = useState(() => new Date());
  const list = useLoad(() => api.sales(salon?.id ?? '', date), [salon?.id, date.toDateString(), version]);
  const [adding, setAdding] = useState(false);
  const [refund, setRefund] = useState<{ id: string | number; total: number } | null>(null);
  const [amt, setAmt] = useState('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = list.data ?? [];
  const total = rows.reduce((n, s) => n + (s.total ?? 0), 0);
  const nav = (icon: string, d: number, label: string) => (
    <Pressable onPress={() => setDate(addDays(date, d))} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={t.ink} />
    </Pressable>
  );
  async function doRefund() {
    if (!refund) return;
    const a = Number(amt.replace(',', '.'));
    if (!Number.isFinite(a) || a <= 0 || a > refund.total) { Alert.alert(tr('common.error'), tr('sl.refundMax', { n: money(refund.total, salon?.currency) })); return; }
    setBusy(true);
    try { await apiX.refundSale(String(refund.id), { amount: a, reason: why.trim() || undefined }); setRefund(null); toast(tr('sl.refunded'), 'success'); void list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  if (adding) return <NewSale onClose={() => setAdding(false)} onDone={() => { setAdding(false); void list.reload(); }} />;
  const addBtn = <Circ icon="plus" violet label={tr('sl.add')} onPress={() => setAdding(true)} />;
  return (
    <Screen>
      <Header title={tr('sections.sales')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        {nav('back', -1, tr('sales.prev'))}
        <Pressable onPress={() => setDate(new Date())} accessibilityRole="button"><Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink, textTransform: 'capitalize' }}>{sameDay(date, new Date()) ? tr('common.today') : dateLabel(date)}</Text></Pressable>
        {nav('chev', 1, tr('sales.next'))}
      </View>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={5} /> : (
        <FlatList initialNumToRender={12} windowSize={9} data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={rows.length ? (
            <View style={{ paddingBottom: 8 }}>
              <T k="sm" color={t.muted}>{tr('sales.total', { n: rows.length })}</T>
              <Text style={{ fontFamily: font.x, fontSize: 40, lineHeight: 46, letterSpacing: -1.4, color: t.ink }}>{money(total, salon?.currency)}</Text>
            </View>
          ) : null}
          ListEmptyComponent={<EmptyState photo="demo:f02" title={tr('sales.empty')} body={tr('sales.emptyBody')} action={{ label: tr('sl.add'), icon: 'plus', onPress: () => setAdding(true) }} style={{ marginHorizontal: 0 }} />}
          renderItem={({ item: s, index }) => (
            <KListItem first={index === 0} title={s.clientName || tr('sales.walkIn')} sub={[hhmm(s.saleTime), s.staffName, (s.items ?? []).map((i) => i.name ?? i.itemName).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              onPress={() => { setRefund({ id: s.id, total: s.total ?? 0 }); setAmt(String(s.total ?? '')); setWhy(''); }}
              right={<View style={{ alignItems: 'flex-end', gap: 4 }}><Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{money(s.total, salon?.currency)}</Text><KPill text={(METHODS as readonly string[]).includes(s.paymentMethod) ? tr(`sales.m.${s.paymentMethod}` as StringKey) : s.paymentMethod} /></View>} />
          )} />
      )}
      <BottomSheet open={!!refund} onClose={() => setRefund(null)}>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 14 }}>{tr('sl.refund')}</Text>
        <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, marginBottom: 12 }}>{tr('sl.refundMax', { n: money(refund?.total, salon?.currency) })}</Text>
        <Field label={tr('sl.refundAmount')} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" />
        <Field label={tr('sl.refundReason')} value={why} onChangeText={setWhy} />
        <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
          <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setRefund(null)} />
          <Btn label={tr('sl.refund')} variant="danger" style={{ flex: 1 }} loading={busy} onPress={() => void doRefund()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
