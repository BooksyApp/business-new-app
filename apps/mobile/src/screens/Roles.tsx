import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView, Toggle } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiB, type Perm, type Role } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Rollar: team roles and their permissions. Landing = flat list of rows; tap = one flat editor view. Owner role is read only. */
export function Roles({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => apiB.roles(sid), [sid]);
  const staff = useLoad(() => api.staff(sid).catch(() => []), [sid]);
  const perms = useLoad(() => apiB.perms().catch(() => [] as Perm[]), []);
  const [edit, setEdit] = useState<Role | 'new' | null>(null);
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [sel, setSel] = useState<string[]>([]);
  const [openG, setOpenG] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const open = (r: Role | 'new') => { setEdit(r); const x = r === 'new' ? null : r; setName(x?.name ?? ''); setDesc(x?.description ?? ''); setSel(x?.permissions ?? []); setOpenG([]); setErr(''); };
  async function save() {
    if (!name.trim()) { setErr(tr('tm.needName')); return; }
    setBusy(true); setErr('');
    try { await apiB.saveRole(sid, edit === 'new' || !edit ? null : edit.id, { name: name.trim(), description: desc.trim() || undefined, permissions: sel }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setEdit(null); void list.reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const del = () => { if (edit && edit !== 'new') Alert.alert(tr('rl.confirmDelete'), edit.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => { void apiB.deleteRole(sid, edit.id).then(() => { setEdit(null); return list.reload(); }).catch((e: Error) => setErr(e.message)); } }]); };
  const allPerms: Perm[] = perms.data ?? [];
  const activeStaff = (staff.data ?? []).filter((x) => x.isActive !== false);
  const isSys = (r: Role) => r.isOwner || r.isDefault;

  if (edit) {
    const ro = edit !== 'new' && edit.isOwner;
    const groups = [...new Set(allPerms.map((p) => p.group))];
    const members = edit !== 'new' ? activeStaff.filter((x) => (edit.memberIds ?? []).map(String).includes(String(x.id))) : [];
    return (
      <Screen>
        <Header title={edit === 'new' ? tr('rl.add') : edit.name} onBack={() => setEdit(null)} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
          <Field label={tr('sx.name')} value={name} onChangeText={(v) => { setName(v); setErr(''); }} editable={!ro} />
          <Field label={tr('sx.description')} value={desc} onChangeText={setDesc} editable={!ro} />
          {edit !== 'new' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {members.slice(0, 4).map((x, i) => <View key={x.id} style={{ marginLeft: i ? -8 : 0 }}><Avatar name={x.name} size={28} uri={x.avatarUrl} /></View>)}
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.m, fontSize: 13, color: t.muted }}>{members.length ? members.map((x) => x.name).join(', ') : tr('rl.members', { n: edit.memberCount })}</Text>
            </View>
          ) : null}
          {ro ? <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginBottom: 8 }}>{tr('rl.readOnly')}</Text> : null}
          <View style={{ backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden', marginTop: 6 }}>
            {groups.map((g, gi) => {
              const gp = allPerms.filter((p) => p.group === g);
              const on = ro ? gp.length : gp.filter((p) => sel.includes(p.key)).length;
              const isOpen = openG.includes(g);
              return (
                <View key={g} style={{ borderTopWidth: gi ? 1 : 0, borderTopColor: t.line }}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpenG(isOpen ? openG.filter((k) => k !== g) : [...openG, g])} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16 }}>
                    <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontFamily: font.s, fontSize: 15, color: t.ink }}>{g}</Text>
                    <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{on}/{gp.length}</Text>
                    <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}><Icon name="chev" size={18} color={t.ink3} /></View>
                  </Pressable>
                  {isOpen ? gp.map((p) => (
                    <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingLeft: 16, paddingRight: 16, paddingBottom: 6, opacity: ro ? 0.6 : 1 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.m, fontSize: 15, color: t.ink }}>{p.label}</Text>
                      <Toggle on={ro || sel.includes(p.key)} label={p.label} onChange={(v) => { if (!ro) setSel(v ? [...sel, p.key] : sel.filter((k) => k !== p.key)); }} />
                    </View>
                  )) : null}
                </View>
              );
            })}
          </View>
          {err ? <Text accessibilityRole="alert" style={{ fontFamily: font.m, fontSize: 13, color: t.gink, marginTop: 12 }}>{err}</Text> : null}
          {!ro ? <View style={{ gap: 10, marginTop: 16 }}>
            <Btn label={tr('common.save')} loading={busy} onPress={() => void save()} />
            {edit !== 'new' ? <Btn label={tr('lk.delete')} variant="danger" onPress={del} /> : null}
          </View> : null}
        </ScrollView>
      </Screen>
    );
  }

  const rows = [...(list.data ?? [])].sort((a, b) => Number(isSys(b)) - Number(isSys(a)));
  return (
    <Screen>
      <Header title={tr('rl.title')} subtitle={salon?.name} onBack={onBack} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={4} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}>
          {rows.length === 0 ? <StateView icon="shield" title={tr('rl.empty')} /> : (
            <View style={{ backgroundColor: t.surface, borderRadius: 20, overflow: 'hidden' }}>
              {rows.map((r, i) => (
                <Pressable key={String(r.id)} accessibilityRole="button" accessibilityLabel={r.name} onPress={() => open(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="shield" size={20} color={t.vtext} /></View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 16, color: t.ink }}>{r.name}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{tr('rl.sum', { m: r.memberCount, p: r.isOwner ? allPerms.length || r.permissions.length : r.permissions.length })}</Text>
                  </View>
                  {isSys(r) ? <Pill text={r.isOwner ? tr('rl.owner') : tr('rl.system')} tone={r.isOwner ? 'violet' : 'muted'} /> : null}
                  <Icon name="chev" size={18} color={t.ink3} />
                </Pressable>
              ))}
            </View>
          )}
          <Btn label={tr('rl.add')} icon="plus" onPress={() => open('new')} style={{ marginTop: 20 }} />
        </ScrollView>
      )}
    </Screen>
  );
}
