import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Field } from '@/components/ui';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Wordmark } from '@/components/Wordmark';
import { SUPPORTED, getLocale, setLocale, t as tr } from '@/i18n';
import { api, saveSession, ApiError } from '@/lib/api';
import { useApp } from '@/lib/app';
import { useTheme } from '@/theme/ThemeContext';
import { font, mesh } from '@/theme/tokens';

/** Sign-in per design BF13 / BF79-3: wordmark, title, e-mail or phone, password, error line, disabled Google row, language switch. */
export default function Login() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { signedIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const u = await api.login(email.trim(), password);
      // Same role gate as the hub: only owners and their team.
      if (!['BUSINESS_OWNER', 'STAFF'].includes(u.role.toUpperCase())) throw new Error(tr('login.wrongApp'));
      await saveSession(u); // the token must be live before the first authenticated call
      const salons = await api.salonsForUser(u);
      await signedIn(u, salons);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 0 ? tr('common.offline') : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 360, experimental_backgroundImage: mesh, opacity: t.dark ? 0.25 : 1 } as any} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: ins.top + 40, paddingBottom: ins.bottom + 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Wordmark height={34} color={t.dark ? '#f5f2fa' : undefined} />
        <Text style={{ fontFamily: font.x, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: t.ink, marginTop: 36 }}>{tr('login.title')}</Text>
        <Text style={{ fontFamily: font.m, fontSize: 16, color: t.muted, marginTop: 8, marginBottom: 28 }}>{tr('login.subtitle')}</Text>
        <Field label={tr('login.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="username" keyboardType="email-address" autoCorrect={false} />
        <Field label={tr('login.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        {error ? (
          <View style={{ backgroundColor: t.gsoft, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <Text style={{ fontFamily: font.s, fontSize: 14, color: t.gink }}>{error}</Text>
          </View>
        ) : null}
        <Btn label={tr('login.signIn')} onPress={() => void submit()} loading={busy} disabled={!email || !password} />
        <View style={{ marginTop: 16, height: 52, borderRadius: 26, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center', opacity: 0.55 }}>
          <Text style={{ fontFamily: font.s, fontSize: 14.5, color: t.muted }}>{tr('login.google')}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 28 }}>
          {SUPPORTED.map((l) => (
            <Pressable key={l.code} onPress={() => void setLocale(l.code)} hitSlop={10}>
              <Text style={{ fontFamily: getLocale() === l.code ? font.b : font.m, fontSize: 15, color: getLocale() === l.code ? t.vtext : t.muted }}>{l.code.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
