import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, ErrorState, Field, Header, Hero, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiX, type Review } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { dateLabel } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const Stars = ({ n }: { n: number }) => {
  const { t } = useTheme();
  return <View accessibilityLabel={`${n}/5`} style={{ flexDirection: 'row', gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={15} color={i <= n ? '#f5a524' : t.line} filled={i <= n} />)}</View>;
};

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
  return (
    <Screen>
      <Header title={tr('rv.title')} subtitle={salon?.name} onBack={onBack} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={4} height={96} /> : (
        <FlatList initialNumToRender={10} windowSize={9} data={list.data?.rows ?? []} keyExtractor={(r) => String(r.id)} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={sum && sum.count ? (
            <Hero style={{ marginBottom: 4 }}>
              <View style={{ padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontFamily: font.x, fontSize: 56, lineHeight: 60, letterSpacing: -2, color: t.ink }}>{sum.average != null ? sum.average.toFixed(1) : '-'}</Text>
                  <Text style={{ fontFamily: font.s, fontSize: 15, color: t.muted }}>{sum.count} {tr('rv.title').toLowerCase()}</Text>
                </View>
                <Stars n={Math.round(sum.average ?? 0)} />
              </View>
            </Hero>
          ) : null}
          ListEmptyComponent={<StateView icon="star" title={tr('rv.empty')} body={tr('rv.emptyBody')} />}
          renderItem={({ item: r }) => (
            <Card style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={r.authorName ?? tr('rv.anonymous')} size={40} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{r.authorName ?? tr('rv.anonymous')}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 12.5, color: t.muted }}>{[dateLabel(new Date(r.createdAt)), r.serviceName, r.staffName].filter(Boolean).join(' · ')}</Text>
                </View>
                <Stars n={r.rating} />
              </View>
              {r.comment ? <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.ink }}>{r.comment}</Text> : null}
              {r.reply ? <View style={{ backgroundColor: t.fill, borderRadius: 12, padding: 10 }}><Text style={{ fontFamily: font.s, fontSize: 12.5, color: t.muted }}>{tr('rv.yourReply')}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: t.ink }}>{r.reply}</Text></View> : null}
              <View style={{ flexDirection: 'row', gap: 18 }}>
                <Pressable onPress={() => open(r, 'reply')} accessibilityRole="button" accessibilityLabel={tr('rv.reply')}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.vtext }}>{tr('rv.reply')}</Text></Pressable>
                <Pressable onPress={() => open(r, 'report')} accessibilityRole="button" accessibilityLabel={tr('rv.report')}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.muted }}>{tr('rv.report')}</Text></Pressable>
              </View>
            </Card>
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
