import React, { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { LocationPicker } from '@/components/LocationPicker';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { T } from '@/components/kit';
import { t as tr } from '@/i18n';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { pinOf, type PinResult } from '@/lib/geo';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Whether the open salon has a map pin. `known` is false until the profile is loaded (no flash of the card). */
export function useSalonPin() {
  const { salon, version } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => (sid ? apiB.business(sid).catch(() => null) : Promise.resolve(null)), [sid, version]);
  return { known: !!q.data, hasPin: !!pinOf(q.data) };
}

/** Bu gün: calm one-tap card for salons that still have no map pin (they never show on the customer map). Gone as soon as the pin is saved. */
export function LocationCard() {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const { known, hasPin } = useSalonPin();
  const [open, setOpen] = useState(false);
  if (!known || hasPin || !salon) return null;
  async function save(r: PinResult) {
    setOpen(false);
    try { await apiB.updateBusiness(salon!.id, { latitude: r.latitude, longitude: r.longitude }); toast(tr('lp.saved'), 'success'); bump(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${tr('lp.cardTitle')}. ${tr('lp.cardSub')}`} noScale
        style={{ marginHorizontal: 20, marginTop: 10, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 24, backgroundColor: t.vsoft }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="pin" size={22} color={t.vtext} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{tr('lp.cardTitle')}</Text>
          <T k="sm" color={t.muted} lines={2}>{tr('lp.cardSub')}</T>
        </View>
        <Icon name="chev" size={18} color={t.ink3} />
      </Pressable>
      <LocationPicker open={open} onClose={() => setOpen(false)} value={null} onConfirm={(r) => void save(r)} />
    </>
  );
}
