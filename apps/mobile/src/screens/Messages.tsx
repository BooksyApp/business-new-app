import React, { useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Card, ErrorState, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, type InboxSummary } from '@/lib/api';
import { useApp } from '@/lib/app';
import { dateLabel, hhmm } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Mesajlar: the salon inbox (conversations from the client app) and a thread with a reply box. */
export function Messages({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const list = useLoad(() => api.conversations(sid), [sid]);
  const [open, setOpen] = useState<InboxSummary | null>(null);
  if (open) return <Thread sid={sid} c={open} onBack={() => { setOpen(null); void list.reload(); }} />;
  return (
    <Screen>
      <Header title={tr('sections.messages')} subtitle={salon?.name} onBack={onBack} />
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={5} /> : (
        <FlatList data={list.data ?? []} keyExtractor={(c) => c.conversationId} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<StateView icon="chat" title={tr('msg.empty')} body={tr('msg.emptyBody')} />}
          renderItem={({ item: c }) => (
            <Card onPress={() => setOpen(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar name={c.customerName} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: c.unread ? font.x : font.b, fontSize: 15.5, color: t.ink }}>{c.customerName}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13, color: t.muted }}>{c.lastMessageAt ? dateLabel(new Date(c.lastMessageAt)) : ''}</Text>
              </View>
              {c.unread ? <View accessibilityLabel={tr('msg.unread', { n: c.unread })} style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: t.guava, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.x, fontSize: 12, color: '#fff' }}>{c.unread}</Text></View> : null}
            </Card>
          )} />
      )}
    </Screen>
  );
}

function Thread({ sid, c, onBack }: { sid: string; c: InboxSummary; onBack: () => void }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const th = useLoad(() => api.conversation(sid, c.conversationId), [c.conversationId]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<FlatList>(null);
  const msgs = th.data?.messages ?? [];
  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api.replyConversation(sid, c.conversationId, body);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setText('');
      await th.reload();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title={c.customerName} subtitle={c.customerEmail} onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {th.error && !th.data ? <ErrorState error={th.error} onRetry={() => void th.reload()} /> : th.loading && !th.data ? <Skeleton rows={4} height={52} /> : (
          <FlatList ref={ref} data={msgs} keyExtractor={(m) => m.messageId} contentContainerStyle={{ padding: 16, gap: 8 }} onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
            refreshControl={<RefreshControl refreshing={th.refreshing} onRefresh={() => void th.reload()} tintColor={t.violet} />}
            ListEmptyComponent={<StateView icon="chat" title={tr('msg.threadEmpty')} />}
            renderItem={({ item: m }) => (
              <View style={{ alignSelf: m.fromSalon ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: m.fromSalon ? t.violet : t.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ fontFamily: font.m, fontSize: 15, color: m.fromSalon ? '#fff' : t.ink }}>{m.body}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 11, color: m.fromSalon ? 'rgba(255,255,255,.75)' : t.muted, marginTop: 2, textAlign: 'right' }}>{hhmm(new Date(m.sentAt).toTimeString())}</Text>
              </View>
            )} />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: Math.max(18, ins.bottom + 6) }}>
          <TextInput value={text} onChangeText={setText} placeholder={tr('msg.reply')} placeholderTextColor={t.ink3} multiline accessibilityLabel={tr('msg.reply')}
            style={{ flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13, fontFamily: font.m, fontSize: 15, color: t.ink }} />
          <Pressable onPress={() => void send()} disabled={busy || !text.trim()} haptic accessibilityRole="button" accessibilityLabel={tr('msg.send')}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.violet, alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() ? 0.5 : 1 }}>
            <Icon name="send" size={22} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
