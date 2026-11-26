import { canOpen } from '@/lib/access';
import { salonShareLink } from '@/lib/config';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Screen } from '@/components/ui';
import { Avatar, IconBtn, Photo, Pill, SecHead, T, TopBar } from '@/components/kit';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from '@/lib/insets';
import { SUPPORTED, getLocale, setLocale, t as tr, type StringKey } from '@/i18n';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useDockInset } from '@/lib/dock';
import { money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { cardShadow, font } from '@/theme/tokens';

type Row = { k: string; icon: string; title: string; sub?: string };

export default function More() {
  const { t } = useTheme();
  const router = useRouter();
  const { user, salon, salons, signOut, version, badges, demo, exitDemo } = useApp();
  const inset = useDockInset(16);
  const ins = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const [out, setOut] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const today = useLoad(() => api.daySheet(salon?.id ?? '', new Date()), [salon?.id, version]);
  const staff = useLoad(() => api.staff(salon?.id ?? '').catch(() => []), [salon?.id]);
  const tot = today.data?.totals;
  const lang = SUPPORTED.find((l) => l.code === getLocale())?.endonym;
  const team = (staff.data ?? []).filter((s) => s.isActive !== false).map((s) => s.name).slice(0, 3).join(', ');
  const go = (k: string) => router.push(`/section/${k}` as never);
  const L = (key: StringKey) => tr(key);

  const tiles: [string, string, string][] = [['receipt', tr('v2.till'), 'sales'], ['wallet', L('rp.title'), 'reports'], ['scissors', L('sections.services'), 'services'], ['users', L('sections.team'), 'team'], ['star', L('sections.reviews'), 'reviews'], ['box', L('inv.title'), 'inventory']];
  const salonRows: Row[] = [
    { k: 'marketing', icon: 'send', title: L('mk.title') },
    { k: 'settings', icon: 'clock', title: tr('v2.hoursRow') },
    { k: 'link', icon: 'share', title: tr('v2.salonLink'), sub: salonShareLink(salon).replace(/^https?:\/\//, '').replace(/\?.*$/, '') },
  ];
  const rest: Row[] = [
    { k: 'groups', icon: 'users', title: tr('ux.classes') }, { k: 'views', icon: 'spark', title: L('sections.views') }, { k: 'messages', icon: 'chat', title: L('sections.messages') },
    { k: 'finance', icon: 'cash', title: L('fn.title') }, { k: 'expenses', icon: 'receipt', title: L('ex.title') }, { k: 'suppliers', icon: 'store', title: tr('ux.suppliers') },
    { k: 'payroll', icon: 'users', title: L('pr.title') }, { k: 'custom', icon: 'paper', title: L('cr.title') }, { k: 'promotion', icon: 'spark', title: tr('ux.promo') },
    { k: 'offers', icon: 'tag', title: L('x2.offers') }, { k: 'shop', icon: 'bag', title: L('x2.shop') }, { k: 'branches', icon: 'map', title: L('x2.branches') },
    { k: 'profile', icon: 'store', title: L('pf.title') }, { k: 'rota', icon: 'clock', title: L('x2.rota') }, { k: 'roles', icon: 'shield', title: L('rl.title') }, { k: 'integrations', icon: 'lock', title: L('ig.title') },
  ];
  const open = (k: string) => (k === 'link' ? void Share.share({ message: `${salon?.name ?? 'booqi'} · ${salonShareLink(salon)}` }).catch(() => {}) : go(k));
  const Menu = ({ rows }: { rows: { key: string; icon: string; title: string; sub?: string; danger?: boolean; on: () => void }[] }) => (
    <View style={{ marginHorizontal: 20, backgroundColor: t.surface, borderRadius: 20, paddingHorizontal: 16, ...cardShadow }}>
      {rows.map((r, i) => (
        <Pressable key={r.key} onPress={r.on} noScale accessibilityRole="button" accessibilityLabel={r.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
          <Icon name={r.icon} size={21} color={r.danger ? t.gink : t.ink} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.r, fontSize: 15, color: r.danger ? t.gink : t.ink }}>{r.title}</Text>
          {r.sub ? <Text numberOfLines={1} style={{ maxWidth: '45%', fontFamily: font.r, fontSize: 14, color: t.ink3 }}>{r.sub}</Text> : null}
          {r.danger ? null : <Icon name="chev" size={16} color={t.ink3} />}
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen style={{ paddingTop: ins.top }}>
      <TopBar title={tr('v2.tabMore')} right={<IconBtn icon="gear" label={L('sections.settings')} onPress={() => go('settings')} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: inset }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={today.refreshing} onRefresh={() => void today.reload()} tintColor={t.violet} />}>
        <Pressable onPress={() => go('profile')} accessibilityRole="button" accessibilityLabel={salon?.name ?? ''} style={{ marginTop: 6, marginHorizontal: 20, height: 170, borderRadius: 26, overflow: 'hidden' }}>
          <Photo src={(salon as { coverUrl?: string; logoUrl?: string } | null)?.coverUrl ?? (salon as { logoUrl?: string } | null)?.logoUrl} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
            <LinearGradient colors={['rgba(20,14,34,0)', 'rgba(20,14,34,.72)']} locations={[0.2, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
          </Photo>
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar uri={(salon as { logoUrl?: string } | null)?.logoUrl} name={salon?.name} size={52} border="#fff" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16, color: '#fff' }}>{salon?.name}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 12.5, color: 'rgba(255,255,255,.85)' }}>{[user?.fullName, salon?.myRole === 'OWNER' || user?.role === 'BUSINESS_OWNER' ? tr('v2.owner') : user?.role].filter(Boolean).join(' · ')}</Text>
            </View>
            <Pill tone="wh" text={tr('v2.profile')} />
          </View>
        </Pressable>
        <SecHead title={tr('v2.manage')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 }}>
          {tiles.filter(([, , k]) => canOpen(salon, k)).map(([i, l, k]) => (
            <Pressable key={k} onPress={() => go(k)} accessibilityRole="button" accessibilityLabel={l}
              style={{ width: (W - 40 - 20) / 3, backgroundColor: t.surface, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 12, gap: 14, ...cardShadow }}>
              <Icon name={i} size={24} color={t.ink} />
              <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 13.5, color: t.ink }}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <SecHead title={tr('v2.salon')} />
        <Menu rows={salonRows.filter((r) => canOpen(salon, r.k === 'settings' ? 'hours' : r.k)).map((r) => ({ key: r.k, icon: r.icon, title: r.title, sub: r.sub, on: () => open(r.k) }))} />
        <SecHead title={tr('v2.allSections')} />
        <Menu rows={rest.filter((r) => canOpen(salon, r.k)).map((r) => ({ key: r.k, icon: r.icon, title: r.title, on: () => go(r.k) }))} />
        <SecHead title={tr('v2.account')} />
        <Menu rows={[
          { key: 'notif', icon: 'bell', title: tr('v2.notifications'), sub: badges.inbox ? String(badges.inbox) : undefined, on: () => router.push('/notifications') },
          { key: 'lang', icon: 'globe', title: tr('more.language'), sub: lang, on: () => setLangOpen(true) },
          ...(salons.length > 1 ? [{ key: 'switch', icon: 'store', title: tr('more.switchSalon'), sub: salon?.name, on: () => router.push('/salons') }] : []),
          { key: 'support', icon: 'help', title: L('x2.support'), on: () => go('support') },
          ...(demo ? [{ key: 'demo', icon: 'eyeoff', title: tr('v2.demoExit'), sub: tr('v2.demoExitSub'), on: exitDemo }] : []),
          { key: 'out', icon: 'out', title: tr('more.signOut'), danger: true, on: () => setOut(true) },
        ]} />
        <T k="xs" color={t.ink3} style={{ textAlign: 'center', marginTop: 14 }}>{tr('more.version')} {Constants.expoConfig?.version ?? ''}</T>
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
