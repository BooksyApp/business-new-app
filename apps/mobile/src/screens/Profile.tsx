import React, { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ToggleRow, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, ErrorState, Field, Header, HeroCard, Screen, Skeleton } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { ListItem } from '@/components/kit';
import { t as tr } from '@/i18n';
import { apiB, type BizProfile } from '@/lib/api-biz';
import { apiO } from '@/lib/api-onboard';
import { GallerySheet } from '@/screens/HubExtras';
import { getLocale } from '@/i18n';
import { Choice, MultiChoice } from '@/components/form';
import { useApp } from '@/lib/app';
import { pickAndUpload } from '@/lib/pick';
import { LocationField } from '@/components/LocationField';
import { pinOf, type Pin } from '@/lib/geo';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Salon profili: name, contact, address, online booking rules, deposit, logo. */
const fromMinText = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
type Group = 'basics' | 'contact' | 'address' | 'booking' | 'pay' | 'team' | 'look';
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
  const [grp, setGrp] = useState<Group | null>(null);
  const [err, setErr] = useState('');
  const { height: H } = useWindowDimensions();
  const [pin, setPin] = useState<Pin | null>(null);
  const [pinMiss, setPinMiss] = useState(false);
  const hydrate = (b: BizProfile) => {
    setPin(pinOf(b));
    setF({ name: b.name ?? '', description: b.description ?? '', phone: b.phone ?? '', email: b.email ?? '', website: b.website ?? '', address: b.address ?? '', city: b.city ?? '', notice: String(b.minBookingNoticeMinutes ?? ''), ahead: String(b.maxBookingDaysAhead ?? ''), cancelH: String(b.cancellationWindowHours ?? ''), deposit: String(b.depositPercent ?? ''), review: b.googleReviewUrl ?? '', category: b.category ?? '', building: (b as { buildingNumber?: string }).buildingNumber ?? '', zip: (b as { zipCode?: string }).zipCode ?? '', state: (b as { state?: string }).state ?? '', country: b.country ?? '', apartment: (b as { apartmentNumber?: string }).apartmentNumber ?? '', hsNote: (b as { healthSafetyNote?: string }).healthSafetyNote ?? '', tax: b.taxRate != null ? String(b.taxRate) : '', lateFee: b.lateCancellationFee != null ? String(b.lateCancellationFee) : '', footer: b.receiptFooter ?? '', brand: (b as { brandColor?: string }).brandColor ?? '' });
    setOnline(b.onlineBookingEnabled ?? true);
    setAssign((b as { staffAssignmentMode?: string }).staffAssignmentMode ?? 'FAIR_EARNINGS'); setParallel(!!(b as { allowParallelServices?: boolean }).allowParallelServices);
    setPay((b.acceptedPaymentMethods ?? 'CASH,CARD').split(',').map((x) => x.trim()).filter(Boolean));
  };
  useEffect(() => { const b = q.data; if (!b) return; hydrate(b); setLogo(b.logoUrl ?? null); setCover(b.coverImageUrl ?? null); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string) => (v: string) => setF((m) => ({ ...m, [k]: v }));
  const int = (k: string) => { const n = Math.round(num(f[k] ?? '')); return Number.isFinite(n) && n >= 0 ? n : undefined; };
  async function save() {
    setErr('');
    if (!pin) { setPinMiss(true); setErr(tr('lp.blocked')); setGrp('address'); return; }
    if (!(f.name ?? '').trim()) { setErr(tr('tm.needName')); setGrp('basics'); return; }
    const body: Partial<BizProfile> = { name: f.name.trim(), description: f.description, phone: f.phone, email: f.email, website: f.website, address: f.address, city: f.city, latitude: pin.latitude, longitude: pin.longitude, onlineBookingEnabled: online, minBookingNoticeMinutes: int('notice'), maxBookingDaysAhead: int('ahead'), cancellationWindowHours: int('cancelH'), depositPercent: int('deposit'), category: f.category || undefined, taxRate: f.tax?.trim() ? num(f.tax) : undefined, lateCancellationFee: f.lateFee?.trim() ? num(f.lateFee) : undefined, receiptFooter: f.footer ?? '', acceptedPaymentMethods: pay.join(','), staffAssignmentMode: assign, allowParallelServices: parallel, healthSafetyNote: f.hsNote ?? '', buildingNumber: f.building || undefined, zipCode: f.zip || undefined, state: f.state || undefined, country: f.country || undefined, apartmentNumber: f.apartment || undefined, ...(/^#[0-9a-fA-F]{6}$/.test(f.brand ?? '') ? { brandColor: f.brand } : {}) } as Partial<BizProfile>;
    setBusy(true);
    try { await apiB.updateBusiness(sid, body); if ((f.review ?? '') !== (q.data?.googleReviewUrl ?? '')) await apiB.setReviewLink(sid, f.review ? f.review : null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); bump(); toast(tr('ns.saved'), 'success'); setGrp(null); void q.reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function pickLogo() {
    try { const up = await pickAndUpload('BUSINESS_LOGO'); if (up) { await apiB.updateBusiness(sid, { logoUrl: up.url }); setLogo(up.url); bump(); } }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  async function pickCover() {
    try { const up = await pickAndUpload('BUSINESS_COVER'); if (up) { await apiB.updateBusiness(sid, { coverImageUrl: up.url }); setCover(up.url); bump(); } }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  const closeSheet = () => { setGrp(null); setErr(''); setPinMiss(false); if (q.data) hydrate(q.data); };
  const catLabel = (cats.data ?? []).find((c) => c.name === f.category)?.label ?? f.category ?? '';
  const join = (a: (string | undefined | false)[], sep = ' · ') => a.filter(Boolean).join(sep);
  const empty = tr('pa.sumEmpty');
  const payLabel: Record<string, string> = { CASH: tr('sales.m.CASH'), CARD: tr('sales.m.CARD_TERMINAL'), ONLINE: tr('pa.payOnline') };
  const assignLabel: Record<string, string> = { FAIR_EARNINGS: tr('pa.assignFair'), ROUND_ROBIN: tr('pa.assignRound'), PRIORITY: tr('pa.assignPriority') };
  const rows: { key: Group; icon: string; title: string; sub: string }[] = [
    { key: 'basics', icon: 'store', title: tr('ux.secBasics'), sub: join([f.name, catLabel]) || empty },
    { key: 'contact', icon: 'phone', title: tr('ux.secContact'), sub: join([f.phone, f.email, f.website]) || empty },
    { key: 'address', icon: 'pin', title: tr('pa.gAddress'), sub: pin ? (join([f.address, f.city], ', ') || tr('pa.pinSet')) : tr('pa.noPin') },
    { key: 'booking', icon: 'cal', title: tr('pa.gBooking'), sub: join([online ? tr('pa.sumOn') : tr('pa.sumOff'), manual ? tr('pa.sumManual') : tr('pa.sumAuto'), `${step} ${tr('common.min')}`]) },
    { key: 'pay', icon: 'wallet', title: tr('pa.gPay'), sub: join([pay.map((x) => payLabel[x] ?? x).join(', '), f.tax ? `${tr('pa.tax')}: ${f.tax}` : undefined]) || empty },
    { key: 'team', icon: 'users', title: tr('pa.gTeam'), sub: join([assignLabel[assign] ?? assign, parallel ? tr('pa.parallel') : undefined]) },
    { key: 'look', icon: 'img', title: tr('pa.gLook'), sub: tr('pa.sumLook') },
  ];
  const sub = (label: string) => <Text numberOfLines={1} accessibilityRole="header" style={{ fontFamily: font.b, fontSize: 15, color: t.ink, marginTop: 6 }}>{label}</Text>;
  const hint = (label: string) => <Text style={{ fontFamily: font.r, fontSize: 13, color: t.muted }}>{label}</Text>;
  const two = (a: React.ReactNode, b: React.ReactNode) => <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}>{a}</View><View style={{ flex: 1 }}>{b}</View></View>;
  const body = (g: Group) => {
    switch (g) {
      case 'basics': return (<>
        <Field label={tr('sx.name')} value={f.name ?? ''} onChangeText={set('name')} />
        <Field label={tr('sx.description')} value={f.description ?? ''} onChangeText={set('description')} multiline style={{ minHeight: 84, paddingTop: 6, textAlignVertical: 'top' }} />
        {sub(tr('pa.secCategory'))}
        <Choice value={f.category ?? ''} onChange={(v) => set('category')(v)} options={(cats.data ?? []).map((c) => ({ value: c.name, label: c.label }))} />
      </>);
      case 'contact': return (<>
        <Field label={tr('create.phone')} value={f.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label={tr('cl.email')} value={f.email ?? ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Website" value={f.website ?? ''} onChangeText={set('website')} keyboardType="url" autoCapitalize="none" />
      </>);
      case 'address': return (<>
        <LocationField value={pin} error={pinMiss && !pin} query={[f.address, f.city].filter(Boolean).join(', ')} onChange={(r) => { setPin({ latitude: r.latitude, longitude: r.longitude }); setPinMiss(false); setErr(''); setF((o) => ({ ...o, ...(r.address ? { address: r.address } : {}), ...(r.city ? { city: r.city } : {}), ...(r.address ? { building: r.building ?? '' } : {}), ...(r.zip ? { zip: r.zip } : {}), ...(r.country ? { country: r.country } : {}) })); }} />
        <Field label={tr('set.address')} value={f.address ?? ''} onChangeText={set('address')} />
        {two(<Field label={tr('pa.building')} value={f.building ?? ''} onChangeText={set('building')} />, <Field label={`${tr('pa.apartment')} (${tr('ob.optional')})`} value={f.apartment ?? ''} onChangeText={set('apartment')} />)}
        <Field label={tr('ob.city')} value={f.city ?? ''} onChangeText={set('city')} />
        {two(<Field label={tr('pa.zip')} value={f.zip ?? ''} onChangeText={set('zip')} />, <Field label={tr('pa.country')} value={f.country ?? ''} onChangeText={set('country')} />)}
      </>);
      case 'booking': return (<>
        <ToggleRow label={tr('pf.online')} value={online} onChange={setOnline} />
        {sub(tr('n4.confTitle'))}
        {([[false, tr('n4.confAuto'), tr('n4.confAutoSub')], [true, tr('n4.confManual'), tr('n4.confManualSub')]] as const).map(([v, label, s]) => (
          <Pressable key={String(v)} onPress={() => void pickMode(v)} accessibilityRole="radio" accessibilityState={{ selected: manual === v }} accessibilityLabel={label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: manual === v ? t.violet : t.hair, backgroundColor: manual === v ? t.vsoft : t.surface }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: manual === v ? t.violet : t.ink3, alignItems: 'center', justifyContent: 'center' }}>
              {manual === v ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.violet }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{label}</Text>
              <Text numberOfLines={2} style={{ fontFamily: font.r, fontSize: 13, color: t.muted }}>{s}</Text>
            </View>
          </Pressable>
        ))}
        {sub(`${tr('n4.slotStep')} (${tr('common.min')})`)}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[5, 10, 15, 20, 25, 30].map((v) => (
            <Pressable key={v} onPress={() => void pickStep(v)} accessibilityRole="radio" accessibilityState={{ selected: step === v }} accessibilityLabel={`${v} ${tr('common.min')}`}
              style={{ flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: step === v ? t.violet : t.hair, backgroundColor: step === v ? t.vsoft : t.surface }}>
              <Text style={{ fontFamily: font.b, fontSize: 15, color: step === v ? t.vtext : t.ink }}>{v}</Text>
            </Pressable>
          ))}
        </View>
        {hint(tr('n4.slotStepHint', { a: '09:00', b: fromMinText(540 + step) }))}
        {two(<Field label={tr('pf.notice')} value={f.notice ?? ''} onChangeText={set('notice')} keyboardType="number-pad" />, <Field label={tr('pf.ahead')} value={f.ahead ?? ''} onChangeText={set('ahead')} keyboardType="number-pad" />)}
        {two(<Field label={tr('pf.cancelH')} value={f.cancelH ?? ''} onChangeText={set('cancelH')} keyboardType="number-pad" />, <Field label={tr('sx.deposit')} value={f.deposit ?? ''} onChangeText={set('deposit')} keyboardType="number-pad" />)}
        <Field label={tr('pa.lateFee')} value={f.lateFee ?? ''} onChangeText={set('lateFee')} keyboardType="decimal-pad" />
      </>);
      case 'pay': return (<>
        {sub(tr('pa.payMethods'))}
        <MultiChoice value={pay} onChange={setPay} options={[{ value: 'CASH', label: tr('sales.m.CASH') }, { value: 'CARD', label: tr('sales.m.CARD_TERMINAL') }, { value: 'ONLINE', label: tr('pa.payOnline') }]} />
        <Field label={tr('pa.tax')} value={f.tax ?? ''} onChangeText={set('tax')} keyboardType="decimal-pad" />
        <Field label={tr('pa.footer')} value={f.footer ?? ''} onChangeText={set('footer')} multiline maxLength={2000} style={{ minHeight: 70, paddingTop: 6, textAlignVertical: 'top' }} />
        <Field label={tr('pf.reviewUrl')} value={f.review ?? ''} onChangeText={set('review')} keyboardType="url" autoCapitalize="none" />
      </>);
      case 'team': return (<>
        {sub(tr('pa.assignMode'))}
        <Choice value={assign} onChange={setAssign} options={[{ value: 'FAIR_EARNINGS', label: tr('pa.assignFair') }, { value: 'ROUND_ROBIN', label: tr('pa.assignRound') }, { value: 'PRIORITY', label: tr('pa.assignPriority') }]} />
        <ToggleRow label={tr('pa.parallel')} hint={tr('pa.parallelHint')} value={parallel} onChange={setParallel} />
        <Field label={tr('pa.healthNote')} value={f.hsNote ?? ''} onChangeText={set('hsNote')} multiline maxLength={2000} style={{ minHeight: 70, paddingTop: 6, textAlignVertical: 'top' }} />
      </>);
      case 'look': return (<>
        <View style={{ gap: 8 }}>
          <Btn label={tr('ux.changePhoto')} variant="secondary" icon="img" onPress={() => void pickLogo()} />
          <Btn label={cover ? tr('pa.changeCover') : tr('pa.addCover')} variant="secondary" icon="img" onPress={() => void pickCover()} />
          <Btn label={tr('hx.galTitle')} variant="secondary" icon="img" onPress={() => { setGrp(null); setGal(true); }} />
        </View>
        {sub(tr('ux.secBrand'))}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 2 }}>
          {['#6f52ed', '#e83e63', '#1d1730', '#12704b', '#d99a1e', '#2a7de1'].map((c) => (
            <Pressable key={c} onPress={() => set('brand')(c)} accessibilityRole="button" accessibilityLabel={c} noScale style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: (f.brand ?? '').toLowerCase() === c ? 3 : 0, borderColor: t.surface, boxShadow: (f.brand ?? '').toLowerCase() === c ? `0 0 0 2px ${c}` : 'none' } as any}>{(f.brand ?? '').toLowerCase() === c ? <Icon name="check" size={20} color="#fff" /> : null}</Pressable>
          ))}
        </View>
        <Field label={tr('x3.brandColor')} value={f.brand ?? ''} onChangeText={set('brand')} autoCapitalize="none" autoCorrect={false} maxLength={7} />
      </>);
    }
  };
  const cur = rows.find((r) => r.key === grp);
  return (
    <Screen>
      <Header title={tr('pf.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={6} height={52} /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
          <HeroCard photo={logo ?? null} title={f.name || salon?.name || ''} sub={[f.city, f.address].filter(Boolean).join(' · ')} />
          <View style={{ backgroundColor: t.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 4 }}>
            {rows.map((r, i) => (
              <ListItem key={r.key} first={i === 0} onPress={() => { setErr(''); setGrp(r.key); }} title={r.title} sub={r.sub}
                lead={<View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name={r.icon} size={19} color={t.ink} /></View>}
                right={<Icon name="chev" size={18} color={t.ink3} />} />
            ))}
          </View>
        </ScrollView>
      )}
      <BottomSheet open={grp !== null} onClose={closeSheet}>
        {cur && grp ? (
          <View>
            <Text numberOfLines={1} accessibilityRole="header" style={{ fontFamily: font.b, fontSize: 16, color: t.ink, marginBottom: 10 }}>{cur.title}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: H * 0.62 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {body(grp)}
            </ScrollView>
            {err ? <Text style={{ fontFamily: font.s, fontSize: 13, color: t.gink, marginTop: 8 }}>{err}</Text> : null}
            <View style={{ marginTop: 12 }}><Btn label={tr('common.save')} loading={busy} onPress={() => void save()} /></View>
          </View>
        ) : null}
      </BottomSheet>
      <GallerySheet open={gal} onClose={() => setGal(false)} />
    </Screen>
  );
}
