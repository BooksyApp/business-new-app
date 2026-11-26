import { Switch, View } from 'react-native';
import { Text } from '@/components/Text';
import { Chip } from '@/components/ui';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Label + switch row used by every editor. */
export function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginTop: 1 }}>{hint}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: t.violet, false: t.fill2 }} />
    </View>
  );
}

/** Single-choice row of chips. */
export function Choice<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {options.map((o) => <Chip key={String(o.value)} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} />)}
    </View>
  );
}

/** Multi-select chips (ids as strings). */
export function MultiChoice({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return <Chip key={o.value} label={o.label} active={on} icon={on ? 'check' : undefined} onPress={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])} />;
      })}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const { t } = useTheme();
  return <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 18, color: t.ink, marginTop: 8, marginBottom: 6 }}>{children}</Text>;
}

/** Parses a decimal typed with comma or dot; NaN when empty/invalid. */
export const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));
