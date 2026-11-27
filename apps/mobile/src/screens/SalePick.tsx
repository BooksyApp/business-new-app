import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Chip, ChipRow, Segmented, T } from '@/components/kit';
import { SearchBar, ServiceThumb } from '@/components/ui';
import { t as tr } from '@/i18n';
import type { ClientWithStats, Service } from '@/lib/api';
import type { Membership, Product } from '@/lib/api-biz';
import type { Pkg } from '@/lib/api-biz';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

export type PickItem = { id: string; name: string; price: number; product: boolean };
type Row = PickItem & { sub?: string; cat?: string };

/** "+" that turns into a (- n +) stepper once the item is in the cart. */
function Stepper({ n, onChange, label }: { n: number; onChange: (d: number) => void; label: string }) {
  const { t } = useTheme();
  if (!n) {
    return (
      <Pressable onPress={() => onChange(1)} accessibilityRole="button" accessibilityLabel={`${label} +1`} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={18} color="#fff" />
      </Pressable>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.fill, borderRadius: 18, padding: 2 }}>
      <Pressable onPress={() => onChange(-1)} accessibilityRole="button" accessibilityLabel={`${label} -1`} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={16} color={t.ink} /></Pressable>
      <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, minWidth: 18, textAlign: 'center' }}>{n}</Text>
      <Pressable onPress={() => onChange(1)} accessibilityRole="button" accessibilityLabel={`${label} +1`} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={16} color={t.ink} /></Pressable>
    </View>
  );
}

/** Service / product picker: segment, search, category chips, "recently sold", a virtualised list with +/stepper and (in the caller) a sticky cart bar. */
export function ItemPicker({ services, products, recent, qty, onChange, cur }: {
  services: Service[]; products: Product[]; recent: { serviceId: string | number; serviceName: string; price?: number }[];
  qty: (id: string, product: boolean) => number; onChange: (it: PickItem, d: number) => void; cur?: string;
}) {
  const { t } = useTheme();
  const [seg, setSeg] = useState<'svc' | 'prod'>('svc');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const svcRows: Row[] = useMemo(() => services.filter((s) => s.isActive !== false).map((s) => ({ id: String(s.id), name: s.name, price: s.price ?? 0, product: false, cat: s.categoryName ?? '', sub: s.durationMinutes ? `${s.durationMinutes} ${tr('common.min')}` : undefined })), [services]);
  const prodRows: Row[] = useMemo(() => products.filter((p) => p.isActive !== false).map((p) => ({ id: String(p.id), name: p.name, price: p.price ?? 0, product: true, sub: p.quantityOnHand != null ? tr('sp.stock', { n: p.quantityOnHand }) : undefined })), [products]);
  const cats = useMemo(() => Array.from(new Set(svcRows.map((r) => r.cat).filter(Boolean) as string[])), [svcRows]);
  const base = seg === 'svc' ? svcRows : prodRows;
  const needle = q.trim().toLowerCase();
  const rows = base.filter((r) => (seg !== 'svc' || !cat || r.cat === cat) && (!needle || r.name.toLowerCase().includes(needle)));
  const showRecent = seg === 'svc' && !needle && !cat && recent.length > 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 8 }}>
        <Segmented items={[{ k: 'svc' as const, label: tr('sp.services') }, { k: 'prod' as const, label: tr('sp.products') }]} value={seg} onChange={(k) => { setSeg(k); setCat(''); }} />
        <SearchBar value={q} onChangeText={setQ} placeholder={tr('sp.search')} />
      </View>
      {seg === 'svc' && cats.length > 1 ? (
        <ChipRow style={{ marginBottom: 6 }}>
          <Chip label={tr('sp.all')} on={!cat} onPress={() => setCat('')} />
          {cats.map((c) => <Chip key={c} label={c} on={cat === c} onPress={() => setCat(cat === c ? '' : c)} />)}
        </ChipRow>
      ) : null}
      <FlatList
        data={rows} keyExtractor={(r) => `${r.product ? 'p' : 's'}${r.id}`} initialNumToRender={14} windowSize={9} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
        ListHeaderComponent={showRecent ? (
          <View style={{ marginBottom: 6 }}>
            <T k="h3" style={{ marginBottom: 8 }}>{tr('sp.recent')}</T>
            <ChipRow style={{ marginHorizontal: -20 }}>
              {recent.slice(0, 8).map((r, i) => <Chip key={`r${r.serviceId}-${i}`} label={`${r.serviceName} · ${money(r.price, cur)}`} onPress={() => onChange({ id: String(r.serviceId), name: r.serviceName, price: r.price ?? 0, product: false }, 1)} />)}
            </ChipRow>
          </View>
        ) : null}
        ListEmptyComponent={<T k="sm" color={t.muted} style={{ textAlign: 'center', paddingVertical: 40 }}>{tr('sp.noRows')}</T>}
        renderItem={({ item: r, index }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: index ? 1 : 0, borderTopColor: t.hair }}>
            <ServiceThumb name={r.name} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T k="t1" lines={2}>{r.name}</T>
              <T k="xs" color={t.muted} lines={1}>{[money(r.price, cur), r.sub].filter(Boolean).join(' · ')}</T>
            </View>
            <Stepper n={qty(r.id, r.product)} onChange={(d) => onChange(r, d)} label={r.name} />
          </View>
        )}
      />
    </View>
  );
}

