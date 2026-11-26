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
import { useApp } from '@/lib/app';
import { pickAndUpload } from '@/lib/pick';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Salon profili: name, contact, address, online booking rules, deposit, logo. */
export function Profile({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiB.business(sid), [sid]);
  const [f, setF] = useState<Record<string, string>>({});
  const [online, setOnline] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const b = q.data; if (!b) return;
    setF({ name: b.name ?? '', description: b.description ?? '', phone: b.phone ?? '', email: b.email ?? '', website: b.website ?? '', address: b.address ?? '', city: b.city ?? '', notice: String(b.minBookingNoticeMinutes ?? ''), ahead: String(b.maxBookingDaysAhead ?? ''), cancelH: String(b.cancellationWindowHours ?? ''), deposit: String(b.depositPercent ?? ''), review: b.googleReviewUrl ?? '', brand: (b as { brandColor?: string }).brandColor ?? '' });
    setOnline(b.onlineBookingEnabled ?? true); setLogo(b.logoUrl ?? null);
  }, [q.data]);
  const set = (k: string) => (v: string) => setF((m) => ({ ...m, [k]: v }));
  const int = (k: string) => { const n = Math.round(num(f[k] ?? '')); return Number.isFinite(n) && n >= 0 ? n : undefined; };
  async function save() {
    if (!(f.name ?? '').trim()) { toast(tr('tm.needName'), 'error'); return; }
    const body: Partial<BizProfile> = { name: f.name.trim(), description: f.description, phone: f.phone, email: f.email, website: f.website, address: f.address, city: f.city, onlineBookingEnabled: online, minBookingNoticeMinutes: int('notice'), maxBookingDaysAhead: int('ahead'), cancellationWindowHours: int('cancelH'), depositPercent: int('deposit'), googleReviewUrl: f.review || null, ...(/^#[0-9a-fA-F]{6}$/.test(f.brand ?? '') ? { brandColor: f.brand } : {}) } as Partial<BizProfile>;
    setBusy(true);
    try { await apiB.updateBusiness(sid, body); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); bump(); toast(tr('ns.saved'), 'success'); onBack(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function pickLogo() {
    try { const up = await pickAndUpload('BUSINESS_LOGO'); if (up) { await apiB.updateBusiness(sid, { logoUrl: up.url }); setLogo(up.url); bump(); } }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  return (
    <Screen>
      <Header title={tr('pf.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={6} height={52} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }}>
          <HeroCard photo={logo ?? null} title={f.name || salon?.name || ''} sub={[f.city, f.address].filter(Boolean).join(' · ')}>
            <Btn small label={tr('ux.changePhoto')} variant="secondary" icon="img" onPress={() => void pickLogo()} />
          </HeroCard>
          <Section title={tr('ux.secBasics')}>
            <Field label={tr('sx.name')} value={f.name ?? ''} onChangeText={set('name')} />
            <Field label={tr('sx.description')} value={f.description ?? ''} onChangeText={set('description')} multiline style={{ minHeight: 84, paddingTop: 6, textAlignVertical: 'top' }} />
          </Section>
          <Section title={tr('ux.secContact')}>
            <Field label={tr('create.phone')} value={f.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" />
            <Field label={tr('cl.email')} value={f.email ?? ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Website" value={f.website ?? ''} onChangeText={set('website')} keyboardType="url" autoCapitalize="none" />
          </Section>
          <Section title={tr('ux.secAddress')}>
            <Field label={tr('set.address')} value={f.address ?? ''} onChangeText={set('address')} />
            <Field label="City" value={f.city ?? ''} onChangeText={set('city')} />
          </Section>
          <Section title={tr('ux.secOnline')}>
            <ToggleRow label={tr('pf.online')} value={online} onChange={setOnline} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('pf.notice')} value={f.notice ?? ''} onChangeText={set('notice')} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('pf.ahead')} value={f.ahead ?? ''} onChangeText={set('ahead')} keyboardType="number-pad" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label={tr('pf.cancelH')} value={f.cancelH ?? ''} onChangeText={set('cancelH')} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={tr('sx.deposit')} value={f.deposit ?? ''} onChangeText={set('deposit')} keyboardType="number-pad" /></View>
            </View>
            <Field label={tr('pf.reviewUrl')} value={f.review ?? ''} onChangeText={set('review')} keyboardType="url" autoCapitalize="none" />
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
      {q.data ? <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} /> : null}
    </Screen>
  );
}
