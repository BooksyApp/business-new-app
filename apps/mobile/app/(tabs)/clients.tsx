import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AddClientSheet } from '@/components/AddClientSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Card, Chip, ErrorState, Field, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type ClientWithStats } from '@/lib/api';
import { useApp } from '@/lib/app';
import { clientKey, rememberClients } from '@/lib/client-cache';
import { useDockInset } from '@/lib/dock';
import { dateLabel, fromIso, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { ctaShadow, font } from '@/theme/tokens';

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

  const stat = (label: string, value: string) => (
    <Card style={{ flex: 1, padding: 12, borderRadius: 18 }}>
      <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12.5, color: t.muted }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.x, fontSize: 19, color: t.ink, marginTop: 2 }}>{value}</Text>
    </Card>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 32, letterSpacing: -0.96, color: t.ink }}>{tr('clients.title')}</Text>
        </View>
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel={tr('cl.add')} haptic
          style={[{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }, ctaShadow]}>
          <Icon name="user-plus" size={22} color="#fff" />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 18 }}>
        <Field placeholder={tr('clients.search')} value={q} onChangeText={setQ} autoCorrect={false} accessibilityLabel={tr('clients.search')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 12, marginBottom: 12 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
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
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: inset, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={all.length ? (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              {stat(tr('cl.statClients'), String(stats.total))}
              {stat(tr('cl.statReturning'), String(stats.returning))}
              {stat(tr('cl.statAvg'), stats.avg == null ? '—' : money(stats.avg, salon?.currency))}
            </View>
          ) : null}
          ListEmptyComponent={filtered
            ? <StateView icon="search" title={tr('cl.noResults')} body={tr('cl.noResultsBody')} actionLabel={tr('cl.clearFilters')} onAction={() => { setQ(''); setSeg('all'); }} />
            : <StateView icon="users" title={tr('clients.empty')} body={tr('cl.emptyBody')} actionLabel={tr('cl.add')} onAction={() => setAdding(true)} />}
          renderItem={({ item: c }) => {
            const name = `${c.firstName} ${c.lastName ?? ''}`.trim() || tr('cl.unnamed');
            const v = visitsOf(c);
            const tag = v === 0 ? null : v === 1 ? { text: tr('cl.tagNew'), tone: 'violet' as const } : v >= 3 ? { text: tr('cl.tagRegular'), tone: 'ok' as const } : null;
            const lapsed = !!c.lastVisitDate && daysSince(c.lastVisitDate) >= 60;
            return (
              <Card onPress={() => router.push(`/client/${encodeURIComponent(clientKey(c))}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                <Avatar name={name} uri={c.avatarUrl} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{c.phone || c.email || tr('cl.noContact')}</Text>
                  {c.nextVisitDate ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon name="cal" size={14} color={t.vtext} />
                      <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12.5, color: t.vtext }}>{dateLabel(fromIso(c.nextVisitDate))}{c.nextVisitTime ? ` · ${c.nextVisitTime.slice(0, 5)}` : ''}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {tag ? <Pill text={tag.text} tone={tag.tone} /> : lapsed ? <Pill text={tr('cl.tagLapsed')} tone="amber" /> : null}
                  <Text style={{ fontFamily: font.b, fontSize: 13, color: t.ink }}>{tr('cl.visitsN', { n: v })}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 12, color: t.muted }}>{money(c.totalSpent, salon?.currency)}</Text>
                </View>
              </Card>
            );
          }}
        />
      )}
      <AddClientSheet open={adding} onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); router.push(`/client/${encodeURIComponent(String(c.id))}`); }} />
    </Screen>
  );
}
