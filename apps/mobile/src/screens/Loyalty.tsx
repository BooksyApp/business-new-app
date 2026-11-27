import { useEffect, useState } from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Field } from '@/components/ui';
import { StampCards } from '@/screens/HubExtras';
import { t as tr } from '@/i18n';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Tier = { name: string; minPoints: number; bonusPercent: number };

/**
 * The ONE loyalty screen body (Marketing > Sadiqlik, and "Daha cox" > Sadiqlik kartlari open the same thing):
 * section 1 "Xal proqrami" (points rule + tiers ladder), section 2 "Mohur kartlari" (stamp cards).
 * Every field lives in always-mounted state and sheets keep their fields in a ScrollView sized to the window, so a keyboard can never hide them.
 */
export function LoyaltyView() {
  const { t } = useTheme();
  const { salon } = useApp();
  const { height: H } = useWindowDimensions();
  const sid = salon?.id ?? '';
  const loy = useLoad(() => apiB.loyaltySettings(sid).catch(() => null), [sid]);
  const tiers = useLoad(() => apiB.tiers(sid).catch(() => [] as Tier[]), [sid]);
  const [lp, setLp] = useState('1'); const [lv, setLv] = useState('10');
  const [busy, setBusy] = useState(false);
  const [perr, setPerr] = useState<string | null>(null);
  useEffect(() => {
    if (!loy.data) return;
    if (loy.data.pointsPerUnit != null) setLp(String(loy.data.pointsPerUnit));
    if (loy.data.visitsForReward != null) setLv(String(loy.data.visitsForReward));
  }, [loy.data]);
  const [edit, setEdit] = useState<number | 'new' | null>(null);
  const [tn, setTn] = useState(''); const [tpts, setTpts] = useState(''); const [tb, setTb] = useState('');
  const [terr, setTerr] = useState<string | null>(null);
  const list: Tier[] = tiers.data ?? [];
  const order = list.map((x, i) => ({ x, i })).sort((a, b) => a.x.minPoints - b.x.minPoints);
  const maxPts = Math.max(1, ...list.map((x) => x.minPoints));
  const ppu = num(lp); const visits = Math.round(num(lv));
  const active = Number.isFinite(ppu) && ppu > 0;

  async function saveRule() {
    setBusy(true); setPerr(null);
    try {
      await apiB.saveLoyalty(sid, { pointsPerUnit: lp.trim() ? num(lp) : null, visitsForReward: lv.trim() ? Math.round(num(lv)) : null });
      await loy.reload(); toast(tr('ns.saved'), 'success');
    } catch (e) { setPerr((e as Error).message); } finally { setBusy(false); }
  }
  const openTier = (i: number | 'new') => {
    const x = i === 'new' ? null : list[i];
    setTn(x?.name ?? ''); setTpts(x ? String(x.minPoints) : ''); setTb(x ? String(x.bonusPercent) : '5'); setTerr(null); setEdit(i);
  };
  async function writeTiers(next: Tier[]) {
    setBusy(true); setTerr(null);
    try { await apiB.saveTiers(sid, next); setEdit(null); await tiers.reload(); }
    catch (e) { setTerr((e as Error).message); } finally { setBusy(false); }
  }
  const saveTier = () => {
    const row: Tier = { name: tn.trim(), minPoints: Math.round(num(tpts)), bonusPercent: Math.round(num(tb)) };
    if (!row.name || !(row.minPoints >= 0) || !(row.bonusPercent >= 0)) { setTerr(tr('hx.cardBad')); return; }
    void writeTiers(edit === 'new' || edit === null ? [...list, row] : list.map((x, i) => (i === edit ? row : x)));
  };
  const delTier = () => {
    if (typeof edit !== 'number') return;
    const at = edit; const nm = list[at]?.name ?? '';
    Alert.alert(tr('lk.delete'), nm, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => void writeTiers(list.filter((_, i) => i !== at)) }]);
  };
  const h = (s: string) => <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink, marginTop: 6 }}>{s}</Text>;
  const meta = (s: string) => <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{s}</Text>;
  const nShow = Number.isFinite(visits) ? Math.min(12, Math.max(0, visits)) : 0;

  return (
    <View style={{ gap: 12 }}>
      {h(tr('mk.lyProg'))}
      <View style={{ backgroundColor: t.violet, borderRadius: 22, padding: 18, gap: 10 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: '#fff' }}>{salon?.name ?? ''}</Text>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 20, color: '#fff' }}>{active ? tr('mk.lyEvery', { m: money(1, salon?.currency), n: ppu }) : tr('mk.lyNoRule')}</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,.25)' }}><View style={{ width: '40%', height: 8, borderRadius: 4, backgroundColor: '#fff' }} /></View>
        {nShow > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {Array.from({ length: nShow }).map((_, i) => <View key={i} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: i < Math.ceil(nShow * 0.4) ? '#fff' : 'rgba(255,255,255,.25)' }} />)}
          </View>
        ) : null}
        <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: 'rgba(255,255,255,.85)' }}>{nShow > 0 ? tr('mk.lyAfter', { n: visits }) : ' '}</Text>
      </View>
      <Card style={{ gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 6 }}>{tr('mk.lyQuick')}</Text>
        <Choice value={lp} onChange={setLp} options={['1', '2', '5', '10'].map((v) => ({ value: v, label: v }))} />
        <Field label={tr('x3.pointsPerUnit')} value={lp} onChangeText={setLp} keyboardType="decimal-pad" />
        <Field label={tr('x3.visitsForReward')} value={lv} onChangeText={setLv} keyboardType="number-pad" />
        {perr ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.gink, marginBottom: 8 }}>{perr}</Text> : null}
        <Btn label={tr('common.save')} loading={busy} onPress={() => void saveRule()} />
      </Card>

      {h(tr('mk.lyTiers'))}
      {meta(tr('mk.lyTiersHint'))}
      {order.length === 0 ? meta(tr('mk.lyNoTiers')) : order.map(({ x, i }, k) => (
        <Pressable key={`${x.name}-${i}`} onPress={() => openTier(i)} accessibilityRole="button" accessibilityLabel={x.name} noScale>
          <Card style={{ gap: 6, marginLeft: k * 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 13, color: t.ink }}>{k + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{x.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{`${tr('mk.lyPts', { n: x.minPoints })} · ${tr('mk.lyBenefit', { n: x.bonusPercent })}`}</Text>
              </View>
              <Icon name="chev" size={18} color={t.muted} />
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: t.track }}><View style={{ width: `${Math.max(6, (x.minPoints / maxPts) * 100)}%`, height: 4, borderRadius: 2, backgroundColor: t.violet }} /></View>
          </Card>
        </Pressable>
      ))}
      <Btn label={tr('mk.newTier')} icon="plus" variant="secondary" onPress={() => openTier('new')} />

      {h(tr('mk.lyStamps'))}
      <StampCards />

      <BottomSheet open={edit !== null} onClose={() => setEdit(null)}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 18, color: t.ink, marginBottom: 10 }}>{edit === 'new' ? tr('mk.newTier') : tr('mk.lyEditTier')}</Text>
        <ScrollView style={{ maxHeight: H * 0.5 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Field label={tr('x3.tier')} value={tn} onChangeText={setTn} />
          <Field label={tr('x3.minPoints')} value={tpts} onChangeText={setTpts} keyboardType="number-pad" />
          <Field label={tr('mk.lyBonus')} value={tb} onChangeText={setTb} keyboardType="number-pad" />
        </ScrollView>
        {terr ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.gink, marginTop: 6 }}>{terr}</Text> : null}
        <Btn label={tr('common.save')} loading={busy} style={{ marginTop: 10 }} onPress={saveTier} />
        {typeof edit === 'number' ? <Btn label={tr('lk.delete')} icon="trash" variant="danger" style={{ marginTop: 8 }} onPress={delTier} /> : null}
        <View style={{ height: 16 }} />
      </BottomSheet>
    </View>
  );
}
