import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Group, Header, ListRow, Row, Screen, SectionTitle } from '@/components/ui';
import { SUPPORTED, getLocale, setLocale, t as tr } from '@/i18n';
import { useApp } from '@/lib/app';
import { HoursEditor, NotifEditor, PushPrefsEditor, SubscriptionCard } from '@/screens/SettingsMore';
import { enablePush } from '@/lib/push';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Ayarlar (basics): salon details, language, push notifications, account, version. Editing the salon stays in the web panel. */
export function Settings({ onBack }: { onBack: () => void }) {
  const { t, mode, setMode } = useTheme();
  const { user, salon, signOut } = useApp();
  const [sub, setSub] = useState<'main' | 'hours' | 'notif' | 'pp'>('main');
  const [push, setPush] = useState<'idle' | 'on' | 'failed'>('idle');
  const h = (s: string) => <SectionTitle title={s} />;
  if (sub === 'hours') return <HoursEditor onBack={() => setSub('main')} />;
  if (sub === 'notif') return <NotifEditor onBack={() => setSub('main')} />;
  if (sub === 'pp') return <PushPrefsEditor onBack={() => setSub('main')} />;
  return (
    <Screen>
      <Header title={tr('sections.settings')} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, gap: 12, paddingBottom: 56 }} showsVerticalScrollIndicator={false}>
        {h(tr('set.salon'))}
        <Card style={{ paddingVertical: 8 }}>
          <Row label={tr('set.name')} value={salon?.name} />
          <Row label={tr('set.address')} value={[salon?.city, salon?.address].filter(Boolean).join(', ')} />
          <Row label={tr('create.phone')} value={salon?.phone} />
          <Row label={tr('set.currency')} value={salon?.currency} />
        </Card>
        <Text style={{ fontFamily: font.m, fontSize: 14, lineHeight: 20, color: t.muted }}>{tr('set.webHint')}</Text>
        <Group>
          <ListRow icon="clock" title={tr('hr.title')} onPress={() => setSub('hours')} />
          <ListRow icon="bell" title={tr('pp.title')} onPress={() => setSub('pp')} />
          <ListRow icon="mail" title={tr('ns.title')} onPress={() => setSub('notif')} />
        </Group>
        {h(tr('sub.title'))}
        <SubscriptionCard />
        {h(tr('more.language'))}
        <Card style={{ paddingVertical: 4 }}>
          {SUPPORTED.map((l) => (
            <Pressable key={l.code} onPress={() => void setLocale(l.code)} accessibilityRole="button" accessibilityState={{ selected: getLocale() === l.code }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
              <Text style={{ fontFamily: getLocale() === l.code ? font.x : font.s, fontSize: 16, color: t.ink }}>{l.endonym}</Text>
              {getLocale() === l.code ? <Icon name="check" size={20} color={t.vtext} /> : null}
            </Pressable>
          ))}
        </Card>
        {h(tr('set.theme'))}
        <Card style={{ paddingVertical: 4 }}>
          {([['system', 'set.themeSystem'], ['light', 'set.themeLight'], ['dark', 'set.themeDark']] as const).map(([m, k]) => (
            <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="button" accessibilityState={{ selected: mode === m }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
              <Text style={{ fontFamily: mode === m ? font.x : font.s, fontSize: 16, color: t.ink }}>{tr(k)}</Text>
              {mode === m ? <Icon name="check" size={20} color={t.vtext} /> : null}
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
        <Btn label={tr('more.signOut')} variant="danger" icon="out" onPress={() => Alert.alert(tr('more.signOutConfirm'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('more.signOut'), style: 'destructive', onPress: signOut }])} />
      </ScrollView>
    </Screen>
  );
}
