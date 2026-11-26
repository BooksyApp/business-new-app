import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Header, Screen, Skeleton, StateView } from '@/components/ui';
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
  const { salon, version } = useApp();
  const inset = useDockInset(16);
  const [pushState, setPushState] = useState<'idle' | 'on' | 'failed'>('idle');
  const data = useLoad(async () => {
    const today = new Date();
    const [appts, waitlist] = await Promise.all([api.appointments(salon?.id ?? '', today, addDays(today, 30)), api.waitlist(salon?.id ?? '').catch(() => [])]);
    return { pending: appts.filter((a) => a.status === 'PENDING'), waitlist };
  }, [salon?.id, version]);
  const pending = data.data?.pending ?? [];
  const waitlist = data.data?.waitlist ?? [];
  const empty = !!data.data && !pending.length && !waitlist.length;

  return (
    <Screen>
      <Header title={tr('notifications.title')} subtitle={salon?.name} />
      {data.error ? (
        <ErrorState error={data.error} onRetry={() => void data.reload()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: inset }}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.reload()} tintColor={t.violet} />}>
          <Card style={{ backgroundColor: t.vsoft, gap: 6 }}>
            <Text style={{ fontFamily: font.b, fontSize: 15.5, color: t.ink }}>{pushState === 'on' ? tr('notifications.pushEnabled') : tr('notifications.pushOn')}</Text>
            <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginBottom: 6 }}>{pushState === 'failed' ? tr('notifications.pushFailed') : tr('notifications.pushOnHint')}</Text>
            {pushState !== 'on' ? <Btn label={tr('notifications.pushOn')} onPress={async () => setPushState((await enablePush()) ? 'on' : 'failed')} /> : null}
          </Card>
          {data.loading && !data.data ? <Skeleton rows={3} /> : null}
          {empty ? <StateView icon="bell" title={tr('notifications.empty')} /> : null}
          {pending.length ? <Text style={{ fontFamily: font.x, fontSize: 18, color: t.ink }}>{tr('notifications.pending')}</Text> : null}
          {pending.map((a) => (
            <Pressable key={a.id} onPress={() => router.navigate('/calendar')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                <Icon name="clock" size={24} color={t.violet} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{a.clientName || '-'} · {a.serviceName}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{dateLabel(fromIso(a.appointmentDate))} · {hhmm(a.startTime)} · {a.staffName}</Text>
                </View>
                <Icon name="chev" size={18} color={t.ink3} />
              </Card>
            </Pressable>
          ))}
          {waitlist.length ? <Text style={{ fontFamily: font.x, fontSize: 18, color: t.ink }}>{tr('notifications.waitlist')}</Text> : null}
          {waitlist.map((w) => (
            <Card key={w.id} style={{ padding: 14 }}>
              <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{w.clientName || '-'}</Text>
              <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{tr('notifications.waitingFor', { service: w.serviceName ?? '-' })}{w.preferredDate ? ` · ${toDay(fromIso(w.preferredDate))}` : ''}</Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
