import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { BackBar, Button, Field, T } from '@/components/kit';
import { Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { BAKU, round6, validPin, type Pin, type PinResult } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeContext';

/** Web fallback (MapLibre Native has no web build; the native screen is LocationPicker.native.tsx): plain latitude/longitude fields. */
export function MiniMap({ value, height = 150 }: { value: Pin; height?: number }) {
  const { t } = useTheme();
  return (
    <View style={{ height, borderRadius: 24, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}>
      <T k="sm" color={t.vtext}>{`${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`}</T>
    </View>
  );
}

export function LocationPicker({ open, onClose, value, onConfirm }: { open: boolean; onClose: () => void; value: Pin | null; onConfirm: (r: PinResult) => void; query?: string }) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  useEffect(() => { if (open) { const v = value && validPin(value) ? value : BAKU; setLat(String(v.latitude)); setLng(String(v.longitude)); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = { latitude: Number(lat.replace(',', '.')), longitude: Number(lng.replace(',', '.')) };
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <BackBar onBack={onClose} />
        <View style={{ padding: 20, gap: 10 }}>
          <T k="h1" style={{ fontSize: 26 }}>{tr('lp.title')}</T>
          <Field placeholder={tr('lp.lat')} accessibilityLabel={tr('lp.lat')} value={lat} onChangeText={setLat} keyboardType="decimal-pad" />
          <Field placeholder={tr('lp.lng')} accessibilityLabel={tr('lp.lng')} value={lng} onChangeText={setLng} keyboardType="decimal-pad" />
          <Button label={tr('lp.confirm')} size="lg" block disabled={!validPin(p)} onPress={() => onConfirm({ latitude: round6(p.latitude), longitude: round6(p.longitude) })} />
        </View>
      </Screen>
    </Modal>
  );
}
