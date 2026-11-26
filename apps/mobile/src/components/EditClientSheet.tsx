import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, MultiChoice, SectionTitle, ToggleRow } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Field } from '@/components/ui';
import { t as tr } from '@/i18n';
import type { Client, ClientWithStats } from '@/lib/api';
import { apiX, type ClientField, type ClientTag } from '@/lib/api-ext';
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
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const { height } = useWindowDimensions();
  const [patch, setPatch] = useState((c as { patchTestDate?: string | null }).patchTestDate?.slice(0, 10) ?? '');
  const [allTags, setAllTags] = useState<ClientTag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [fields, setFields] = useState<ClientField[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || !sid) return;
    void apiX.clientTags(sid).then(setAllTags).catch(() => undefined);
    void apiX.clientCrm(sid, client.id).then((r) => setTagIds((r.tags ?? []).map((x) => String(x.id)))).catch(() => undefined);
    void apiX.clientFields(sid, client.id).then((f) => { setFields(f); setVals(Object.fromEntries(f.map((x) => [String(x.id), x.value ?? '']))); }).catch(() => undefined);
  }, [open, sid, client.id]);
  async function addTag() {
    const n = newTag.trim(); if (!n) return;
    try { const tg = await apiX.createClientTag(sid, n); setAllTags((a) => [...a, tg]); setTagIds((a) => [...a, String(tg.id)]); setNewTag(''); } catch (e) { toast((e as Error).message, 'error'); }
  }
  const [busy, setBusy] = useState(false);
  const needContact = !phone.trim() && !email.trim();
  async function save() {
    setBusy(true);
    try {
      await apiX.updateClient(client.id, { firstName: first.trim(), lastName: last.trim(), phone: phone.trim(), email: email.trim(), allowMarketingEmails: mkt, allowSmsNotifications: sms, patchTestDate: /^\d{4}-\d{2}-\d{2}$/.test(patch) ? patch : undefined });
      await apiX.setClientTags(sid, client.id, tagIds).catch(() => undefined);
      if (fields.length) await apiX.setClientFields(sid, client.id, vals).catch(() => undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); onSaved();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 12 }}>{tr('cx.edit')}</Text>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.68 }}>
      <Field label={tr('create.firstName')} value={first} onChangeText={setFirst} autoCapitalize="words" />
      <Field label={tr('create.lastName')} value={last} onChangeText={setLast} autoCapitalize="words" />
      <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label={tr('cl.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <ToggleRow label={tr('cl.consentMarketing')} value={mkt} onChange={setMkt} />
      <ToggleRow label={tr('cl.consentSms')} value={sms} onChange={setSms} />
      <Field label={tr('pa.patchTest')} value={patch} onChangeText={setPatch} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
      <SectionTitle>{tr('pa.tags')}</SectionTitle>
      {allTags.length ? <MultiChoice value={tagIds} onChange={setTagIds} options={allTags.map((x) => ({ value: String(x.id), label: x.name }))} /> : null}
      <Field label={tr('pa.newTag')} value={newTag} onChangeText={setNewTag} onSubmitEditing={() => void addTag()} returnKeyType="done" maxLength={40} />
      {fields.length ? <SectionTitle>{tr('pa.customFields')}</SectionTitle> : null}
      {fields.map((f) => {
        const k = String(f.id);
        if (f.type === 'SELECT') return <View key={k}><Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 4 }}>{f.name}</Text><Choice value={vals[k] ?? ''} onChange={(v) => setVals((m) => ({ ...m, [k]: v }))} options={[{ value: '', label: '-' }, ...(f.options ?? []).map((o) => ({ value: o, label: o }))]} /></View>;
        return <Field key={k} label={f.name} value={vals[k] ?? ''} onChangeText={(v) => setVals((m) => ({ ...m, [k]: v }))} keyboardType={f.type === 'NUMBER' ? 'decimal-pad' : f.type === 'DATE' ? 'numbers-and-punctuation' : 'default'} placeholder={f.type === 'DATE' ? 'YYYY-MM-DD' : undefined} />;
      })}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, paddingBottom: 16 }}>
        <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} disabled={!first.trim() || needContact} onPress={() => void save()} />
      </View>
    </BottomSheet>
  );
}
