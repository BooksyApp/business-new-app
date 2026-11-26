import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Card, ErrorState, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
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
  const rows = list.data ?? [];
  const total = rows.reduce((n, s) => n + (s.total ?? 0), 0);
  const nav = (icon: string, d: number, label: string) => (
    <Pressable onPress={() => setDate(addDays(date, d))} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={t.ink} />
    </Pressable>
  );
  return (
    <Screen>
      <Header title={tr('sections.sales')} subtitle={salon?.name} onBack={onBack} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        {nav('back', -1, tr('sales.prev'))}
        <Pressable onPress={() => setDate(new Date())} accessibilityRole="button"><Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink, textTransform: 'capitalize' }}>{sameDay(date, new Date()) ? tr('common.today') : dateLabel(date)}</Text></Pressable>
        {nav('chev', 1, tr('sales.next'))}
      </View>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={5} /> : (
        <FlatList data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={rows.length ? (
            <Card style={{ backgroundColor: t.vsoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: font.s, fontSize: 14.5, color: t.vtext }}>{tr('sales.total', { n: rows.length })}</Text>
              <Text style={{ fontFamily: font.x, fontSize: 22, color: t.vtext }}>{money(total, salon?.currency)}</Text>
            </Card>
          ) : null}
          ListEmptyComponent={<StateView icon="wallet" title={tr('sales.empty')} body={tr('sales.emptyBody')} />}
          renderItem={({ item: s }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{s.clientName || tr('sales.walkIn')}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{[hhmm(s.saleTime), s.staffName, (s.items ?? []).map((i) => i.name ?? i.itemName).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{money(s.total, salon?.currency)}</Text>
                <Pill text={(METHODS as readonly string[]).includes(s.paymentMethod) ? tr(`sales.m.${s.paymentMethod}` as StringKey) : s.paymentMethod} tone="muted" />
              </View>
            </Card>
          )} />
      )}
    </Screen>
  );
}
