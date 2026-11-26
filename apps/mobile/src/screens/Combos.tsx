import React, { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Chip, Circ, ErrorState, Field, Header, HeroCard, Pill, Screen, Section, ServiceThumb, Skeleton, StateView, StickyCta, Toggle } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX, type ServiceFull } from '@/lib/api-ext';
import { apiM, type Combo, type ComboStep } from '@/lib/api-more';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Draft = { id: string | null; name: string; party: number; steps: { serviceId: string; staffId: string; parallel: boolean }[] };

/** Combo xidmətlər: several services bundled into one visit (backend "package services": ordered steps, optional fixed specialist, parallel steps, party size). */
export function Combos({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiM.combos(sid), [sid]);
  const svc = useLoad(() => apiX.servicesFull(sid), [sid]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string | number) => (svc.data ?? []).find((s) => String(s.id) === String(id))?.name ?? '';
  const comboIds = new Set((list.data ?? []).map((c) => String(c.serviceId)));
  const open = (c: Combo | null) => setD(c ? { id: String(c.serviceId), name: nameOf(c.serviceId), party: c.maxPartySize, steps: c.steps.map((s) => ({ serviceId: String(s.serviceId), staffId: s.staffId ? String(s.staffId) : '', parallel: !!s.parallel })) } : { id: null, name: '', party: 1, steps: [] });
  const total = (steps: Draft['steps']) => steps.reduce((n, s) => { const x = (svc.data ?? []).find((v) => String(v.id) === s.serviceId); return n + (x?.price ?? 0); }, 0);
  const minutes = (steps: Draft['steps']) => { let gs = 0; let ge = 0; steps.forEach((s, i) => { const m = (svc.data ?? []).find((v) => String(v.id) === s.serviceId)?.durationMinutes ?? 60; if (!(i > 0 && s.parallel)) gs = ge; ge = Math.max(ge, gs + m); }); return ge; };

  async function save() {
    if (!d || !d.name.trim() || d.steps.length === 0) { toast(d && !d.name.trim() ? tr('sx.needName') : tr('ux.needTwo'), 'error'); return; }
    setBusy(true);
    try {
      let id = d.id;
      const dur = Math.max(5, minutes(d.steps)); const price = total(d.steps);
      if (!id) { const c = await apiX.createService(sid, { name: d.name.trim(), price, durationMinutes: dur, priceType: 'FIXED', isVisible: true }); id = String((c as ServiceFull).id); }
      else await apiX.updateServiceFull(sid, id, { name: d.name.trim(), price, durationMinutes: dur });
      await apiM.saveCombo(id, sid, d.party, d.steps.map((s) => ({ serviceId: s.serviceId, staffId: s.staffId || null, parallel: s.parallel })));
      toast(tr('ux.comboSaved'), 'success'); setD(null); bump(); await list.reload(); await svc.reload();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function revert() {
    if (!d?.id) return;
    setBusy(true);
    try { await apiM.saveCombo(d.id, sid, 1, []); setD(null); bump(); await list.reload(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (d) {
    const choices = (svc.data ?? []).filter((s) => s.isActive && !comboIds.has(String(s.id)) && String(s.id) !== d.id && !s.isClass);
    return (
      <Screen>
        <Header title={d.id ? tr('ux.comboEdit') : tr('ux.comboNew')} subtitle={salon?.name} onBack={() => setD(null)} />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }}>
          <HeroCard dark icon="gift" title={d.name || tr('ux.comboNew')} sub={`${minutes(d.steps)} ${tr('common.min')} · ${tr('ux.people', { n: d.party })}`} stat={money(total(d.steps), salon?.currency)} statLabel={tr('ux.comboTotal')} />
          <Section title={tr('ux.secBasics')}>
            <Field label={tr('ux.comboName')} value={d.name} onChangeText={(v) => setD({ ...d, name: v })} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface, borderRadius: 24, padding: 14, paddingLeft: 18 }}>
              <Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{tr('ux.party')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.fill, borderRadius: 24, padding: 3 }}>
                <Pressable onPress={() => setD({ ...d, party: Math.max(1, d.party - 1) })} accessibilityRole="button" accessibilityLabel="-" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={18} color={t.ink} /></Pressable>
                <Text style={{ fontFamily: font.x, fontSize: 17, minWidth: 24, textAlign: 'center', color: t.ink }}>{d.party}</Text>
                <Pressable onPress={() => setD({ ...d, party: Math.min(6, d.party + 1) })} accessibilityRole="button" accessibilityLabel="+" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} color={t.ink} /></Pressable>
              </View>
            </View>
          </Section>
          <Section title={tr('ux.steps')}>
            {d.steps.map((s, i) => {
              const sv = (svc.data ?? []).find((v) => String(v.id) === s.serviceId);
              const able = (staff.data ?? []).filter((m) => m.isActive !== false && (!sv?.staffIds?.length || sv.staffIds.map(String).includes(String(m.id))));
              const move = (to: number) => { const a = [...d.steps]; const [x] = a.splice(i, 1); a.splice(to, 0, x); setD({ ...d, steps: a }); };
              return (
                <Card key={`${s.serviceId}-${i}`} style={{ gap: 10, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.x, fontSize: 14, color: '#fff' }}>{i + 1}</Text></View>
                    <ServiceThumb name={sv?.name ?? ''} cat={sv?.categoryName} size={44} />
                    <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16.5, color: t.ink }}>{sv?.name}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{sv?.durationMinutes} {tr('common.min')} · {money(sv?.price, salon?.currency)}</Text></View>
                    <Pressable onPress={() => i > 0 && move(i - 1)} accessibilityRole="button" accessibilityLabel="up" hitSlop={6} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: i ? 1 : 0.3 }}><Icon name="chevu" size={20} color={t.ink} /></Pressable>
                    <Pressable onPress={() => setD({ ...d, steps: d.steps.filter((_, j) => j !== i) })} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} hitSlop={6} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={20} color={t.gink} /></Pressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <Chip soft label={tr('ux.anyone')} active={!s.staffId} onPress={() => setD({ ...d, steps: d.steps.map((x, j) => (j === i ? { ...x, staffId: '' } : x)) })} />
                    {able.map((m) => <Chip key={m.id} soft label={m.name} avatar={<Avatar name={m.name} size={24} uri={m.avatarUrl} />} active={s.staffId === String(m.id)} onPress={() => setD({ ...d, steps: d.steps.map((x, j) => (j === i ? { ...x, staffId: String(m.id) } : x)) })} />)}
                  </ScrollView>
                  {i > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted, flex: 1 }}>{tr('ux.parallelStep')}</Text><Toggle on={s.parallel} onChange={(v) => setD({ ...d, steps: d.steps.map((x, j) => (j === i ? { ...x, parallel: v } : x)) })} label={tr('ux.parallelStep')} /></View> : null}
                </Card>
              );
            })}
            <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.muted }}>{tr('ux.addStep')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{choices.map((s) => <Chip key={String(s.id)} icon="plus" label={`${s.name} · ${money(s.price, salon?.currency)}`} onPress={() => setD({ ...d, steps: [...d.steps, { serviceId: String(s.id), staffId: '', parallel: false }] })} />)}</View>
          </Section>
          {d.id ? <Btn label={tr('ux.removeCombo')} variant="danger" loading={busy} onPress={() => void revert()} /> : null}
        </ScrollView>
        <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} secondary={{ label: tr('common.cancel'), onPress: () => setD(null) }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={tr('ux.combos')} subtitle={salon?.name} onBack={onBack} right={<Circ icon="plus" violet label={tr('ux.comboNew')} onPress={() => open(null)} />} />
      {list.error ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={3} height={150} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(c) => String(c.serviceId)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="gift" title={tr('ux.noCombos')} body={tr('ux.noCombosBody')} actionLabel={tr('ux.comboNew')} onAction={() => open(null)} />}
          renderItem={({ item: c }) => (
            <Card onPress={() => open(c)} style={{ gap: 12, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <ServiceThumb name={nameOf(c.serviceId)} cat="gift" size={56} />
                <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 19, letterSpacing: -0.4, color: t.ink }}>{nameOf(c.serviceId) || c.steps.map((s) => s.serviceName).join(' + ')}</Text><Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{c.totalDurationMinutes} {tr('common.min')} · {tr('ux.people', { n: c.maxPartySize })}</Text></View>
                <Text style={{ fontFamily: font.x, fontSize: 20, color: t.ink }}>{money(c.totalPrice, salon?.currency)}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{c.steps.map((s: ComboStep, i) => <Pill key={i} text={`${i + 1}. ${s.serviceName}${s.parallel ? ' ∥' : ''}`} tone="violet" />)}</View>
            </Card>
          )} />
      )}
    </Screen>
  );
}
