import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, ErrorState, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useDockInset } from '@/lib/dock';
import { addDays, dateLabel, fromIso, hhmm } from '@/lib/format';
import { enablePush } from '@/lib/push';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/**
 * No server-side inbox endpoint exists yet, so the list is derived (as in the old app): bookings waiting for the salon's
 * confirmation (next 30 days) and waitlist requests. The OS push prompt only appears after the button below.
 */
export default function Notifications() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, version, bump } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const inset = useDockInset(16);
  const [pushState, setPushState] = useState<'idle' | 'on' | 'failed'>('idle');
  const data = useLoad(async () => {
    const today = new Date();
    const [appts, waitlist] = await Promise.all([api.appointments(salon?.id ?? '', today, addDays(today, 30)), api.waitlist(salon?.id ?? '').catch(() => [])]);
    return { pending: appts.filter((a) => a.status === 'PENDING').sort((a, b) => `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`)), waitlist };
  }, [salon?.id, version]);
  const pending = data.data?.pending ?? [];
  const waitlist = data.data?.waitlist ?? [];
  async function confirm(id: string) {
    setBusyId(id);
    try {
      await api.confirmAppointment(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  const empty = !!data.data && !pending.length && !waitlist.length;

  return (
    <Screen>
      <Header title={tr('notifications.title')} subtitle={salon?.name} />
      {data.error && !data.data ? (
        <ErrorState error={data.error} onRetry={() => void data.reload()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: inset }}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.reload()} tintColor={t.violet} />}>
          <Card style={{ backgroundColor: t.vsoft, gap: 6 }}>
            <Text style={{ fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{pushState === 'on' ? tr('notifications.pushEnabled') : tr('notifications.pushOn')}</Text>
            <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginBottom: 6 }}>{pushState === 'failed' ? tr('notifications.pushFailed') : tr('notifications.pushOnHint')}</Text>
            {pushState !== 'on' ? <Btn label={tr('notifications.pushOn')} onPress={async () => setPushState((await enablePush()) ? 'on' : 'failed')} /> : null}
          </Card>
          {data.loading && !data.data ? <Skeleton rows={3} /> : null}
          {empty ? <StateView icon="bell" title={tr('notifications.empty')} /> : null}
          {pending.length ? <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, marginHorizontal: 4, marginTop: 4 }}>{tr('notifications.pending')}</Text> : null}
          {pending.map((a) => (
            <Pressable key={a.id} onPress={() => router.push(`/booking/${a.id}`)} accessibilityRole="button" accessibilityLabel={`${a.clientName ?? ''} ${a.serviceName ?? ''}`}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar name={a.clientName ?? ''} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{a.clientName || '-'}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{a.serviceName}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{dateLabel(fromIso(a.appointmentDate))} · {hhmm(a.startTime)} · {a.staffName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Pill text={tr('status.PENDING')} tone="amber" />
                  <Pressable onPress={() => void confirm(a.id)} disabled={busyId === a.id} haptic accessibilityRole="button" accessibilityLabel={tr('appt.confirm')}
                    style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: t.violet, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: busyId === a.id ? 0.5 : 1 }}>
                    <Icon name="check" size={16} color="#fff" />
                    <Text style={{ fontFamily: font.b, fontSize: 13, color: '#fff' }}>{tr('appt.confirm')}</Text>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          ))}
          {waitlist.length ? <Text style={{ fontFamily: font.b, fontSize: 14, color: t.ink, marginHorizontal: 4, marginTop: 4 }}>{tr('notifications.waitlist')}</Text> : null}
          {waitlist.map((w) => (
            <Card key={w.id} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="user-plus" size={24} color={t.vtext} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{w.clientName || '-'}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{tr('notifications.waitingFor', { service: w.serviceName ?? '-' })}{w.preferredDate ? ` · ${toDay(fromIso(w.preferredDate))}` : ''}</Text>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
