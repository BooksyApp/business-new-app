import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, TabBar, ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiB, type Automation } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const SEGMENTS = ['ALL_CLIENTS', 'LAPSED_60D', 'LAPSED_90D', 'TOP_SPENDERS', 'BIRTHDAY_THIS_MONTH'] as const;

/** Marketinq: e-mail / SMS campaigns to client segments (draft, audience preview, send) and promo codes. */
export function Marketing({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [tab, setTab] = useState<'campaigns' | 'promos' | 'auto'>('campaigns');
  const camps = useLoad(() => apiB.campaigns(sid), [sid]);
  const promos = useLoad(() => apiB.promos(sid), [sid]);
  const auto = useLoad(() => (tab === 'auto' ? apiB.automation(sid).catch(() => null) : Promise.resolve(null)), [sid, tab]);
  const [au, setAu] = useState<Automation | null>(null);
  useEffect(() => { if (auto.data) setAu(auto.data); }, [auto.data]);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState(''); const [channel, setChannel] = useState<'EMAIL' | 'SMS'>('EMAIL'); const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>('ALL_CLIENTS');
  const [subject, setSubject] = useState(''); const [body, setBody] = useState('');
  const [code, setCode] = useState(''); const [ptype, setPtype] = useState<'PERCENT' | 'FIXED'>('PERCENT'); const [value, setValue] = useState(''); const [uses, setUses] = useState('');
  const [busy, setBusy] = useState(false);
  const aud = useLoad(() => (sheet && tab === 'campaigns' ? apiB.audience(sid, seg, channel).catch(() => null) : Promise.resolve(null)), [sid, sheet, seg, channel, tab]);
  const run = async (fn: () => Promise<unknown>, after: () => void) => { setBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); } };
  const addBtn = <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={tr('mk.add')} haptic style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color="#fff" /></Pressable>;
  const q = tab === 'campaigns' ? camps : tab === 'promos' ? promos : auto;
  return (
    <Screen>
      <Header title={tr('mk.title')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      <TabBar value={tab} onChange={setTab} tabs={[{ k: 'campaigns', label: tr('mk.campaigns') }, { k: 'promos', label: tr('mk.promos') }, { k: 'auto', label: tr('mk.auto') }]} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={4} /> : tab === 'auto' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {au ? (
            <>
              <ToggleRow label={tr('mk.birthday')} hint={tr('mk.birthdayHint')} value={au.birthdayEnabled} onChange={(v) => setAu({ ...au, birthdayEnabled: v })} />
              <Field label={tr('mk.daysBefore')} value={String(au.birthdayDaysBefore)} onChangeText={(v) => setAu({ ...au, birthdayDaysBefore: Math.max(0, Math.round(num(v)) || 0) })} keyboardType="number-pad" />
              <ToggleRow label={tr('mk.winback')} hint={tr('mk.winbackHint')} value={au.winbackEnabled} onChange={(v) => setAu({ ...au, winbackEnabled: v })} />
              <Field label={tr('mk.daysAfter')} value={String(au.winbackDaysAfter)} onChangeText={(v) => setAu({ ...au, winbackDaysAfter: Math.max(1, Math.round(num(v)) || 1) })} keyboardType="number-pad" />
              <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 10 }}>{tr('mk.sent30', { n: au.sentLast30Days })}</Text>
              <Btn label={tr('common.save')} loading={busy} onPress={() => void run(() => { const { sentLast30Days: _s, ...body } = au; return apiB.saveAutomation(sid, body); }, () => void auto.reload())} />
            </>
          ) : null}
        </ScrollView>
      ) : tab === 'campaigns' ? (
        <FlatList data={camps.data ?? []} keyExtractor={(c) => String(c.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={camps.refreshing} onRefresh={() => void camps.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="send" title={tr('mk.empty')} body={tr('mk.emptyBody')} />}
          renderItem={({ item: c }) => (
            <Card style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.x, fontSize: 16, color: t.ink }}>{c.name}</Text>
                <Pill text={c.status} tone={c.status === 'SENT' ? 'ok' : c.status === 'FAILED' ? 'guava' : 'muted'} />
              </View>
              <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{c.channel} · {tr(`mk.seg.${c.segment}` as 'mk.seg.ALL_CLIENTS')} · {c.recipientCount}</Text>
              {c.status === 'DRAFT' ? <Btn label={tr('mk.send')} variant="secondary" loading={busy} onPress={() => Alert.alert(tr('mk.sendConfirm'), c.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('mk.send'), onPress: () => void run(() => apiB.queueCampaign(sid, c.id), () => void camps.reload()) }])} /> : null}
            </Card>
          )} />
      ) : (
        <FlatList data={promos.data ?? []} keyExtractor={(c) => String(c.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
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
