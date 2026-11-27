import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BackBar, Button, Chip, CtaBar, Field, Toggle, T } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Screen } from '@/components/ui';
import { getLocale, t as tr } from '@/i18n';
import { api, ApiError, saveSession } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { apiO, authErrorKey, type BizCategory } from '@/lib/api-onboard';
import { useApp } from '@/lib/app';
import { WEB_BASE } from '@/lib/config';
import { num } from '@/components/form';
import { LocationField } from '@/components/LocationField';
import type { Pin } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const DAY_KEY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const okTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Row = { on: boolean; from: string; to: string };
type Team = 'solo' | 'small' | 'big';

/**
 * Qeydiyyat (artifact "Qeydiyyat"): 4 short steps instead of the hub's long wizard.
 * Account -> salon -> hours -> team + first service. Then the same calls the hub makes after sign-up
 * (PUT business, PUT business-hours, POST service, POST staff + service assignment) and the owner lands on Bu gun with the setup checklist.
 */
export default function Register() {
  const { t } = useTheme();
  const router = useRouter();
  const { signedIn } = useApp();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  // 1 account
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [ref, setRef] = useState('');
  // 2 salon
  const [bizName, setBizName] = useState('');
  const [cats, setCats] = useState<BizCategory[]>([]);
  const [cat, setCat] = useState('');
  const [city, setCity] = useState('Bakı');
  const [address, setAddress] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [pin, setPin] = useState<Pin | null>(null);
  const [pinMiss, setPinMiss] = useState(false);
  // 3 hours
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(DAYS.map((d, i) => [d, { on: i < 6, from: '09:00', to: '19:00' }])));
  // 4 team + service
  const [team, setTeam] = useState<Team>('solo');
  const [svcName, setSvcName] = useState('');
  const [svcMin, setSvcMin] = useState('45');
  const [svcPrice, setSvcPrice] = useState('');
  const lastRef = useRef<any>(null);
  const emailRef = useRef<any>(null);
  const pwRef = useRef<any>(null);

  useEffect(() => {
    void apiO.categories(getLocale()).then(setCats).catch(() => undefined);
    void apiO.platform().then((p) => setClosed(p.businessSignupsOpen === false)).catch(() => undefined);
  }, []);

  const preset = (days: number, from: string, to: string) => setRows(Object.fromEntries(DAYS.map((d, i) => [d, { on: i < days, from, to }])));
  const setRow = (d: string, p: Partial<Row>) => setRows((m) => ({ ...m, [d]: { ...m[d], ...p } }));

  const accountOk = first.trim() && last.trim() && EMAIL.test(email.trim()) && pw.length >= 8 && terms;
  const bizOk = bizName.trim() && cat && pin;
  const hoursOk = DAYS.every((d) => !rows[d].on || (okTime(rows[d].from) && okTime(rows[d].to) && rows[d].to > rows[d].from)) && DAYS.some((d) => rows[d].on);
  const can = [accountOk, bizOk, hoursOk, true][step];

  function back() { if (step === 0) router.back(); else setStep(step - 1); }

  async function submit(noService?: boolean) {
    setBusy(true); setError('');
    try {
      const auth = await apiO.register({ firstName: first.trim(), lastName: last.trim(), email: email.trim(), password: pw, phone: phone.trim(), businessName: bizName.trim(), marketingOptIn: marketing, referralCode: ref.trim() || undefined });
      await saveSession(auth); // every call below is authenticated
      const bid = auth.businessId;
      if (bid == null) throw new Error(tr('ob.noBusiness'));
      // Same follow-up the hub runs after sign-up. Hours / service / staff are best effort: the checklist on Bu gun shows what is still missing.
      await apiB.updateBusiness(bid, { name: bizName.trim(), category: cat, address: address.trim() || undefined, city: city.trim() || undefined, country: 'Azerbaijan', phone: (bizPhone || phone).trim() || undefined, latitude: pin?.latitude, longitude: pin?.longitude } as never).catch(() => undefined);
      await apiX.saveHours(bid, DAYS.map((d) => ({ dayOfWeek: d, enabled: rows[d].on, startTime: rows[d].from, endTime: rows[d].to }))).catch(() => undefined);
      let svcId: string | null = null;
      if (!noService && svcName.trim()) {
        const d = Math.max(5, Math.round(num(svcMin)) || 45); const p = num(svcPrice);
        const s = await apiX.createService(bid, { name: svcName.trim(), durationMinutes: d, price: Number.isFinite(p) ? p : 0, priceType: 'FIXED', isVisible: true }).catch(() => null);
        svcId = s?.id != null ? String(s.id) : null;
      }
      if (team === 'solo') {
        // A salon without staff is not bookable: a solo owner is the first specialist, working the salon hours (hub LR-03).
        const schedule: Record<string, string[]> = {};
        for (const d of DAYS) if (rows[d].on) schedule[d] = [rows[d].from, rows[d].to];
        const st = await apiX.createStaff(bid, { name: `${first} ${last}`.trim(), schedule, isActive: true }).catch(() => null);
        if (st?.id != null && svcId) await apiX.setStaffServiceIds(bid, st.id, [svcId]).catch(() => undefined);
      }
      const salons = await api.salonsForUser(auth).catch(() => []);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await signedIn(auth, salons);
      router.replace('/today');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const k = authErrorKey(e);
      setError(e instanceof ApiError && e.status === 0 ? tr('common.offline') : e instanceof ApiError && e.status === 409 ? tr('ob.errTaken') : k ? tr(k) : (e as Error).message);
      if (e instanceof ApiError && e.status === 409) setStep(0);
    } finally { setBusy(false); }
  }

  function next() {
    if (step === 1 && !pin) { setPinMiss(true); return; }
    if (step < 3) { setStep(step + 1); return; }
    void submit();
  }

  const label = (s2: string) => <T k="sm" color={t.muted} style={{ fontFamily: font.b, marginTop: 8, marginBottom: -2, marginLeft: 4 }}>{s2}</T>;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackBar label={step === 0 ? tr('v2.signIn') : tr('common.back')} onBack={back} />
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 4 }} accessibilityLabel={tr('ob.stepOf', { n: step + 1, m: 4 })}>
          {[0, 1, 2, 3].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? t.violet : t.fill }} />)}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 140, gap: 10 }}>
          <T k="h1" style={{ fontSize: 26 }}>{[tr('ob.regTitle'), tr('ob.bizTitle'), tr('ob.hoursTitle'), tr('ob.teamTitle')][step]}</T>
          <T k="body" color={t.muted} style={{ marginBottom: 6 }}>{[tr('ob.regSub'), tr('ob.bizSub'), tr('ob.hoursSub'), tr('ob.teamSub')][step]}</T>
          {closed ? <T k="body" color={t.gink} style={{ backgroundColor: t.gsoft, borderRadius: 16, padding: 12 }}>{tr('ob.closed')}</T> : null}

          {step === 0 ? (<>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field placeholder={tr('ob.first')} accessibilityLabel={tr('ob.first')} value={first} onChangeText={setFirst} autoComplete="given-name" textContentType="givenName" returnKeyType="next" onSubmitEditing={() => lastRef.current?.focus()} blurOnSubmit={false} /></View>
              <View style={{ flex: 1 }}><Field ref={lastRef} placeholder={tr('ob.last')} accessibilityLabel={tr('ob.last')} value={last} onChangeText={setLast} autoComplete="family-name" textContentType="familyName" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} blurOnSubmit={false} /></View>
            </View>
            <Field ref={emailRef} icon="mail" placeholder={tr('cl.email')} accessibilityLabel={tr('cl.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} blurOnSubmit={false} />
            <Field icon="phone" placeholder={`${tr('create.phone')} (${tr('ob.optional')})`} accessibilityLabel={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
            <Field ref={pwRef} icon="lock" placeholder={tr('v2.password')} accessibilityLabel={tr('v2.password')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
            <T k="xs" color={pw.length > 0 && pw.length < 8 ? t.gink : t.ink3} style={{ marginLeft: 4 }}>{tr('ob.pwHint')}</T>
            <Field icon="gift" placeholder={`${tr('ob.referral')} (${tr('ob.optional')})`} accessibilityLabel={tr('ob.referral')} value={ref} onChangeText={setRef} autoCapitalize="characters" autoCorrect={false} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <Toggle on={terms} onChange={setTerms} label={tr('ob.terms')} />
              <Text style={{ flex: 1, fontFamily: font.m, fontSize: 13, lineHeight: 18, color: t.ink }}>
                {tr('ob.terms')}{' '}
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${WEB_BASE}/legal/terms`).catch(() => {})} style={{ fontFamily: font.b, color: t.vtext }}>{tr('ob.termsLink')}</Text>
                {' · '}
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${WEB_BASE}/legal/privacy`).catch(() => {})} style={{ fontFamily: font.b, color: t.vtext }}>{tr('ob.privacyLink')}</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Toggle on={marketing} onChange={setMarketing} label={tr('ob.marketing')} />
              <Text style={{ flex: 1, fontFamily: font.m, fontSize: 13, lineHeight: 18, color: t.muted }}>{tr('ob.marketing')}</Text>
            </View>
          </>) : null}

          {step === 1 ? (<>
            <Field icon="store" placeholder={tr('ob.bizName')} accessibilityLabel={tr('ob.bizName')} value={bizName} onChangeText={setBizName} />
            {label(tr('ob.category'))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cats.map((c) => <Chip key={c.slug} label={c.label} on={cat === c.name} onPress={() => setCat(c.name)} />)}
              {cats.length === 0 ? <T k="sm" color={t.muted}>{tr('common.loading')}</T> : null}
            </View>
            {label(tr('set.address'))}
            <Field icon="pin" placeholder={tr('ob.city')} accessibilityLabel={tr('ob.city')} value={city} onChangeText={setCity} />
            <Field icon="pin" placeholder={tr('ob.street')} accessibilityLabel={tr('ob.street')} value={address} onChangeText={setAddress} />
            <LocationField value={pin} error={pinMiss && !pin} query={[address, city].filter(Boolean).join(', ')} onChange={(r) => { setPin({ latitude: r.latitude, longitude: r.longitude }); setPinMiss(false); if (!address.trim() && r.address) setAddress(r.address); if (!city.trim() && r.city) setCity(r.city); }} />
            <Field icon="phone" placeholder={`${tr('ob.bizPhone')} (${tr('ob.optional')})`} accessibilityLabel={tr('ob.bizPhone')} value={bizPhone} onChangeText={setBizPhone} keyboardType="phone-pad" />
          </>) : null}

          {step === 2 ? (<>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Chip label={tr('ob.presetWeek')} onPress={() => preset(5, '09:00', '18:00')} />
              <Chip label={tr('ob.presetSix')} onPress={() => preset(6, '09:00', '19:00')} />
              <Chip label={tr('ob.presetAll')} onPress={() => preset(7, '10:00', '20:00')} />
            </View>
            {DAYS.map((d, i) => (
              <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54 }}>
                <Toggle on={rows[d].on} onChange={(v) => setRow(d, { on: v })} label={tr(`days.${DAY_KEY[i]}` as never)} />
                <Text style={{ width: 40, fontFamily: font.b, fontSize: 14, color: rows[d].on ? t.ink : t.ink3 }}>{tr(`days.${DAY_KEY[i]}` as never)}</Text>
                {rows[d].on ? (<>
                  <View style={{ flex: 1 }}><Field value={rows[d].from} onChangeText={(v) => setRow(d, { from: v })} accessibilityLabel={`${tr('ob.from')} ${tr(`days.${DAY_KEY[i]}` as never)}`} keyboardType="numbers-and-punctuation" maxLength={5} boxStyle={{ height: 44, borderRadius: 14 }} style={{ height: 42, textAlign: 'center' }} /></View>
                  <Text style={{ color: t.ink3 }}>-</Text>
                  <View style={{ flex: 1 }}><Field value={rows[d].to} onChangeText={(v) => setRow(d, { to: v })} accessibilityLabel={`${tr('ob.to')} ${tr(`days.${DAY_KEY[i]}` as never)}`} keyboardType="numbers-and-punctuation" maxLength={5} boxStyle={{ height: 44, borderRadius: 14 }} style={{ height: 42, textAlign: 'center' }} /></View>
                </>) : <T k="sm" color={t.ink3} style={{ flex: 1 }}>{tr('ob.closedDay')}</T>}
              </View>
            ))}
          </>) : null}

          {step === 3 ? (<>
            {label(tr('ob.teamSize'))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label={tr('ob.solo')} on={team === 'solo'} onPress={() => setTeam('solo')} />
              <Chip label={tr('ob.small')} on={team === 'small'} onPress={() => setTeam('small')} />
              <Chip label={tr('ob.big')} on={team === 'big'} onPress={() => setTeam('big')} />
            </View>
            <T k="sm" color={t.muted}>{team === 'solo' ? tr('ob.soloHint') : tr('ob.teamHint')}</T>
            {label(tr('ob.firstService'))}
            <Field icon="scissors" placeholder={tr('ob.svcName')} accessibilityLabel={tr('ob.svcName')} value={svcName} onChangeText={setSvcName} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field placeholder={tr('ob.svcMin')} accessibilityLabel={tr('ob.svcMin')} value={svcMin} onChangeText={setSvcMin} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field placeholder={tr('ob.svcPrice')} accessibilityLabel={tr('ob.svcPrice')} value={svcPrice} onChangeText={setSvcPrice} keyboardType="decimal-pad" /></View>
            </View>
            <T k="xs" color={t.ink3}>{tr('ob.laterHint')}</T>
          </>) : null}

          {error ? <T k="sm" color={t.gink} style={{ backgroundColor: t.gsoft, borderRadius: 16, padding: 12 }}>{error}</T> : null}
          {step === 0 ? (
            <Pressable onPress={() => router.back()} accessibilityRole="link" style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.r, fontSize: 12.5, color: t.ink3 }}>{tr('ob.haveAccount')} <Text style={{ fontFamily: font.b, color: t.vtext }}>{tr('v2.signIn')}</Text></Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <CtaBar>
        <Button label={step === 3 ? tr('ob.create') : tr('ob.next')} onPress={next} loading={busy} disabled={(!can && !(step === 1 && bizName.trim() && cat)) || closed} style={{ flex: 1 }} />
        {step === 3 ? <Button label={tr('ob.skip')} kind="ol" onPress={() => void submit(true)} disabled={busy} /> : null}
      </CtaBar>
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
