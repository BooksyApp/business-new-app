import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, Linking, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlockTimeSheet } from '@/components/BlockTimeSheet';
import { Choice, MultiChoice, SectionTitle, ToggleRow } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Circ, ErrorState, Field, Header, HeroCard, Pill, Screen, Section, Skeleton, StateView, StickyCta, Toggle } from '@/components/ui';
import { BackBar, Card as KCard, EmptyState, IconBtn, LoadRing, Pill as KPill, Skeleton as KSkel, T, Title, Avatar as KAvatar } from '@/components/kit';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { ChairRentSheet, FeedSheet, PortfolioSheet } from '@/screens/HubExtras';
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
  const roles = useLoad(() => apiB.roles(sid).catch(() => []), [sid]);
  const [roleId, setRoleId] = useState<string>('');
  const [roleInit, setRoleInit] = useState('');
  useEffect(() => {
    const cur = (roles.data ?? []).find((r) => staff && (r.memberIds ?? []).map(String).includes(String(staff.id)));
    const dflt = (roles.data ?? []).find((r) => r.isDefault);
    const v = String((cur ?? dflt)?.id ?? ''); setRoleId(v); setRoleInit(cur ? v : '');
  }, [roles.data, staff?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ids, setIds] = useState<string[]>((staff?.serviceIds ?? []).map(String));
  // The backend keeps specialist <-> service links in the catalog (GET /services/assignments/...), not on the staff row.
  useEffect(() => { if (staff) void apiX.staffServiceIds(sid, staff.id).then((a) => setIds((a ?? []).map(String))).catch(() => undefined); }, [staff?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sched, setSched] = useState<Record<string, { on: boolean; from: string; to: string }>>(() => Object.fromEntries(DAYS.map((d) => {
    const a = staff?.workingHoursStart?.[d]; const b = staff?.workingHoursEnd?.[d];
    return [d, a && b ? { on: true, from: hm(a), to: hm(b) } : { on: !staff && d !== 'SUNDAY', from: '09:00', to: '18:00' }];
  })));
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState(false);
  const [tool, setTool] = useState<null | 'port' | 'rent' | 'feed'>(null);
  const [avatar, setAvatar] = useState(staff?.avatarUrl);
  async function pickAvatar() {
    if (!staff) return;
    try { const up = await pickAndUpload('STAFF_AVATAR'); if (up) { await apiX.updateStaff(sid, staff.id, { avatarUrl: up.url }); setAvatar(up.url); bump(); } }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message); }
  }

  async function save(invite: boolean) {
    if (!name.trim()) { toast(tr('tm.needName'), 'error'); return; }
    for (const d of DAYS) if (sched[d].on && (!okTime(sched[d].from) || !okTime(sched[d].to) || sched[d].to <= sched[d].from)) { toast(tr('hr.badTime'), 'error'); return; }
    const schedule: Record<string, string[]> = {};
    for (const d of DAYS) if (sched[d].on) schedule[d] = [sched[d].from, sched[d].to];
    const body: StaffBody = { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, position: pos.trim() || undefined, serviceIds: ids, schedule, isActive: active };
    setBusy(true);
    try {
      let id = staff?.id;
      if (staff) await apiX.updateStaff(sid, staff.id, body); else id = (await apiX.createStaff(sid, body)).id;
      if (id != null) await apiX.setStaffServiceIds(sid, id, ids);
      if (id != null && roleId && roleId !== roleInit) await apiX.setStaffRoleId(id, roleId).catch(() => undefined);
      if (invite && id != null) { await apiX.inviteStaff(id); Alert.alert(tr('tm.invited')); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally { setBusy(false); }
  }
  const setDay = (d: string, p: Partial<{ on: boolean; from: string; to: string }>) => setSched((m) => ({ ...m, [d]: { ...m[d], ...p } }));
  return (
    <Screen>
      <Header title={staff ? tr('tm.editTitle') : tr('tm.newTitle')} subtitle={staff?.name} onBack={onClose} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 4 }} showsVerticalScrollIndicator={false}>
        <HeroCard photo={staff ? (avatar ?? null) : undefined} icon="user-plus" title={name || tr('tm.newTitle')} sub={pos}>
          {staff ? <Btn label={tr('ad.avatar')} variant="secondary" small icon="img" onPress={() => void pickAvatar()} /> : null}
        </HeroCard>
        <Section title={tr('ux.secBasics')}>
          <Field label={tr('tm.name')} value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label={tr('tm.position')} value={pos} onChangeText={setPos} />
        </Section>
        <Section title={tr('ux.secContact')}>
          <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label={tr('cl.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Section>
        {staff ? <ToggleRow label={active ? tr('tm.deactivate') : tr('tm.activate')} value={active} onChange={setActive} /> : null}
        {(roles.data ?? []).filter((r) => !r.isOwner).length ? (<><SectionTitle>{tr('tm.role')}</SectionTitle><Choice value={roleId} onChange={setRoleId} options={(roles.data ?? []).filter((r) => !r.isOwner || String(r.id) === roleId).map((r) => ({ value: String(r.id), label: r.name }))} /></>) : null}
        <SectionTitle>{tr('tm.services')}</SectionTitle>
        <MultiChoice value={ids} onChange={setIds} options={(svc.data ?? []).filter((s) => s.isActive).map((s) => ({ value: String(s.id), label: s.name }))} />
        <SectionTitle>{tr('tm.schedule')}</SectionTitle>
        {DAYS.map((d) => (
          <Card key={d} style={{ gap: 8, padding: 14, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{tr(`tm.days.${d}` as 'tm.days.MONDAY')}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: sched[d].on ? t.ok : t.muted }}>{sched[d].on ? `${sched[d].from} - ${sched[d].to}` : tr('tm.closed')}</Text></View>
              <Toggle on={sched[d].on} onChange={(v) => setDay(d, { on: v })} label={d} />
            </View>
            {sched[d].on ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label={tr('ux.opensAt')} value={sched[d].from} onChangeText={(v) => setDay(d, { from: v })} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
                <View style={{ flex: 1 }}><Field label={tr('ux.closesAt')} value={sched[d].to} onChangeText={(v) => setDay(d, { to: v })} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              </View>
            ) : null}
          </Card>
        ))}
        {staff ? (
          <>
            <SectionTitle>{tr('tm.timeOff')}</SectionTitle>
            {(off.data ?? []).length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, marginBottom: 8 }}>{tr('tm.noTimeOff')}</Text> : (off.data ?? []).map((o) => (
              <Card key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, padding: 12 }}>
                <Icon name="clock-alert" size={20} color={t.vtext} />
                <Text style={{ flex: 1, fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{dateLabel(fromIso(o.startDate))}{o.endDate !== o.startDate ? ` - ${dateLabel(fromIso(o.endDate))}` : ''}{!o.isFullDay && o.startTime ? ` · ${o.startTime.slice(0, 5)}-${(o.endTime ?? '').slice(0, 5)}` : ''}{o.reason ? ` · ${o.reason}` : ''}</Text>
                <Pressable onPress={() => void api.deleteTimeOff(o.id).then(() => off.reload()).catch((e: Error) => toast(e.message, 'error'))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
              </Card>
            ))}
            <Btn label={tr('tm.addTimeOff')} variant="secondary" icon="plus" onPress={() => setBlock(true)} style={{ marginBottom: 8 }} />
            <SectionTitle>{tr('hx.toolsPortfolio')}</SectionTitle>
            <Btn label={tr('hx.toolsPortfolio')} variant="secondary" icon="img" onPress={() => setTool('port')} style={{ marginBottom: 8 }} />
            <Btn label={tr('hx.toolsRent')} variant="secondary" icon="cash" onPress={() => setTool('rent')} style={{ marginBottom: 8 }} />
            <Btn label={tr('hx.toolsFeed')} variant="secondary" icon="cal" onPress={() => setTool('feed')} style={{ marginBottom: 8 }} />
          </>
        ) : null}
      </ScrollView>
      <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save(false)} secondary={staff && email.trim() ? { label: tr('tm.invite'), onPress: () => void save(true) } : undefined} />
      {staff ? <PortfolioSheet staffId={String(staff.id)} name={staff.name} open={tool === 'port'} onClose={() => setTool(null)} /> : null}
      {staff ? <ChairRentSheet staffId={String(staff.id)} name={staff.name} open={tool === 'rent'} onClose={() => setTool(null)} /> : null}
      {staff ? <FeedSheet staffId={String(staff.id)} name={staff.name} open={tool === 'feed'} onClose={() => setTool(null)} /> : null}
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
  const addBtn = <IconBtn icon="plus" label={tr('tm.add')} onPress={() => setSel('new')} />;
  const rows = list.data ?? [];
  const cells: (StaffFull | 'invite')[] = [...rows, 'invite'];
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} right={addBtn} />
      <Title sub={`${rows.length} ${tr('v3.specN')}`} style={{ paddingBottom: 12 }}>{tr('sections.team')}</Title>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <KSkel blocks={[{ h: 190, w: '48%' }, { h: 190 }]} /> : !rows.length ? <EmptyState photo={'demo:a-salon'} title={tr('team.empty')} action={{ label: tr('tm.add'), icon: 'plus', onPress: () => setSel('new') }} /> : (
        <FlatList numColumns={2} initialNumToRender={12} windowSize={9} data={cells} keyExtractor={(s) => (s === 'invite' ? 'invite' : String(s.id))} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }} columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          renderItem={({ item: s }) => s === 'invite' ? (
            <Pressable onPress={() => setSel('new')} accessibilityRole="button" accessibilityLabel={tr('tm.add')} style={{ flex: 1, minHeight: 190, borderRadius: 22, borderWidth: 1.5, borderColor: t.hair, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={24} color={t.ink} /></View>
              <T k="h3">{tr('tm.add')}</T>
            </Pressable>
          ) : (
            <KCard style={{ flex: 1, minHeight: 190, opacity: s.isActive === false ? 0.6 : 1 }}>
              <Pressable onPress={() => setSel(s)} accessibilityRole="button" accessibilityLabel={s.name} noScale style={{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, gap: 4 }}>
              <LoadRing value={((s as { load?: number }).load ?? 0.6)} size={84}><KAvatar name={s.name} uri={s.avatarUrl} size={70} /></LoadRing>
              <T k="h2" lines={1} style={{ marginTop: 8 }}>{s.name.split(' ')[0]}</T>
              <T k="sm" color={t.muted} lines={1}>{s.position || s.role || ''}</T>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {(s as { rating?: number }).rating ? <KPill icon="star" text={String((s as { rating?: number }).rating).replace('.', ',')} /> : null}
                {s.isActive === false ? <KPill text={tr('team.inactive')} /> : (s as { load?: number }).load != null ? <KPill text={`${Math.round(((s as { load?: number }).load ?? 0) * 100)}%`} /> : null}
              </View>
              </Pressable>
              {s.phone ? <Pressable onPress={() => void Linking.openURL(`tel:${s.phone!.replace(/\s+/g, '')}`).catch(() => {})} accessibilityRole="button" accessibilityLabel={tr('common.call')} hitSlop={6} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><Icon name="phone" size={17} color={t.ink3} /></Pressable> : null}
            </KCard>
          )} />
      )}
    </Screen>
  );
}
