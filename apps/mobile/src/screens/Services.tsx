import { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Choice, MultiChoice, SectionTitle, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Chip, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX, type Category, type ServiceBody, type ServiceFull } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Tab = 'main' | 'price' | 'staff' | 'online' | 'settings';
const TABS: { k: Tab; label: 'sx.tabMain' | 'sx.tabPrice' | 'sx.tabStaff' | 'sx.tabOnline' | 'sx.tabSettings' }[] = [
  { k: 'main', label: 'sx.tabMain' }, { k: 'price', label: 'sx.tabPrice' }, { k: 'staff', label: 'sx.tabStaff' }, { k: 'online', label: 'sx.tabOnline' }, { k: 'settings', label: 'sx.tabSettings' },
];

/** Five-tab service editor (main, price, specialists, online booking, settings); `service` null = create. */
function Editor({ service, cats, onClose, onSaved }: { service: ServiceFull | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const staff = useLoad(() => api.staff(sid), [sid]);
  const [tab, setTab] = useState<Tab>('main');
  const [name, setName] = useState(service?.name ?? '');
  const [desc, setDesc] = useState(service?.description ?? '');
  const [cat, setCat] = useState<string>(service?.categoryId != null ? String(service.categoryId) : '');
  const [price, setPrice] = useState(service?.price != null ? String(service.price) : '');
  const [dur, setDur] = useState(service?.durationMinutes != null ? String(service.durationMinutes) : '60');
  const [ptype, setPtype] = useState<'FIXED' | 'FROM' | 'RANGE'>(service?.priceType ?? 'FIXED');
  const [deposit, setDeposit] = useState(service?.depositPercent != null ? String(service.depositPercent) : '');
  const [taxRate, setTaxRate] = useState(service?.taxRate != null ? String(service.taxRate) : '');
  const [ids, setIds] = useState<string[]>((service?.staffIds ?? []).map(String));
  const [visible, setVisible] = useState(service?.isVisible ?? true);
  const [padB, setPadB] = useState(String(service?.paddingBefore ?? 0));
  const [padA, setPadA] = useState(String(service?.paddingAfter ?? 0));
  const [interval, setInterval_] = useState(String(service?.bookingInterval ?? 0));
  const [parallel, setParallel] = useState(String(service?.parallelClients ?? 1));
  const [mobile, setMobile] = useState(service?.mobileService ?? false);
  const [msg, setMsg] = useState(service?.messageToClient ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    const p = num(price); const d = Math.round(num(dur));
    if (!name.trim() || !Number.isFinite(p) || p < 0 || !Number.isFinite(d) || d <= 0 || d > 720) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(tr('common.error'), tr('sx.needName'));
      setTab('main');
      return;
    }
    const dep = deposit.trim() === '' ? undefined : Math.min(100, Math.max(0, Math.round(num(deposit)) || 0));
    const body: ServiceBody = {
      name: name.trim(), description: desc.trim() || undefined, categoryId: cat || undefined, price: p, durationMinutes: d, priceType: ptype,
      staffIds: ids, isVisible: visible, paddingBefore: Math.max(0, Math.round(num(padB)) || 0), paddingAfter: Math.max(0, Math.round(num(padA)) || 0),
      bookingInterval: Math.max(0, Math.round(num(interval)) || 0), parallelClients: Math.max(0, Math.round(num(parallel)) || 0),
      mobileService: mobile, messageToClient: msg.trim() || null, depositPercent: dep ?? (service ? -1 : undefined),
      taxRate: taxRate.trim() === '' ? null : num(taxRate),
    };
    setBusy(true);
    try {
      if (service) await apiX.updateServiceFull(sid, service.id, body); else await apiX.createService(sid, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); onSaved();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally { setBusy(false); }
  }
  function archive() {
    if (!service) return;
    Alert.alert(tr('sx.archiveConfirm'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('sx.archive'), style: 'destructive', onPress: () => {
      void apiX.archiveService(sid, service.id).then(() => { bump(); onSaved(); }).catch((e: Error) => Alert.alert(tr('common.error'), e.message));
    } }]);
  }
  const pt = [{ value: 'FIXED' as const, label: tr('sx.fixed') }, { value: 'FROM' as const, label: tr('sx.from') }, { value: 'RANGE' as const, label: tr('sx.range') }];

  return (
    <Screen>
      <Header title={service ? tr('sx.editTitle') : tr('sx.newTitle')} subtitle={service?.name} onBack={onClose} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TABS.map((x) => <Chip key={x.k} label={tr(x.label)} active={tab === x.k} onPress={() => setTab(x.k)} />)}
      </ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {tab === 'main' ? (
          <>
            <Field label={tr('sx.name')} value={name} onChangeText={setName} autoCapitalize="sentences" />
            <Field label={tr('sx.description')} value={desc} onChangeText={setDesc} multiline style={{ minHeight: 84, paddingTop: 14, textAlignVertical: 'top' }} />
            <SectionTitle>{tr('sx.category')}</SectionTitle>
            <Choice value={cat} onChange={setCat} options={[{ value: '', label: tr('sx.noCategory') }, ...cats.map((c) => ({ value: String(c.id), label: c.name }))]} />
            <Field label={`${tr('svc.duration')} (${tr('common.min')})`} value={dur} onChangeText={setDur} keyboardType="number-pad" />
          </>
        ) : null}
        {tab === 'price' ? (
          <>
            <SectionTitle>{tr('sx.priceType')}</SectionTitle>
            <Choice value={ptype} onChange={setPtype} options={pt} />
            <Field label={`${tr('appt.price')} (${salon?.currency ?? 'AZN'})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            <Field label={tr('sx.deposit')} value={deposit} onChangeText={setDeposit} keyboardType="number-pad" />
            <Field label={tr('sx.tax')} value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" />
          </>
        ) : null}
        {tab === 'staff' ? (
          <>
            <SectionTitle>{tr('sx.pickStaff')}</SectionTitle>
            {staff.loading && !staff.data ? <Skeleton rows={2} height={44} /> : <MultiChoice value={ids} onChange={setIds} options={(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: String(s.id), label: s.name }))} />}
          </>
        ) : null}
        {tab === 'online' ? (
          <>
            <ToggleRow label={tr('sx.visible')} hint={tr('sx.visibleHint')} value={visible} onChange={setVisible} />
            <Field label={tr('sx.clientMessage')} value={msg} onChangeText={setMsg} multiline style={{ minHeight: 84, paddingTop: 14, textAlignVertical: 'top' }} />
          </>
        ) : null}
        {tab === 'settings' ? (
          <>
            <Field label={tr('sx.padBefore')} value={padB} onChangeText={setPadB} keyboardType="number-pad" />
            <Field label={tr('sx.padAfter')} value={padA} onChangeText={setPadA} keyboardType="number-pad" />
            <Field label={tr('sx.interval')} value={interval} onChangeText={setInterval_} keyboardType="number-pad" />
            <Field label={tr('sx.parallel')} value={parallel} onChangeText={setParallel} keyboardType="number-pad" />
            <ToggleRow label={tr('sx.mobile')} value={mobile} onChange={setMobile} />
            {service ? <Btn label={tr('sx.archive')} variant="danger" icon="trash" style={{ marginTop: 14 }} onPress={archive} /> : null}
          </>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => void save()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Category manager: add, hide/show, delete. */
function Categories({ cats, onBack, onChanged }: { cats: Category[]; onBack: () => void; onChanged: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); onChanged(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); } };
  return (
    <Screen>
      <Header title={tr('sx.categories')} onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 40 }}>
        <Field label={tr('sx.newCategory')} value={name} onChangeText={setName} autoCapitalize="sentences" />
        <Btn label={tr('common.save')} loading={busy} disabled={!name.trim()} onPress={() => void run(async () => { await apiX.createCategory(sid, { name: name.trim() }); setName(''); })} />
        {cats.map((c) => (
          <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: c.isVisible ? 1 : 0.6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{c.name}</Text>
              {c.serviceCount != null ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{c.serviceCount}</Text> : null}
            </View>
            <Pressable onPress={() => void run(() => apiX.updateCategory(sid, c.id, { isVisible: !c.isVisible }))} accessibilityRole="button" accessibilityLabel={c.isVisible ? tr('sx.hide') : tr('sx.show')}><Icon name={c.isVisible ? 'eye' : 'eyeoff'} size={22} color={t.vtext} /></Pressable>
            <Pressable onPress={() => Alert.alert(tr('sx.delCategory'), c.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => void run(() => apiX.deleteCategory(sid, c.id)) }])} accessibilityRole="button" accessibilityLabel={tr('sx.delCategory')}><Icon name="trash" size={22} color={t.gink} /></Pressable>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

/** Xidmətlər: list by category, on/off switch, add/edit (5 tabs), archive/restore, categories, packages. */
export function Services({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiX.servicesFull(sid), [sid]);
  const cats = useLoad(() => apiX.categories(sid).catch(() => [] as Category[]), [sid]);
  const [view, setView] = useState<'list' | 'edit' | 'cats' | 'archived' | 'packages'>('list');
  const [edit, setEdit] = useState<ServiceFull | null>(null);
  const [filter, setFilter] = useState('');
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const archived = useLoad(() => (view === 'archived' ? apiX.archivedServices(sid) : Promise.resolve([] as ServiceFull[])), [sid, view]);
  const pk = useLoad(() => (view === 'packages' ? apiX.packages(sid) : Promise.resolve([])), [sid, view]);
  const rows = useMemo(() => (list.data ?? []).filter((s) => !filter || String(s.categoryId ?? '') === filter).sort((a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? '') || a.name.localeCompare(b.name)), [list.data, filter]);

  async function toggle(s: ServiceFull, v: boolean) {
    setLocal((m) => ({ ...m, [s.id]: v }));
    try {
      await apiX.updateServiceFull(sid, s.id, { isActive: v });
      Haptics.selectionAsync().catch(() => {});
      bump();
      await list.reload();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setLocal((m) => { const { [s.id]: _d, ...rest } = m; return rest; });
    }
  }
  if (view === 'edit') return <Editor service={edit} cats={cats.data ?? []} onClose={() => setView('list')} onSaved={() => { setView('list'); void list.reload(); }} />;
  if (view === 'cats') return <Categories cats={cats.data ?? []} onBack={() => { setView('list'); void list.reload(); }} onChanged={() => void cats.reload()} />;
  if (view === 'archived' || view === 'packages') {
    const isArch = view === 'archived';
    return (
      <Screen>
        <Header title={isArch ? tr('sx.showArchived') : tr('sx.packages')} onBack={() => setView('list')} />
        <FlatList data={(isArch ? archived.data : pk.data) as { id: string; name?: string; serviceName?: string; sessions?: number; price?: number }[] ?? []} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={(isArch ? archived.loading : pk.loading) ? <Skeleton rows={3} /> : <StateView icon="scissors" title={isArch ? tr('lk.empty') : tr('sx.noPackages')} />}
          renderItem={({ item: s }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{s.name ?? s.serviceName}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{[s.sessions ? tr('sx.sessions', { n: s.sessions }) : null, money(s.price, salon?.currency)].filter(Boolean).join(' · ')}</Text>
              </View>
              {isArch ? <Btn label={tr('sx.restore')} variant="secondary" onPress={() => void apiX.restoreService(sid, s.id).then(() => { bump(); void archived.reload(); void list.reload(); }).catch((e: Error) => Alert.alert(tr('common.error'), e.message))} /> : null}
            </Card>
          )} />
      </Screen>
    );
  }
  const addBtn = <Pressable onPress={() => { setEdit(null); setView('edit'); }} accessibilityRole="button" accessibilityLabel={tr('sx.add')} haptic style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color="#fff" /></Pressable>;
  return (
    <Screen>
      <Header title={tr('sections.services')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Chip label={tr('cl.segAll')} active={filter === ''} onPress={() => setFilter('')} />
        {(cats.data ?? []).map((c) => <Chip key={c.id} label={c.name} active={filter === String(c.id)} onPress={() => setFilter(String(c.id))} />)}
        <Chip label={tr('sx.categories')} icon="edit" onPress={() => setView('cats')} />
        <Chip label={tr('sx.packages')} icon="gift" onPress={() => setView('packages')} />
        <Chip label={tr('sx.archived')} icon="box" onPress={() => setView('archived')} />
      </ScrollView>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={6} /> : (
        <FlatList initialNumToRender={12} windowSize={9} data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => { void list.reload(); void cats.reload(); }} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="scissors" title={tr('create.noServices')} actionLabel={tr('sx.add')} onAction={() => { setEdit(null); setView('edit'); }} />}
          renderItem={({ item: s }) => {
            const on = local[s.id] ?? s.isActive;
            return (
              <Card onPress={() => { setEdit(s); setView('edit'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: on ? 1 : 0.65 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{s.name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{[s.categoryName, s.durationMinutes ? `${s.durationMinutes} ${tr('common.min')}` : null, money(s.price, salon?.currency)].filter(Boolean).join(' · ')}</Text>
                  {s.isVisible === false ? <Pill text={tr('sx.tabOnline')} tone="muted" /> : null}
                </View>
                <Switch value={on} onValueChange={(v) => void toggle(s, v)} accessibilityLabel={s.name} trackColor={{ true: t.violet, false: t.fill2 }} />
              </Card>
            );
          }} />
      )}
    </Screen>
  );
}
