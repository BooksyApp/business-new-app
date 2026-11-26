import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Ring, Section, ServiceThumb, Skeleton } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiB } from '@/lib/api-biz';
import { apiM } from '@/lib/api-more';
import { useApp } from '@/lib/app';
import { dateLabel, fromIso, money } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Client card: prepaid session packages with a remaining-sessions ring, "sell a package" and "plan a session". */
export function ClientPackages({ clientId, clientName }: { clientId: string | number; clientName: string }) {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const mine = useLoad(() => apiM.clientPackages(String(clientId)).catch(() => []), [clientId]);
  const all = useLoad(() => apiB.packages(sid).catch(() => []), [sid]);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  async function buy(id: string) {
    setBusy(String(id));
    try { await apiM.buyPackage(sid, String(clientId), id); toast(tr('ux.bought'), 'success'); setSheet(false); bump(); await mine.reload(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  }
  return (
    <Section title={tr('ux.packages')}>
      {mine.loading && !mine.data ? <Skeleton rows={1} height={96} /> : (mine.data ?? []).length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 22 }}><Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{tr('ux.noPackages')}</Text></Card>
      ) : (mine.data ?? []).map((p) => {
        const left = Number(p.sessions_remaining); const total = Number(p.sessions_total) || 1;
        return (
          <Card key={String(p.id)} style={{ gap: 12, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Ring value={left / total} size={68} label={`${left}/${total}`} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: t.ink }}>{p.package_name}</Text>
                <Text style={{ fontFamily: font.b, fontSize: 15, color: left > 0 ? t.vtext : t.muted }}>{tr('ux.sessionsLeft', { n: left })}</Text>
                {p.expires_at ? <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{tr('ux.expires', { d: dateLabel(fromIso(p.expires_at)) })}</Text> : null}
              </View>
            </View>
            {left > 0 ? <Btn small label={tr('ux.planSession')} icon="cal" variant="secondary" onPress={() => router.push({ pathname: '/booking/new', params: { clientId: String(clientId), clientName } })} /> : null}
          </Card>
        );
      })}
      <Btn label={tr('ux.sellPackage')} icon="gift" variant="secondary" onPress={() => setSheet(true)} />
      <BottomSheet open={sheet} onClose={() => setSheet(false)}>
        <View style={{ paddingBottom: 18, gap: 10 }}>
          <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 4 }}>{tr('ux.sellPackage')}</Text>
          {(all.data ?? []).filter((p) => p.active).map((p) => (
            <Pressable key={String(p.id)} onPress={() => void buy(String(p.id))} disabled={busy != null} accessibilityRole="button" accessibilityLabel={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.surface, borderRadius: 24, padding: 14, opacity: busy && busy !== String(p.id) ? 0.5 : 1 }}>
              <ServiceThumb name={p.name} cat="gift" size={52} />
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{p.name}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('sx.sessions', { n: p.sessions_total })}</Text></View>
              <Text style={{ fontFamily: font.x, fontSize: 18, color: t.ink }}>{money(p.price, salon?.currency)}</Text>
            </Pressable>
          ))}
          {(all.data ?? []).filter((p) => p.active).length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted, textAlign: 'center', padding: 18 }}>{tr('sx.noPackages')}</Text> : null}
        </View>
      </BottomSheet>
    </Section>
  );
}
