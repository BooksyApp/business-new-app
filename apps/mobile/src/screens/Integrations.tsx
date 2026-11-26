import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { TabBar } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { Pressable } from '@/components/Pressable';
import { t as tr } from '@/i18n';
import { apiB, type ApiKey } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';


/** İnteqrasiyalar: API keys, webhooks (create, test, delete) and the activity (audit) log. */
export function Integrations({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [tab, setTab] = useState<'keys' | 'hooks' | 'audit' | 'track'>('keys');
  const keys = useLoad(async () => { const r = await apiB.apiKeys(sid).catch(() => []); return (Array.isArray(r) ? r : (r as { keys: ApiKey[] }).keys ?? []) as ApiKey[]; }, [sid]);
  const hooks = useLoad(() => apiB.webhooks(sid).catch(() => ({ webhooks: [], events: [] as string[] })), [sid]);
  const audit = useLoad(() => (tab === 'audit' ? apiB.audit(sid) : Promise.resolve([])), [sid, tab]);
  const trk = useLoad(() => (tab === 'track' ? apiB.tracking(sid).catch(() => null) : Promise.resolve(null)), [sid, tab]);
  const [pix, setPix] = useState(''); const [ga, setGa] = useState('');
  useEffect(() => { const x = trk.data?.tracking; if (x) { setPix(x.metaPixelId ?? ''); setGa(x.gaMeasurementId ?? ''); } }, [trk.data]);
  const dom = useLoad(() => (tab === 'track' ? apiB.domain(sid).catch(() => null) : Promise.resolve(null)), [sid, tab]);
  const [dn, setDn] = useState('');
  const [name, setName] = useState(''); const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => { setBusy(true); try { await fn(); after?.(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); } };
  const q = tab === 'keys' ? keys : tab === 'hooks' ? hooks : tab === 'track' ? trk : audit;
  return (
    <Screen>
      <Header title={tr('ig.title')} subtitle={salon?.name} onBack={onBack} />
      <TabBar value={tab} onChange={setTab} tabs={[{ k: 'keys', label: tr('ig.keys') }, { k: 'hooks', label: tr('ig.hooks') }, { k: 'audit', label: tr('ig.audit') }, { k: 'track', label: tr('x3.tracking') }]} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={4} /> : tab === 'track' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Field label="Meta Pixel ID" value={pix} onChangeText={setPix} autoCapitalize="none" autoCorrect={false} />
          <Field label="Google Analytics ID (G-XXXX)" value={ga} onChangeText={setGa} autoCapitalize="none" autoCorrect={false} />
          <Btn label={tr('common.save')} loading={busy} onPress={() => void run(() => apiB.saveTracking(sid, pix.trim(), ga.trim()), () => Alert.alert(tr('ns.saved')))} />
          {dom.data?.available ? (
            <View style={{ marginTop: 20, gap: 8 }}>
              <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 18, color: t.ink }}>{tr('x3.domain')}</Text>
              <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{tr('x3.domainHint', { t: dom.data.cnameTarget })}</Text>
              {dom.data.domain ? <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{dom.data.domain} · {dom.data.status ?? ''}</Text> : null}
              {dom.data.lastError ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.gink }}>{dom.data.lastError}</Text> : null}
              <Field label="shop.example.com" value={dn} onChangeText={setDn} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <Btn label={tr('common.save')} variant="secondary" loading={busy} disabled={!dn.trim()} onPress={() => void run(() => apiB.setDomain(sid, dn.trim().toLowerCase()), () => { setDn(''); void dom.reload(); })} />
              {dom.data.domain ? <View style={{ flexDirection: 'row', gap: 10 }}><Btn label={tr('x3.verify')} style={{ flex: 1 }} loading={busy} onPress={() => void run(() => apiB.verifyDomain(sid), () => void dom.reload())} /><Btn label={tr('x3.remove')} variant="danger" style={{ flex: 1 }} loading={busy} onPress={() => void run(() => apiB.removeDomain(sid), () => void dom.reload())} /></View> : null}
            </View>
          ) : null}
        </ScrollView>
      ) : tab === 'keys' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }} refreshControl={<RefreshControl refreshing={keys.refreshing} onRefresh={() => void keys.reload()} tintColor={t.violet} />}>
          {(keys.data ?? []).map((k) => (
            <Card key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: k.revokedAt ? 0.5 : 1 }}>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{k.name}</Text><Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{k.prefix}…</Text></View>
              {!k.revokedAt ? <Pressable onPress={() => Alert.alert(tr('ig.revokeConfirm'), k.name, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('ig.revoke'), style: 'destructive', onPress: () => void run(() => apiB.revokeKey(sid, k.id), () => void keys.reload()) }])} accessibilityRole="button"><Text style={{ fontFamily: font.b, fontSize: 14, color: t.gink }}>{tr('ig.revoke')}</Text></Pressable> : null}
            </Card>
          ))}
          {(keys.data ?? []).length === 0 ? <StateView icon="lock" title={tr('ig.noKeys')} /> : null}
          <Field label={tr('ig.keyName')} value={name} onChangeText={setName} />
          <Btn label={tr('ig.createKey')} variant="secondary" loading={busy} disabled={!name.trim()} onPress={() => void run(async () => { const r = await apiB.createKey(sid, name.trim(), ['read']); Alert.alert(tr('ig.keyOnce'), r.key); setName(''); }, () => void keys.reload())} />
        </ScrollView>
      ) : tab === 'hooks' ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }} refreshControl={<RefreshControl refreshing={hooks.refreshing} onRefresh={() => void hooks.reload()} tintColor={t.violet} />}>
          {(hooks.data?.webhooks ?? []).map((w) => (
            <Card key={w.id} style={{ gap: 6 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{w.url}</Text>
              <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{w.events.length} · {w.active ? tr('inv.active') : '-'}{w.failedDeliveries ? ` · ${tr('ig.failed', { n: w.failedDeliveries })}` : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn label={tr('ig.test')} variant="secondary" style={{ flex: 1 }} onPress={() => void run(() => apiB.testWebhook(sid, w.id), () => Alert.alert(tr('ig.tested')))} />
                <Btn label={tr('lk.delete')} variant="danger" style={{ flex: 1 }} onPress={() => void run(() => apiB.deleteWebhook(sid, w.id), () => void hooks.reload())} />
              </View>
            </Card>
          ))}
          {(hooks.data?.webhooks ?? []).length === 0 ? <StateView icon="globe" title={tr('ig.noHooks')} /> : null}
          <Field label="URL (https://)" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Btn label={tr('ig.createHook')} variant="secondary" loading={busy} disabled={!/^https:\/\//i.test(url.trim())} onPress={() => void run(async () => { const r = await apiB.createWebhook(sid, url.trim(), hooks.data?.events ?? []); Alert.alert(tr('ig.secretOnce'), r.secret); setUrl(''); }, () => void hooks.reload())} />
        </ScrollView>
      ) : (
        <FlatList data={audit.data ?? []} keyExtractor={(_, i) => String(i)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}
          ListEmptyComponent={<StateView icon="paper" title={tr('ig.noAudit')} />}
          renderItem={({ item: a }) => (
            <Card style={{ padding: 12, gap: 2 }}>
              <Text numberOfLines={2} style={{ fontFamily: font.s, fontSize: 14, color: t.ink }}>{a.summary ?? `${a.method} ${a.path}`}</Text>
              <Text style={{ fontFamily: font.m, fontSize: 12.5, color: t.muted }}>{[a.actor_name, a.created_at?.slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · ')}</Text>
            </Card>
          )} />
      )}
    </Screen>
  );
}