/** Client search + pick (needed to attach a package / membership to someone). */
export function ClientSelect({ clients, value, onChange }: { clients: ClientWithStats[]; value: ClientWithStats | null; onChange: (c: ClientWithStats | null) => void }) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const nm = (c: ClientWithStats) => `${c.firstName} ${c.lastName ?? ''}`.trim();
  const list = needle ? clients.filter((c) => nm(c).toLowerCase().includes(needle) || (c.phone ?? '').includes(needle)).slice(0, 6) : [];
  if (value) {
    return (
      <Pressable onPress={() => onChange(null)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: 14, backgroundColor: t.vsoft, paddingHorizontal: 14 }}>
        <Icon name="check" size={18} color={t.vtext} />
        <T k="t1" lines={1} style={{ flex: 1 }}>{nm(value)}</T>
        <Icon name="x" size={16} color={t.muted} />
      </Pressable>
    );
  }
  return (
    <View>
      <SearchBar value={q} onChangeText={setQ} placeholder={tr('sp.clientSearch')} />
      {list.map((c) => (
        <Pressable key={String(c.id)} onPress={() => onChange(c)} accessibilityRole="button" style={{ minHeight: 46, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: t.hair }}>
          <T k="t1" lines={1}>{nm(c)}</T>
          {c.phone ? <T k="xs" color={t.muted}>{c.phone}</T> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Selectable plan / package row. */
export function PlanRow({ title, sub, price, on, onPress, cur }: { title: string; sub?: string; price: number; on?: boolean; onPress?: () => void; cur?: string }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} noScale
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 16, backgroundColor: t.surface, borderWidth: on ? 2 : 1, borderColor: on ? t.ink : t.hair }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T k="t1" lines={2}>{title}</T>
        {sub ? <T k="xs" color={t.muted}>{sub}</T> : null}
      </View>
      <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{money(price, cur)}</Text>
    </Pressable>
  );
}

export function planSub(p: Pkg): string { return [tr('sp.sessionsN', { n: p.sessions_total })].join(' · '); }
export function memberSub(m: Membership): string {
  return [m.billing_period_months ? tr('sp.monthsN', { n: m.billing_period_months }) : '', m.discount_percent ? tr('sp.discountN', { n: m.discount_percent }) : '', m.included_sessions ? tr('sp.inclN', { n: m.included_sessions }) : ''].filter(Boolean).join(' · ');
}
