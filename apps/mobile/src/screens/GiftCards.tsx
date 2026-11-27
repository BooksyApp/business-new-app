import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { num } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Card, Field, Header, Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Hədiyyə kartları: sell a card (amount + optional e-mail) and check a card's balance. Its own place in "Daha çox", not inside Maliyyə. */
export function GiftCards({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? ''; const cur = salon?.currency;
  const [amt, setAmt] = useState(''); const [mail, setMail] = useState(''); const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'sell' | 'check' | null>(null);
  const [sold, setSold] = useState<{ code: string; amount: number } | null>(null);
  const [found, setFound] = useState<{ code: string; balance: number; amount: number } | null>(null);
  const [err, setErr] = useState('');
  const N = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
  async function sell() {
    setErr(''); setBusy('sell');
    try { const c = await apiB.issueGiftCard(sid, num(amt), mail.trim()); setSold({ code: String(c.code), amount: N(c.amount) }); setAmt(''); setMail(''); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function check() {
    setErr(''); setBusy('check');
    try { const c = await apiB.lookupGiftCard(code.trim()); setFound({ code: String(c.code), balance: N(c.balance), amount: N(c.amount) }); }
    catch (e) { setFound(null); setErr((e as Error).message); } finally { setBusy(null); }
  }
  const head = (s: string) => <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{s}</Text>;
  const row = (k: string, v: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34 }}>
      <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 13.5, color: t.muted }}>{k}</Text>
      <Text numberOfLines={1} selectable style={{ flex: 1, textAlign: 'right', fontFamily: font.s, fontSize: 15, color: t.ink }}>{v}</Text>
    </View>
  );
  return (
    <Screen>
      <Header title={tr('fn.gift')} subtitle={salon?.name} onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 12 }}>
        <Card style={{ gap: 10, padding: 16 }}>
          {head(tr('fn.sellGift'))}
          <Field label={`${tr('ex.amount')} (${cur ?? 'AZN'})`} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" />
          <Field label={tr('cl.email')} value={mail} onChangeText={setMail} keyboardType="email-address" autoCapitalize="none" />
          <Btn label={tr('fn.issue')} loading={busy === 'sell'} disabled={!(num(amt) > 0)} onPress={() => void sell()} />
          {sold ? <View style={{ backgroundColor: t.vsoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}>{row(tr('fn.giftCode'), sold.code)}{row(tr('ex.amount'), money(sold.amount, cur))}</View> : null}
        </Card>
        <Card style={{ gap: 10, padding: 16 }}>
          {head(tr('fn.lookup'))}
          <Field label={tr('sl.giftCode')} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} />
          <Btn label={tr('fn.check')} variant="secondary" loading={busy === 'check'} disabled={!code.trim()} onPress={() => void check()} />
          {found ? <View style={{ backgroundColor: t.fill, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}>{row(tr('fn.giftCode'), found.code)}{row(tr('fn.balance'), `${money(found.balance, cur)} / ${money(found.amount, cur)}`)}</View> : null}
        </Card>
        {err ? <Text style={{ fontFamily: font.s, fontSize: 13.5, color: t.gink, textAlign: 'center' }}>{err}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
