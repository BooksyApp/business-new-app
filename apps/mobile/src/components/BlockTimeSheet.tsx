import React, { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Chip, Field, Toggle } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay, type Staff, type TimeOff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { addDays, dateLabel, fromMin } from '@/lib/format';
import { apiM } from '@/lib/api-more';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const { t } = useTheme();
  const btn = (icon: string, d: number, l: string) => (
    <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} accessibilityRole="button" accessibilityLabel={l}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={t.ink} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ fontFamily: font.s, fontSize: 13, color: t.muted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 4 }}>
        {btn('minus', -30, `${label} -30`)}
        <Text style={{ fontFamily: font.x, fontSize: 18, color: t.ink }}>{fromMin(value)}</Text>
        {btn('plus', 30, `${label} +30`)}
      </View>
    </View>
  );
}

/** "Vaxtı blokla": one master, a day (or the whole day) and a reason; created as an approved time-off so the booking slots disappear. Also deletes an existing block. */
export function BlockTimeSheet({ open, date, masters, preset, existing, onClose, onDone }: {
  open: boolean; date: Date; masters: Staff[]; preset?: string | null; existing?: TimeOff | null; onClose: () => void; onDone: () => void;
}) {
  const { t } = useTheme();
  const { salon } = useApp();
  const [staffId, setStaffId] = useState<string>('');
  const [full, setFull] = useState(false);
  const [from, setFrom] = useState(12 * 60);
  const [to, setTo] = useState(13 * 60);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState<'' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY'>('');
  const [weeks, setWeeks] = useState(8);
  const [first, setFirst] = useState(date);
  const [last, setLast] = useState(date);
  useEffect(() => { if (open) { setFirst(date); setLast(date); setStaffId(String(preset ?? masters[0]?.id ?? '')); setFull(false); setFrom(12 * 60); setTo(13 * 60); setReason(''); setRep(''); setWeeks(8); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const usable = masters.filter((m) => m.id !== '__none');
  const who = staffId || String(usable[0]?.id ?? ''); // masters may arrive after the sheet opened (live: staff list still loading)
  const multi = toDay(last) !== toDay(first);
  const spanDays = Math.round((new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime() - new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime()) / 86400000) + 1;
  const firstDays = React.useMemo(() => Array.from({ length: 60 }, (_, i) => addDays(date, i)), [date.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastDays = React.useMemo(() => Array.from({ length: 60 }, (_, i) => addDays(first, i)), [first.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps
  async function create() {
    if (!salon || !who) return;
    setBusy(true);
    try {
      if (rep && !multi) await apiM.createRecurringTimeOff({ businessId: salon.id, staffId: who, startDate: toDay(first), endDate: toDay(first), isFullDay: full, ...(full ? null : { startTime: fromMin(from), endTime: fromMin(to) }), reason: reason.trim() || undefined, recurrencePattern: rep, recurrenceEndDate: toDay(addDays(date, weeks * 7)) });
      else await api.createTimeOff({ businessId: salon.id, staffId: who, startDate: toDay(first), endDate: toDay(last), isFullDay: full, ...(full ? null : { startTime: fromMin(from), endTime: fromMin(to) }), reason: reason.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!existing) return;
    setBusy(true);
    try { await api.deleteTimeOff(existing.id); onDone(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (existing) {
    return (
      <BottomSheet open={open} onClose={onClose}>
        <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink }}>{tr('block.title')}</Text>
        <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted, marginTop: 6 }}>{existing.staffName} · {existing.isFullDay ? tr('block.fullDay') : `${(existing.startTime ?? '').slice(0, 5)} – ${(existing.endTime ?? '').slice(0, 5)}`}</Text>
        {existing.reason ? <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink, marginTop: 6 }}>{existing.reason}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, paddingBottom: 16 }}>
          <Btn label={tr('common.close')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Btn label={tr('block.remove')} variant="danger" style={{ flex: 1 }} loading={busy} onPress={() => void remove()} />
        </View>
      </BottomSheet>
    );
  }
  const valid = !!who && (full || to > from);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink }}>{tr('block.new')}</Text>
      <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted, marginTop: 2, marginBottom: 12 }}>{multi ? `${dateLabel(first)} - ${dateLabel(last)} · ${tr('n5.tDays', { n: spanDays })}` : dateLabel(first)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {usable.map((m) => <Chip key={m.id} label={m.name} active={who === String(m.id)} onPress={() => setStaffId(String(m.id))} />)}
      </ScrollView>
      <Text style={{ fontFamily: font.s, fontSize: 13, color: t.muted, marginBottom: 6 }}>{tr('n5.tFrom')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {firstDays.map((d) => <Chip key={d.toISOString()} soft label={dateLabel(d)} active={d.toDateString() === first.toDateString()} onPress={() => { setFirst(d); if (last < d) setLast(d); }} />)}
      </ScrollView>
      <Text style={{ fontFamily: font.s, fontSize: 13, color: t.muted, marginBottom: 6 }}>{tr('n5.tTo')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {lastDays.map((d) => <Chip key={d.toISOString()} soft label={dateLabel(d)} active={d.toDateString() === last.toDateString()} onPress={() => setLast(d)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
        <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{tr('block.fullDay')}</Text>
        <Toggle on={full} onChange={setFull} label={tr('block.fullDay')} />
      </View>
      {full ? null : (
        <View style={{ flexDirection: 'row', gap: 12, marginVertical: 8 }}>
          <Stepper label={tr('block.from')} value={from} min={0} max={23 * 60 + 30} onChange={(v) => { setFrom(v); if (to <= v) setTo(Math.min(24 * 60 - 1, v + 30)); }} />
          <Stepper label={tr('block.to')} value={Math.min(to, 23 * 60 + 59)} min={30} max={23 * 60 + 30} onChange={setTo} />
        </View>
      )}
      {multi ? null : <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.muted, marginTop: 6, marginBottom: 8 }}>{tr('ux.repeatRule')}</Text>}
      {multi ? null : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
        {([['', 'ux.repNone'], ['DAILY', 'ux.repDaily'], ['WEEKLY', 'ux.repWeekly'], ['BIWEEKLY', 'ux.repBiweekly']] as const).map(([k, l]) => <Chip key={k} soft label={tr(l)} icon={k ? 'repeat' : undefined} active={rep === k} onPress={() => setRep(k)} />)}
      </ScrollView>}
      {rep && !multi ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {[4, 8, 12, 26].map((w) => <Chip key={w} soft label={tr('ux.repWeeks', { n: w })} active={weeks === w} onPress={() => setWeeks(w)} />)}
        </ScrollView>
      ) : null}
      <Field label={tr('block.reason')} value={reason} onChangeText={setReason} maxLength={200} />
      {!full && to <= from ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.gink, marginTop: -6, marginBottom: 8 }}>{tr('block.badRange')}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
        <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Btn label={tr('block.save')} style={{ flex: 1 }} loading={busy} disabled={!valid} onPress={() => void create()} />
      </View>
    </BottomSheet>
  );
}
