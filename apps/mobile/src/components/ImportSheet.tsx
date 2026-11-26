import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { Btn, Chip, Pill, StatCard } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiM, type ImportPlan, type ImportRow } from '@/lib/api-more';
import { useApp } from '@/lib/app';
import { toast } from '@/lib/toast';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Field = 'name' | 'phone' | 'email' | 'birthday' | 'note';
const FIELDS: { k: Field; label: 'ux.colName' | 'ux.colPhone' | 'ux.colEmail' | 'ux.colNote' | 'cl.email'; guess: RegExp }[] = [
  { k: 'name', label: 'ux.colName', guess: /name|ad$|ad soyad|full|ф\.?и\.?о|имя/i },
  { k: 'phone', label: 'ux.colPhone', guess: /phone|tel|mobil|телефон/i },
  { k: 'email', label: 'ux.colEmail', guess: /mail|почта/i },
  { k: 'note', label: 'ux.colNote', guess: /note|qeyd|коммент|заметк/i },
];

/** Minimal CSV parser: quotes, ; , or tab delimiters. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r/g, '');
  const first = clean.split('\n')[0] ?? '';
  const d = [';', '\t', ','].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let cur: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) { if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { cur.push(cell); cell = ''; }
    else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; }
    else cell += ch;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Client CSV import: pick a file (expo-document-picker) or paste text, match columns, preview what will happen, run, see the report. */
export function ImportSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [step, setStep] = useState<'pick' | 'map' | 'preview' | 'done'>('pick');
  const [text, setText] = useState('');
  const [map, setMap] = useState<Partial<Record<Field, number>>>({});
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const table = useMemo(() => parseCsv(text), [text]);
  const head = table[0] ?? [];
  const body = table.slice(1);
  const rows: ImportRow[] = useMemo(() => body.map((r) => {
    const o: ImportRow = {};
    (Object.keys(map) as Field[]).forEach((k) => { const i = map[k]; if (i != null && r[i]?.trim()) o[k] = r[i].trim(); });
    return o;
  }), [body, map]);

  function reset() { setStep('pick'); setText(''); setMap({}); setPlan(null); }
  async function pickFile() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const DP = require('expo-document-picker') as { getDocumentAsync: (o: object) => Promise<{ canceled: boolean; assets?: { uri: string }[] }> };
      const r = await DP.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const res = await fetch(r.assets[0].uri); setText(await res.text());
    } catch { toast(tr('ux.filePickFail'), 'error'); }
  }
  function toMap() {
    const m: Partial<Record<Field, number>> = {};
    FIELDS.forEach((f) => { const i = head.findIndex((h) => f.guess.test(h)); if (i >= 0) m[f.k] = i; });
    setMap(m); setStep('map');
  }
  async function preview() { setBusy(true); try { setPlan(await apiM.importPreview(sid, rows)); setStep('preview'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } }
  async function run() { setBusy(true); try { setPlan(await apiM.importRun(sid, rows)); setStep('done'); onDone(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } }
  const c = plan?.counts;
  const title = step === 'pick' ? tr('ux.import') : step === 'map' ? tr('ux.importMap') : step === 'preview' ? tr('ux.importPreview') : tr('ux.importDone');

  return (
    <BottomSheet open={open} onClose={() => { onClose(); reset(); }}>
      <View style={{ paddingBottom: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>{(['pick', 'map', 'preview', 'done'] as const).map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= ['pick', 'map', 'preview', 'done'].indexOf(step) ? t.violet : t.fill2 }} />)}</View>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink }}>{title}</Text>
        {step === 'pick' ? (
          <>
            <Btn label={tr('ux.importPick')} icon="paper" onPress={() => void pickFile()} />
            <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted, textAlign: 'center' }}>{tr('ux.importPaste')}</Text>
            <TextInput value={text} onChangeText={setText} multiline placeholder={'Ad;Telefon;E-poçt\nLeyla;+994501112233;leyla@mail.az'} placeholderTextColor={t.ink3} accessibilityLabel={tr('ux.import')} style={{ minHeight: 110, maxHeight: 180, borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, padding: 14, fontFamily: font.m, fontSize: 15, color: t.ink, textAlignVertical: 'top', outlineStyle: 'none' } as any} />
            <Btn label={tr('ux.rows', { n: body.length })} disabled={body.length === 0} onPress={toMap} />
          </>
        ) : null}
        {step === 'map' ? (
          <>
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 12 }}>
              {FIELDS.map((f) => (
                <View key={f.k} style={{ gap: 6 }}>
                  <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{tr(f.label as 'ux.colName')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <Chip soft label={tr('ux.colNone')} active={map[f.k] == null} onPress={() => setMap((m) => { const n = { ...m }; delete n[f.k]; return n; })} />
                    {head.map((h, i) => <Chip key={i} soft label={h || `#${i + 1}`} active={map[f.k] === i} onPress={() => setMap((m) => ({ ...m, [f.k]: i }))} />)}
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label={tr('common.back')} variant="secondary" style={{ flex: 1 }} onPress={() => setStep('pick')} />
              <Btn label={tr('ux.importPreview')} style={{ flex: 1.4 }} loading={busy} disabled={map.name == null && map.phone == null && map.email == null} onPress={() => void preview()} />
            </View>
          </>
        ) : null}
        {(step === 'preview' || step === 'done') && plan ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCard label={tr('ux.impNew')} value={String(c?.NEW ?? 0)} tone="ok" />
              <StatCard label={tr('ux.impMerge')} value={String((c?.MERGE_EXISTING ?? 0) + (c?.MERGE_IN_FILE ?? 0))} />
              <StatCard label={tr('ux.impErr')} value={String(c?.ERROR ?? 0)} tone={(c?.ERROR ?? 0) > 0 ? 'guava' : 'muted'} />
            </View>
            <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ gap: 8 }}>
              {plan.rows.slice(0, 40).map((r) => (
                <View key={r.row} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.surface, borderRadius: 18, padding: 12 }}>
                  <Icon name={r.status === 'ERROR' ? 'info' : 'check'} size={20} color={r.status === 'ERROR' ? t.gink : t.ok} />
                  <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{r.name ?? r.phone ?? r.email ?? `#${r.row}`}</Text>{r.reason || r.matchedName ? <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{r.reason ?? r.matchedName}</Text> : null}</View>
                  <Pill text={r.status === 'NEW' ? tr('ux.impNew') : r.status === 'ERROR' ? tr('ux.impErr') : tr('ux.impMerge')} tone={r.status === 'NEW' ? 'ok' : r.status === 'ERROR' ? 'guava' : 'violet'} />
                </View>
              ))}
            </ScrollView>
            {step === 'preview' ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn label={tr('common.back')} variant="secondary" style={{ flex: 1 }} onPress={() => setStep('map')} />
                <Btn label={tr('ux.importRun')} style={{ flex: 1.4 }} loading={busy} disabled={(c?.NEW ?? 0) + (c?.MERGE_EXISTING ?? 0) + (c?.MERGE_IN_FILE ?? 0) === 0} onPress={() => void run()} />
              </View>
            ) : <Btn label={tr('common.close')} onPress={() => { onClose(); reset(); }} />}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
