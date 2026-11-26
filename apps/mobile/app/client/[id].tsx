import React, { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Field, Header, Pill, Row, Screen, Skeleton } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type Client, type ClientWithStats } from '@/lib/api';
import { useApp } from '@/lib/app';
import { recallClient } from '@/lib/client-cache';
import { dateLabel, digits, fromIso, hhmm, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const TONE = { PENDING: 'violet', CONFIRMED: 'violet', COMPLETED: 'ok', CANCELLED: 'muted', NO_SHOW: 'guava' } as const;

/** Client card: read-only profile and visit history; the only thing the salon can add is a note. */
export default function ClientCard() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = decodeURIComponent(String(id));
  const fromList = recallClient(key);
  const loaded = useLoad<Client | ClientWithStats | null>(async () => {
    if (fromList) return fromList;
    return (await api.clients(salon?.id ?? '')).find((c) => String(c.id) === key) ?? null;
  }, [key]);
  const client = loaded.data;
  const hasId = !!client?.id;
  const rec = useLoad(() => (client?.id ? api.clientRecord(salon?.id ?? '', client.id) : Promise.resolve(null)), [client?.id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const stats = (client ?? {}) as Partial<ClientWithStats>;
  const name = client ? `${client.firstName} ${client.lastName ?? ''}`.trim() : '';

  async function addNote() {
    if (!client || !salon) return;
    setBusy(true);
    try {
      await api.addClientNote(salon.id, client.id, note.trim());
      setNote('');
      await rec.reload();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title={name || tr('clients.title')} onBack={() => router.back()} />
      {!client ? <Skeleton rows={3} height={90} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: client.phone ? 14 : 0 }}>
              <Avatar name={name} size={60} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{client.phone}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{client.email}</Text>
              </View>
            </View>
            {client.phone ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn label={tr('common.call')} icon="phone" variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`tel:${client.phone}`)} />
                <Btn label={tr('common.whatsapp')} icon="chat" variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`https://wa.me/${digits(client.phone)}`)} />
              </View>
            ) : null}
          </Card>
          <Card style={{ paddingVertical: 8 }}>
            <Row label={tr('clients.visits')} value={String(stats.totalVisits ?? 0)} />
            <Row label={tr('clients.spent')} value={money(stats.totalSpent, salon?.currency)} />
            <Row label={tr('clients.lastVisit')} value={stats.lastVisitDate ? dateLabel(fromIso(stats.lastVisitDate)) : '-'} />
          </Card>
          {hasId ? (
            <>
              <Text style={{ fontFamily: font.x, fontSize: 19, color: t.ink, marginTop: 6 }}>{tr('clients.notes')}</Text>
              <Card>
                {client.notes ? <Text style={{ fontFamily: font.m, fontSize: 15, color: t.ink, marginBottom: 8 }}>{client.notes}</Text> : null}
                {(rec.data?.notes ?? []).map((n) => (
                  <View key={n.id} style={{ paddingVertical: 6 }}>
                    <Text style={{ fontFamily: font.m, fontSize: 15, color: t.ink }}>{n.body}</Text>
                    <Text style={{ fontFamily: font.m, fontSize: 12, color: t.muted }}>{[n.author_name, n.created_at?.slice(0, 10)].filter(Boolean).join(' · ')}</Text>
                  </View>
                ))}
                {!client.notes && !(rec.data?.notes ?? []).length ? <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted, marginBottom: 12 }}>{tr('clients.noNotes')}</Text> : null}
                <Field placeholder={tr('clients.noteHint')} value={note} onChangeText={setNote} multiline style={{ minHeight: 80, paddingTop: 14, textAlignVertical: 'top' }} />
                <Btn label={tr('clients.addNote')} disabled={!note.trim()} loading={busy} onPress={() => void addNote()} />
              </Card>
              <Text style={{ fontFamily: font.x, fontSize: 19, color: t.ink, marginTop: 6 }}>{tr('clients.history')}</Text>
              {rec.loading ? <Skeleton rows={2} height={64} /> : (rec.data?.visits ?? []).length === 0 ? (
                <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('clients.noHistory')}</Text>
              ) : (
                (rec.data?.visits ?? []).map((v) => (
                  <Card key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{v.service_name}</Text>
                      <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{dateLabel(fromIso(v.appointment_date))} · {hhmm(v.start_time)}{v.staff_name ? ` · ${v.staff_name}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 13.5, color: t.ink }}>{money(v.price, salon?.currency)}</Text>
                      <Pill text={tr(`status.${v.status as keyof typeof TONE}`)} tone={TONE[v.status as keyof typeof TONE] ?? 'muted'} />
                    </View>
                  </Card>
                ))
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
