import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { ToggleRow } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Field } from '@/components/ui';
import { t as tr } from '@/i18n';
import type { Client, ClientWithStats } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Edit an existing client: name, contact, consents. */
export function EditClientSheet({ client, open, onClose, onSaved }: { client: Client | ClientWithStats; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTheme();
  const { bump } = useApp();
  const c = client as Partial<ClientWithStats> & Client;
  const [first, setFirst] = useState(c.firstName ?? '');
  const [last, setLast] = useState(c.lastName ?? '');
  const [phone, setPhone] = useState(c.phone ?? '');
  const [email, setEmail] = useState(c.email ?? '');
  const [mkt, setMkt] = useState(!!c.allowMarketingEmails);
  const [sms, setSms] = useState(!!c.allowSmsNotifications);
  const [busy, setBusy] = useState(false);
  const needContact = !phone.trim() && !email.trim();
  async function save() {
    setBusy(true);
    try {
      await apiX.updateClient(client.id, { firstName: first.trim(), lastName: last.trim(), phone: phone.trim(), email: email.trim(), allowMarketingEmails: mkt, allowSmsNotifications: sms });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); onSaved();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 12 }}>{tr('cx.edit')}</Text>
      <Field label={tr('create.firstName')} value={first} onChangeText={setFirst} autoCapitalize="words" />
      <Field label={tr('create.lastName')} value={last} onChangeText={setLast} autoCapitalize="words" />
      <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label={tr('cl.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <ToggleRow label={tr('cl.consentMarketing')} value={mkt} onChange={setMkt} />
      <ToggleRow label={tr('cl.consentSms')} value={sms} onChange={setSms} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, paddingBottom: 16 }}>
        <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} disabled={!first.trim() || needContact} onPress={() => void save()} />
      </View>
    </BottomSheet>
  );
}
