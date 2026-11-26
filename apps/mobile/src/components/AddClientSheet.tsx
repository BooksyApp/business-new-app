import React, { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Text } from '@/components/Text';
import { Btn, Field } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type Client } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** "Müştəri əlavə et" sheet (BF48-3): name is required, e-mail or phone, two consents recorded on create. */
export function AddClientSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: Client) => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [mkt, setMkt] = useState(false);
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const needContact = !phone.trim() && !email.trim();

  async function save() {
    if (!salon) return;
    setBusy(true);
    try {
      const c = await api.createClient(salon.id, {
        firstName: first.trim(), lastName: last.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined,
        allowMarketingEmails: mkt, allowSmsNotifications: sms,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump();
      setFirst(''); setLast(''); setPhone(''); setEmail(''); setMkt(false); setSms(false);
      onCreated(c);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(tr('cl.addFailed'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (label: string, v: boolean, set: (b: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
      <Text style={{ flex: 1, fontFamily: font.m, fontSize: 14.5, color: t.ink }}>{label}</Text>
      <Switch value={v} onValueChange={set} accessibilityLabel={label} trackColor={{ true: t.violet, false: t.fill2 }} />
    </View>
  );

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 14 }}>{tr('cl.addTitle')}</Text>
      <Field label={tr('create.firstName')} value={first} onChangeText={setFirst} autoCapitalize="words" returnKeyType="next" />
      <Field label={tr('create.lastName')} value={last} onChangeText={setLast} autoCapitalize="words" returnKeyType="next" />
      <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label={tr('cl.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      {needContact && first.trim() ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginTop: -6, marginBottom: 8 }}>{tr('cl.needContact')}</Text> : null}
      {toggle(tr('cl.consentMarketing'), mkt, setMkt)}
      {toggle(tr('cl.consentSms'), sms, setSms)}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, paddingBottom: 16 }}>
        <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} disabled={!first.trim() || needContact} onPress={() => void save()} />
      </View>
    </BottomSheet>
  );
}
