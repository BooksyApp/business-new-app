import { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Choice, MultiChoice, SectionTitle, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Chip, Circ, ErrorState, Field, Header, HeroCard, Pill, Screen, ServiceThumb, Skeleton, StateView, StickyCta, Toggle } from '@/components/ui';
import { BackBar, Chip as KChip, ChipRow, EmptyState, IconBtn, ListItem, Pill as KPill, PhotoRow, SecHead, Skeleton as KSkel, Title } from '@/components/kit';
import { DEMO_IMG } from '@/demo/photos';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiB, type PeakRule } from '@/lib/api-biz';
import { apiX, type Category, type ServiceBody, type ServiceFull } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { Addons, Packages } from '@/screens/ServiceExtras';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Tab = 'main' | 'price' | 'staff' | 'online' | 'settings';
const TABS: { k: Tab; label: 'sx.tabMain' | 'sx.tabPrice' | 'sx.tabStaff' | 'sx.tabOnline' | 'sx.tabSettings' }[] = [
  { k: 'main', label: 'sx.tabMain' }, { k: 'price', label: 'sx.tabPrice' }, { k: 'staff', label: 'sx.tabStaff' }, { k: 'online', label: 'sx.tabOnline' }, { k: 'settings', label: 'sx.tabSettings' },
];

