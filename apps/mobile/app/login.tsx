import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Button, Field, Pill, T } from '@/components/kit';
import { BizPill } from '@/components/Opening';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Wordmark } from '@/components/Wordmark';
import { SUPPORTED, getLocale, setLocale, t as tr } from '@/i18n';
import { api, saveSession, ApiError } from '@/lib/api';
import { authErrorKey } from '@/lib/api-onboard';
import { useApp } from '@/lib/app';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from '@/lib/insets';
import { useTheme } from '@/theme/ThemeContext';
import { font, wordmarkOnDark } from '@/theme/tokens';

const AURA = 'radial-gradient(55% 32% at 12% 8%, rgba(216,204,255,.55), rgba(216,204,255,0) 70%), radial-gradient(50% 28% at 95% 30%, rgba(255,194,207,.45), rgba(255,194,207,0) 70%)';

/** Giriş (artifact "Giriş"): no photo. Wordmark, BİZNES ÜÇÜN pill, one line, two fields, Daxil ol, "Demo-ya bax" as the second way in. */
export default function Login() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { signedIn, enterDemo } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const pw = useRef<any>(null);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const k = authErrorKey(e);
      setError(e instanceof ApiError && e.status === 0 ? tr('common.offline') : k ? tr(k) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, experimental_backgroundImage: AURA, opacity: t.dark ? 0.3 : 1 } as object} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: ins.top + 94, paddingBottom: ins.bottom + 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center' }}>
          <Wordmark height={72} color={t.dark ? wordmarkOnDark : undefined} />
          <BizPill style={{ marginTop: 16 }} />
          <T k="body" color={t.muted} style={{ fontSize: 15, marginTop: 18 }}>{tr('v2.tagline')}</T>
        </View>
        <View style={{ gap: 10, marginTop: 44 }}>
          <Field icon="mail" placeholder={tr('v2.emailOrPhone')} accessibilityLabel={tr('v2.emailOrPhone')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="username" textContentType="username"
            keyboardType="email-address" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} blurOnSubmit={false} />
          <Field ref={pw} icon="lock" placeholder={tr('v2.password')} accessibilityLabel={tr('v2.password')} value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete="password" textContentType="password"
            autoCapitalize="none" returnKeyType="go" onSubmitEditing={() => { if (email && password && !busy) void submit(); }}
            right={<Pressable onPress={() => setShow((v) => !v)} accessibilityRole="button" accessibilityLabel={show ? tr('login.hidePassword') : tr('login.showPassword')} hitSlop={10} style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name={show ? 'eyeoff' : 'eye'} size={19} color={t.muted} /></Pressable>} />
          {error ? (
            <View accessibilityRole="alert" style={{ backgroundColor: t.gsoft, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="info" size={18} color={t.gink} />
              <Text style={{ flex: 1, fontFamily: font.s, fontSize: 13.5, lineHeight: 19, color: t.gink }}>{error}</Text>
            </View>
          ) : null}
          <Button label={tr('v2.signIn')} onPress={() => void submit()} loading={busy} disabled={!email || !password} style={{ marginTop: 4 }} />
          <Button label={tr('v2.demoTry')} icon="eye" kind="ol" onPress={() => setDemoOpen(true)} />
          <Pressable onPress={() => router.push('/forgot')} accessibilityRole="link" style={{ alignSelf: 'center', marginTop: 2, minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.b, fontSize: 12.5, color: t.vtext }}>{tr('ob.forgotLink')}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/register')} accessibilityRole="link" style={{ alignSelf: 'center', marginTop: 0, minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.r, fontSize: 12.5, color: t.ink3 }}>{tr('v2.noSalon')} <Text style={{ fontFamily: font.b, color: t.vtext }}>{tr('v2.signUp')}</Text></Text>
          </Pressable>
          <Pressable onPress={() => router.push('/accept-invite')} accessibilityRole="link" style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.r, fontSize: 12.5, color: t.ink3 }}>{tr('ob.haveInvite')}</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 24 }}>
          {SUPPORTED.map((l) => (
            <Pressable key={l.code} onPress={() => void setLocale(l.code)} hitSlop={10} accessibilityRole="button" accessibilityLabel={l.endonym} accessibilityState={{ selected: getLocale() === l.code }}>
              <Text style={{ fontFamily: getLocale() === l.code ? font.b : font.r, fontSize: 13, color: getLocale() === l.code ? t.vtext : t.ink3 }}>{l.code.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <BottomSheet open={demoOpen} onClose={() => setDemoOpen(false)}>
        <View style={{ paddingBottom: Math.max(ins.bottom, 12) }}>
          <Pill text={tr('v2.demoPill')} tone="v" />
          <T k="h1" style={{ fontSize: 24, marginTop: 12, marginBottom: 6 }}>{tr('v2.demoTitle')}</T>
          <T k="body" color={t.muted} style={{ marginBottom: 16 }}>{tr('v2.demoBody')}</T>
          {([['cal', 'v2.demoF1'], ['spark', 'v2.demoF2'], ['receipt', 'v2.demoF3']] as const).map(([i, k], n) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: n ? 1 : 0, borderTopColor: t.hair }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name={i} size={19} color={t.ink} /></View>
              <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{tr(k)}</Text>
            </View>
          ))}
          <Button label={tr('v2.demoTry')} onPress={() => { setDemoOpen(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); enterDemo(); }} style={{ marginTop: 14 }} />
          <Button label={tr('v2.close')} kind="ghost" onPress={() => setDemoOpen(false)} style={{ marginTop: 8 }} />
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}
