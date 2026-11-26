import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, ErrorState, Field, Screen } from '@/components/ui';
import { Avatar, BackBar, Button, Chip, ChipRow, EmptyState, Skeleton, Stars, T, Title } from '@/components/kit';
import { DEMO_IMG } from '@/demo/photos';
import { t as tr } from '@/i18n';
import { apiX, type Review } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { dateLabel } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Rəylər: rating summary, list, public reply. The salon cannot edit, hide or delete a review - it can only open a case for the platform team. */
export function Reviews({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(async () => ({ rows: await apiX.reviews(sid), sum: await apiX.reviewSummary(sid).catch(() => null) }), [sid]);
  const [sel, setSel] = useState<Review | null>(null);
  const [mode, setMode] = useState<'reply' | 'report'>('reply');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('FAKE');
  const [busy, setBusy] = useState(false);
  const open = (r: Review, m: 'reply' | 'report') => { setSel(r); setMode(m); setText(m === 'reply' ? r.reply ?? '' : ''); };
  async function send() {
    if (!sel) return;
    setBusy(true);
    try {
      if (mode === 'reply') await apiX.replyReview(sid, sel.id, text.trim());
      else { await apiX.reportReview(sid, sel.id, reason, text.trim()); Alert.alert(tr('rv.reportSent')); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSel(null); void list.reload();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  const sum = list.data?.sum;
  const [flt, setFlt] = useState<'all' | 'open' | 'photo' | 'low'>('all');
  const rows = (list.data?.rows ?? []).filter((r) => flt === 'all' || (flt === 'open' && !r.reply) || (flt === 'low' && r.rating <= 3));
  const all = list.data?.rows ?? [];
  const openN = all.filter((r) => !r.reply).length;
  const dist = [5, 4, 3, 2, 1].map((n) => all.filter((r) => Math.round(r.rating) === n).length);
  const mx = Math.max(1, ...dist);
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} />
      <Title sub={salon?.name} style={{ paddingBottom: 12 }}>{tr('rv.title')}</Title>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton blocks={[{ h: 120 }, { h: 36, r: 18 }, { h: 110 }, { h: 110 }]} /> : (
        <FlatList initialNumToRender={10} windowSize={9} data={rows} keyExtractor={(r) => String(r.id)} contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={sum && sum.count ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 20, paddingBottom: 18 }}>
                <View>
                  <Text style={{ fontFamily: font.x, fontSize: 56, lineHeight: 60, letterSpacing: -2, color: t.ink }}>{sum.average != null ? sum.average.toFixed(1).replace('.', ',') : '-'}</Text>
                  <Stars n={sum.average ?? 0} size={16} />
                  <T k="xs" color={t.muted} style={{ marginTop: 4 }}>{sum.count} {tr('v3.reviewsN')}</T>
                </View>
                <View style={{ flex: 1, gap: 7 }}>
                  {dist.map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <T k="xs" color={t.muted} style={{ width: 8 }}>{5 - i}</T>
                      <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: t.track }}><View style={{ width: `${(c / mx) * 100}%`, height: 5, borderRadius: 3, backgroundColor: t.ink }} /></View>
                    </View>
                  ))}
                </View>
              </View>
              <ChipRow style={{ marginBottom: 6 }}>
                <Chip label={tr('v2.all')} on={flt === 'all'} onPress={() => setFlt('all')} />
                <Chip label={tr('v3.unanswered')} count={openN || undefined} on={flt === 'open'} onPress={() => setFlt('open')} />
                <Chip label={tr('v3.lowStars')} on={flt === 'low'} onPress={() => setFlt('low')} />
              </ChipRow>
            </View>
          ) : null}
          ListEmptyComponent={<EmptyState photo={DEMO_IMG['f04']} title={tr('rv.empty')} body={tr('rv.emptyBody')} />}
          renderItem={({ item: r, index }) => (
            <View style={{ marginHorizontal: 20, paddingVertical: 16, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: t.hair, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={r.authorName ?? tr('rv.anonymous')} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T k="h3" lines={1}>{r.authorName ?? tr('rv.anonymous')}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Stars n={r.rating} size={15} /><T k="xs" color={t.ink3}>{dateLabel(new Date(r.createdAt))}</T></View>
                </View>
              </View>
              {r.comment ? <T k="t1" style={{ fontFamily: font.m, lineHeight: 22 }}>{r.comment}</T> : null}
              <T k="xs" color={t.ink3} lines={1}>{[r.staffName, r.serviceName].filter(Boolean).join(' · ')}</T>
              {r.reply ? <View style={{ backgroundColor: t.fill, borderRadius: 16, padding: 12 }}><T k="body"><Text style={{ fontFamily: font.b }}>{tr('rv.yourReply')}</Text> · {r.reply}</T></View> : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                <Button size="sm" kind="ol" icon="chat" label={r.reply ? tr('v3.editReply') : tr('rv.reply')} onPress={() => open(r, 'reply')} />
                <Button size="sm" kind="ghost" label={tr('rv.report')} onPress={() => open(r, 'report')} />
              </View>
            </View>
          )} />
      )}
      <BottomSheet open={!!sel} onClose={() => setSel(null)}>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 14 }}>{mode === 'reply' ? tr('rv.reply') : tr('rv.report')}</Text>
        {mode === 'report' ? (<><Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, marginBottom: 10 }}>{tr('rv.reportBody')}</Text>
          <Choice value={reason} onChange={setReason} options={(['FAKE', 'ABUSIVE', 'OTHER'] as const).map((k) => ({ value: k, label: tr(`rv.reasons.${k}` as 'rv.reasons.FAKE') }))} /></>) : null}
        <Field label={mode === 'reply' ? tr('rv.yourReply') : tr('rv.reason')} value={text} onChangeText={setText} multiline style={{ minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }} />
        <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
          <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setSel(null)} />
          <Btn label={mode === 'reply' ? tr('rv.send') : tr('rv.report')} style={{ flex: 1 }} loading={busy} disabled={mode === 'report' && !text.trim()} onPress={() => void send()} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
