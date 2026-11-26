import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, Line, TabBar, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Circ, ErrorState, Field, Header, Hero, Pill, Screen, Skeleton, StateView, Toggle } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiB, type Automation } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const SEGMENTS = ['ALL_CLIENTS', 'LAPSED_60D', 'LAPSED_90D', 'TOP_SPENDERS', 'BIRTHDAY_THIS_MONTH'] as const;

/** Marketinq: e-mail / SMS campaigns to client segments (draft, audience preview, send) and promo codes. */
export function Marketing({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [tab, setTab] = useState<'campaigns' | 'promos' | 'auto' | 'members' | 'refs'>('campaigns');
  const camps = useLoad(() => apiB.campaigns(sid), [sid]);
  const promos = useLoad(() => apiB.promos(sid), [sid]);
  const auto = useLoad(() => (tab === 'auto' ? apiB.automation(sid).catch(() => null) : Promise.resolve(null)), [sid, tab]);
  const [au, setAu] = useState<Automation | null>(null);
  useEffect(() => { if (auto.data) setAu(auto.data); }, [auto.data]);
  const mem = useLoad(() => (tab === 'members' ? apiB.memberships(sid).catch(() => []) : Promise.resolve([])), [sid, tab]);
  const refs = useLoad(() => (tab === 'refs' ? Promise.all([apiB.refCodes(sid).catch(() => []), apiB.refStats(sid).catch(() => null)]) : Promise.resolve(null)), [sid, tab]);
  const loy = useLoad(() => (tab === 'members' ? apiB.loyaltySettings(sid).catch(() => null) : Promise.resolve(null)), [sid, tab]);
  const [lp, setLp] = useState(''); const [lv, setLv] = useState('');
  useEffect(() => { if (loy.data) { setLp(loy.data.pointsPerUnit != null ? String(loy.data.pointsPerUnit) : ''); setLv(loy.data.visitsForReward != null ? String(loy.data.visitsForReward) : ''); } }, [loy.data]);
  const tiers = useLoad(() => (tab === 'members' ? apiB.tiers(sid).catch(() => []) : Promise.resolve([])), [sid, tab]);
  const [tn, setTn] = useState(''); const [tpts, setTpts] = useState(''); const [tb, setTb] = useState('');
  const [mn, setMn] = useState(''); const [mp, setMp] = useState(''); const [mm, setMm] = useState('1'); const [md, setMd] = useState('0'); const [ms, setMs] = useState('0');
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState(''); const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL'); const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>('ALL_CLIENTS');
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [code, setCode] = useState(''); const [ptype, setPtype] = useState<'PERCENT' | 'FIXED'>('PERCENT'); const [value, setValue] = useState(''); const [uses, setUses] = useState('');
  const [busy, setBusy] = useState(false);
  const aud = useLoad(() => (sheet && tab === 'campaigns' ? apiB.audience(sid, seg, channel).catch(() => null) : Promise.resolve(null)), [sid, sheet, seg, channel, tab]);
  const run = async (fn: () => Promise<unknown>, after: () => void) => { setBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); } };
  const addBtn = <Circ icon="plus" violet label={tr('mk.add')} onPress={() => setSheet(true)} />;
  const q = tab === 'campaigns' ? camps : tab === 'promos' ? promos : tab === 'members' ? mem : tab === 'refs' ? refs : auto;
  return (
    <Screen>
      <Header title={tr('mk.title')} subtitle={salon?.name} onBack={onBack} right={tab === 'campaigns' || tab === 'promos' ? addBtn : undefined} />
      <TabBar value={tab} onChange={setTab} tabs={[{ k: 'campaigns', label: tr('mk.campaigns') }, { k: 'promos', label: tr('mk.promos') }, { k: 'auto', label: tr('mk.auto') }, { k: 'members', label: tr('x3.memberships') }, { k: 'refs', label: tr('x3.referrals') }]} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={4} /> : tab === 'members' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}>
          {(mem.data ?? []).map((m) => (
            <Card key={String(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: m.active ? 1 : 0.6 }}>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{m.name}</Text><Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{money(m.price, salon?.currency)} / {m.billing_period_months} · -{m.discount_percent}% · {tr('sx.sessions', { n: m.included_sessions })}</Text></View>
              <Toggle on={m.active} onChange={(v) => void run(() => apiB.setMembershipActive(sid, m, v), () => void mem.reload())} label={m.name} />
            </Card>
          ))}
          {(mem.data ?? []).length === 0 ? <StateView icon="crown" title={tr('x3.noMemberships')} /> : null}
          <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 18, color: t.ink, marginTop: 8 }}>{tr('x3.loyalty')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label={tr('x3.pointsPerUnit')} value={lp} onChangeText={setLp} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label={tr('x3.visitsForReward')} value={lv} onChangeText={setLv} keyboardType="number-pad" /></View>
          </View>
          {(tiers.data ?? []).map((x, i) => (
            <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
              <Text style={{ flex: 1, fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{x.name} · {x.minPoints} · +{x.bonusPercent}%</Text>
              <Pressable onPress={() => void run(() => apiB.saveTiers(sid, (tiers.data ?? []).filter((_, j) => j !== i)), () => void tiers.reload())} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
            </Card>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1.4 }}><Field label={tr('x3.tier')} value={tn} onChangeText={setTn} /></View>
            <View style={{ flex: 1 }}><Field label={tr('x3.minPoints')} value={tpts} onChangeText={setTpts} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="+%" value={tb} onChangeText={setTb} keyboardType="number-pad" /></View>
          </View>
          <Btn label={tr('ad.addRule')} variant="secondary" icon="plus" loading={busy} disabled={!tn.trim() || !(num(tpts) >= 0) || !(num(tb) >= 0)} onPress={() => void run(() => apiB.saveTiers(sid, [...(tiers.data ?? []), { name: tn.trim(), minPoints: Math.round(num(tpts)), bonusPercent: Math.round(num(tb)) }]), () => { setTn(''); setTpts(''); setTb(''); void tiers.reload(); })} />
          <Btn label={tr('common.save')} variant="secondary" loading={busy} onPress={() => void run(() => apiB.saveLoyalty(sid, { pointsPerUnit: lp.trim() ? num(lp) : null, visitsForReward: lv.trim() ? Math.round(num(lv)) : null }), () => void loy.reload())} />
          <Field label={tr('sx.name')} value={mn} onChangeText={setMn} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label={tr('sl.price')} value={mp} onChangeText={setMp} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label={tr('x3.months')} value={mm} onChangeText={setMm} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="%" value={md} onChangeText={setMd} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label={tr('ad.sessionsTotal')} value={ms} onChangeText={setMs} keyboardType="number-pad" /></View>
          </View>
          <Btn label={tr('common.save')} loading={busy} disabled={!mn.trim() || !(num(mp) >= 0)} onPress={() => void run(() => apiB.createMembership(sid, { name: mn.trim(), price: num(mp), billingPeriodMonths: Math.max(1, Math.round(num(mm)) || 1), discountPercent: Math.min(100, Math.max(0, Math.round(num(md)) || 0)), includedSessions: Math.max(0, Math.round(num(ms)) || 0) }), () => { setMn(''); setMp(''); void mem.reload(); })} />
        </ScrollView>
      ) : tab === 'refs' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}>
          {refs.data?.[1] ? <Card><Line label={tr('x3.codes')} value={`${refs.data[1].activeReferralCodes}/${refs.data[1].totalReferralCodes}`} /><Line label={tr('x3.uses')} value={`${refs.data[1].successfulUsages}/${refs.data[1].totalUsages}`} /><Line label={tr('x3.rewards')} value={money(refs.data[1].totalRewardsGiven, salon?.currency)} bold /></Card> : null}
          {(refs.data?.[0] ?? []).map((c) => <Card key={String(c.id)}><Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink, letterSpacing: 0.5 }}>{c.code}</Text><Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{c.status} · {c.currentUses}{c.maxUses ? `/${c.maxUses}` : ''} · {money(c.rewardAmount, salon?.currency)}</Text></Card>)}
          {(refs.data?.[0] ?? []).length === 0 ? <StateView icon="share" title={tr('x3.noRefs')} /> : null}
        </ScrollView>
      ) : tab === 'auto' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {au ? (
            <View style={{ gap: 12 }}>
              <Hero><View style={{ padding: 20, gap: 2 }}><Text style={{ fontFamily: font.s, fontSize: 15, color: t.muted }}>{tr('mk.auto')}</Text><Text style={{ fontFamily: font.x, fontSize: 40, letterSpacing: -1.2, color: t.ink }}>{au.sentLast30Days}</Text><Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('mk.sent30', { n: au.sentLast30Days })}</Text></View></Hero>
              <Card style={{ gap: 4 }}>
                <ToggleRow label={tr('mk.birthday')} hint={tr('mk.birthdayHint')} value={au.birthdayEnabled} onChange={(v) => setAu({ ...au, birthdayEnabled: v })} />
                {au.birthdayEnabled ? <Field label={tr('mk.daysBefore')} value={String(au.birthdayDaysBefore)} onChangeText={(v) => setAu({ ...au, birthdayDaysBefore: Math.max(0, Math.round(num(v)) || 0) })} keyboardType="number-pad" /> : null}
              </Card>
              <Card style={{ gap: 4 }}>
                <ToggleRow label={tr('mk.winback')} hint={tr('mk.winbackHint')} value={au.winbackEnabled} onChange={(v) => setAu({ ...au, winbackEnabled: v })} />
                {au.winbackEnabled ? <Field label={tr('mk.daysAfter')} value={String(au.winbackDaysAfter)} onChangeText={(v) => setAu({ ...au, winbackDaysAfter: Math.max(1, Math.round(num(v)) || 1) })} keyboardType="number-pad" /> : null}
              </Card>
              <Btn label={tr('common.save')} loading={busy} onPress={() => void run(() => { const { sentLast30Days: _s, ...body } = au; return apiB.saveAutomation(sid, body); }, () => void auto.reload())} />
            </View>
          ) : null}
        </ScrollView>
      ) : tab === 'campaigns' ? (
        <FlatList data={camps.data ?? []} keyExtractor={(c) => String(c.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={camps.refreshing} onRefresh={() => void camps.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="send" title={tr('mk.empty')} body={tr('mk.emptyBody')} />}
          renderItem={({ item: c }) => (
            <LinearGradient colors={c.status === 'SENT' ? ['#1d1730', '#35276b'] : c.status === 'FAILED' ? ['#e83e63', '#a02244'] : ['#6f52ed', '#a24cd8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 20, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.channel === 'SMS' ? 'chat' : 'mail'} size={20} color="#fff" /></View>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: '#fff' }}>{c.name}</Text>
                <View style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.18)', justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 13, color: '#fff' }}>{c.status}</Text></View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <View><Text style={{ fontFamily: font.x, fontSize: 44, lineHeight: 48, letterSpacing: -1.5, color: '#fff' }}>{c.status === 'SENT' ? (c.sentCount ?? c.recipientCount) : c.recipientCount}</Text><Text style={{ fontFamily: font.s, fontSize: 14, color: 'rgba(255,255,255,.8)' }}>{tr(`mk.seg.${c.segment}` as 'mk.seg.ALL_CLIENTS')}</Text></View>
                <Text style={{ fontFamily: font.b, fontSize: 14, color: 'rgba(255,255,255,.75)' }}>{c.channel}</Text>
              </View>
              {c.status === 'DRAFT' ? <Btn label={tr('mk.send')} small loading={busy} onPress={() => Alert.alert(tr('mk.sendConfirm'), c.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('mk.send'), onPress: () => void run(() => apiB.queueCampaign(sid, c.id), () => void camps.reload()) }])} /> : null}
            </LinearGradient>
          )} />
      ) : (
        <FlatList data={promos.data ?? []} keyExtractor={(c) => String(c.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={<StateView icon="tag" title={tr('mk.noPromos')} />}
          renderItem={({ item: c }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: c.active ? 1 : 0.55 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink, letterSpacing: 0.5 }}>{c.code}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{c.type === 'PERCENT' ? `${c.value}%` : c.value} · {c.uses}{c.max_uses ? `/${c.max_uses}` : ''}</Text>
              </View>
              {c.active ? <Pressable onPress={() => void run(() => apiB.deactivatePromo(sid, c.id), () => void promos.reload())} accessibilityRole="button" accessibilityLabel={tr('mk.deactivate')}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.gink }}>{tr('mk.deactivate')}</Text></Pressable> : null}
            </Card>
          )} />
      )}
      <BottomSheet open={sheet} onClose={() => setSheet(false)}>
        {tab === 'campaigns' ? (
          <>
            <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 8 }}>{tr('mk.add')}</Text>
            <Field label={tr('sx.name')} value={name} onChangeText={setName} />
            <Choice value={channel} onChange={setChannel} options={[{ value: 'EMAIL' as const, label: 'E-mail' }, { value: 'SMS' as const, label: 'SMS' }]} />
            <View style={{ maxHeight: 90 }}><Choice value={seg} onChange={setSeg} options={SEGMENTS.map((s) => ({ value: s, label: tr(`mk.seg.${s}` as 'mk.seg.ALL_CLIENTS') }))} /></View>
            {aud.data ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 8 }}>{tr('mk.audience', { n: aud.data.reachable, m: aud.data.segmentSize })}</Text> : null}
            {channel === 'EMAIL' ? <Field label={tr('mk.subject')} value={subject} onChangeText={setSubject} /> : null}
            <Field label={tr('mk.body')} value={body} onChangeText={setBody} multiline style={{ minHeight: 90, paddingTop: 14, textAlignVertical: 'top' }} />
            <Btn label={tr('common.save')} loading={busy} disabled={!name.trim() || !body.trim()} onPress={() => void run(() => apiB.createCampaign(sid, { name: name.trim(), channel, segment: seg, subject: subject.trim() || undefined, body: body.trim() }), () => { setSheet(false); setName(''); setBody(''); void camps.reload(); })} />
          </>
        ) : (
          <>
            <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 8 }}>{tr('mk.addPromo')}</Text>
            <Field label={tr('mk.code')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />
            <Choice value={ptype} onChange={setPtype} options={[{ value: 'PERCENT' as const, label: '%' }, { value: 'FIXED' as const, label: tr('mk.fixed') }]} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('mk.value')} value={value} onChangeText={setValue} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('mk.maxUses')} value={uses} onChangeText={setUses} keyboardType="number-pad" /></View>
            </View>
            <Btn label={tr('common.save')} loading={busy} disabled={!code.trim() || !(num(value) > 0)} onPress={() => void run(() => apiB.createPromo(sid, { code: code.trim().toUpperCase(), type: ptype, value: num(value), maxUses: uses.trim() ? Math.round(num(uses)) : undefined }), () => { setSheet(false); setCode(''); setValue(''); setUses(''); void promos.reload(); })} />
          </>
        )}
        <View style={{ height: 16 }} />
      </BottomSheet>
    </Screen>
  );
}
