import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ImportSheet } from '@/components/ImportSheet';
import { AddClientSheet } from '@/components/AddClientSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Card, Chip, Circ, ErrorState, Header, Pill, Screen, SearchBar, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type ClientWithStats } from '@/lib/api';
import { useApp } from '@/lib/app';
import { clientKey, rememberClients } from '@/lib/client-cache';
import { useDockInset } from '@/lib/dock';
import { dateLabel, fromIso, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Seg = 'all' | 'new' | 'regular' | 'lapsed' | 'never';
const SEGS: { k: Seg; label: 'cl.segAll' | 'cl.segNew' | 'cl.segRegular' | 'cl.segLapsed' | 'cl.segNever' }[] = [
  { k: 'all', label: 'cl.segAll' }, { k: 'new', label: 'cl.segNew' }, { k: 'regular', label: 'cl.segRegular' }, { k: 'lapsed', label: 'cl.segLapsed' }, { k: 'never', label: 'cl.segNever' },
];
const visitsOf = (c: ClientWithStats) => c.pastVisits ?? c.totalVisits ?? 0;
const daysSince = (iso: string) => Math.floor((Date.now() - fromIso(iso).getTime()) / 86400000);
const inSeg = (c: ClientWithStats, s: Seg) =>
  s === 'all' ? true : s === 'never' ? visitsOf(c) === 0 : s === 'new' ? visitsOf(c) === 1 : s === 'regular' ? visitsOf(c) >= 3
    : !!c.lastVisitDate && daysSince(c.lastVisitDate) >= 60;

/** Müştərilər (BF48 list, mobile): search, six-segment style filter row, three stats, client rows with the next visit, add-client sheet. */
export default function Clients() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version } = useApp();
  const inset = useDockInset(16);
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<Seg>('all');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const list = useLoad(async () => { const r = await api.clientsWithStats(salon?.id ?? ''); rememberClients(r); return r; }, [salon?.id, version]);
  const all = list.data ?? [];
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((c) => inSeg(c, seg) && (!s || `${c.firstName} ${c.lastName ?? ''} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(s)));
  }, [q, seg, all]);
  const stats = useMemo(() => {
    const paying = all.filter((c) => (c.totalSpent ?? 0) > 0);
    const avg = paying.length ? paying.reduce((n, c) => n + (c.totalSpent ?? 0), 0) / paying.length : null;
    return { total: all.length, returning: all.filter((c) => visitsOf(c) >= 2).length, avg };
  }, [all]);
  const filtered = q.trim() !== '' || seg !== 'all';

  return (
    <Screen>
      <Header title={tr('clients.title')} subtitle={all.length ? `${stats.total} ${tr('ux.members')} · ${tr('ux.returningN', { n: stats.returning })}` : undefined}
        right={<><Circ icon="paper" label={tr('ux.import')} onPress={() => setImporting(true)} /><Circ icon="user-plus" violet label={tr('cl.add')} onPress={() => setAdding(true)} /></>} />
      <View style={{ paddingHorizontal: 20 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder={tr('clients.search')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginTop: 14, marginBottom: 14 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {SEGS.map((s) => <Chip key={s.k} label={tr(s.label)} active={seg === s.k} onPress={() => setSeg(s.k)} />)}
      </ScrollView>
      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.reload()} />
      ) : list.loading && !list.data ? (
        <Skeleton rows={6} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c, i) => clientKey(c) || String(i)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: inset, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag" initialNumToRender={12} windowSize={9} removeClippedSubviews
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={filtered
            ? <StateView icon="search" title={tr('cl.noResults')} body={tr('cl.noResultsBody')} actionLabel={tr('cl.clearFilters')} onAction={() => { setQ(''); setSeg('all'); }} />
            : <StateView icon="users" title={tr('clients.empty')} body={tr('cl.emptyBody')} actionLabel={tr('cl.add')} onAction={() => setAdding(true)} />}
          renderItem={({ item: c }) => {
            const name = `${c.firstName} ${c.lastName ?? ''}`.trim() || tr('cl.unnamed');
            const v = visitsOf(c);
            const lapsed = !!c.lastVisitDate && daysSince(c.lastVisitDate) >= 60;
            const line = v === 0 ? tr('ux.firstBooking') : `${tr('ux.lastVisit')}: ${c.lastVisitDate ? (daysSince(c.lastVisitDate) <= 0 ? tr('common.today').toLowerCase() : dateLabel(fromIso(c.lastVisitDate))) : '-'}${c.favouriteService ? ` · ${c.favouriteService}` : ''}`;
            const tag = c.notes?.trim() ? { text: tr('ux.hasNote'), tone: 'violet' as const } : c.vip ? { text: 'VIP', tone: 'amber' as const } : lapsed ? { text: tr('cl.tagLapsed'), tone: 'amber' as const } : null;
            return (
              <Card onPress={() => router.push(`/client/${encodeURIComponent(clientKey(c))}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 92 }}>
                <Avatar name={name} uri={c.avatarUrl} size={60} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17.5, letterSpacing: -0.3, color: t.ink }}>{name}</Text>
                  <Text numberOfLines={2} style={{ fontFamily: font.m, fontSize: 14.5, lineHeight: 20, color: t.muted }}>{line}</Text>
                </View>
                {tag ? <Pill text={tag.text} tone={tag.tone} /> : <Icon name="chev" size={20} color={t.ink3} />}
              </Card>
            );
          }}
        />
      )}
      <ImportSheet open={importing} onClose={() => setImporting(false)} onDone={() => { void list.reload(); }} />
      <AddClientSheet open={adding} onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); router.push(`/client/${encodeURIComponent(String(c.id))}`); }} />
    </Screen>
  );
}
