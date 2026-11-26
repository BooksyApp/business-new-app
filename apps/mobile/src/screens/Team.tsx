import { useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlockTimeSheet } from '@/components/BlockTimeSheet';
import { Choice, MultiChoice, SectionTitle, ToggleRow } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Circ, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX, type StaffBody, type StaffFull } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { pickAndUpload } from '@/lib/pick';
import { dateLabel, fromIso } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const hm = (s?: string) => (s ?? '').slice(0, 5);
const okTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Specialist editor: contact, position, services, weekly schedule, role, invite, time off. */
function Editor({ staff, onClose, onSaved }: { staff: StaffFull | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const svc = useLoad(() => api.services(sid), [sid]);
  const off = useLoad(() => (staff ? apiX.timeOffForStaff(sid, staff.id).catch(() => []) : Promise.resolve([])), [staff?.id]);
  const [name, setName] = useState(staff?.name ?? '');
  const [phone, setPhone] = useState(staff?.phone ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [pos, setPos] = useState(staff?.position ?? '');
  const [active, setActive] = useState(staff?.isActive ?? true);
  const [role, setRole] = useState(staff?.role ?? 'STAFF');
  const [ids, setIds] = useState<string[]>((staff?.serviceIds ?? []).map(String));
  const [sched, setSched] = useState<Record<string, { on: boolean; from: string; to: string }>>(() => Object.fromEntries(DAYS.map((d) => {
    const a = staff?.workingHoursStart?.[d]; const b = staff?.workingHoursEnd?.[d];
    return [d, a && b ? { on: true, from: hm(a), to: hm(b) } : { on: !staff && d !== 'SUNDAY', from: '09:00', to: '18:00' }];
  })));
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState(false);
  const [avatar, setAvatar] = useState(staff?.avatarUrl);
  async function pickAvatar() {
    if (!staff) return;
    try { const up = await pickAndUpload('STAFF_AVATAR'); if (up) { await apiX.updateStaff(sid, staff.id, { avatarUrl: up.url }); setAvatar(up.url); bump(); } }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message); }
  }

  async function save(invite: boolean) {
    if (!name.trim()) { Alert.alert(tr('common.error'), tr('tm.needName')); return; }
    for (const d of DAYS) if (sched[d].on && (!okTime(sched[d].from) || !okTime(sched[d].to) || sched[d].to <= sched[d].from)) { Alert.alert(tr('common.error'), tr('hr.badTime')); return; }
    const schedule: Record<string, string[]> = {};
    for (const d of DAYS) if (sched[d].on) schedule[d] = [sched[d].from, sched[d].to];
    const body: StaffBody = { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, position: pos.trim() || undefined, serviceIds: ids, schedule, isActive: active };
    setBusy(true);
    try {
      let id = staff?.id;
      if (staff) await apiX.updateStaff(sid, staff.id, body); else id = (await apiX.createStaff(sid, body)).id;
      if (staff && role !== staff.role && staff.role) await apiX.setStaffRole(staff.id, role).catch(() => undefined);
      if (invite && id != null) { await apiX.inviteStaff(id); Alert.alert(tr('tm.invited')); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); onSaved();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally { setBusy(false); }
  }
  const setDay = (d: string, p: Partial<{ on: boolean; from: string; to: string }>) => setSched((m) => ({ ...m, [d]: { ...m[d], ...p } }));
  return (
    <Screen>
      <Header title={staff ? tr('tm.editTitle') : tr('tm.newTitle')} subtitle={staff?.name} onBack={onClose} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {staff ? <View style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}><Avatar name={staff.name} uri={avatar} size={72} /><Btn label={tr('ad.avatar')} variant="secondary" icon="img" onPress={() => void pickAvatar()} /></View> : null}
        <Field label={tr('tm.name')} value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label={tr('cl.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Field label={tr('tm.position')} value={pos} onChangeText={setPos} />
        {staff ? <ToggleRow label={active ? tr('tm.deactivate') : tr('tm.activate')} value={active} onChange={setActive} /> : null}
        {staff?.role ? (<><SectionTitle>{tr('tm.role')}</SectionTitle><Choice value={role} onChange={setRole} options={['OWNER', 'MANAGER', 'STAFF'].map((r) => ({ value: r, label: r }))} /></>) : null}
        <SectionTitle>{tr('tm.services')}</SectionTitle>
        <MultiChoice value={ids} onChange={setIds} options={(svc.data ?? []).filter((s) => s.isActive).map((s) => ({ value: String(s.id), label: s.name }))} />
        <SectionTitle>{tr('tm.schedule')}</SectionTitle>
        {DAYS.map((d) => (
          <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Pressable onPress={() => setDay(d, { on: !sched[d].on })} accessibilityRole="button" accessibilityState={{ selected: sched[d].on }} style={{ width: 64, height: 44, borderRadius: 14, backgroundColor: sched[d].on ? t.vsoft : t.fill, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.b, fontSize: 14, color: sched[d].on ? t.vtext : t.muted }}>{tr(`tm.days.${d}` as 'tm.days.MONDAY')}</Text>
            </Pressable>
            {sched[d].on ? (
              <>
                <Field label="" value={sched[d].from} onChangeText={(v) => setDay(d, { from: v })} keyboardType="numbers-and-punctuation" maxLength={5} style={{ flex: 1, textAlign: 'center' }} />
                <Text style={{ color: t.muted }}>-</Text>
                <Field label="" value={sched[d].to} onChangeText={(v) => setDay(d, { to: v })} keyboardType="numbers-and-punctuation" maxLength={5} style={{ flex: 1, textAlign: 'center' }} />
              </>
            ) : <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('tm.closed')}</Text>}
          </View>
        ))}
        {staff ? (
          <>
            <SectionTitle>{tr('tm.timeOff')}</SectionTitle>
            {(off.data ?? []).length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, marginBottom: 8 }}>{tr('tm.noTimeOff')}</Text> : (off.data ?? []).map((o) => (
              <Card key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, padding: 12 }}>
                <Icon name="clock-alert" size={20} color={t.vtext} />
                <Text style={{ flex: 1, fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{dateLabel(fromIso(o.startDate))}{o.endDate !== o.startDate ? ` - ${dateLabel(fromIso(o.endDate))}` : ''}{o.reason ? ` · ${o.reason}` : ''}</Text>
                <Pressable onPress={() => void api.deleteTimeOff(o.id).then(() => off.reload()).catch((e: Error) => Alert.alert(tr('common.error'), e.message))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
              </Card>
            ))}
            <Btn label={tr('tm.addTimeOff')} variant="secondary" icon="plus" onPress={() => setBlock(true)} style={{ marginBottom: 8 }} />
          </>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {staff && email.trim() ? <Btn label={tr('tm.invite')} variant="secondary" icon="mail" style={{ flex: 1 }} loading={busy} onPress={() => void save(true)} /> : null}
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => void save(false)} />
        </View>
      </ScrollView>
      {staff ? <BlockTimeSheet open={block} date={new Date()} masters={[{ id: staff.id, name: staff.name }]} preset={String(staff.id)} existing={null} onClose={() => setBlock(false)} onDone={() => { setBlock(false); void off.reload(); }} /> : null}
    </Screen>
  );
}

/** Komanda: masters with photo, position and role; add/edit, schedule, services, role, invite, time off; contact actions. */
export function Team({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const list = useLoad(() => apiX.staffFull(salon?.id ?? ''), [salon?.id]);
  const [sel, setSel] = useState<StaffFull | null | 'new'>(null);
  if (sel) return <Editor staff={sel === 'new' ? null : sel} onClose={() => setSel(null)} onSaved={() => { setSel(null); void list.reload(); }} />;
  const addBtn = <Circ icon="user-plus" violet label={tr('tm.add')} onPress={() => setSel('new')} />;
  return (
    <Screen>
      <Header title={tr('sections.team')} subtitle={salon?.name} onBack={onBack} right={addBtn} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={5} /> : (
        <FlatList initialNumToRender={12} windowSize={9} data={list.data ?? []} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="users" title={tr('team.empty')} actionLabel={tr('tm.add')} onAction={() => setSel('new')} />}
          renderItem={({ item: s }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 92, opacity: s.isActive === false ? 0.6 : 1 }}>
              <Pressable onPress={() => setSel(s)} accessibilityRole="button" accessibilityLabel={s.name} noScale style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={s.name} uri={s.avatarUrl} size={60} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17.5, letterSpacing: -0.3, color: t.ink }}>{s.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{s.position || s.role || ''}</Text>
                {s.isActive === false ? <Pill text={tr('team.inactive')} tone="muted" /> : s.role ? <Pill text={s.role} tone="violet" /> : null}
              </View>
              </Pressable>
              {s.phone ? <Pressable onPress={() => void Linking.openURL(`tel:${s.phone!.replace(/\s+/g, '')}`).catch(() => {})} accessibilityRole="button" accessibilityLabel={tr('common.call')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={22} color={t.vtext} /></Pressable> : null}
            </Card>
          )} />
      )}
    </Screen>
  );
}
