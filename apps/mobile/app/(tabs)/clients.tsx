import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ImportSheet } from '@/components/ImportSheet';
import { AddClientSheet } from '@/components/AddClientSheet';
import { Text } from '@/components/Text';
import { ErrorState, Screen, SearchBar, StateView } from '@/components/ui';
import { Avatar, Chip, ChipRow, EmptyState, IconBtn, ListItem, Skeleton, T, TopBar } from '@/components/kit';
import { useSafeAreaInsets } from '@/lib/insets';
import { t as tr } from '@/i18n';
import { api, type ClientWithStats } from '@/lib/api';
import { useApp } from '@/lib/app';
import { clientKey, rememberClients } from '@/lib/client-cache';
import { useDockInset } from '@/lib/dock';
import { fromIso, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Seg = 'all' | 'vip' | 'new' | 'lapsed' | 'regular' | 'never';
const visitsOf = (c: ClientWithStats) => c.pastVisits ?? c.totalVisits ?? 0;
const daysSince = (iso: string) => Math.floor((Date.now() - fromIso(iso).getTime()) / 86400000);
const tagsOf = (c: ClientWithStats) => (c as { tags?: string[] }).tags;
const isVip = (c: ClientWithStats) => !!c.vip || !!tagsOf(c)?.includes('VIP');
const isNew = (c: ClientWithStats) => visitsOf(c) <= 1;
const isLapsed = (c: ClientWithStats) => !!c.lastVisitDate && daysSince(c.lastVisitDate) >= 60;
const inSeg = (c: ClientWithStats, s: Seg) =>
  s === 'all' ? true : s === 'vip' ? isVip(c) : s === 'new' ? isNew(c) : s === 'lapsed' ? isLapsed(c) : s === 'regular' ? visitsOf(c) >= 3 : visitsOf(c) === 0;

/** Müştərilər (artifact "Müştərilər"): like an Instagram follower list. Search, segment chips with counts, photo, one line, last visit. */
export default function Clients() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
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
  const segs: { k: Seg; label: string }[] = [
    { k: 'all', label: tr('v2.all') }, { k: 'new', label: tr('v2.newTag') }, { k: 'regular', label: tr('cl.segRegular') }, { k: 'lapsed', label: tr('v2.lost') },
  ];
  const filtered = q.trim() !== '' || seg !== 'all';
  const empty = !list.loading && !list.error && all.length === 0;

  return (
    <Screen style={{ paddingTop: ins.top }}>
      <TopBar title={tr('v2.clientsTitle')} right={<><IconBtn icon="sliders" label={tr('ux.import')} onPress={() => setImporting(true)} /><IconBtn icon="plus" label={tr('v2.addClient')} onPress={() => setAdding(true)} /></>} />
      <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder={tr('v2.searchClient')} />
      </View>
      {empty ? (
        <EmptyState photo="demo:p7755235" title={tr('v2.emptyClientsTitle')} body={tr('v2.emptyClientsBody')}
          action={{ label: tr('v2.addClient'), icon: 'plus', onPress: () => setAdding(true) }} secondary={{ label: tr('ux.import'), icon: 'users', onPress: () => setImporting(true) }} />
      ) : (
        <>
          <ChipRow style={{ marginTop: 14, marginBottom: 6 }}>
            {segs.map((s) => <Chip key={s.k} label={s.label} on={seg === s.k} count={all.length ? all.filter((c) => inSeg(c, s.k)).length : undefined} onPress={() => setSeg(s.k)} />)}
          </ChipRow>
          {list.error && !list.data ? (
            <ErrorState error={list.error} onRetry={() => void list.reload()} />
          ) : list.loading && !list.data ? (
            <Skeleton blocks={[{ h: 60 }, { h: 60 }, { h: 60 }, { h: 60 }, { h: 60 }]} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(c, i) => clientKey(c) || String(i)}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: inset }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag" initialNumToRender={14} windowSize={9} removeClippedSubviews
              refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
              ListEmptyComponent={filtered ? <StateView icon="search" title={tr('cl.noResults')} body={tr('cl.noResultsBody')} actionLabel={tr('cl.clearFilters')} onAction={() => { setQ(''); setSeg('all'); }} /> : null}
              renderItem={({ item: c, index }) => {
                const name = `${c.firstName} ${c.lastName ?? ''}`.trim() || tr('cl.unnamed');
                const v = visitsOf(c);
                const tag = isVip(c) ? { l: 'VIP', c: t.vtext } : isLapsed(c) ? { l: tr('v2.lost'), c: t.gink } : tagsOf(c)?.[0] && tagsOf(c)?.[0] !== 'VIP' ? { l: tagsOf(c)![0], c: t.muted } : null;
                const last = c.lastVisitDate ? (daysSince(c.lastVisitDate) <= 0 ? tr('v2.today') : tr('v2.daysAgo', { n: daysSince(c.lastVisitDate) })) : tr('v2.firstVisit');
                return (
                  <ListItem first={index === 0} title={name} onPress={() => router.push(`/client/${encodeURIComponent(clientKey(c))}`)}
                    lead={<Avatar uri={c.avatarUrl} name={name} size={52} />}
                    sub={<Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 13, color: t.muted }}>{v ? tr('v2.visitsSpent', { n: v, s: money(c.totalSpent ?? 0, salon?.currency) }) : tr('v2.newClientShort')}{tag ? <Text style={{ fontFamily: font.s, color: tag.c }}>{` · ${tag.l}`}</Text> : null}</Text>}
                    right={<T k="sm" color={t.ink3}>{last}</T>} />
                );
              }}
            />
          )}
        </>
      )}
      <ImportSheet open={importing} onClose={() => setImporting(false)} onDone={() => { void list.reload(); }} />
      <AddClientSheet open={adding} onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); router.push(`/client/${encodeURIComponent(String(c.id))}`); }} />
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
