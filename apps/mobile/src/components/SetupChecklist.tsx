import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { shareAfterSheet } from '@/lib/share';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { BottomSheet } from '@/components/BottomSheet';
import { LoadRing, T } from '@/components/kit';
import { useSalonPin } from '@/components/LocationCard';
import { t as tr } from '@/i18n';
import { apiB } from '@/lib/api-biz';
import { apiO } from '@/lib/api-onboard';
import { useApp } from '@/lib/app';
import { salonShareLink } from '@/lib/config';
import * as storage from '@/lib/secureStorage';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Step = { k: string; done: boolean; title: string; sub?: string; on: () => void };

/**
 * Salonu hazırla (artifact "Bu gün · yeni salon"): the first-run checklist on Bu gün.
 * Required steps come from GET /businesses/{id}/readiness (category, services, staff, hours, online booking: same rule the backend uses to hide a salon from customers),
 * then two local steps (share the link, invite the team). Slim card (ring + next step) that opens the full list in a sheet; hidden once everything is done or the owner taps "Sonra".
 */
export function SetupChecklist() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version, bump, demo } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiO.readiness(sid).catch(() => null), [sid, version]);
  const pinState = useSalonPin();
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<{ shared: boolean; invited: boolean; hidden: boolean }>({ shared: false, invited: false, hidden: false });
  useEffect(() => {
    if (!sid || demo) return;
    void Promise.all([storage.getItem(`biz.setup.shared.${sid}`), storage.getItem(`biz.setup.invited.${sid}`), storage.getItem(`biz.setup.hidden.${sid}`)])
      .then(([a, b, c]) => setFlags({ shared: a === '1', invited: b === '1', hidden: c === '1' })).catch(() => undefined);
  }, [sid, demo]);
  const mark = (k: 'shared' | 'invited' | 'hidden') => { setFlags((f) => ({ ...f, [k]: true })); if (!demo) void storage.setItem(`biz.setup.${k}.${sid}`, '1').catch(() => undefined); };

  const r = q.data;
  if (!r || flags.hidden) return null;
  const miss = new Set<string>(r.missing);
  const steps: Step[] = [];
  if (miss.has('category')) steps.push({ k: 'category', done: false, title: tr('ob.stCategory'), on: () => router.push('/section/profile') });
  if (pinState.known) steps.push({ k: 'location', done: pinState.hasPin, title: tr('lp.stTitle'), sub: tr('lp.stSub'), on: () => router.push('/section/profile') });
  steps.push({ k: 'services', done: !miss.has('services'), title: tr('ob.stServices'), sub: tr('ob.stServicesSub'), on: () => router.push('/section/services') });
  steps.push({ k: 'staff', done: !miss.has('staff'), title: tr('ob.stStaff'), sub: tr('ob.stStaffSub'), on: () => router.push('/section/team') });
  steps.push({ k: 'hours', done: !miss.has('hours'), title: tr('ob.stHours'), sub: tr('ob.stHoursSub'), on: () => router.push('/section/hours') });
  steps.push({
    k: 'online', done: !miss.has('onlineBooking'), title: tr('ob.stOnline'), sub: tr('ob.stOnlineSub'),
    on: () => { void apiB.updateBusiness(sid, { onlineBookingEnabled: true }).then(() => { toast(tr('ob.onlineOn'), 'success'); bump(); }).catch((e: Error) => toast(e.message, 'error')); },
  });
  steps.push({ k: 'share', done: flags.shared, title: tr('ob.stShare'), sub: tr('ob.stShareSub'), on: () => { mark('shared'); shareAfterSheet(`${salon?.name ?? 'booqi'} · ${salonShareLink(salon)}`); } });
  steps.push({ k: 'invite', done: flags.invited, title: tr('ob.stInvite'), sub: tr('ob.stInviteSub'), on: () => { mark('invited'); router.push('/section/team'); } });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const nextStep = steps.find((s) => !s.done);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${tr('ob.setupTitle')} ${done}/${steps.length}. ${nextStep?.title ?? ''}`} noScale
        style={{ marginHorizontal: 20, marginTop: 6, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.surface, boxShadow: '0 1px 2px rgba(29,23,48,.04), 0 6px 20px -10px rgba(29,23,48,.14)' } as object}>
        <LoadRing value={done / steps.length} size={44}>
          <Text style={{ fontFamily: font.b, fontSize: 12, color: t.ink }}>{done}/{steps.length}</Text>
        </LoadRing>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{r.bookable ? tr('ob.setupAlmost') : tr('ob.setupTitle')}</Text>
          <T k="sm" color={t.muted} lines={1}>{nextStep?.title}</T>
        </View>
        <Icon name="chev" size={18} color={t.ink3} />
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <T k="h2" style={{ fontSize: 18 }}>{tr('ob.setupTitle')}</T>
        <T k="sm" color={t.muted} style={{ marginBottom: 6 }}>{r.bookable ? tr('ob.setupBookable') : tr('ob.setupHidden')}</T>
        {steps.map((s, i) => (
          <Pressable key={s.k} onPress={() => { setOpen(false); s.on(); }} accessibilityRole="button" accessibilityLabel={s.title} accessibilityState={{ checked: s.done }} noScale
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair, minHeight: 52 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? t.ok : 'transparent', borderWidth: s.done ? 0 : 1.5, borderColor: s.k === nextStep?.k ? t.violet : t.hair }}>
              {s.done ? <Icon name="check" size={16} color="#fff" /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T k="t1" lines={1} color={s.done ? t.ink3 : t.ink} style={s.done ? { textDecorationLine: 'line-through' } : undefined}>{s.title}</T>
              {!s.done && s.sub ? <T k="t2" color={t.muted} lines={1}>{s.sub}</T> : null}
            </View>
            {!s.done ? <Icon name="chev" size={16} color={t.ink3} /> : null}
          </Pressable>
        ))}
        <Pressable onPress={() => { setOpen(false); mark('hidden'); }} accessibilityRole="button" accessibilityLabel={tr('ob.later')} style={{ alignSelf: 'center', minHeight: 40, justifyContent: 'center', marginTop: 6 }}>
          <Text style={{ fontFamily: font.b, fontSize: 13, color: t.ink3 }}>{tr('ob.later')}</Text>
        </Pressable>
      </BottomSheet>
    </>
  );
}
