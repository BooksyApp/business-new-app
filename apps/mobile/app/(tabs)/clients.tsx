import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/Text';
import { Avatar, Card, ErrorState, Field, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app';
import { clientKey, rememberClients } from '@/lib/client-cache';
import { useDockInset } from '@/lib/dock';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

export default function Clients() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version } = useApp();
  const inset = useDockInset(16);
  const [q, setQ] = useState('');
  const list = useLoad(async () => { const r = await api.clientsWithStats(salon?.id ?? ''); rememberClients(r); return r; }, [salon?.id, version]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = list.data ?? [];
    return s ? all.filter((c) => `${c.firstName} ${c.lastName ?? ''} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(s)) : all;
  }, [q, list.data]);

  return (
    <Screen>
      <Header title={tr('clients.title')} subtitle={salon?.name} />
      <View style={{ paddingHorizontal: 18 }}>
        <Field placeholder={tr('clients.search')} value={q} onChangeText={setQ} autoCorrect={false} />
      </View>
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.reload()} />
      ) : list.loading && !list.data ? (
        <Skeleton rows={6} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c, i) => clientKey(c) || String(i)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: inset, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="users" title={tr('clients.empty')} />}
          renderItem={({ item: c }) => {
            const name = `${c.firstName} ${c.lastName ?? ''}`.trim();
            return (
              <Card onPress={() => router.push(`/client/${encodeURIComponent(clientKey(c))}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                <Avatar name={name} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{c.phone || c.email || ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: font.b, fontSize: 13, color: t.ink }}>{c.totalVisits ?? 0} {tr('clients.visits').toLowerCase()}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 12, color: t.muted }}>{money(c.totalSpent, salon?.currency)}</Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}