/** Five-tab service editor (main, price, specialists, online booking, settings); `service` null = create. */
function Editor({ service, cats, onClose, onSaved }: { service: ServiceFull | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTheme();
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
  const [isClass, setIsClass] = useState(service?.isClass ?? false);
  const [maxP, setMaxP] = useState(service?.maxParticipants != null ? String(service.maxParticipants) : '8');
  const [msg, setMsg] = useState(service?.messageToClient ?? '');
  const [busy, setBusy] = useState(false);
  const peak = useLoad(() => (service ? apiB.peak(sid, service.id).catch(() => [] as PeakRule[]) : Promise.resolve([] as PeakRule[])), [service?.id]);
  const [rules, setRules] = useState<PeakRule[] | null>(null);
  const [pw, setPw] = useState('5'); const [pf, setPf] = useState('17:00'); const [pto, setPto] = useState('20:00'); const [pp, setPp] = useState('20');
  const peakList = rules ?? peak.data ?? [];

  async function save() {
    const p = num(price); const d = Math.round(num(dur));
    if (!name.trim() || !Number.isFinite(p) || p < 0 || !Number.isFinite(d) || d <= 0 || d > 720) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      toast(tr('sx.needName'), 'error');
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
      isClass, maxParticipants: isClass ? Math.max(1, Math.round(num(maxP)) || 1) : undefined,
    };
    setBusy(true);
    try {
      if (service) { await apiX.updateServiceFull(sid, service.id, body); if (rules) await apiB.savePeak(sid, service.id, rules); } else await apiX.createService(sid, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally { setBusy(false); }
  }
  function archive() {
    if (!service) return;
    Alert.alert(tr('sx.archiveConfirm'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('sx.archive'), style: 'destructive', onPress: () => {
      void apiX.archiveService(sid, service.id).then(() => { bump(); onSaved(); }).catch((e: Error) => toast(e.message, 'error'));
    } }]);
  }
  const pt = [{ value: 'FIXED' as const, label: tr('sx.fixed') }, { value: 'FROM' as const, label: tr('sx.from') }, { value: 'RANGE' as const, label: tr('sx.range') }];

  return (
    <Screen>
      <Header title={service ? tr('sx.editTitle') : tr('sx.newTitle')} subtitle={service?.name} onBack={onClose} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginBottom: 12 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {TABS.map((x) => <Chip key={x.k} label={tr(x.label)} active={tab === x.k} onPress={() => setTab(x.k)} />)}
      </ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}>
        <View style={{ marginBottom: 14 }}>
          <HeroCard icon="scissors" title={name || tr('sx.newTitle')} sub={[cats.find((c) => String(c.id) === cat)?.name, dur ? `${dur} ${tr('common.min')}` : null].filter(Boolean).join(' · ')} stat={price ? money(num(price) || 0, salon?.currency) : undefined} />
        </View>
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
            {service ? (
              <>
                <SectionTitle>{tr('ad.peak')}</SectionTitle>
                <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 6 }}>{tr('ad.peakHint')}</Text>
                {peakList.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{r.weekday} · {r.startTime.slice(0, 5)}-{r.endTime.slice(0, 5)} · +{r.percent}%</Text>
                    <Pressable onPress={() => setRules(peakList.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Field label={tr('ad.weekday')} value={pw} onChangeText={setPw} keyboardType="number-pad" maxLength={1} /></View>
                  <View style={{ flex: 1.4 }}><Field label="→" value={pf} onChangeText={setPf} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
                  <View style={{ flex: 1.4 }}><Field label=" " value={pto} onChangeText={setPto} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
                  <View style={{ flex: 1 }}><Field label={tr('ad.percent')} value={pp} onChangeText={setPp} keyboardType="number-pad" /></View>
                </View>
                <Btn label={tr('ad.addRule')} variant="secondary" icon="plus" onPress={() => { const w = Number(pw); const p = Number(pp); if (!(w >= 1 && w <= 7) || !/^\d{2}:\d{2}$/.test(pf) || !/^\d{2}:\d{2}$/.test(pto) || pto <= pf || !(p > 0)) { toast(tr('hr.badTime'), 'error'); return; } setRules([...peakList, { weekday: w, startTime: pf, endTime: pto, percent: p }]); }} />
              </>
            ) : null}
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
            <ToggleRow label={tr('ux.isClass')} value={isClass} onChange={setIsClass} />
            {isClass ? <Field label={tr('ux.maxP')} value={maxP} onChangeText={setMaxP} keyboardType="number-pad" /> : null}
            {service ? <Btn label={tr('sx.archive')} variant="danger" icon="trash" style={{ marginTop: 14 }} onPress={archive} /> : null}
          </>
        ) : null}
      </ScrollView>
      <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} secondary={{ label: tr('common.cancel'), onPress: onClose }} />
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
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); onChanged(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } };
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
  const router = useRouter();
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiX.servicesFull(sid), [sid]);
  const cats = useLoad(() => apiX.categories(sid).catch(() => [] as Category[]), [sid]);
  const [view, setView] = useState<'list' | 'edit' | 'cats' | 'archived' | 'packages' | 'addons'>('list');
  const [edit, setEdit] = useState<ServiceFull | null>(null);
  const [filter, setFilter] = useState('');
  const quick = useLoad(() => apiB.quickSale(sid).catch(() => []), [sid]);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const archived = useLoad(() => (view === 'archived' ? apiX.archivedServices(sid) : Promise.resolve([] as ServiceFull[])), [sid, view]);
  const rows = useMemo(() => (list.data ?? []).filter((s) => !filter || String(s.categoryId ?? '') === filter).sort((a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? '') || a.name.localeCompare(b.name)), [list.data, filter]);

  async function toggle(s: ServiceFull, v: boolean) {
    setLocal((m) => ({ ...m, [s.id]: v }));
    try {
      await apiX.updateServiceFull(sid, s.id, { isActive: v });
      Haptics.selectionAsync().catch(() => {});
      bump();
      await list.reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLocal((m) => { const { [s.id]: _d, ...rest } = m; return rest; });
    }
  }
  if (view === 'edit') return <Editor service={edit} cats={cats.data ?? []} onClose={() => setView('list')} onSaved={() => { setView('list'); void list.reload(); }} />;
  if (view === 'cats') return <Categories cats={cats.data ?? []} onBack={() => { setView('list'); void list.reload(); }} onChanged={() => void cats.reload()} />;
  if (view === 'packages') return <Packages onBack={() => setView('list')} />;
  if (view === 'addons') return <Addons onBack={() => setView('list')} />;
  if (view === 'archived') {
    const isArch = true;
    return (
      <Screen>
        <Header title={isArch ? tr('sx.showArchived') : tr('sx.packages')} onBack={() => setView('list')} />
        <FlatList data={archived.data as { id: string; name?: string; serviceName?: string; sessions?: number; price?: number }[] ?? []} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}
          ListEmptyComponent={archived.loading ? <Skeleton rows={3} /> : <StateView icon="scissors" title={isArch ? tr('lk.empty') : tr('sx.noPackages')} />}
          renderItem={({ item: s }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{s.name ?? s.serviceName}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{[s.sessions ? tr('sx.sessions', { n: s.sessions }) : null, money(s.price, salon?.currency)].filter(Boolean).join(' · ')}</Text>
              </View>
              {isArch ? <Btn label={tr('sx.restore')} variant="secondary" onPress={() => void apiX.restoreService(sid, s.id).then(() => { bump(); void archived.reload(); void list.reload(); }).catch((e: Error) => toast(e.message, 'error'))} /> : null}
            </Card>
          )} />
      </Screen>
    );
  }
  const addBtn = <IconBtn icon="plus" label={tr('sx.add')} onPress={() => { setEdit(null); setView('edit'); }} />;
  const more: [string, string, () => void][] = [['gift', tr('ux.combos'), () => router.push('/section/combos')], ['edit', tr('sx.categories'), () => setView('cats')], ['gift', tr('sx.packages'), () => setView('packages')], ['plus', tr('ad.addons'), () => setView('addons')], ['box', tr('sx.archived'), () => setView('archived')]];
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} right={addBtn} />
      <Title sub={`${(rows ?? []).length} ${tr('v3.servicesN')} · ${(cats.data ?? []).length} ${tr('v3.catsN')}`} style={{ paddingBottom: 12 }}>{tr('sections.services')}</Title>
      <ChipRow style={{ marginBottom: 8 }}>
        <KChip label={tr('v2.all')} on={filter === ''} onPress={() => setFilter('')} />
        {(cats.data ?? []).map((c) => <KChip key={c.id} label={c.name} on={filter === String(c.id)} onPress={() => setFilter(String(c.id))} />)}
      </ChipRow>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <KSkel blocks={[{ h: 90 }, { h: 90 }, { h: 90 }, { h: 90 }]} /> : (
        <FlatList initialNumToRender={12} windowSize={9} data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => { void list.reload(); void cats.reload(); }} tintColor={t.violet} />}
          ListEmptyComponent={<EmptyState photo={DEMO_IMG['p3997381']} title={tr('create.noServices')} action={{ label: tr('sx.add'), icon: 'plus', onPress: () => { setEdit(null); setView('edit'); } }} />}
          ListFooterComponent={<View style={{ marginTop: 18, marginHorizontal: 20 }}><SecHead title={tr('v3.more')} style={{ marginHorizontal: 0, marginTop: 8 }} />{more.map(([ic, l, fn], i) => <ListItem key={l} first={i === 0} title={l} onPress={fn} lead={<Icon name={ic} size={20} color={t.ink} />} right={<Icon name="chev" size={16} color={t.ink3} />} />)}</View>}
          renderItem={({ item: s, index }) => {
            const on = local[s.id] ?? s.isActive;
            const isQuick = (quick.data ?? []).some((q) => String(q.serviceId) === String(s.id));
            const toggleQuick = () => { const ids = (quick.data ?? []).map((q) => String(q.serviceId)); const next = ids.includes(String(s.id)) ? ids.filter((x) => x !== String(s.id)) : [...ids, String(s.id)]; void apiB.setQuickSale(sid, next).then(() => quick.reload()).catch((e: Error) => toast(e.message, 'error')); };
            return (
              <View style={{ opacity: on ? 1 : 0.6 }}>
                <PhotoRow first={index === 0} photo={(s as { imageUrl?: string }).imageUrl} title={s.name} onPress={() => { setEdit(s); setView('edit'); }}
                  chips={<>
                    {s.durationMinutes ? <KPill icon="clock" text={`${s.durationMinutes} ${tr('common.min')}`} /> : null}
                    {s.categoryName ? <KPill text={s.categoryName} /> : null}
                    {s.isVisible === false ? <KPill text={tr('sx.tabOnline')} tone="fl" /> : null}
                  </>}
                  right={<View style={{ alignItems: 'flex-end', gap: 10 }}>
                    <Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{money(s.price, salon?.currency)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Pressable onPress={toggleQuick} accessibilityRole="button" accessibilityLabel={tr('sl.quick')} accessibilityState={{ selected: isQuick }} hitSlop={10}><Icon name="star" size={20} color={isQuick ? t.star : t.faint} filled={isQuick} /></Pressable>
                      <Toggle on={on} onChange={(v) => void toggle(s, v)} label={s.name} />
                    </View>
                  </View>} />
              </View>
            );
          }} />
      )}
    </Screen>
  );
}
