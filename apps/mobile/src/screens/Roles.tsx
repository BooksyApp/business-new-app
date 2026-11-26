import { useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ToggleRow } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Circ, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiB, type Role } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Rollar: team roles and their permissions (grouped switches). The owner role is read only. */
export function Roles({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiB.roles(sid), [sid]);
  const staff = useLoad(() => api.staff(sid).catch(() => []), [sid]);
  const perms = useLoad(() => apiB.perms().catch(() => []), []);
  const [edit, setEdit] = useState<Role | 'new' | null>(null);
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const open = (r: Role | 'new') => { setEdit(r); const x = r === 'new' ? null : r; setName(x?.name ?? ''); setDesc(x?.description ?? ''); setSel(x?.permissions ?? []); };
  async function save() {
    if (!name.trim()) { Alert.alert(tr('common.error'), tr('tm.needName')); return; }
    setBusy(true);
    try { await apiB.saveRole(sid, edit === 'new' || !edit ? null : edit.id, { name: name.trim(), description: desc.trim() || undefined, permissions: sel }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setEdit(null); void list.reload(); }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  const del = () => { if (edit && edit !== 'new') Alert.alert(tr('rl.confirmDelete'), edit.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => { void apiB.deleteRole(sid, edit.id).then(() => { setEdit(null); return list.reload(); }).catch((e: Error) => Alert.alert(tr('common.error'), e.message)); } }]); };
  if (edit) {
    const ro = edit !== 'new' && edit.isOwner;
    const groups = [...new Set((perms.data ?? []).map((p) => p.group))];
    return (
      <Screen>
        <Header title={edit === 'new' ? tr('rl.add') : edit.name} onBack={() => setEdit(null)} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
          <Field label={tr('sx.name')} value={name} onChangeText={setName} editable={!ro} />
          <Field label={tr('sx.description')} value={desc} onChangeText={setDesc} editable={!ro} />
          {groups.map((g) => (
            <View key={g}>
              <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 16, color: t.ink, marginTop: 10 }}>{g}</Text>
              {(perms.data ?? []).filter((p) => p.group === g).map((p) => <ToggleRow key={p.key} label={p.label} hint={p.description} disabled={ro} value={ro || sel.includes(p.key)} onChange={(v) => setSel(v ? [...sel, p.key] : sel.filter((k) => k !== p.key))} />)}
            </View>
          ))}
          {!ro ? <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {edit !== 'new' ? <Btn label={tr('lk.delete')} variant="danger" style={{ flex: 1 }} onPress={del} /> : null}
            <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => void save()} />
          </View> : null}
        </ScrollView>
      </Screen>
    );
  }
  const addBtn = <Circ icon="plus" violet label={tr('rl.add')} onPress={() => open('new')} />;
  return (
    <Screen>
      <Header title={tr('rl.title')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={4} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(r) => String(r.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="shield" title={tr('rl.empty')} />}
          renderItem={({ item: r }) => (
            <Card onPress={() => open(r)} style={{ gap: 14, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={24} color={t.vtext} /></View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 19, letterSpacing: -0.4, color: t.ink }}>{r.name}</Text>
                  <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('rl.members', { n: r.memberCount })}</Text>
                </View>
                {r.isOwner ? <Pill text={tr('rl.owner')} tone="violet" /> : <Icon name="chev" size={20} color={t.ink3} />}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {(staff.data ?? []).filter((x) => x.isActive !== false).slice(0, Math.max(1, Math.min(4, r.memberCount || 1))).map((x, i) => <View key={x.id} style={{ marginLeft: i ? -12 : 0 }}><Avatar name={x.name} size={38} uri={x.avatarUrl} /></View>)}
                {r.memberCount > 4 ? <Text style={{ marginLeft: 8, fontFamily: font.b, fontSize: 14, color: t.muted }}>+{r.memberCount - 4}</Text> : null}
              </View>
              {r.permissions.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(perms.data ?? []).filter((x) => r.permissions.includes(x.key)).slice(0, 3).map((x) => <View key={x.key} style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: t.fill, justifyContent: 'center' }}><Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13, color: t.ink }}>{x.label}</Text></View>)}
                {r.permissions.length > 3 ? <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: t.vsoft, justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 13, color: t.vtext }}>+{r.permissions.length - 3}</Text></View> : null}
              </View> : null}
            </Card>
          )} />
      )}
    </Screen>
  );
}
