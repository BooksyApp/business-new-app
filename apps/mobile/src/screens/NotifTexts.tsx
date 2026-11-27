import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Button as KButton, Field as KField, ListItem, Pill, Segmented, T } from '@/components/kit';
import { ErrorState, Header, Screen, Skeleton } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiH, type NotifTexts } from '@/lib/api-hub';
import { useApp } from '@/lib/app';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { SetGroup } from '@/screens/SettingsMore';

const KINDS = ['CONFIRMATION', 'REMINDER', 'CANCELLATION'] as const;
const LOCS = ['az', 'en', 'ru'] as const;
type Kind = (typeof KINDS)[number];
type Loc = (typeof LOCS)[number];
const MAX = 500;
const LOC_ITEMS = LOCS.map((l) => ({ k: l, label: l.toUpperCase() }));
const one = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Mesaj mətnləri: the salon's own paragraph for the three booking e-mails (confirmation, reminder, cancellation) in az / en / ru.
 * Compact list; one bottom sheet edits a message (language switch, counter, live preview, clear). Saved with PUT .../settings/notification-texts.
 * The backend adds the paragraph verbatim: it has no placeholders, so there are no variable chips.
 */
export function NotifTextsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiH.texts(sid), [sid]);
  const [v, setV] = useState<NotifTexts | null>(null);
  const [loc, setLoc] = useState<Loc>('az');
  const [open, setOpen] = useState<Kind | null>(null);
  const [draft, setDraft] = useState<Record<Loc, string>>({ az: '', en: '', ru: '' });
  const [dl, setDl] = useState<Loc>('az');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (q.data) setV(q.data); }, [q.data]);
  function openKind(k: Kind) {
    if (!v) return;
    setDraft({ az: v[k].az ?? '', en: v[k].en ?? '', ru: v[k].ru ?? '' });
    setDl(loc); setErr(''); setOpen(k);
  }
  async function save() {
    if (!v || !open) return;
    setBusy(true); setErr('');
    try {
      const body: NotifTexts = { ...v };
      body[open] = draft;
      const next = await apiH.saveTexts(sid, body);
      setV(next ?? body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(tr('ns.saved'), 'success'); setOpen(null);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const text = draft[dl];
  return (
    <Screen>
      <Header title={tr('hx.textsTitle')} subtitle={tr('hx.textsSub')} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !v ? <Skeleton rows={3} height={64} /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 56 }}>
          <Segmented items={LOC_ITEMS} value={loc} onChange={setLoc} />
          <SetGroup>
            {KINDS.map((k, i) => {
              const p = one(v[k][loc] ?? '');
              return (
                <ListItem key={k} first={i === 0} title={tr(`hx.kind${k}` as 'hx.kindREMINDER')}
                  lead={<View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="mail" size={18} color={t.vtext} /></View>}
                  sub={<T k="t2" lines={1} color={p ? t.muted : t.ink3}>{p || tr('set.txtNone')}</T>}
                  right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pill text={tr('pp.emailCol')} /><Icon name="chev" size={14} color={t.ink3} /></View>}
                  onPress={() => openKind(k)} />
              );
            })}
          </SetGroup>
          <T k="t2" lines={2} color={t.muted} style={{ marginTop: 12, marginLeft: 4 }}>{tr('set.txtHint')}</T>
        </ScrollView>
      )}
      <BottomSheet open={open !== null} onClose={() => setOpen(null)}>
        <T k="h2" lines={1} style={{ marginBottom: 10 }}>{open ? tr(`hx.kind${open}` as 'hx.kindREMINDER') : ''}</T>
        <Segmented items={LOC_ITEMS} value={dl} onChange={setDl} />
        <KField multiline maxLength={MAX} value={text} onChangeText={(x) => setDraft((d) => ({ ...d, [dl]: x.slice(0, MAX) }))} accessibilityLabel={tr('hx.textsTitle')}
          boxStyle={{ height: 120, alignItems: 'flex-start', paddingVertical: 8, marginTop: 12 }} style={{ height: 100, textAlignVertical: 'top' }} />
        <T k="xs" lines={1} color={t.ink3} style={{ textAlign: 'right', marginTop: 4, marginRight: 4 }}>{`${text.length}/${MAX}`}</T>
        <T k="t2" lines={1} color={t.muted} style={{ marginTop: 6, marginLeft: 4 }}>{tr('set.txtPreview')}</T>
        <View style={{ marginTop: 6, backgroundColor: t.fill, borderRadius: 14, padding: 12 }}>
          <T k="t2" lines={5} color={text.trim() ? t.ink : t.ink3}>{text.trim() || tr('set.txtNone')}</T>
          <T k="xs" lines={1} color={t.ink3} style={{ marginTop: 6 }}>{tr('set.txtPill')}</T>
        </View>
        {err ? <T k="t2" color={t.gink} style={{ marginTop: 8, marginLeft: 4 }}>{err}</T> : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <KButton kind="fl" label={tr('set.txtClear')} disabled={!text} onPress={() => setDraft((d) => ({ ...d, [dl]: '' }))} style={{ flex: 1 }} />
          <KButton label={tr('common.save')} loading={busy} onPress={() => void save()} style={{ flex: 1 }} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
