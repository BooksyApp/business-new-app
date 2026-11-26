import React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Card, Chip, Header, Row, Screen, Skeleton } from '@/components/ui';
import { SUPPORTED, getLocale, setLocale, t as tr, type StringKey } from '@/i18n';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useDockInset } from '@/lib/dock';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const MENU = [
  { key: 'views', icon: 'spark' }, { key: 'services', icon: 'scissors' }, { key: 'team', icon: 'users' },
  { key: 'reviews', icon: 'star' }, { key: 'messages', icon: 'chat' }, { key: 'settings', icon: 'gear' },
] as const;

export default function More() {
  const { t } = useTheme();
  const router = useRouter();
  const { user, salon, salons, signOut, version } = useApp();
  const inset = useDockInset(16);
  const today = useLoad(() => api.daySheet(salon?.id ?? '', new Date()), [salon?.id, version]);
  const tot = today.data?.totals;

  return (
    <Screen>
      <Header title={tr('more.title')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: inset }}>
        <Card>
          <Text style={{ fontFamily: font.s, fontSize: 13.5, color: t.muted, marginBottom: 6 }}>{tr('more.takings')}</Text>
          {today.loading && !today.data ? <Skeleton rows={1} height={40} /> : (
            <>
              <Text style={{ fontFamily: font.x, fontSize: 32, letterSpacing: -0.8, color: t.ink }}>{money(tot?.already_paid ?? 0, salon?.currency)}</Text>
              <Row label={tr('more.expected')} value={money(tot?.expected ?? 0, salon?.currency)} />
              <Row label={tr('more.bookings')} value={String(tot?.bookings ?? 0)} />
            </>
          )}
        </Card>
        <Card onPress={salons.length > 1 ? () => router.push('/salons') : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={user?.fullName ?? ''} size={48} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{user?.fullName}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{salon?.name}</Text>
          </View>
          {salons.length > 1 ? <Text style={{ fontFamily: font.b, fontSize: 13, color: t.vtext }}>{tr('more.switchSalon')}</Text> : null}
        </Card>
        <Card style={{ padding: 6 }}>
          {MENU.map((m) => (
            <Pressable key={m.key} onPress={() => router.push(`/section/${m.key}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={m.icon} size={22} color={t.vtext} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{tr(`sections.${m.key}` as StringKey)}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{tr(`sections.${m.key}Hint` as StringKey)}</Text>
              </View>
              <Icon name="chev" size={18} color={t.ink3} />
            </Pressable>
          ))}
        </Card>
        <Card>
          <Text style={{ fontFamily: font.s, fontSize: 13.5, color: t.muted, marginBottom: 10 }}>{tr('more.language')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SUPPORTED.map((l) => <Chip key={l.code} label={l.endonym} active={getLocale() === l.code} onPress={() => void setLocale(l.code)} />)}
          </View>
        </Card>
        <Card onPress={() => Alert.alert(tr('more.signOutConfirm'), undefined, [
          { text: tr('common.cancel'), style: 'cancel' },
          { text: tr('more.signOut'), style: 'destructive', onPress: signOut },
        ])} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.gsoft }}>
          <Icon name="out" size={22} color={t.gink} />
          <Text style={{ fontFamily: font.b, fontSize: 16, color: t.gink }}>{tr('more.signOut')}</Text>
        </Card>
        <Text style={{ fontFamily: font.m, fontSize: 12, color: t.ink3, textAlign: 'center' }}>{tr('more.version')} {Constants.expoConfig?.version}</Text>
      </ScrollView>
    </Screen>
  );
}
