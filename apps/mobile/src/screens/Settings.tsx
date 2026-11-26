import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Screen } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { BackBar, Field as KField, Button as KButton, Card as KCard, KV, ListItem as KListItem, T, Title } from '@/components/kit';
import { useRouter } from 'expo-router';
import { SUPPORTED, getLocale, setLocale, t as tr } from '@/i18n';
import { useApp } from '@/lib/app';
import { apiO } from '@/lib/api-onboard';
import { toast } from '@/lib/toast';
import { HoursEditor, NotifEditor, PushPrefsEditor, SubscriptionCard } from '@/screens/SettingsMore';
import { enablePush } from '@/lib/push';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Ayarlar (basics): salon details, language, push notifications, account, version. Editing the salon stays in the web panel. */
export function Settings({ onBack }: { onBack: () => void }) {
  const { t, mode, setMode } = useTheme();
  const router = useRouter();
  const { user, salon, signOut } = useApp();
  const [sub, setSub] = useState<'main' | 'hours' | 'notif' | 'pp'>('main');
  const [push, setPush] = useState<'idle' | 'on' | 'failed'>('idle');
  const [sheet, setSheet] = useState<null | 'lang' | 'theme' | 'salon' | 'sub' | 'pw' | 'del'>(null);
  const [curPw, setCurPw] = useState(''); const [newPw, setNewPw] = useState(''); const [pwBusy, setPwBusy] = useState(false);
  if (sub === 'hours') return <HoursEditor onBack={() => setSub('main')} />;
  if (sub === 'notif') return <NotifEditor onBack={() => setSub('main')} />;
  if (sub === 'pp') return <PushPrefsEditor onBack={() => setSub('main')} />;
  const lead = (icon: string, danger?: boolean) => <Icon name={icon} size={22} color={danger ? t.gink : t.ink} />;
  const chev = <Icon name="chev" size={16} color={t.ink3} />;
  const langName = SUPPORTED.find((l) => l.code === getLocale())?.endonym ?? '';
  const themeName = tr(mode === 'light' ? 'set.themeLight' : mode === 'dark' ? 'set.themeDark' : 'set.themeSystem');
  const val = (v: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><T k="body" color={t.muted}>{v}</T>{chev}</View>;
  const head = (s2: string) => <T k="sm" color={t.muted} style={{ fontFamily: font.b, marginTop: 18, marginBottom: 8, marginLeft: 4 }}>{s2}</T>;
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} />
      <Title style={{ paddingBottom: 4 }}>{tr('sections.settings')}</Title>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 }} showsVerticalScrollIndicator={false}>
        {head(tr('set.notifications'))}
        <KCard style={{ paddingHorizontal: 18 }}>
          <KListItem first title={tr('pp.title')} lead={lead('bell')} right={chev} onPress={() => setSub('pp')} />
          <KListItem title={tr('ns.title')} lead={lead('mail')} right={chev} onPress={() => setSub('notif')} />
          <KListItem title={tr('v3.pushRow')} sub={push === 'on' ? tr('notifications.pushEnabled') : push === 'failed' ? tr('notifications.pushFailed') : undefined} lead={lead('bell')}
            right={push === 'on' ? <Icon name="check" size={20} color={t.ok} /> : <KButton size="sm" kind="fl" label={tr('push.allow')} onPress={async () => setPush((await enablePush()) ? 'on' : 'failed')} />} />
        </KCard>
        {head(tr('set.salon'))}
        <KCard style={{ paddingHorizontal: 18 }}>
          <KListItem first title={tr('v3.salonInfo')} sub={salon?.name} lead={lead('store')} right={chev} onPress={() => router.push('/section/profile')} />
          <KListItem title={tr('hx.textsTitle')} lead={lead('paper')} right={chev} onPress={() => router.push('/section/texts')} />
          <KListItem title={tr('hr.title')} lead={lead('clock')} right={chev} onPress={() => setSub('hours')} />
          <KListItem title={tr('sub.title')} lead={lead('crown')} right={chev} onPress={() => setSheet('sub')} />
        </KCard>
        {head(tr('set.account'))}
        <KCard style={{ paddingHorizontal: 18 }}>
          <KListItem first title={tr('more.language')} lead={lead('globe')} right={val(langName)} onPress={() => setSheet('lang')} />
          <KListItem title={tr('set.theme')} lead={lead('moon')} right={val(themeName)} onPress={() => setSheet('theme')} />
          <KListItem title={tr('ob.pwChange')} lead={lead('lock')} right={chev} onPress={() => setSheet('pw')} />
          <KListItem title={tr('ob.delTitle')} lead={lead('trash', true)} right={chev} onPress={() => setSheet('del')} />
          <KListItem title={tr('v3.support')} lead={lead('help')} right={chev} onPress={() => router.push('/section/support')} />
        </KCard>
        <KCard style={{ paddingHorizontal: 18, marginTop: 14 }}>
          <KListItem first title={tr('more.signOut')} lead={lead('out', true)} onPress={() => Alert.alert(tr('more.signOutConfirm'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('more.signOut'), style: 'destructive', onPress: () => void signOut() }])} />
        </KCard>
        <T k="xs" color={t.ink3} style={{ textAlign: 'center', marginTop: 18 }}>{user?.fullName ? `${user.fullName} · ` : ''}{tr('more.version')} {Constants.expoConfig?.version}</T>
      </ScrollView>
      <BottomSheet open={sheet === 'pw'} onClose={() => setSheet(null)}>
        <T k="h1" style={{ marginBottom: 10 }}>{tr('ob.pwChange')}</T>
        <KField icon="lock" placeholder={tr('ob.pwCurrent')} accessibilityLabel={tr('ob.pwCurrent')} value={curPw} onChangeText={setCurPw} secureTextEntry autoCapitalize="none" style={{ marginBottom: 10 }} boxStyle={{ marginBottom: 10 }} />
        <KField icon="lock" placeholder={tr('ob.newPw')} accessibilityLabel={tr('ob.newPw')} value={newPw} onChangeText={setNewPw} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
        <T k="xs" color={t.ink3} style={{ marginTop: 6, marginLeft: 4 }}>{tr('ob.pwHint')}</T>
        <KButton label={tr('common.save')} loading={pwBusy} disabled={!curPw || newPw.length < 8} style={{ marginTop: 14 }} onPress={() => { setPwBusy(true); void apiO.changePassword(curPw, newPw).then(() => { toast(tr('ob.pwChanged'), 'success'); setCurPw(''); setNewPw(''); setSheet(null); }).catch((e: Error) => toast(e.message, 'error')).finally(() => setPwBusy(false)); }} />
      </BottomSheet>
      <BottomSheet open={sheet === 'del'} onClose={() => setSheet(null)}>
        <T k="h1" style={{ marginBottom: 6 }}>{tr('ob.delTitle')}</T>
        <T k="body" color={t.muted}>{tr('ob.delBody')}</T>
        <KButton label={tr('ob.delAction')} icon="send" style={{ marginTop: 14 }} onPress={() => { setSheet(null); router.push('/section/support'); }} />
      </BottomSheet>
      <BottomSheet open={sheet === 'lang'} onClose={() => setSheet(null)}>
        <T k="h1" style={{ marginBottom: 6 }}>{tr('more.language')}</T>
        {SUPPORTED.map((l, i) => <KListItem key={l.code} first={i === 0} title={l.endonym} right={getLocale() === l.code ? <Icon name="check" size={20} color={t.vtext} /> : undefined} onPress={() => { void setLocale(l.code); setSheet(null); }} />)}
      </BottomSheet>
      <BottomSheet open={sheet === 'theme'} onClose={() => setSheet(null)}>
        <T k="h1" style={{ marginBottom: 6 }}>{tr('set.theme')}</T>
        {([['system', 'set.themeSystem'], ['light', 'set.themeLight'], ['dark', 'set.themeDark']] as const).map(([m, k], i) => <KListItem key={m} first={i === 0} title={tr(k)} right={mode === m ? <Icon name="check" size={20} color={t.vtext} /> : undefined} onPress={() => { setMode(m); setSheet(null); }} />)}
      </BottomSheet>
      <BottomSheet open={sheet === 'salon'} onClose={() => setSheet(null)}>
        <T k="h1" style={{ marginBottom: 6 }}>{tr('v3.salonInfo')}</T>
        <KV first icon="store" label={tr('set.name')} value={salon?.name ?? '-'} />
        <KV icon="pin" label={tr('set.address')} value={[salon?.city, salon?.address].filter(Boolean).join(', ') || '-'} />
        <KV icon="phone" label={tr('create.phone')} value={salon?.phone ?? '-'} />
        <KV icon="wallet" label={tr('set.currency')} value={salon?.currency ?? '-'} />
        <T k="sm" color={t.muted} style={{ marginTop: 10, marginBottom: 10 }}>{tr('set.webHint')}</T>
      </BottomSheet>
      <BottomSheet open={sheet === 'sub'} onClose={() => setSheet(null)}>
        <T k="h1" style={{ marginBottom: 10 }}>{tr('sub.title')}</T>
        <SubscriptionCard />
      </BottomSheet>
    </Screen>
  );
}
