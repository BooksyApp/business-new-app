import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Avatar, Card, Header, Screen, StateView } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { useApp } from '@/lib/app';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Salon picker (BF79-4): shown when the account manages several salons, and from More > Salonu dəyiş. */
export default function Salons() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, salons, chooseSalon } = useApp();
  return (
    <Screen>
      <Header title={tr('login.pickSalon')} subtitle={tr('login.pickSalonHint')} onBack={salon ? () => router.back() : undefined} />
      {salons.length === 0 ? (
        <StateView icon="store" title={tr('login.pickSalon')} body={tr('clients.empty')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }}>
          {salons.map((b) => (
            <Card key={b.id} onPress={() => { Haptics.selectionAsync().catch(() => {}); chooseSalon(b); router.replace('/calendar'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
              <Avatar name={b.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16.5, color: t.ink }}>{b.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{[b.city, b.address].filter(Boolean).join(' · ')}</Text>
              </View>
              {salon?.id === b.id ? <Icon name="check" size={22} color={t.vtext} /> : <Icon name="chev" size={20} color={t.ink3} />}
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
