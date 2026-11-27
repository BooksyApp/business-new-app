import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Platform, ScrollView, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { askWithIntro } from '@/components/PermissionIntro';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Button, Field, T } from '@/components/kit';
import { t as tr } from '@/i18n';
import { BAKU, geo, round6, validPin, type Pin, type PinResult, type Place } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const delta = (zoomed: boolean) => (zoomed ? 0.006 : 0.05);
const region = (p: Pin, zoomed: boolean): Region => ({ ...p, latitudeDelta: delta(zoomed), longitudeDelta: delta(zoomed) });

/** Non-interactive preview of the saved pin (Salon profili, create flows). */
export function MiniMap({ value, height = 150 }: { value: Pin; height?: number }) {
  const { t } = useTheme();
  return (
    <View style={{ height, borderRadius: 24, overflow: 'hidden', backgroundColor: t.fill }} pointerEvents="none">
      <MapView style={{ flex: 1 }} region={region(value, true)} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} toolbarEnabled={false} liteMode={Platform.OS === 'android'}>
        <Marker coordinate={value} tracksViewChanges={false} />
      </MapView>
    </View>
  );
}

/**
 * Full-screen map: the pin stays fixed in the centre, the map moves under it (or tap the map to jump there).
 * Search by address (backend /public/geocode), "Mənim yerim" (foreground location), reverse geocode of the dropped pin.
 */
export function LocationPicker({ open, onClose, value, onConfirm, query }: { open: boolean; onClose: () => void; value: Pin | null; onConfirm: (r: PinResult) => void; query?: string }) {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [pin, setPin] = useState<Pin>(value ?? BAKU);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addr, setAddr] = useState<{ address?: string; city?: string } | null>(null);
  const seq = useRef(0);

  useEffect(() => { if (open) { setPin(value && validPin(value) ? value : BAKU); setQ(query ?? ''); setHits([]); setAddr(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    const h = setTimeout(() => { void geo.reverse(pin).then((r) => { if (my === seq.current) setAddr(r); }); }, 500);
    return () => clearTimeout(h);
  }, [pin, open]);
  useEffect(() => {
    if (!open || q.trim().length < 3) { setHits([]); return; }
    const h = setTimeout(() => { setBusy(true); void geo.search(q).then(setHits).finally(() => setBusy(false)); }, 450);
    return () => clearTimeout(h);
  }, [q, open]);

  const go = (p: Pin, zoomed = true) => { setPin(p); map.current?.animateToRegion(region(p, zoomed), 350); };
  async function mine() {
    const ok = await askWithIntro('location');
    if (ok !== 'granted') return;
    setLocating(true);
    try {
      const L = require('expo-location') as typeof import('expo-location');
      const pos = (await L.getLastKnownPositionAsync()) ?? (await L.getCurrentPositionAsync({ accuracy: L.Accuracy.Balanced }));
      go({ latitude: round6(pos.coords.latitude), longitude: round6(pos.coords.longitude) });
    } catch { /* no fix: the map stays where it is */ } finally { setLocating(false); }
  }
  const pick = (p: Place) => { Keyboard.dismiss(); setHits([]); setQ(p.label); go({ latitude: p.latitude, longitude: p.longitude }); setAddr({ address: p.address, city: p.city }); };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.canvas }}>
        <MapView ref={map} style={{ flex: 1 }} initialRegion={region(pin, !!value)} showsUserLocation={false} toolbarEnabled={false} rotateEnabled={false} pitchEnabled={false}
          onRegionChangeComplete={(r) => setPin({ latitude: round6(r.latitude), longitude: round6(r.longitude) })}
          onPress={(e) => go({ latitude: round6(e.nativeEvent.coordinate.latitude), longitude: round6(e.nativeEvent.coordinate.longitude) }, true)} />
        {/* fixed centre pin: its tip sits on the map centre */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ marginBottom: 44, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.violet, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px -4px rgba(29,23,48,.45)' } as object}>
              <Icon name="pin" size={20} color="#fff" />
            </View>
            <View style={{ width: 3, height: 10, borderRadius: 2, backgroundColor: t.violet }} />
          </View>
        </View>

        <View style={{ position: 'absolute', left: 16, right: 16, top: ins.top + 8, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.back')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px -6px rgba(29,23,48,.3)' } as object}>
              <Icon name="x" size={20} color={t.ink} />
            </Pressable>
            <View style={{ flex: 1 }}><Field icon="search" placeholder={tr('lp.search')} accessibilityLabel={tr('lp.search')} value={q} onChangeText={setQ} returnKeyType="search" autoCorrect={false} right={busy ? <ActivityIndicator color={t.violet} /> : undefined} /></View>
          </View>
          {hits.length > 0 ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240, borderRadius: 20, backgroundColor: t.surface }}>
              {hits.map((h, i) => (
                <Pressable key={`${h.latitude},${h.longitude},${i}`} onPress={() => pick(h)} accessibilityRole="button" accessibilityLabel={h.label} style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
                  <Text numberOfLines={2} style={{ fontFamily: font.m, fontSize: 14, color: t.ink }}>{h.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : q.trim().length >= 3 && !busy ? <T k="sm" color={t.muted} style={{ alignSelf: 'center', backgroundColor: t.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>{tr('lp.noResult')}</T> : null}
        </View>

        <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(ins.bottom, 12) + 4, gap: 10 }}>
          <Pressable onPress={() => void mine()} accessibilityRole="button" accessibilityLabel={tr('lp.mine')} style={{ alignSelf: 'flex-end', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.surface, boxShadow: '0 4px 14px -6px rgba(29,23,48,.3)' } as object}>
            {locating ? <ActivityIndicator color={t.violet} /> : <Icon name="pin" size={16} color={t.vtext} />}
            <Text style={{ fontFamily: font.b, fontSize: 14, color: t.vtext }}>{tr('lp.mine')}</Text>
          </Pressable>
          <View style={{ borderRadius: 24, backgroundColor: t.surface, padding: 14, gap: 10, boxShadow: '0 8px 28px -10px rgba(29,23,48,.35)' } as object}>
            <T k="sm" color={t.muted} lines={1}>{[addr?.address, addr?.city].filter(Boolean).join(', ') || tr('lp.hint')}</T>
            <Button label={tr('lp.confirm')} size="lg" block onPress={() => onConfirm({ ...pin, address: addr?.address, city: addr?.city })} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
