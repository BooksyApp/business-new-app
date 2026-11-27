import React, { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { LocationPicker, MiniMap } from '@/components/LocationPicker';
import { Button, T } from '@/components/kit';
import { t as tr } from '@/i18n';
import type { Pin, PinResult } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeContext';

/**
 * The salon's map pin, required for the customer map. Empty = one calm "Xəritədə yer seçin" button; set = mini map + "Dəyiş".
 * `query` pre-fills the picker search (typed address + city). `error` shows the required message.
 */
export function LocationField({ value, onChange, query, error }: { value: Pin | null; onChange: (r: PinResult) => void; query?: string; error?: boolean }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {value ? (
        <View style={{ gap: 10 }}>
          <MiniMap value={value} />
          <Button label={tr('lp.change')} kind="ol" icon="pin" onPress={() => setOpen(true)} />
        </View>
      ) : (
        <View style={{ borderRadius: 24, backgroundColor: error ? t.gsoft : t.vsoft, padding: 18, gap: 12, alignItems: 'center' }}>
          <Icon name="pin" size={28} color={error ? t.gink : t.vtext} />
          <T k="sm" color={error ? t.gink : t.muted} style={{ textAlign: 'center' }}>{tr('lp.required')}</T>
          <Button label={tr('lp.set')} icon="pin" onPress={() => setOpen(true)} />
        </View>
      )}
      <LocationPicker open={open} onClose={() => setOpen(false)} value={value} query={query} onConfirm={(r) => { setOpen(false); onChange(r); }} />
    </View>
  );
}
