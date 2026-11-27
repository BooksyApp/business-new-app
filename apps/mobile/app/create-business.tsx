import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BackBar, Button, Chip, CtaBar, Field, T } from '@/components/kit';
import { Screen } from '@/components/ui';
import { LocationField } from '@/components/LocationField';
import type { Pin } from '@/lib/geo';
import { getLocale, t as tr } from '@/i18n';
import { api, ApiError } from '@/lib/api';
import { apiO, type BizCategory } from '@/lib/api-onboard';
import { useApp } from '@/lib/app';
import { toast } from '@/lib/toast';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Yeni salon: an additional business for the signed-in owner (POST /businesses, category required) or the first one when the account has none. */
export default function CreateBusiness() {
  const { t } = useTheme();
  const router = useRouter();
  const { user, salons, signedIn, chooseSalon } = useApp();
  const [name, setName] = useState('');
  const [cats, setCats] = useState<BizCategory[]>([]);
  const [cat, setCat] = useState('');
  const [city, setCity] = useState('Bakı');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState<Pin | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void apiO.categories(getLocale()).then(setCats).catch(() => undefined); }, []);

  async function create() {
    if (!user) return;
    if (!pin) { toast(tr('lp.blocked'), 'error'); return; }
    setBusy(true);
    try {
      const b = await apiO.createBusiness({ ownerId: user.userId, name: name.trim(), category: cat, city: city.trim() || undefined, address: address.trim() || undefined, country: 'Azerbaijan', phone: phone.trim() || undefined, latitude: pin.latitude, longitude: pin.longitude });
      const list = await api.salonsForUser(user).catch(() => [...salons, b]);
      await signedIn(user, list);
      const mine = list.find((x) => String(x.id) === String(b.id)) ?? b;
      chooseSalon(mine);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/today');
    } catch (e) { toast(e instanceof ApiError && e.status === 0 ? tr('common.offline') : (e as Error).message, 'error'); }
    finally { setBusy(false); }
  }
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackBar onBack={() => router.back()} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130, gap: 10 }}>
          <T k="h1" style={{ fontSize: 26 }}>{tr('ob.addSalon')}</T>
          <T k="body" color={t.muted} style={{ marginBottom: 6 }}>{tr('ob.addSalonSub')}</T>
          <Field icon="store" placeholder={tr('ob.bizName')} accessibilityLabel={tr('ob.bizName')} value={name} onChangeText={setName} />
          <T k="sm" color={t.muted} style={{ fontFamily: font.b, marginTop: 8, marginLeft: 4 }}>{tr('ob.category')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cats.map((c) => <Chip key={c.slug} label={c.label} on={cat === c.name} onPress={() => setCat(c.name)} />)}
          </View>
          <Field icon="pin" placeholder={tr('ob.city')} accessibilityLabel={tr('ob.city')} value={city} onChangeText={setCity} />
          <Field icon="pin" placeholder={tr('ob.street')} accessibilityLabel={tr('ob.street')} value={address} onChangeText={setAddress} />
          <LocationField value={pin} query={[address, city].filter(Boolean).join(', ')} onChange={(r) => { setPin({ latitude: r.latitude, longitude: r.longitude }); if (!address.trim() && r.address) setAddress(r.address); if (!city.trim() && r.city) setCity(r.city); }} />
          <Field icon="phone" placeholder={`${tr('ob.bizPhone')} (${tr('ob.optional')})`} accessibilityLabel={tr('ob.bizPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </ScrollView>
      </KeyboardAvoidingView>
      <CtaBar><Button label={tr('ob.create')} onPress={() => void create()} loading={busy} disabled={!name.trim() || !cat || !pin} style={{ flex: 1 }} /></CtaBar>
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
