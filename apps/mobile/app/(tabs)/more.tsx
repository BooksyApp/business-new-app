import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Header, Screen } from '@/components/ui';
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

/** `.rowc` of BF79-7: icon, title 16/800, muted line 14, optional chevron. */
function Item({ icon, title, sub, onPress, danger }: { icon: string; title: string; sub?: string; onPress?: () => void; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Icon name={icon} size={24} color={danger ? t.gink : t.vtext} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: danger ? t.gink : t.ink }}>{title}</Text>
        {sub ? <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{sub}</Text> : null}
      </View>
      {onPress && !danger ? <Icon name="chev" size={18} color={t.ink3} /> : null}
    </Card>
  );
}

export default function More() {
  const { t } = useTheme();
  const router = useRouter();
  const { user, salon, salons, signOut, version } = useApp();
  const inset = useDockInset(16);
  const [out, setOut] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const today = useLoad(() => api.daySheet(salon?.id ?? '', new Date()), [salon?.id, version]);
  const tot = today.data?.totals;
  const lang = SUPPORTED.find((l) => l.code === getLocale())?.endonym;

  return (
    <Screen>
      <Header title={tr('more.title')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: inset }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={today.refreshing} onRefresh={() => void today.reload()} tintColor={t.violet} />}>
        <Item icon="wallet" title={tr('more.takings')} sub={`${tr('more.expected')} ${money(tot?.expected ?? 0, salon?.currency)} · ${tr('more.collected')} ${money(tot?.already_paid ?? 0, salon?.currency)}`} onPress={() => router.push('/section/sales')} />
        <Item icon="cal" title={tr('more.bookings')} sub={`${tr('common.today')} · ${tot?.bookings ?? 0}`} onPress={() => router.navigate('/calendar')} />
        <Item icon="user" title={tr('more.profile')} sub={[user?.fullName, user?.role].filter(Boolean).join(' · ')} onPress={() => router.push('/section/settings')} />
        <Item icon="globe" title={tr('more.language')} sub={lang} onPress={() => setLangOpen(true)} />
        <Item icon="store" title={salons.length > 1 ? tr('more.switchSalon') : tr('more.salon')} sub={salon?.name} onPress={salons.length > 1 ? () => router.push('/salons') : undefined} />
        <Item icon="spark" title={tr('rp.title')} sub={tr('rp.top')} onPress={() => router.push('/section/reports')} />
        {([['finance', 'cash', 'fn.title'], ['inventory', 'box', 'inv.title'], ['expenses', 'receipt', 'ex.title'], ['marketing', 'send', 'mk.title'], ['payroll', 'users', 'pr.title'], ['custom', 'paper', 'cr.title'], ['roles', 'shield', 'rl.title'], ['integrations', 'lock', 'ig.title'], ['profile', 'store', 'pf.title']] as const).map(([k, ic, tt]) => (
          <Item key={k} icon={ic} title={tr(tt)} onPress={() => router.push(`/section/${k}`)} />
        ))}
        {MENU.map((m) => (
          <Item key={m.key} icon={m.icon} title={tr(`sections.${m.key}` as StringKey)} sub={tr(`sections.${m.key}Hint` as StringKey)} onPress={() => router.push(`/section/${m.key}`)} />
        ))}
        <Item icon="out" danger title={tr('more.signOut')} sub={`${tr('more.version')} ${Constants.expoConfig?.version ?? ''}`} onPress={() => setOut(true)} />
      </ScrollView>
      <BottomSheet open={out} onClose={() => setOut(false)}>
        <Text style={{ fontFamily: font.x, fontSize: 20, color: t.ink }}>{tr('more.signOutConfirm')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, paddingBottom: 12 }}>
          <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setOut(false)} />
          <Btn label={tr('more.signOut')} variant="danger" style={{ flex: 1 }} onPress={() => { setOut(false); signOut(); }} />
        </View>
      </BottomSheet>
      <BottomSheet open={langOpen} onClose={() => setLangOpen(false)}>
        <Text style={{ fontFamily: font.x, fontSize: 20, color: t.ink, marginBottom: 8 }}>{tr('more.language')}</Text>
        {SUPPORTED.map((l) => (
          <Pressable key={l.code} onPress={() => { setLangOpen(false); void setLocale(l.code); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}>
            <Text style={{ fontFamily: getLocale() === l.code ? font.x : font.s, fontSize: 16, color: t.ink }}>{l.endonym}</Text>
            {getLocale() === l.code ? <Icon name="check" size={20} color={t.vtext} /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
  );
}
