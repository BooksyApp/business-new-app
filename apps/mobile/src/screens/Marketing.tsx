import { useEffect, useState, type ReactNode } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, Line, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Screen, Skeleton, StateView, Toggle } from '@/components/ui';
import { Button, EmptyState, ListItem, Pill as KPill } from '@/components/kit';
import { PromoteSheet } from '@/components/PromoteSheet';
import { t as tr } from '@/i18n';
import { apiB, type Automation } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const SEGMENTS = ['ALL_CLIENTS', 'LAPSED_60D', 'LAPSED_90D', 'TOP_SPENDERS', 'BIRTHDAY_THIS_MONTH'] as const;
type View_ = 'home' | 'campaigns' | 'promos' | 'auto' | 'members' | 'loyalty' | 'refs';
type Sheet_ = null | 'camp' | 'promo' | 'member' | 'tier';

/**
 * Marketinq. Two levels only: a landing list of tools, then one flat screen per tool (its list + one "Yeni ..." button).
 * Creating opens exactly one BottomSheet with the needed fields and one Save; its errors are shown inline.
 */
export function Marketing({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [view, setView] = useState<View_>('home');
  const [sheet, setSheet] = useState<Sheet_>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const camps = useLoad(() => apiB.campaigns(sid), [sid]);
  const promos = useLoad(() => apiB.promos(sid), [sid]);
  const auto = useLoad(() => (view === 'auto' ? apiB.automation(sid).catch(() => null) : Promise.resolve(null)), [sid, view]);
  const [au, setAu] = useState<Automation | null>(null);
  useEffect(() => { if (auto.data) setAu(auto.data); }, [auto.data]);
  const mem = useLoad(() => (view === 'members' ? apiB.memberships(sid).catch(() => []) : Promise.resolve([])), [sid, view]);
  const refs = useLoad(() => (view === 'refs' ? Promise.all([apiB.refCodes(sid).catch(() => []), apiB.refStats(sid).catch(() => null)]) : Promise.resolve(null)), [sid, view]);
  const loy = useLoad(() => (view === 'loyalty' ? apiB.loyaltySettings(sid).catch(() => null) : Promise.resolve(null)), [sid, view]);
  const tiers = useLoad(() => (view === 'loyalty' ? apiB.tiers(sid).catch(() => []) : Promise.resolve([])), [sid, view]);
  const [lp, setLp] = useState(''); const [lv, setLv] = useState('');
  useEffect(() => { if (loy.data) { setLp(loy.data.pointsPerUnit != null ? String(loy.data.pointsPerUnit) : ''); setLv(loy.data.visitsForReward != null ? String(loy.data.visitsForReward) : ''); } }, [loy.data]);
  const [tn, setTn] = useState(''); const [tpts, setTpts] = useState(''); const [tb, setTb] = useState('');
  const [mn, setMn] = useState(''); const [mp, setMp] = useState(''); const [mm, setMm] = useState('1'); const [md, setMd] = useState('0'); const [ms, setMs] = useState('0');
  const [name, setName] = useState(''); const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL'); const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>('ALL_CLIENTS');
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [code, setCode] = useState(''); const [ptype, setPtype] = useState<'PERCENT' | 'FIXED'>('PERCENT'); const [value, setValue] = useState(''); const [uses, setUses] = useState('');
  const aud = useLoad(() => (sheet === 'camp' ? apiB.audience(sid, seg, channel).catch(() => null) : Promise.resolve(null)), [sid, sheet, seg, channel]);
  const openSheet = (s: Sheet_) => { setErr(null); setSheet(s); };
  const closeSheet = () => { setSheet(null); setErr(null); };
  const run = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true); setErr(null);
    try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after(); }
    catch (e) { const m = (e as Error).message; if (sheet) setErr(m); else toast(m, 'error'); }
    finally { setBusy(false); }
  };
  const confirmSend = (c: { id: string | number; name: string }) => Alert.alert(tr('mk.sendConfirm'), c.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('mk.send'), onPress: () => void run(() => apiB.queueCampaign(sid, c.id as never), () => void camps.reload()) }]);
  const tile = (icon: string) => <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={t.ink} /></View>;
  const goBack = () => { if (view === 'home') onBack(); else setView('home'); };
  const activePromos = (promos.data ?? []).filter((p) => p.active).length;
  const pad = { paddingHorizontal: 20, paddingBottom: 40, gap: 10 } as const;
  const sub15 = { fontFamily: font.s, fontSize: 15, color: t.ink } as const;
  const newBtn = (label: string, onPress: () => void) => <Button kind="pr" icon="plus" label={label} onPress={onPress} block style={{ marginBottom: 6 }} />;
  const errLine = err ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.gink, marginBottom: 8 }}>{err}</Text> : null;
  const sheetTitle = (s: string) => <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 20, color: t.ink, marginBottom: 14 }}>{s}</Text>;

  const title = view === 'campaigns' ? tr('mk.campaigns') : view === 'promos' ? tr('mk.promos') : view === 'auto' ? tr('mk.auto') : view === 'members' ? tr('x3.memberships') : view === 'loyalty' ? tr('x3.loyalty') : view === 'refs' ? tr('x3.referrals') : tr('mk.title');
  const q = view === 'campaigns' ? camps : view === 'promos' ? promos : view === 'members' ? mem : view === 'refs' ? refs : view === 'auto' ? auto : null;

  let content: ReactNode;
  if (view === 'home') {
    const rows: { k: View_ | 'ads'; icon: string; title: string; sub: string }[] = [
      { k: 'campaigns', icon: 'mail', title: tr('mk.campaigns'), sub: camps.data ? tr('mk.sumCamps', { n: camps.data.length }) : tr('mk.campsSub') },
      { k: 'promos', icon: 'tag', title: tr('mk.promos'), sub: promos.data ? tr('mk.sumPromos', { n: activePromos }) : tr('mk.promosSub') },
      { k: 'auto', icon: 'spark', title: tr('mk.auto'), sub: tr('mk.autoSub') },
      { k: 'members', icon: 'crown', title: tr('x3.memberships'), sub: tr('mk.memSub') },
      { k: 'loyalty', icon: 'star', title: tr('x3.loyalty'), sub: tr('mk.loySub') },
      { k: 'refs', icon: 'share', title: tr('x3.referrals'), sub: tr('mk.refsSub') },
      { k: 'ads', icon: 'send', title: tr('v3.adsRow'), sub: tr('v3.adsRowSub') },
    ];
    content = (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {rows.map((r, i) => (
          <ListItem key={r.k} first={i === 0} title={r.title} sub={r.sub} lead={tile(r.icon)}
            right={r.k === 'ads' ? <KPill text={tr('v3.paid')} /> : <Icon name="chev" size={18} color={t.muted} />}
            onPress={() => (r.k === 'ads' ? setPromoOpen(true) : setView(r.k))} />
        ))}
      </ScrollView>
    );
  } else if (q && q.error && !q.data) {
    content = <ErrorState error={q.error} onRetry={() => void q.reload()} />;
  } else if (q && q.loading && !q.data) {
    content = <Skeleton rows={4} />;
  } else if (view === 'campaigns') {
    content = (
      <FlatList data={camps.data ?? []} keyExtractor={(c) => String(c.id)} contentContainerStyle={pad}
        refreshControl={<RefreshControl refreshing={camps.refreshing} onRefresh={() => void camps.reload()} tintColor={t.violet} />}
        ListHeaderComponent={newBtn(tr('mk.add'), () => openSheet('camp'))}
        ListEmptyComponent={<EmptyState photo={'demo:f05'} title={tr('mk.empty')} body={tr('mk.emptyBody')} style={{ marginHorizontal: 0 }} />}
        renderItem={({ item: c, index }) => (
          <ListItem first={index === 0} title={c.name} sub={`${tr(`mk.seg.${c.segment}` as 'mk.seg.ALL_CLIENTS')} · ${c.channel} · ${c.status === 'SENT' ? (c.sentCount ?? c.recipientCount) : c.recipientCount}`}
            lead={tile(c.channel === 'SMS' ? 'chat' : 'mail')}
            right={c.status === 'DRAFT' ? <Button size="sm" kind="fl" label={tr('mk.send')} loading={busy} onPress={() => confirmSend(c)} /> : <KPill text={c.status === 'SENT' ? tr('v3.sent') : c.status} tone={c.status === 'SENT' ? 'ok' : c.status === 'FAILED' ? 'g' : 'fl'} />} />
        )} />
    );
  } else if (view === 'promos') {
    content = (
      <FlatList data={promos.data ?? []} keyExtractor={(c) => String(c.id)} contentContainerStyle={pad}
        refreshControl={<RefreshControl refreshing={promos.refreshing} onRefresh={() => void promos.reload()} tintColor={t.violet} />}
        ListHeaderComponent={newBtn(tr('mk.addPromo'), () => openSheet('promo'))}
        ListEmptyComponent={<StateView icon="tag" title={tr('mk.noPromos')} />}
        renderItem={({ item: c, index }) => (
          <ListItem first={index === 0} title={c.code} sub={`${c.type === 'PERCENT' ? `${c.value}%` : money(c.value, salon?.currency)} · ${c.uses}${c.max_uses ? ` / ${c.max_uses}` : ''}`} lead={tile('tag')}
            right={c.active ? <Pressable onPress={() => void run(() => apiB.deactivatePromo(sid, c.id), () => void promos.reload())} accessibilityRole="button" accessibilityLabel={tr('mk.deactivate')}><Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13, color: t.gink }}>{tr('mk.deactivate')}</Text></Pressable> : <KPill text="—" />} />
        )} />
    );
  } else if (view === 'auto') {
    content = (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {au ? (
          <View style={{ gap: 12 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{tr('mk.sent30', { n: au.sentLast30Days })}</Text>
            <Card style={{ gap: 4 }}>
              <ToggleRow label={tr('mk.birthday')} hint={tr('mk.birthdayHint')} value={au.birthdayEnabled} onChange={(v) => setAu({ ...au, birthdayEnabled: v })} />
              {au.birthdayEnabled ? <Field label={tr('mk.daysBefore')} value={String(au.birthdayDaysBefore)} onChangeText={(v) => setAu({ ...au, birthdayDaysBefore: Math.max(0, Math.round(num(v)) || 0) })} keyboardType="number-pad" /> : null}
            </Card>
            <Card style={{ gap: 4 }}>
              <ToggleRow label={tr('mk.winback')} hint={tr('mk.winbackHint')} value={au.winbackEnabled} onChange={(v) => setAu({ ...au, winbackEnabled: v })} />
              {au.winbackEnabled ? <Field label={tr('mk.daysAfter')} value={String(au.winbackDaysAfter)} onChangeText={(v) => setAu({ ...au, winbackDaysAfter: Math.max(1, Math.round(num(v)) || 1) })} keyboardType="number-pad" /> : null}
            </Card>
            <Btn label={tr('common.save')} loading={busy} onPress={() => void run(() => { const { sentLast30Days: _s, ...rest } = au; return apiB.saveAutomation(sid, rest); }, () => void auto.reload())} />
          </View>
        ) : null}
      </ScrollView>
    );
  } else if (view === 'members') {
    content = (
      <FlatList data={mem.data ?? []} keyExtractor={(m) => String(m.id)} contentContainerStyle={pad}
        ListHeaderComponent={newBtn(tr('mk.newMem'), () => openSheet('member'))}
        ListEmptyComponent={<StateView icon="crown" title={tr('x3.noMemberships')} />}
        renderItem={({ item: m, index }) => (
          <View style={{ opacity: m.active ? 1 : 0.6 }}>
            <ListItem first={index === 0} title={m.name} sub={`${money(m.price, salon?.currency)} / ${m.billing_period_months} · -${m.discount_percent}% · ${tr('sx.sessions', { n: m.included_sessions })}`} lead={tile('crown')}
              right={<Toggle on={m.active} onChange={(v) => void run(() => apiB.setMembershipActive(sid, m, v), () => void mem.reload())} label={m.name} />} />
          </View>
        )} />
    );
  } else if (view === 'loyalty') {
    content = (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pad}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('x3.pointsPerUnit')} value={lp} onChangeText={setLp} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label={tr('x3.visitsForReward')} value={lv} onChangeText={setLv} keyboardType="number-pad" /></View>
        </View>
        <Btn label={tr('common.save')} loading={busy} onPress={() => void run(() => apiB.saveLoyalty(sid, { pointsPerUnit: lp.trim() ? num(lp) : null, visitsForReward: lv.trim() ? Math.round(num(lv)) : null }), () => void loy.reload())} />
        <View style={{ height: 8 }} />
        {newBtn(tr('mk.newTier'), () => openSheet('tier'))}
        {(tiers.data ?? []).map((x, i) => (
          <ListItem key={i} first={i === 0} title={x.name} sub={`${x.minPoints} · +${x.bonusPercent}%`} lead={tile('star')}
            right={<Pressable onPress={() => void run(() => apiB.saveTiers(sid, (tiers.data ?? []).filter((_, j) => j !== i)), () => void tiers.reload())} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>} />
        ))}
      </ScrollView>
    );
  } else {
    content = (
      <ScrollView contentContainerStyle={pad}>
        {refs.data?.[1] ? <Card><Line label={tr('x3.codes')} value={`${refs.data[1].activeReferralCodes}/${refs.data[1].totalReferralCodes}`} /><Line label={tr('x3.uses')} value={`${refs.data[1].successfulUsages}/${refs.data[1].totalUsages}`} /><Line label={tr('x3.rewards')} value={money(refs.data[1].totalRewardsGiven, salon?.currency)} bold /></Card> : null}
        {(refs.data?.[0] ?? []).map((c, i) => <ListItem key={String(c.id)} first={i === 0} title={c.code} sub={`${c.status} · ${c.currentUses}${c.maxUses ? `/${c.maxUses}` : ''} · ${money(c.rewardAmount, salon?.currency)}`} lead={tile('share')} />)}
        {(refs.data?.[0] ?? []).length === 0 ? <StateView icon="share" title={tr('x3.noRefs')} /> : null}
      </ScrollView>
    );
  }

  return (
    <Screen>
      <Header title={title} subtitle={view === 'home' ? salon?.name : undefined} onBack={goBack} />
      {content}
      <BottomSheet open={sheet !== null} onClose={closeSheet}>
        {sheet === 'camp' ? (
          <>
            {sheetTitle(tr('mk.add'))}
            <Field label={tr('sx.name')} value={name} onChangeText={setName} />
            <Choice value={channel} onChange={setChannel} options={[{ value: 'EMAIL' as const, label: 'E-mail' }, { value: 'SMS' as const, label: 'SMS' }]} />
            <View style={{ maxHeight: 90 }}><Choice value={seg} onChange={setSeg} options={SEGMENTS.map((s) => ({ value: s, label: tr(`mk.seg.${s}` as 'mk.seg.ALL_CLIENTS') }))} /></View>
            {aud.data ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 8 }}>{tr('mk.audience', { n: aud.data.reachable, m: aud.data.segmentSize })}</Text> : null}
            {channel === 'EMAIL' ? <Field label={tr('mk.subject')} value={subject} onChangeText={setSubject} /> : null}
            <Field label={tr('mk.body')} value={body} onChangeText={setBody} multiline style={{ minHeight: 90, paddingTop: 14, textAlignVertical: 'top' }} />
            {errLine}
            <Btn label={tr('common.save')} loading={busy} disabled={!name.trim() || !body.trim()} onPress={() => void run(() => apiB.createCampaign(sid, { name: name.trim(), channel, segment: seg, subject: subject.trim() || undefined, body: body.trim() }), () => { closeSheet(); setName(''); setBody(''); void camps.reload(); })} />
          </>
        ) : sheet === 'promo' ? (
          <>
            {sheetTitle(tr('mk.addPromo'))}
            <Field label={tr('mk.code')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />
            <Choice value={ptype} onChange={setPtype} options={[{ value: 'PERCENT' as const, label: '%' }, { value: 'FIXED' as const, label: tr('mk.fixed') }]} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('mk.value')} value={value} onChangeText={setValue} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('mk.maxUses')} value={uses} onChangeText={setUses} keyboardType="number-pad" /></View>
            </View>
            {errLine}
            <Btn label={tr('common.save')} loading={busy} disabled={!code.trim() || !(num(value) > 0)} onPress={() => void run(() => apiB.createPromo(sid, { code: code.trim().toUpperCase(), type: ptype, value: num(value), maxUses: uses.trim() ? Math.round(num(uses)) : undefined }), () => { closeSheet(); setCode(''); setValue(''); setUses(''); void promos.reload(); })} />
          </>
        ) : sheet === 'member' ? (
          <>
            {sheetTitle(tr('mk.newMem'))}
            <Field label={tr('sx.name')} value={mn} onChangeText={setMn} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label={tr('sl.price')} value={mp} onChangeText={setMp} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('x3.months')} value={mm} onChangeText={setMm} keyboardType="number-pad" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="%" value={md} onChangeText={setMd} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('ad.sessionsTotal')} value={ms} onChangeText={setMs} keyboardType="number-pad" /></View>
            </View>
            {errLine}
            <Btn label={tr('common.save')} loading={busy} disabled={!mn.trim() || !(num(mp) >= 0)} onPress={() => void run(() => apiB.createMembership(sid, { name: mn.trim(), price: num(mp), billingPeriodMonths: Math.max(1, Math.round(num(mm)) || 1), discountPercent: Math.min(100, Math.max(0, Math.round(num(md)) || 0)), includedSessions: Math.max(0, Math.round(num(ms)) || 0) }), () => { closeSheet(); setMn(''); setMp(''); void mem.reload(); })} />
          </>
        ) : sheet === 'tier' ? (
          <>
            {sheetTitle(tr('mk.newTier'))}
            <Field label={tr('x3.tier')} value={tn} onChangeText={setTn} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label={tr('x3.minPoints')} value={tpts} onChangeText={setTpts} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label="+%" value={tb} onChangeText={setTb} keyboardType="number-pad" /></View>
            </View>
            {errLine}
            <Btn label={tr('common.save')} loading={busy} disabled={!tn.trim() || !(num(tpts) >= 0) || !(num(tb) >= 0)} onPress={() => void run(() => apiB.saveTiers(sid, [...(tiers.data ?? []), { name: tn.trim(), minPoints: Math.round(num(tpts)), bonusPercent: Math.round(num(tb)) }]), () => { closeSheet(); setTn(''); setTpts(''); setTb(''); void tiers.reload(); })} />
          </>
        ) : null}
        <View style={{ height: 16 }} />
      </BottomSheet>
      <PromoteSheet open={promoOpen} onClose={() => setPromoOpen(false)} />
    </Screen>
  );
}
