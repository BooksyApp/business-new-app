import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Button, Chip, Pill, Segmented, T } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/**
 * "Reklam et": optional paid promotion of a post or story. UI only for now: no prices, no promised results,
 * and the primary action leads to a calm "Tezliklə" state because there is no backend yet.
 * Reachable only from post statistics and Marketinq.
 */
export function PromoteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const [goal, setGoal] = useState<'book' | 'reach'>('book');
  const [aud, setAud] = useState<string[]>(['city']);
  const [days, setDays] = useState(7);
  const [size, setSize] = useState<'s' | 'm' | 'l'>('m');
  const [soon, setSoon] = useState(false);
  useEffect(() => { if (open) setSoon(false); }, [open]);
  const tog = (k: string) => setAud((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const AUD: [string, string][] = [['city', tr('v3.adCity')], ['near', tr('v3.adNear')], ['age', tr('v3.adAge')], ['int', tr('v3.adInterest')]];
  return (
    <BottomSheet open={open} onClose={onClose}>
      {soon ? (
        <View style={{ alignItems: 'center', paddingVertical: 18, gap: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="timer" size={30} color={t.vtext} /></View>
          <T k="h1" style={{ textAlign: 'center' }}>{tr('v3.soon')}</T>
          <T k="body" color={t.muted} style={{ textAlign: 'center' }}>{tr('v3.adsSoonBody')}</T>
          <Button label={tr('v2.close')} kind="fl" block onPress={onClose} style={{ marginTop: 10 }} />
        </View>
      ) : (
        <View style={{ gap: 4, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T k="h1" style={{ fontSize: 22 }}>{tr('v3.adTitle')}</T>
            <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: t.gsoft, justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 12, color: t.gink }}>{tr('v3.paidAd')}</Text></View>
          </View>
          <T k="sm" color={t.muted}>{tr('v3.adIntro')}</T>
          <T k="xs" color={t.ink3} style={{ fontFamily: font.b, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 }}>{tr('v3.adGoal')}</T>
          <Segmented items={[{ k: 'book', label: tr('v3.adGoalBook') }, { k: 'reach', label: tr('v3.adGoalReach') }]} value={goal} onChange={setGoal} />
          <T k="xs" color={t.ink3} style={{ fontFamily: font.b, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 }}>{tr('v3.adWho')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{AUD.map(([k, l]) => <Chip key={k} label={l} on={aud.includes(k)} onPress={() => tog(k)} />)}</View>
          <T k="xs" color={t.ink3} style={{ fontFamily: font.b, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 }}>{tr('v3.adDuration')}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>{[3, 7, 14].map((d) => <Chip key={d} label={tr('v3.adDays', { n: d })} on={days === d} onPress={() => setDays(d)} />)}</View>
          <T k="xs" color={t.ink3} style={{ fontFamily: font.b, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 }}>{tr('v3.adBudget')}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['s', 'm', 'l'] as const).map((k) => (
              <Pressable key={k} onPress={() => setSize(k)} accessibilityRole="button" accessibilityState={{ selected: size === k }} noScale style={{ flex: 1, height: 74, borderRadius: 18, backgroundColor: t.surface, borderWidth: size === k ? 2 : 1, borderColor: size === k ? t.ink : t.hair, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <T k="h3">{tr(`v3.adSize_${k}` as 'v3.adSize_s')}</T>
                <T k="xs" color={t.muted}>{tr('v3.adAmountLater')}</T>
              </Pressable>
            ))}
          </View>
          <T k="xs" color={t.ink3} style={{ marginTop: 10 }}>{tr('v3.adDisclaimer')}</T>
          <Button label={tr('v3.adPick')} block size="lg" onPress={() => setSoon(true)} style={{ marginTop: 12 }} />
        </View>
      )}
    </BottomSheet>
  );
}
