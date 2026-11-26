import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackBar, Button, Field, T } from '@/components/kit';
import { Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { ApiError } from '@/lib/api';
import { apiO } from '@/lib/api-onboard';
import { toast } from '@/lib/toast';
import { useTheme } from '@/theme/ThemeContext';

/** Şifrəni unutdum: POST /public/auth/password/forgot (always 200), then POST /public/auth/password/reset with the emailed token. */
export default function Forgot() {
  const { t } = useTheme();
  const router = useRouter();
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true); setError('');
    try { await apiO.forgot(email.trim()); setPhase('code'); }
    catch (e) { setError(e instanceof ApiError && e.status === 0 ? tr('common.offline') : (e as Error).message); }
    finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError('');
    try { await apiO.reset(token.trim(), pw); toast(tr('ob.resetDone'), 'success'); router.back(); }
    catch (e) { setError(e instanceof ApiError && e.status === 0 ? tr('common.offline') : (e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackBar label={tr('v2.signIn')} onBack={() => router.back()} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 10 }}>
          <T k="h1" style={{ fontSize: 26 }}>{phase === 'email' ? tr('ob.forgotTitle') : tr('ob.sentTitle')}</T>
          <T k="body" color={t.muted} style={{ marginBottom: 8 }}>{phase === 'email' ? tr('ob.forgotSub') : tr('ob.sentBody')}</T>
          {phase === 'email' ? (<>
            <Field icon="mail" placeholder={tr('cl.email')} accessibilityLabel={tr('cl.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
            <Button label={tr('ob.sendLink')} onPress={() => void send()} loading={busy} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} style={{ marginTop: 6 }} />
            <Button label={tr('ob.haveCode')} kind="ghost" onPress={() => setPhase('code')} />
          </>) : (<>
            <Field icon="shield" placeholder={tr('ob.code')} accessibilityLabel={tr('ob.code')} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
            <Field icon="lock" placeholder={tr('ob.newPw')} accessibilityLabel={tr('ob.newPw')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
            <T k="xs" color={t.ink3} style={{ marginLeft: 4 }}>{tr('ob.pwHint')}</T>
            <Button label={tr('ob.resetBtn')} onPress={() => void reset()} loading={busy} disabled={!token.trim() || pw.length < 8} style={{ marginTop: 6 }} />
            <Button label={tr('ob.sendAgain')} kind="ghost" onPress={() => setPhase('email')} />
          </>)}
          {error ? <T k="sm" color={t.gink} style={{ backgroundColor: t.gsoft, borderRadius: 16, padding: 12 }}>{error}</T> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
