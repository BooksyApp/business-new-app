import { useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ToggleRow } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
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
  const addBtn = <Pressable onPress={() => open('new')} accessibilityRole="button" accessibilityLabel={tr('rl.add')} haptic style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color="#fff" /></Pressable>;
  return (
    <Screen>
      <Header title={tr('rl.title')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={4} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(r) => String(r.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="shield" title={tr('rl.empty')} />}
          renderItem={({ item: r }) => (
            <Card onPress={() => open(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="shield" size={22} color={t.vtext} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{r.name}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{tr('rl.members', { n: r.memberCount })}</Text>
              </View>
              {r.isOwner ? <Pill text={tr('rl.owner')} tone="violet" /> : null}
            </Card>
          )} />
      )}
    </Screen>
  );
}
