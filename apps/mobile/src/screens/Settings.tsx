import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Header, Row, Screen } from '@/components/ui';
import { SUPPORTED, getLocale, setLocale, t as tr } from '@/i18n';
import { useApp } from '@/lib/app';
import { enablePush } from '@/lib/push';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Ayarlar (basics): salon details, language, push notifications, account, version. Editing the salon stays in the web panel. */
export function Settings({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { user, salon, signOut } = useApp();
  const [push, setPush] = useState<'idle' | 'on' | 'failed'>('idle');
  const h = (s: string) => <Text style={{ fontFamily: font.x, fontSize: 18, color: t.ink, marginTop: 8 }}>{s}</Text>;
  return (
    <Screen>
      <Header title={tr('sections.settings')} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {h(tr('set.salon'))}
        <Card style={{ paddingVertical: 8 }}>
          <Row label={tr('set.name')} value={salon?.name} />
          <Row label={tr('set.address')} value={[salon?.city, salon?.address].filter(Boolean).join(', ')} />
          <Row label={tr('create.phone')} value={salon?.phone} />
          <Row label={tr('set.currency')} value={salon?.currency} />
        </Card>
        <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{tr('set.webHint')}</Text>
        {h(tr('more.language'))}
        <Card style={{ paddingVertical: 4 }}>
          {SUPPORTED.map((l) => (
            <Pressable key={l.code} onPress={() => void setLocale(l.code)} accessibilityRole="button" accessibilityState={{ selected: getLocale() === l.code }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
              <Text style={{ fontFamily: getLocale() === l.code ? font.x : font.s, fontSize: 16, color: t.ink }}>{l.endonym}</Text>
              {getLocale() === l.code ? <Icon name="check" size={20} color={t.vtext} /> : null}
            </Pressable>
          ))}
        </Card>
        {h(tr('set.notifications'))}
        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{push === 'on' ? tr('notifications.pushEnabled') : push === 'failed' ? tr('notifications.pushFailed') : tr('notifications.pushOnHint')}</Text>
          {push !== 'on' ? <Btn label={tr('notifications.pushOn')} icon="bell" variant="secondary" onPress={async () => setPush((await enablePush()) ? 'on' : 'failed')} /> : null}
        </Card>
        {h(tr('set.account'))}
        <Card style={{ paddingVertical: 8 }}>
          <Row label={tr('set.user')} value={user?.fullName} />
          <Row label={tr('login.email')} value={user?.email} />
          <Row label={tr('set.role')} value={user?.role} />
          <Row label={tr('more.version')} value={Constants.expoConfig?.version} />
        </Card>
        <Btn label={tr('more.signOut')} variant="danger" icon="out" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
