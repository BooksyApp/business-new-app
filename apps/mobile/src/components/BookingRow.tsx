import React from 'react';
import { View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Pill } from '@/components/ui';
import { t as tr } from '@/i18n';
import type { Appointment, ClientWithStats, Staff } from '@/lib/api';
import { recallClient } from '@/lib/client-cache';
import { hhmm, toMin } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { cardShadow, font } from '@/theme/tokens';

const TONE = { PENDING: 'amber', CONFIRMED: 'ok', COMPLETED: 'violet', CANCELLED: 'muted', NO_SHOW: 'guava' } as const;

export const durLabel = (a: Appointment) => {
  const m = Math.max(5, toMin(a.endTime) - toMin(a.startTime));
  return m % 60 === 0 ? `${m / 60} ${tr('common.hour' as never) === 'common.hour' ? 'saat' : tr('common.hour' as never)}` : m > 60 ? `${Math.floor(m / 60)} saat ${m % 60} ${tr('common.min')}` : `${m} ${tr('common.min')}`;
};

/** BF03 `.rowb`: time column, ring photo, name 17/800, service · duration, status pill, mini staff photo top right. */
export function BookingRow({ a, staff, onPress }: { a: Appointment; staff?: Staff[]; onPress: () => void }) {
  const { t } = useTheme();
  const c = a.clientId != null ? (recallClient(String(a.clientId)) as ClientWithStats | undefined) : undefined;
  const master = staff?.find((s) => String(s.id) === String(a.staffId));
  const late = (a.lateMinutes ?? 0) > 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${hhmm(a.startTime)} ${a.clientName ?? ''} ${a.serviceName ?? ''}`}
      style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: t.surface, borderRadius: 26, padding: 16, minHeight: 104 }, cardShadow]}>
      <Text numberOfLines={1} style={{ width: 58, fontFamily: font.x, fontSize: 18, letterSpacing: -0.4, color: t.ink, paddingTop: 2 }}>{hhmm(a.startTime)}</Text>
      <Avatar name={a.clientName ?? ''} size={56} uri={c?.avatarUrl} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17.5, letterSpacing: -0.3, color: t.ink }}>{a.clientName || '-'}</Text>
        <Text numberOfLines={2} style={{ fontFamily: font.m, fontSize: 14.5, lineHeight: 20, color: t.muted }}>{a.serviceName}{a.serviceName ? ' · ' : ''}{durLabel(a)}</Text>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          {late ? <Pill text={`${tr('ux.delay')} · ${a.lateMinutes} ${tr('common.min')}`} tone="guava" /> : <Pill text={tr(`status.${a.status}`)} tone={TONE[a.status] ?? 'violet'} />}
        </View>
      </View>
      {master ? <Avatar name={master.name} size={30} uri={master.avatarUrl} /> : null}
    </Pressable>
  );
}
