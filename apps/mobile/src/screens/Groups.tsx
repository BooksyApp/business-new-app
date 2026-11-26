import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Chip, Circ, ErrorState, Field, Header, Pill, Screen, SearchBar, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Appointment, type ClientWithStats } from '@/lib/api';
import { apiX, type ServiceFull } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { recallClient, rememberClients } from '@/lib/client-cache';
import { addDays, dayMonth, fromMin, hhmm, toMin, weekdayShort } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Session = { key: string; svc: ServiceFull; staffId: string; staffName: string; date: string; start: string; end: string; people: Appointment[]; max: number };

/** Capacity bar: filled share in violet, full = green. */
function Fill({ n, max }: { n: number; max: number }) {
  const { t } = useTheme();
  const v = max ? Math.min(1, n / max) : 0;
  return (
    <View accessible accessibilityLabel={`${n}/${max}`} style={{ height: 10, borderRadius: 5, backgroundColor: t.fill2, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height: 10, borderRadius: 5, backgroundColor: v >= 1 ? t.ok : t.violet }} />
    </View>
  );
}

/** Qrup dərsləri: sessions of services marked as group classes (next 14 days) with capacity, participants, add / remove. */
export function Groups({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, version, bump } = useApp();
  const sid = salon?.id ?? '';
  const today = new Date();
  const svc = useLoad(() => apiX.servicesFull(sid), [sid]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const appts = useLoad(() => api.appointments(sid, today, addDays(today, 13)), [sid, version]);
  const clients = useLoad(async () => { const r = await api.clientsWithStats(sid).catch(() => [] as ClientWithStats[]); rememberClients(r); return r; }, [sid]);
  const classes = useMemo(() => (svc.data ?? []).filter((s) => s.isClass), [svc.data]);
  const sessions = useMemo<Session[]>(() => {
    const m = new Map<string, Session>();
    for (const a of appts.data ?? []) {
      const s = classes.find((c) => String(c.id) === String(a.serviceId));
      if (!s || a.status === 'CANCELLED') continue;
      const key = `${a.serviceId}|${a.staffId}|${a.appointmentDate.slice(0, 10)}|${hhmm(a.startTime)}`;
      const cur = m.get(key) ?? { key, svc: s, staffId: String(a.staffId), staffName: a.staffName ?? '', date: a.appointmentDate.slice(0, 10), start: hhmm(a.startTime), end: hhmm(a.endTime), people: [], max: s.maxParticipants ?? 1 };
      cur.people.push(a); m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  }, [appts.data, classes]);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  // new session
  const [nSvc, setNSvc] = useState(''); const [nStaff, setNStaff] = useState(''); const [nDay, setNDay] = useState(0); const [nTime, setNTime] = useState('18:00');
  const [newSheet, setNewSheet] = useState(false);
  const cur = sessions.find((s) => s.key === open) ?? null;
  const target = cur ?? (newSheet && nSvc && nStaff ? ({ svc: classes.find((c) => String(c.id) === nSvc)!, staffId: nStaff, date: toDay(addDays(today, nDay)), start: nTime, end: '', people: [], max: classes.find((c) => String(c.id) === nSvc)?.maxParticipants ?? 1, staffName: '', key: 'new' } as Session) : null);
  const list = useMemo(() => { const s = q.trim().toLowerCase(); return (clients.data ?? []).filter((c) => !s || `${c.firstName} ${c.lastName ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(s)).slice(0, 40); }, [clients.data, q]);

  async function add(c: ClientWithStats) {
    if (!target || target.people.length >= target.max) return;
    const dur = target.svc.durationMinutes ?? 60;
    const start = target.start;
    setBusy(true);
    try {
      await api.createAppointment({ businessId: sid, staffId: target.staffId, clientId: c.id, clientName: `${c.firstName} ${c.lastName ?? ''}`.trim(), serviceId: target.svc.id, appointmentDate: target.date, startTime: start, endTime: fromMin(toMin(start) + dur), price: target.svc.price });
      toast(tr('ux.addParticipant'), 'success'); setAdding(false); setNewSheet(false); setQ(''); bump(); await appts.reload();
      if (target.key === 'new') setOpen(`${target.svc.id}|${target.staffId}|${target.date}|${start}`);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function remove(a: Appointment) {
    setBusy(true);
    try { await api.cancelAppointment(a.id, 'Removed from class'); toast(tr('ux.removeP'), 'success'); bump(); await appts.reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <Header title={tr('ux.classes')} subtitle={salon?.name} onBack={onBack} right={classes.length ? <Circ icon="plus" violet label={tr('ux.classes')} onPress={() => { setNSvc(String(classes[0].id)); setNStaff(String(classes[0].staffIds?.[0] ?? (staff.data ?? [])[0]?.id ?? '')); setNewSheet(true); }} /> : undefined} />
      {svc.error ? <ErrorState error={svc.error} onRetry={() => void svc.reload()} /> : (svc.loading && !svc.data) || (appts.loading && !appts.data) ? <Skeleton rows={4} height={130} /> : classes.length === 0 ? (
        <StateView icon="users" title={tr('ux.noClasses')} body={tr('ux.noClassesBody')} />
      ) : (
        <FlatList data={sessions} keyExtractor={(s) => s.key} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={appts.refreshing} onRefresh={() => void appts.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="cal" title={tr('ux.noSessions')} />}
          renderItem={({ item: s }) => {
            const full = s.people.length >= s.max;
            return (
              <Card onPress={() => setOpen(s.key)} style={{ gap: 14, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 60, height: 64, borderRadius: 20, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: font.s, fontSize: 13, color: t.vtext }}>{weekdayShort(new Date(s.date))}</Text>
                    <Text style={{ fontFamily: font.x, fontSize: 24, letterSpacing: -0.6, color: t.vtext }}>{Number(s.date.slice(8, 10))}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: t.ink }}>{s.svc.name}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{s.start} – {s.end} · {s.staffName}</Text>
                  </View>
                  {full ? <Pill text={tr('ux.full')} tone="ok" /> : null}
                </View>
                <Fill n={s.people.length} max={s.max} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row' }}>{s.people.slice(0, 5).map((p, i) => <View key={p.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar name={p.clientName ?? ''} size={32} uri={(recallClient(String(p.clientId)) as ClientWithStats | undefined)?.avatarUrl} /></View>)}</View>
                  <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{tr('ux.seats', { n: s.people.length, m: s.max })}</Text>
                </View>
              </Card>
            );
          }} />
      )}

      <BottomSheet open={!!cur && !adding} onClose={() => setOpen(null)}>
        {cur ? (
          <View style={{ paddingBottom: 18, gap: 12 }}>
            <View><Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, color: t.ink }}>{cur.svc.name}</Text><Text style={{ fontFamily: font.s, fontSize: 15, color: t.muted }}>{dayMonth(new Date(cur.date))} · {cur.start} – {cur.end} · {cur.staffName}</Text></View>
            <Fill n={cur.people.length} max={cur.max} />
            <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.muted }}>{tr('ux.participants')} · {tr('ux.seats', { n: cur.people.length, m: cur.max })}</Text>
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
              {cur.people.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, borderRadius: 20, padding: 10 }}>
                  <Avatar name={p.clientName ?? ''} size={46} uri={(recallClient(String(p.clientId)) as ClientWithStats | undefined)?.avatarUrl} />
                  <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{p.clientName}</Text><Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{p.clientPhone ?? ''}</Text></View>
                  <Pressable onPress={() => void remove(p)} disabled={busy} accessibilityRole="button" accessibilityLabel={`${tr('ux.removeP')} ${p.clientName}`} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: t.gsoft, justifyContent: 'center' }}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.gink }}>{tr('ux.removeP')}</Text></Pressable>
                </View>
              ))}
            </ScrollView>
            <Btn label={cur.people.length >= cur.max ? tr('ux.full') : tr('ux.addParticipant')} icon="user-plus" disabled={cur.people.length >= cur.max} onPress={() => setAdding(true)} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet open={newSheet && !adding} onClose={() => setNewSheet(false)}>
        <View style={{ paddingBottom: 18, gap: 12 }}>
          <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, color: t.ink }}>{tr('ux.classes')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>{classes.map((c) => <Chip key={c.id} soft label={c.name} active={nSvc === String(c.id)} onPress={() => { setNSvc(String(c.id)); if (c.staffIds?.length) setNStaff(String(c.staffIds[0])); }} />)}</ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>{(staff.data ?? []).filter((m) => { const c = classes.find((x) => String(x.id) === nSvc); return !c?.staffIds?.length || c.staffIds.map(String).includes(String(m.id)); }).map((m) => <Chip key={m.id} soft label={m.name} avatar={<Avatar name={m.name} size={26} uri={m.avatarUrl} />} active={nStaff === String(m.id)} onPress={() => setNStaff(String(m.id))} />)}</ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>{Array.from({ length: 14 }, (_, i) => <Chip key={i} soft label={`${weekdayShort(addDays(today, i))} ${addDays(today, i).getDate()}`} active={nDay === i} onPress={() => setNDay(i)} />)}</ScrollView>
          <Field label={tr('hr.open')} value={nTime} onChangeText={setNTime} keyboardType="numbers-and-punctuation" maxLength={5} />
          <Btn label={tr('ux.addParticipant')} icon="user-plus" disabled={!nSvc || !nStaff || !/^([01]\d|2[0-3]):[0-5]\d$/.test(nTime)} onPress={() => setAdding(true)} />
        </View>
      </BottomSheet>

      <BottomSheet open={adding} onClose={() => setAdding(false)}>
        <View style={{ paddingBottom: 12, gap: 12 }}>
          <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, color: t.ink }}>{tr('ux.clientsSel')}</Text>
          <SearchBar value={q} onChangeText={setQ} placeholder={tr('clients.search')} />
          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            {list.map((c) => {
              const taken = !!target?.people.some((p) => String(p.clientId) === String(c.id));
              return (
                <Pressable key={String(c.id)} onPress={() => void add(c)} disabled={busy || taken} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.surface, borderRadius: 20, padding: 10, opacity: taken ? 0.45 : 1 }}>
                  <Avatar name={`${c.firstName} ${c.lastName ?? ''}`} size={46} uri={c.avatarUrl} />
                  <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{`${c.firstName} ${c.lastName ?? ''}`}</Text><Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{c.phone ?? ''}</Text></View>
                  {taken ? <Icon name="check" size={20} color={t.ok} /> : <Icon name="plus" size={20} color={t.vtext} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>
    </Screen>
  );
}
