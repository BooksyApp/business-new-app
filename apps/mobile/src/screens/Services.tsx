import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type Service } from '@/lib/api';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Xidmətlər: the salon's services with an on/off switch (bookable online) and a price / duration editor. */
export function Services({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => api.services(sid), [sid]);
  const [edit, setEdit] = useState<Service | null>(null);
  const [price, setPrice] = useState('');
  const [dur, setDur] = useState('');
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const rows = (list.data ?? []).slice().sort((a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? '') || a.name.localeCompare(b.name));

  async function toggle(s: Service, v: boolean) {
    setLocal((m) => ({ ...m, [s.id]: v }));
    try {
      await api.updateService(sid, s.id, { isActive: v });
      Haptics.selectionAsync().catch(() => {});
      bump();
      await list.reload();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setLocal((m) => { const { [s.id]: _drop, ...rest } = m; return rest; });
    }
  }
  function open(s: Service) { setEdit(s); setPrice(s.price != null ? String(s.price) : ''); setDur(s.durationMinutes != null ? String(s.durationMinutes) : ''); }
  async function save() {
    if (!edit) return;
    const p = Number(price.replace(',', '.'));
    const d = Math.round(Number(dur));
    if (!Number.isFinite(p) || p < 0 || !Number.isFinite(d) || d <= 0 || d > 720 || p > 100000) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); Alert.alert(tr('common.error'), tr('svc.invalid')); return; }
    setBusy(true);
    try {
      await api.updateService(sid, edit.id, { price: p, durationMinutes: d });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEdit(null);
      bump();
      await list.reload();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title={tr('sections.services')} subtitle={salon?.name} onBack={onBack} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={6} /> : (
        <FlatList initialNumToRender={12} windowSize={9} data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="scissors" title={tr('create.noServices')} />}
          renderItem={({ item: s }) => {
            const on = local[s.id] ?? s.isActive;
            return (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: on ? 1 : 0.65 }}>
                <Pressable onPress={() => open(s)} accessibilityRole="button" accessibilityLabel={`${s.name}, ${tr('svc.edit')}`} style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{s.name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{[s.categoryName, s.durationMinutes ? `${s.durationMinutes} ${tr('common.min')}` : null, money(s.price, salon?.currency)].filter(Boolean).join(' · ')}</Text>
                </Pressable>
                <Pressable onPress={() => open(s)} accessibilityRole="button" accessibilityLabel={tr('svc.edit')}><Icon name="edit" size={20} color={t.vtext} /></Pressable>
                <Switch value={on} onValueChange={(v) => void toggle(s, v)} accessibilityLabel={s.name} trackColor={{ true: t.violet, false: t.fill2 }} />
              </Card>
            );
          }} />
      )}
      <BottomSheet open={!!edit} onClose={() => setEdit(null)}>
        <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 14 }}>{edit?.name}</Text>
        <Field label={`${tr('appt.price')} (${salon?.currency ?? 'AZN'})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <Field label={`${tr('svc.duration')} (${tr('common.min')})`} value={dur} onChangeText={setDur} keyboardType="number-pad" />
        <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
          <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setEdit(null)} />
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => void save()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
