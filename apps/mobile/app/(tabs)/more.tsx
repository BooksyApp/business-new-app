import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, Share, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Circ, Group, Header, Hero, ListRow, Screen, SectionTitle } from '@/components/ui';
import { SUPPORTED, getLocale, setLocale, t as tr, type StringKey } from '@/i18n';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useDockInset } from '@/lib/dock';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Row = { k: string; icon: string; title: string; sub?: string };

export default function More() {
  const { t } = useTheme();
  const router = useRouter();
  const { user, salon, salons, signOut, version, badges, demo, exitDemo } = useApp();
  const inset = useDockInset(16);
  const [out, setOut] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const today = useLoad(() => api.daySheet(salon?.id ?? '', new Date()), [salon?.id, version]);
  const staff = useLoad(() => api.staff(salon?.id ?? '').catch(() => []), [salon?.id]);
  const tot = today.data?.totals;
  const lang = SUPPORTED.find((l) => l.code === getLocale())?.endonym;
  const team = (staff.data ?? []).filter((s) => s.isActive !== false).map((s) => s.name).slice(0, 3).join(', ');
  const go = (k: string) => router.push(`/section/${k}` as never);
  const L = (key: StringKey) => tr(key);

  const groups: { title: string; rows: Row[] }[] = [
    { title: tr('ux.groupDaily'), rows: [
      { k: 'sales', icon: 'wallet', title: tr('more.takings'), sub: `${tr('more.expected')} ${money(tot?.expected ?? 0, salon?.currency)} · ${tr('more.collected')} ${money(tot?.already_paid ?? 0, salon?.currency)}` },
      { k: 'team', icon: 'users', title: L('sections.team'), sub: team || L('sections.teamHint') },
      { k: 'services', icon: 'scissors', title: L('sections.services'), sub: L('sections.servicesHint') },
      { k: 'groups', icon: 'users', title: tr('ux.classes'), sub: tr('ux.noClassesBody') },
      { k: 'views', icon: 'spark', title: L('sections.views'), sub: L('sections.viewsHint') },
      { k: 'reviews', icon: 'star', title: L('sections.reviews'), sub: L('sections.reviewsHint') },
      { k: 'messages', icon: 'chat', title: L('sections.messages'), sub: L('sections.messagesHint') },
    ] },
    { title: tr('ux.groupMoney'), rows: [
      { k: 'finance', icon: 'cash', title: L('fn.title') }, { k: 'expenses', icon: 'receipt', title: L('ex.title') }, { k: 'inventory', icon: 'box', title: L('inv.title') }, { k: 'suppliers', icon: 'store', title: tr('ux.suppliers'), sub: tr('ux.stockCount') },
      { k: 'payroll', icon: 'users', title: L('pr.title') }, { k: 'reports', icon: 'spark', title: L('rp.title'), sub: L('rp.top') }, { k: 'custom', icon: 'paper', title: L('cr.title') },
    ] },
    { title: tr('ux.groupGrowth'), rows: [
      { k: 'marketing', icon: 'send', title: L('mk.title') }, { k: 'promotion', icon: 'spark', title: tr('ux.promo') }, { k: 'offers', icon: 'tag', title: L('x2.offers') }, { k: 'shop', icon: 'bag', title: L('x2.shop') }, { k: 'branches', icon: 'map', title: L('x2.branches') },
    ] },
    { title: tr('ux.groupSetup'), rows: [
      { k: 'profile', icon: 'store', title: L('pf.title') }, { k: 'rota', icon: 'clock', title: L('x2.rota') }, { k: 'roles', icon: 'shield', title: L('rl.title') },
      { k: 'integrations', icon: 'lock', title: L('ig.title') }, { k: 'settings', icon: 'gear', title: L('sections.settings'), sub: L('sections.settingsHint') },
    ] },
  ];

  return (
    <Screen>
      <Header title={tr('more.title')} right={<Circ icon="bell" label={tr('tabs.notifications')} badge={badges.pending + badges.waitlist + badges.inbox} onPress={() => router.navigate('/notifications')} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: inset }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={today.refreshing} onRefresh={() => void today.reload()} tintColor={t.violet} />}>
        <Hero>
          <View style={{ padding: 18, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={salon?.name ?? ''} size={72} uri={(salon as { logoUrl?: string } | null)?.logoUrl} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontFamily: font.x, fontSize: 21, lineHeight: 26, letterSpacing: -0.5, color: t.ink }}>{salon?.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14.5, color: t.muted, marginTop: 2 }}>{tr('ux.salonProfile')}{salon?.city ? ` · ${salon.city}` : ''}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn small label={tr('ux.viewSite')} icon="eye" style={{ flex: 1.4 }} onPress={() => void Linking.openURL('https://getbooqi.tech').catch(() => {})} />
              <Btn small label={tr('ux.share')} icon="share" variant="secondary" style={{ flex: 0.8 }} onPress={() => void Share.share({ message: salon?.name ?? 'booqi' }).catch(() => {})} />
            </View>
          </View>
        </Hero>
        {groups.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <SectionTitle title={g.title} />
            <Group>
              {g.rows.map((r) => <ListRow key={r.k} icon={r.icon} title={r.title} sub={r.sub} onPress={() => go(r.k)} />)}
            </Group>
          </View>
        ))}
        <View style={{ gap: 8 }}>
          <SectionTitle title={tr('ux.groupMore')} />
          <Group>
            <ListRow icon="user" title={tr('more.profile')} sub={[user?.fullName, user?.role].filter(Boolean).join(' · ')} onPress={() => go('settings')} />
            <ListRow icon="globe" title={tr('more.language')} sub={lang} onPress={() => setLangOpen(true)} />
            {salons.length > 1 ? <ListRow icon="store" title={tr('more.switchSalon')} sub={salon?.name} onPress={() => router.push('/salons')} /> : null}
            <ListRow icon="help" title={L('x2.support')} onPress={() => go('support')} />
            {demo ? <ListRow icon="eyeoff" title={tr('v2.demoExit')} sub={tr('v2.demoExitSub')} onPress={exitDemo} /> : null}
            <ListRow icon="out" danger title={tr('more.signOut')} sub={`${tr('more.version')} ${Constants.expoConfig?.version ?? ''}`} onPress={() => setOut(true)} />
          </Group>
        </View>
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
