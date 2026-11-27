import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackBar, Button, Field, T } from '@/components/kit';
import { Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { ApiError } from '@/lib/api';
import { apiO, inviteTokenFrom, type InvitePreview } from '@/lib/api-onboard';
import { toast } from '@/lib/toast';
import { useTheme } from '@/theme/ThemeContext';

/** Dəvəti qəbul et: the emailed link (or booqibiz://accept-invite?token=) -> GET preview -> POST accept (new account, or the existing account's password), then sign in. */
export default function AcceptInvite() {
  const { t } = useTheme();
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const [raw, setRaw] = useState(typeof tokenParam === 'string' ? tokenParam : '');
  const [inv, setInv] = useState<InvitePreview | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const token = inviteTokenFrom(raw);

  async function check() {
    setBusy(true); setError('');
    try { const p = await apiO.invitePreview(token); setInv(p); setFirst((p.staffName ?? '').split(' ')[0] ?? ''); }
    catch (e) { setError(e instanceof ApiError && e.status === 0 ? tr('common.offline') : tr('ob.inviteBad')); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (typeof tokenParam === 'string' && tokenParam) void check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function join() {
    if (!inv) return;
    setBusy(true); setError('');
    try {
      await apiO.inviteAccept(token, { firstName: first.trim() || undefined, lastName: last.trim() || undefined, password: pw });
      toast(tr('ob.inviteDone'), 'success');
      router.replace('/login');
    } catch (e) { setError(e instanceof ApiError && e.status === 0 ? tr('common.offline') : (e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackBar label={tr('v2.signIn')} onBack={() => router.back()} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 10 }}>
          <T k="h1" style={{ fontSize: 26 }}>{inv ? tr('ob.inviteHello', { salon: inv.salonName }) : tr('ob.inviteTitle')}</T>
          <T k="body" color={t.muted} style={{ marginBottom: 8 }}>{inv ? tr('ob.inviteAs', { email: inv.email }) : tr('ob.inviteSub')}</T>
          {!inv ? (<>
            <Field icon="share" placeholder={tr('ob.inviteLink')} accessibilityLabel={tr('ob.inviteLink')} value={raw} onChangeText={setRaw} autoCapitalize="none" autoCorrect={false} />
            <Button label={tr('ob.inviteCheck')} onPress={() => void check()} loading={busy} disabled={!token} style={{ marginTop: 6 }} />
          </>) : (<>
            {!inv.accountExists ? (<>
              <Field placeholder={tr('ob.first')} accessibilityLabel={tr('ob.first')} value={first} onChangeText={setFirst} />
              <Field placeholder={tr('ob.last')} accessibilityLabel={tr('ob.last')} value={last} onChangeText={setLast} />
            </>) : null}
            <Field icon="lock" placeholder={inv.accountExists ? tr('ob.invitePwExisting') : tr('ob.newPw')} accessibilityLabel={tr('v2.password')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" textContentType={inv.accountExists ? 'password' : 'newPassword'} />
            {!inv.accountExists ? <T k="xs" color={t.ink3} style={{ marginLeft: 4 }}>{tr('ob.pwHint')}</T> : null}
            <Button label={tr('ob.inviteJoin')} onPress={() => void join()} loading={busy} disabled={inv.accountExists ? !pw : pw.length < 8} style={{ marginTop: 6 }} />
          </>)}
          {error ? <T k="sm" color={t.gink} style={{ backgroundColor: t.gsoft, borderRadius: 16, padding: 12 }}>{error}</T> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
