import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, Image, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, ErrorState, Field, Header, HeroCard, Screen, Section, Skeleton, StickyCta, photoUrl } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiB, type BizProfile } from '@/lib/api-biz';
import { apiO } from '@/lib/api-onboard';
import { GallerySheet } from '@/screens/HubExtras';
import { getLocale } from '@/i18n';
import { Choice, MultiChoice, SectionTitle } from '@/components/form';
import { useApp } from '@/lib/app';
import { pickAndUpload } from '@/lib/pick';
import { LocationField } from '@/components/LocationField';
import { pinOf, type Pin } from '@/lib/geo';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Salon profili: name, contact, address, online booking rules, deposit, logo. */
const fromMinText = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function Profile({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiB.business(sid), [sid]);
  const [f, setF] = useState<Record<string, string>>({});
  const [online, setOnline] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [gal, setGal] = useState(false);
  const [pay, setPay] = useState<string[]>(['CASH', 'CARD']);
  const [assign, setAssign] = useState('FAIR_EARNINGS');
  const [parallel, setParallel] = useState(false);
  const conf = useLoad(() => apiB.bookingSettings(sid).catch(() => null), [sid]);
  const [manual, setManual] = useState(false);
  const [step, setStep] = useState(15);
  useEffect(() => { if (conf.data) { setManual(!!conf.data.requireConfirmation); setStep(conf.data.slotIntervalMinutes ?? 15); } }, [conf.data]);
  async function pickStep(v: number) {
    if (v === step) return;
    const prev = step;
    setStep(v);
    try { await apiB.saveSlotInterval(sid, v); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); toast(tr('n4.modeSaved'), 'success'); }
    catch (e) { setStep(prev); toast((e as Error).message, 'error'); }
  }
  async function pickMode(v: boolean) {
    if (v === manual) return;
    setManual(v);
    try { await apiB.saveConfirmation(sid, v); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); toast(tr('n4.modeSaved'), 'success'); }
    catch (e) { setManual(!v); toast((e as Error).message, 'error'); }
  }
  const cats = useLoad(() => apiO.categories(getLocale()).catch(() => []), []);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState<Pin | null>(null);
  const [pinMiss, setPinMiss] = useState(false);
  useEffect(() => {
    const b = q.data; if (!b) return;
    setPin(pinOf(b));
    setF({ name: b.name ?? '', description: b.description ?? '', phone: b.phone ?? '', email: b.email ?? '', website: b.website ?? '', address: b.address ?? '', city: b.city ?? '', notice: String(b.minBookingNoticeMinutes ?? ''), ahead: String(b.maxBookingDaysAhead ?? ''), cancelH: String(b.cancellationWindowHours ?? ''), deposit: String(b.depositPercent ?? ''), review: b.googleReviewUrl ?? '', category: b.category ?? '', building: (b as { buildingNumber?: string }).buildingNumber ?? '', zip: (b as { zipCode?: string }).zipCode ?? '', state: (b as { state?: string }).state ?? '', country: b.country ?? '', apartment: (b as { apartmentNumber?: string }).apartmentNumber ?? '', hsNote: (b as { healthSafetyNote?: string }).healthSafetyNote ?? '', tax: b.taxRate != null ? String(b.taxRate) : '', lateFee: b.lateCancellationFee != null ? String(b.lateCancellationFee) : '', footer: b.receiptFooter ?? '', brand: (b as { brandColor?: string }).brandColor ?? '' });
    setOnline(b.onlineBookingEnabled ?? true); setLogo(b.logoUrl ?? null); setCover(b.coverImageUrl ?? null);
    setAssign((b as { staffAssignmentMode?: string }).staffAssignmentMode ?? 'FAIR_EARNINGS'); setParallel(!!(b as { allowParallelServices?: boolean }).allowParallelServices);
    setPay((b.acceptedPaymentMethods ?? 'CASH,CARD').split(',').map((x) => x.trim()).filter(Boolean));
  }, [q.data]);
  const set = (k: string) => (v: string) => setF((m) => ({ ...m, [k]: v }));
  const int = (k: string) => { const n = Math.round(num(f[k] ?? '')); return Number.isFinite(n) && n >= 0 ? n : undefined; };
  async function save() {
    if (!pin) { setPinMiss(true); toast(tr('lp.blocked'), 'error'); return; }
    if (!(f.name ?? '').trim()) { toast(tr('tm.needName'), 'error'); return; }
    const body: Partial<BizProfile> = { name: f.name.trim(), description: f.description, phone: f.phone, email: f.email, website: f.website, address: f.address, city: f.city, latitude: pin.latitude, longitude: pin.longitude, onlineBookingEnabled: online, minBookingNoticeMinutes: int('notice'), maxBookingDaysAhead: int('ahead'), cancellationWindowHours: int('cancelH'), depositPercent: int('deposit'), category: f.category || undefined, taxRate: f.tax?.trim() ? num(f.tax) : undefined, lateCancellationFee: f.lateFee?.trim() ? num(f.lateFee) : undefined, receiptFooter: f.footer ?? '', acceptedPaymentMethods: pay.join(','), staffAssignmentMode: assign, allowParallelServices: parallel, healthSafetyNote: f.hsNote ?? '', buildingNumber: f.building || undefined, zipCode: f.zip || undefined, state: f.state || undefined, country: f.country || undefined, apartmentNumber: f.apartment || undefined, ...(/^#[0-9a-fA-F]{6}$/.test(f.brand ?? '') ? { brandColor: f.brand } : {}) } as Partial<BizProfile>;
    setBusy(true);
    try { await apiB.updateBusiness(sid, body); if ((f.review ?? '') !== (q.data?.googleReviewUrl ?? '')) await apiB.setReviewLink(sid, f.review ? f.review : null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); bump(); toast(tr('ns.saved'), 'success'); onBack(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function pickLogo() {
    try { const up = await pickAndUpload('BUSINESS_LOGO'); if (up) { await apiB.updateBusiness(sid, { logoUrl: up.url }); setLogo(up.url); bump(); } }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function pickCover() {
    try { const up = await pickAndUpload('BUSINESS_COVER'); if (up) { await apiB.updateBusiness(sid, { coverImageUrl: up.url }); setCover(up.url); bump(); } }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  return (
    <Screen>
      <Header title={tr('pf.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={6} height={52} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }}>
          <HeroCard photo={logo ?? null} title={f.name || salon?.name || ''} sub={[f.city, f.address].filter(Boolean).join(' · ')}>
            <Btn small label={tr('ux.changePhoto')} variant="secondary" icon="img" onPress={() => void pickLogo()} />
            <Btn small label={tr('hx.galTitle')} variant="secondary" icon="img" onPress={() => setGal(true)} />
            <Btn small label={cover ? tr('pa.changeCover') : tr('pa.addCover')} variant="secondary" icon="img" onPress={() => void pickCover()} />
          </HeroCard>
          <Section title={tr('ux.secBasics')}>
            <Field label={tr('sx.name')} value={f.name ?? ''} onChangeText={set('name')} />
            <Field label={tr('sx.description')} value={f.description ?? ''} onChangeText={set('description')} multiline style={{ minHeight: 84, paddingTop: 6, textAlignVertical: 'top' }} />
          </Section>
          <Section title={tr('pa.secCategory')}>
            <Choice value={f.category ?? ''} onChange={(v) => set('category')(v)} options={(cats.data ?? []).map((c) => ({ value: c.name, label: c.label }))} />
          </Section>
          <Section title={tr('ux.secContact')}>
            <Field label={tr('create.phone')} value={f.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" />
            <Field label={tr('cl.email')} value={f.email ?? ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Website" value={f.website ?? ''} onChangeText={set('website')} keyboardType="url" autoCapitalize="none" />
          </Section>
          <Section title={tr('ux.secAddress')}>
            <Field label={tr('set.address')} value={f.address ?? ''} onChangeText={set('address')} />
            <Field label="City" value={f.city ?? ''} onChangeText={set('city')} />
            <LocationField value={pin} error={pinMiss && !pin} query={[f.address, f.city].filter(Boolean).join(', ')} onChange={(r) => { setPin({ latitude: r.latitude, longitude: r.longitude }); setPinMiss(false); setF((o) => ({ ...o, ...(!(o.address ?? '').trim() && r.address ? { address: r.address } : {}), ...(!(o.city ?? '').trim() && r.city ? { city: r.city } : {}) })); }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('pa.zip')} value={f.zip ?? ''} onChangeText={set('zip')} /></View>
              <View style={{ flex: 1 }}><Field label={tr('pa.state')} value={f.state ?? ''} onChangeText={set('state')} /></View>
            </View>
            <Field label={tr('pa.country')} value={f.country ?? ''} onChangeText={set('country')} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('pa.building')} value={f.building ?? ''} onChangeText={set('building')} /></View>
              <View style={{ flex: 1 }}><Field label={tr('pa.apartment')} value={f.apartment ?? ''} onChangeText={set('apartment')} /></View>
            </View>
          </Section>
          <Section title={tr('ux.secOnline')}>
            <ToggleRow label={tr('pf.online')} value={online} onChange={setOnline} />
            <SectionTitle>{tr('n4.confTitle')}</SectionTitle>
            {([[false, tr('n4.confAuto'), tr('n4.confAutoSub')], [true, tr('n4.confManual'), tr('n4.confManualSub')]] as const).map(([v, label, sub]) => (
              <Pressable key={String(v)} onPress={() => void pickMode(v)} accessibilityRole="radio" accessibilityState={{ selected: manual === v }} accessibilityLabel={label}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: manual === v ? t.violet : t.hair, backgroundColor: manual === v ? t.vsoft : t.surface }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: manual === v ? t.violet : t.ink3, alignItems: 'center', justifyContent: 'center' }}>
                  {manual === v ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.violet }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{label}</Text>
                  <Text style={{ fontFamily: font.r, fontSize: 13, color: t.muted }}>{sub}</Text>
                </View>
              </Pressable>
            ))}
            <SectionTitle>{`${tr('n4.slotStep')} (${tr('common.min')})`}</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[5, 10, 15, 20, 25, 30].map((v) => (
                <Pressable key={v} onPress={() => void pickStep(v)} accessibilityRole="radio" accessibilityState={{ selected: step === v }} accessibilityLabel={`${v} ${tr('common.min')}`}
                  style={{ flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: step === v ? t.violet : t.hair, backgroundColor: step === v ? t.vsoft : t.surface }}>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: step === v ? t.vtext : t.ink }}>{v}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontFamily: font.r, fontSize: 13, color: t.muted }}>{tr('n4.slotStepHint', { a: '09:00', b: fromMinText(540 + step) })}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('pf.notice')} value={f.notice ?? ''} onChangeText={set('notice')} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('pf.ahead')} value={f.ahead ?? ''} onChangeText={set('ahead')} keyboardType="number-pad" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('pf.cancelH')} value={f.cancelH ?? ''} onChangeText={set('cancelH')} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('sx.deposit')} value={f.deposit ?? ''} onChangeText={set('deposit')} keyboardType="number-pad" /></View>
            </View>
            <Field label={tr('pa.lateFee')} value={f.lateFee ?? ''} onChangeText={set('lateFee')} keyboardType="decimal-pad" />
            <SectionTitle>{tr('pa.payMethods')}</SectionTitle>
            <MultiChoice value={pay} onChange={setPay} options={[{ value: 'CASH', label: tr('sales.m.CASH') }, { value: 'CARD', label: tr('sales.m.CARD_TERMINAL') }, { value: 'ONLINE', label: tr('pa.payOnline') }]} />
            <Field label={tr('pf.reviewUrl')} value={f.review ?? ''} onChangeText={set('review')} keyboardType="url" autoCapitalize="none" />
          </Section>
          <Section title={tr('pa.secRules')}>
            <SectionTitle>{tr('pa.assignMode')}</SectionTitle>
            <Choice value={assign} onChange={setAssign} options={[{ value: 'FAIR_EARNINGS', label: tr('pa.assignFair') }, { value: 'ROUND_ROBIN', label: tr('pa.assignRound') }, { value: 'PRIORITY', label: tr('pa.assignPriority') }]} />
            <ToggleRow label={tr('pa.parallel')} hint={tr('pa.parallelHint')} value={parallel} onChange={setParallel} />
            <Field label={tr('pa.healthNote')} value={f.hsNote ?? ''} onChangeText={set('hsNote')} multiline maxLength={2000} style={{ minHeight: 70, paddingTop: 6, textAlignVertical: 'top' }} />
          </Section>
          <Section title={tr('pa.secReceipts')}>
            <Field label={tr('pa.tax')} value={f.tax ?? ''} onChangeText={set('tax')} keyboardType="decimal-pad" />
            <Field label={tr('pa.footer')} value={f.footer ?? ''} onChangeText={set('footer')} multiline maxLength={2000} style={{ minHeight: 70, paddingTop: 6, textAlignVertical: 'top' }} />
          </Section>
          <Section title={tr('ux.secBrand')}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 2 }}>
              {['#6f52ed', '#e83e63', '#1d1730', '#12704b', '#d99a1e', '#2a7de1'].map((c) => (
                <Pressable key={c} onPress={() => set('brand')(c)} accessibilityRole="button" accessibilityLabel={c} noScale style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: (f.brand ?? '').toLowerCase() === c ? 3 : 0, borderColor: t.surface, boxShadow: (f.brand ?? '').toLowerCase() === c ? `0 0 0 2px ${c}` : 'none' } as any}>{(f.brand ?? '').toLowerCase() === c ? <Icon name="check" size={20} color="#fff" /> : null}</Pressable>
              ))}
            </View>
            <Field label={tr('x3.brandColor')} value={f.brand ?? ''} onChangeText={set('brand')} autoCapitalize="none" autoCorrect={false} maxLength={7} />
          </Section>
        </ScrollView>
      )}
      <GallerySheet open={gal} onClose={() => setGal(false)} />
      {q.data ? <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} /> : null}
    </Screen>
  );
}
