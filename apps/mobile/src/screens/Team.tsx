import React, { useState } from 'react';
import { FlatList, Linking, RefreshControl, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, ErrorState, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Komanda: masters with photo, position and role; a tap opens contact actions. */
export function Team({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const list = useLoad(() => api.staff(salon?.id ?? ''), [salon?.id]);
  const [sel, setSel] = useState<Staff | null>(null);
  return (
    <Screen>
      <Header title={tr('sections.team')} subtitle={salon?.name} onBack={onBack} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={5} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="users" title={tr('team.empty')} />}
          renderItem={({ item: s }) => (
            <Card onPress={() => setSel(s)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, opacity: s.isActive === false ? 0.6 : 1 }}>
              <Avatar name={s.name} uri={s.avatarUrl} size={52} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{s.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{s.position || s.role || ''}</Text>
              </View>
              {s.isActive === false ? <Pill text={tr('team.inactive')} tone="muted" /> : s.role ? <Pill text={s.role} tone="violet" /> : null}
            </Card>
          )} />
      )}
      <BottomSheet open={!!sel} onClose={() => setSel(null)}>
        {sel ? (
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={sel.name} uri={sel.avatarUrl} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink }}>{sel.name}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{sel.position || sel.role || ''}</Text>
              </View>
            </View>
            {sel.phone ? <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{sel.phone}</Text> : null}
            {sel.email ? <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{sel.email}</Text> : null}
            {sel.phone ? <Btn label={tr('common.call')} icon="phone" variant="secondary" onPress={() => void Linking.openURL(`tel:${sel.phone}`)} /> : null}
            {sel.email ? <Btn label={tr('team.email')} icon="mail" variant="secondary" onPress={() => void Linking.openURL(`mailto:${sel.email}`)} /> : null}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
