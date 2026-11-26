import React, { useMemo, useState } from 'react';
import { FlatList, Linking, RefreshControl, ScrollView, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { ToggleRow } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Chip, Circ, ErrorState, Field, Header, HeroCard, Pill, Screen, SearchBar, Skeleton, StateView, StatCard, StickyCta } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiM, type StockLevel, type Supplier } from '@/lib/api-more';
import { useApp } from '@/lib/app';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Draft = { id: string | null; name: string; contact: string; email: string; phone: string; account: string; notes: string; active: boolean };
const blank: Draft = { id: null, name: '', contact: '', email: '', phone: '', account: '', notes: '', active: true };

/** Təchizatçılar (CRUD) and Anbar sayımı (count session: enter what is on the shelf, review the differences, confirm). */
export function Suppliers({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const [tab, setTab] = useState<'suppliers' | 'count'>('suppliers');
  const sup = useLoad(() => apiM.suppliers(sid), [sid]);
  const lv = useLoad(() => (tab === 'count' ? apiM.stockLevels(sid) : Promise.resolve([] as StockLevel[])), [sid, tab]);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const levels = useMemo(() => (lv.data ?? []).filter((p) => !q.trim() || `${p.name} ${p.sku ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())), [lv.data, q]);
  const diffs = useMemo(() => (lv.data ?? []).flatMap((p) => { const c = counted[String(p.id)]; if (c == null || c === '') return []; const n = Math.max(0, Math.round(Number(c.replace(',', '.')))); return Number.isFinite(n) && n !== Number(p.quantity_on_hand) ? [{ p, n, delta: n - Number(p.quantity_on_hand) }] : []; }), [lv.data, counted]);
  const done = Object.values(counted).filter((v) => v !== '').length;

  async function saveSup() {
    if (!d || !d.name.trim()) { toast(tr('tm.needName'), 'error'); return; }
    setBusy(true);
    try { await apiM.saveSupplier(sid, d.id, { name: d.name.trim(), contactName: d.contact.trim() || undefined, email: d.email.trim() || undefined, phone: d.phone.trim() || undefined, accountNumber: d.account.trim() || undefined, notes: d.notes.trim() || undefined, isActive: d.active }); toast(tr('ns.saved'), 'success'); setD(null); await sup.reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true);
    try { for (const x of diffs) await apiM.stockCount(sid, x.p.id, x.n, 'Mobile count'); toast(tr('ux.countDone'), 'success'); setReview(false); setCounted({}); bump(); await lv.reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (d) {
    const set = (k: keyof Draft) => (v: string) => setD({ ...d, [k]: v });
    return (
      <Screen>
        <Header title={d.id ? tr('ux.supplierEdit') : tr('ux.supplierNew')} subtitle={salon?.name} onBack={() => setD(null)} />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 4 }}>
          <HeroCard icon="store" title={d.name || tr('ux.supplierNew')} sub={[d.contact, d.phone].filter(Boolean).join(' · ')} />
          <View style={{ height: 10 }} />
          <Field label={tr('sx.name')} value={d.name} onChangeText={set('name')} />
          <Field label={tr('ux.contactName')} value={d.contact} onChangeText={set('contact')} />
          <Field label={tr('create.phone')} value={d.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label={tr('cl.email')} value={d.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
          <Field label={tr('ux.account')} value={d.account} onChangeText={set('account')} />
          <Field label={tr('ux.colNote')} value={d.notes} onChangeText={set('notes')} multiline style={{ minHeight: 70, paddingTop: 6, textAlignVertical: 'top' }} />
          {d.id ? <ToggleRow label={tr('inv.active')} value={d.active} onChange={(v) => setD({ ...d, active: v })} /> : null}
        </ScrollView>
        <StickyCta label={tr('common.save')} loading={busy} onPress={() => void saveSup()} secondary={{ label: tr('common.cancel'), onPress: () => setD(null) }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={tab === 'suppliers' ? tr('ux.suppliers') : tr('ux.stockCount')} subtitle={salon?.name} onBack={onBack} right={tab === 'suppliers' ? <Circ icon="plus" violet label={tr('ux.supplierNew')} onPress={() => setD({ ...blank })} /> : undefined} />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 }}>
        <Chip label={tr('ux.suppliers')} active={tab === 'suppliers'} onPress={() => setTab('suppliers')} />
        <Chip label={tr('ux.stockCount')} active={tab === 'count'} onPress={() => setTab('count')} />
      </View>
      {tab === 'suppliers' ? (
        sup.error ? <ErrorState error={sup.error} onRetry={() => void sup.reload()} /> : sup.loading && !sup.data ? <Skeleton rows={3} height={96} /> : (
          <FlatList data={sup.data ?? []} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={sup.refreshing} onRefresh={() => void sup.reload()} tintColor={t.violet} />}
            ListEmptyComponent={<StateView icon="store" title={tr('ux.noSuppliers')} body={tr('ux.noSuppliersBody')} actionLabel={tr('ux.supplierNew')} onAction={() => setD({ ...blank })} />}
            renderItem={({ item: s }: { item: Supplier }) => (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 92, opacity: s.is_active === false ? 0.6 : 1 }}>
                <Pressable onPress={() => setD({ id: String(s.id), name: s.name, contact: s.contact_name ?? '', email: s.email ?? '', phone: s.phone ?? '', account: s.account_number ?? '', notes: s.notes ?? '', active: s.is_active !== false })} accessibilityRole="button" accessibilityLabel={s.name} noScale style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.x, fontSize: 22, color: t.vtext }}>{s.name.slice(0, 1).toUpperCase()}</Text></View>
                  <View style={{ flex: 1, gap: 2 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: t.ink }}>{s.name}</Text><Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{[s.contact_name, s.phone].filter(Boolean).join(' · ') || s.email || '—'}</Text>{s.is_active === false ? <Pill text={tr('team.inactive')} tone="muted" /> : null}</View>
                </Pressable>
                {s.phone ? <Pressable onPress={() => void Linking.openURL(`tel:${s.phone!.replace(/\s+/g, '')}`).catch(() => {})} accessibilityRole="button" accessibilityLabel={tr('common.call')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={22} color={t.vtext} /></Pressable> : null}
              </Card>
            )} />
        )
      ) : lv.error ? <ErrorState error={lv.error} onRetry={() => void lv.reload()} /> : lv.loading && !lv.data ? <Skeleton rows={5} height={84} /> : (
        <>
          <FlatList data={levels} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, gap: 10 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            ListHeaderComponent={<View style={{ gap: 12, marginBottom: 6 }}><HeroCard dark icon="box" title={tr('ux.stockCount')} sub={tr('ux.countHint')} stat={tr('ux.countProgress', { n: done, m: (lv.data ?? []).length })} /><SearchBar value={q} onChangeText={setQ} placeholder={tr('ux.searchProduct')} /></View>}
            ListEmptyComponent={<StateView icon="box" title={tr('ux.noStock')} />}
            renderItem={({ item: p }) => {
              const c = counted[String(p.id)] ?? '';
              const n = c === '' ? null : Math.max(0, Math.round(Number(c.replace(',', '.')) || 0));
              const delta = n == null ? 0 : n - Number(p.quantity_on_hand);
              return (
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                  <View style={{ flex: 1, gap: 2 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, letterSpacing: -0.2, color: t.ink }}>{p.name}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('ux.system')}: {p.quantity_on_hand}{p.sku ? ` · ${p.sku}` : ''}</Text></View>
                  {n != null && delta !== 0 ? <Pill text={`${delta > 0 ? '+' : ''}${delta}`} tone={delta > 0 ? 'ok' : 'guava'} /> : n != null ? <Icon name="check" size={20} color={t.ok} /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.fill, borderRadius: 24, padding: 3 }}>
                    <Pressable onPress={() => setCounted({ ...counted, [String(p.id)]: String(Math.max(0, (n ?? Number(p.quantity_on_hand)) - 1)) })} accessibilityRole="button" accessibilityLabel={`${p.name} -1`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={18} color={t.ink} /></Pressable>
                    <Text style={{ fontFamily: font.x, fontSize: 17, minWidth: 30, textAlign: 'center', color: n == null ? t.ink3 : t.ink }}>{n ?? '–'}</Text>
                    <Pressable onPress={() => setCounted({ ...counted, [String(p.id)]: String((n ?? Number(p.quantity_on_hand)) + 1) })} accessibilityRole="button" accessibilityLabel={`${p.name} +1`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} color={t.ink} /></Pressable>
                  </View>
                </Card>
              );
            }} />
          <StickyCta label={`${tr('ux.reviewCount')} · ${tr('ux.diffs', { n: diffs.length })}`} disabled={done === 0} onPress={() => setReview(true)} />
        </>
      )}
      <BottomSheet open={review} onClose={() => setReview(false)}>
        <View style={{ paddingBottom: 18, gap: 12 }}>
          <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink }}>{tr('ux.stockCount')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard label={tr('ux.countProgress', { n: done, m: (lv.data ?? []).length })} value={String(done)} />
            <StatCard label={tr('ux.diffs', { n: diffs.length })} value={String(diffs.length)} tone={diffs.length ? 'guava' : 'ok'} />
          </View>
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }}>
            {diffs.length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted, textAlign: 'center', padding: 18 }}>{tr('ux.noDiffs')}</Text> : diffs.map((x) => (
              <View key={String(x.p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.surface, borderRadius: 18, padding: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{x.p.name}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{x.p.quantity_on_hand} → {x.n}</Text>
                <Pill text={`${x.delta > 0 ? '+' : ''}${x.delta}`} tone={x.delta > 0 ? 'ok' : 'guava'} />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setReview(false)} />
            <Btn label={tr('ux.confirmCount')} style={{ flex: 1.4 }} loading={busy} disabled={diffs.length === 0} onPress={() => void confirm()} />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
