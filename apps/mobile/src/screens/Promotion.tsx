import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Header, HeroCard, Pill, Screen, Section, Skeleton, Spark, StatCard } from '@/components/ui';
import { Pressable } from '@/components/Pressable';
import { getLocale, t as tr } from '@/i18n';
import { apiM, type PromoPackage, type PromoRow } from '@/lib/api-more';
import { useApp } from '@/lib/app';
import { dateLabel, fromIso, money } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const TONE = { PENDING: 'amber', ACTIVE: 'ok', PAUSED: 'muted', ENDED: 'violet', CANCELLED: 'muted' } as const;

/** Marketplace reklamı: status + marketplace bookings sparkline, packages to buy (reservation then payment page), history with results, pause / resume. */
export function Promotion({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const quote = useLoad(() => apiM.promoQuote(sid), [sid]);
  const hist = useLoad(() => apiM.promoHistory(sid).catch(() => [] as PromoRow[]), [sid]);
  const mk = useLoad(() => apiM.marketplace(sid).catch(() => null), [sid]);
  const [pick, setPick] = useState<PromoPackage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cur = salon?.currency;
  const nameOf = (p: PromoPackage) => (getLocale() === 'ru' ? p.nameRu : getLocale() === 'en' ? p.nameEn : p.nameAz) ?? p.nameEn ?? '';
  const daily = mk.data?.daily ?? [];
  const total = daily.reduce((n, d) => n + d.bookings, 0);
  const reload = async () => { await Promise.all([quote.reload(), hist.reload(), mk.reload()]); };

  async function pay(id: string) {
    const r = await apiM.promoCheckout(sid, id, 'https://getbooqi.tech/promotion/success', 'https://getbooqi.tech/promotion/cancel');
    await Linking.openURL(r.checkoutUrl);
  }
  async function buy() {
    if (!pick) return;
    setBusy('buy');
    try { const r = await apiM.promoBuy(sid, pick.id); toast(tr('ux.promoReserved'), 'success'); setPick(null); await pay(String(r.id)); bump(); await reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  }
  async function act(fn: () => Promise<unknown>, key: string) { setBusy(key); try { await fn(); await reload(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); } }

  return (
    <Screen>
      <Header title={tr('ux.promo')} subtitle={salon?.name} onBack={onBack} />
      {quote.error && !quote.data ? <ErrorState error={quote.error} onRetry={() => void quote.reload()} /> : quote.loading && !quote.data ? <Skeleton rows={3} height={140} /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 12 }}
          refreshControl={<RefreshControl refreshing={quote.refreshing} onRefresh={() => void reload()} tintColor={t.violet} />}>
          <HeroCard dark icon="spark" title={mk.data?.promoted ? tr('ux.promoOn') : tr('ux.promoOff')} sub={tr('ux.promoSub')} stat={String(total)} statLabel={tr('ux.promoDaily')}>
            {daily.length > 1 ? <Spark data={daily.map((d) => d.bookings)} width={300} height={56} color="#d8ccff" /> : null}
          </HeroCard>
          <Section title={tr('ux.promoBuyTitle')} hint={!quote.data?.enabled ? tr('ux.promoDisabled') : quote.data?.alreadyRunning ? tr('ux.promoRunning') : undefined}>
            {(quote.data?.packages ?? []).map((p) => (
              <Pressable key={String(p.id)} onPress={() => setPick(p)} disabled={!quote.data?.enabled || quote.data?.alreadyRunning} accessibilityRole="button" accessibilityLabel={nameOf(p)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.surface, borderRadius: 26, padding: 16, minHeight: 88, opacity: !quote.data?.enabled || quote.data?.alreadyRunning ? 0.55 : 1 }}>
                <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.x, fontSize: 22, color: t.vtext }}>{p.days}</Text><Text style={{ fontFamily: font.s, fontSize: 11.5, color: t.vtext }}>{tr('ux.promoDays', { n: '' }).trim()}</Text></View>
                <View style={{ flex: 1, gap: 2 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: t.ink }}>{nameOf(p) || tr('ux.promoDays', { n: p.days })}</Text>{p.forecastKnown ? <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('ux.promoPerDay', { n: Math.round(p.forecastPerDay) })}</Text> : null}</View>
                <Text style={{ fontFamily: font.x, fontSize: 20, color: t.ink }}>{money(p.price, p.currency ?? cur)}</Text>
              </Pressable>
            ))}
          </Section>
          <Section title={tr('ux.promoHistory')}>
            {(hist.data ?? []).length === 0 ? <Card style={{ alignItems: 'center', paddingVertical: 22 }}><Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{tr('ux.noPromoHist')}</Text></Card> : (hist.data ?? []).map((r) => (
              <Card key={String(r.id)} style={{ gap: 12, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{dateLabel(fromIso(r.startsAt))} – {dateLabel(fromIso(r.endsAt))}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{r.source === 'FREE_GRANT' ? tr('ux.free') : money(r.amount, r.currency ?? cur)}{r.status === 'ACTIVE' ? ` · ${tr('ux.daysLeft', { n: r.daysLeft })}` : ''}</Text></View>
                  <Pill text={r.status} tone={TONE[r.status]} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <StatCard label={tr('ux.impressions')} value={String(r.impressions)} style={{ backgroundColor: t.fill, boxShadow: 'none' } as any} />
                  <StatCard label={tr('ux.clicks')} value={String(r.clicks)} hint={r.ctr != null ? `${(r.ctr * 100).toFixed(1)}%` : undefined} style={{ backgroundColor: t.fill, boxShadow: 'none' } as any} />
                  <StatCard label={tr('ux.promoBookings')} value={String(r.bookings)} tone="ok" style={{ backgroundColor: t.fill, boxShadow: 'none' } as any} />
                </View>
                {r.status === 'PENDING' ? <View style={{ flexDirection: 'row', gap: 10 }}><Btn small label={tr('ux.discard')} variant="secondary" style={{ flex: 1 }} loading={busy === `d${r.id}`} onPress={() => void act(() => apiM.promoDiscard(sid, r.id), `d${r.id}`)} /><Btn small label={tr('ux.promoPay')} style={{ flex: 1 }} loading={busy === `p${r.id}`} onPress={() => void act(() => pay(String(r.id)), `p${r.id}`)} /></View> : null}
                {r.status === 'ACTIVE' ? <Btn small label={tr('ux.pause')} variant="secondary" icon="timer" loading={busy === `z${r.id}`} onPress={() => void act(() => apiM.promoPause(sid, r.id), `z${r.id}`)} /> : null}
                {r.status === 'PAUSED' ? <Btn small label={tr('ux.resume')} icon="check" loading={busy === `r${r.id}`} onPress={() => void act(() => apiM.promoResume(sid, r.id), `r${r.id}`)} /> : null}
              </Card>
            ))}
          </Section>
        </ScrollView>
      )}
      <BottomSheet open={!!pick} onClose={() => setPick(null)}>
        {pick ? (
          <View style={{ paddingBottom: 18, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="spark" size={30} color={t.vtext} /></View>
            <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink }}>{nameOf(pick) || tr('ux.promoDays', { n: pick.days })}</Text>
            <Text style={{ fontFamily: font.m, fontSize: 16, color: t.muted }}>{tr('ux.promoDays', { n: pick.days })} · {tr('ux.promoSub')}</Text>
            <Text style={{ fontFamily: font.x, fontSize: 40, letterSpacing: -1.3, color: t.ink }}>{money(pick.price, pick.currency ?? cur)}</Text>
            <Btn label={tr('ux.promoPay')} loading={busy === 'buy'} onPress={() => void buy()} />
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
