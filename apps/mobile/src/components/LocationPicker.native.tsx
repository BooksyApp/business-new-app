import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, ScrollView, View, type NativeSyntheticEvent } from 'react-native';
import { Camera, Map as MapLibre, Marker, type CameraRef, type StyleSpecification, type ViewStateChangeEvent, type PressEvent, type PressEventWithFeatures } from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { askWithIntro } from '@/components/PermissionIntro';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Button, Field, T } from '@/components/kit';
import { t as tr } from '@/i18n';
import { MAP_BG, mapStyle } from '@/lib/mapStyle';
import { BAKU, geo, round6, validPin, type Pin, type PinMeta, type PinResult, type Place } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Zoom levels: neighbourhood (a saved or searched pin) and city (nothing chosen yet). */
const zoomOf = (zoomed: boolean) => (zoomed ? 15 : 12);
const lngLat = (p: Pin): [number, number] => [p.longitude, p.latitude];

/**
 * One map for the whole product: MapLibre Native drawing the same OpenFreeMap "positron" vector tiles, recoloured with the same
 * palette as the customer site (src/lib/mapStyle.ts), so a pin set here sits on exactly the street picture the customer sees.
 * No Google or Apple base map.
 */
/** Frozen per mounted map (a fresh object would restyle an open map): the bundled tuned copy, or the live one if already fetched. */
const useStyle = () => useState(() => mapStyle() as unknown as StyleSpecification)[0];
function OsmCredit({ top }: { top?: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', right: 6, ...(top != null ? { top } : { bottom: 4 }), backgroundColor: 'rgba(255,255,255,.8)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 9.5, color: '#4a4458' }}>© OpenStreetMap · OpenFreeMap</Text></View>;
}
/** The brand pin: violet disc with a white ring and a short stem; the stem's tip is the anchor point. */
function SalonPin({ violet }: { violet: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: violet, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px -4px rgba(29,23,48,.45)' } as object}>
        <Icon name="pin" size={20} color="#fff" />
      </View>
      <View style={{ width: 3, height: 10, borderRadius: 2, backgroundColor: violet }} />
    </View>
  );
}

/** Non-interactive preview of the saved pin (Salon profili, create flows). */
export function MiniMap({ value, height = 150 }: { value: Pin; height?: number }) {
  const { t } = useTheme();
  const STYLE = useStyle();
  return (
    <View style={{ height, borderRadius: 24, overflow: 'hidden', backgroundColor: MAP_BG }} pointerEvents="none">
      <MapLibre style={{ flex: 1, backgroundColor: MAP_BG }} mapStyle={STYLE} androidView="texture" attribution={false} logo={false} compass={false}
        dragPan={false} touchZoom={false} doubleTapZoom={false} doubleTapHoldZoom={false} touchRotate={false} touchPitch={false}>
        <Camera initialViewState={{ center: lngLat(value), zoom: zoomOf(true) }} center={lngLat(value)} zoom={zoomOf(true)} duration={0} />
        <Marker lngLat={lngLat(value)} anchor="bottom"><SalonPin violet={t.violet} /></Marker>
      </MapLibre>
      <OsmCredit />
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
  const STYLE = useStyle();
  const camera = useRef<CameraRef>(null);
  const [pin, setPin] = useState<Pin>(value ?? BAKU);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addr, setAddr] = useState<PinMeta | null>(null);
  const seq = useRef(0);

  useEffect(() => { if (open) { setPin(value && validPin(value) ? value : BAKU); setQ(query ?? ''); setHits([]); setAddr(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    setAddr(null); // the old spot's address must never be confirmed for a new pin
    const h = setTimeout(() => { void geo.reverse(pin).then((r) => { if (my === seq.current) setAddr(r); }); }, 500);
    return () => clearTimeout(h);
  }, [pin, open]);
  useEffect(() => {
    if (!open || q.trim().length < 3) { setHits([]); return; }
    const h = setTimeout(() => { setBusy(true); void geo.search(q).then(setHits).finally(() => setBusy(false)); }, 450);
    return () => clearTimeout(h);
  }, [q, open]);

  const go = (p: Pin, zoomed = true) => { setPin(p); camera.current?.easeTo({ center: lngLat(p), zoom: zoomOf(zoomed), duration: 350 }); };
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
  // The address always follows the pin: if the lookup for the current spot has not come back yet, wait for it before closing.
  const [confirming, setConfirming] = useState(false);
  const confirm = async () => {
    if (confirming) return;
    let a = addr;
    if (!a) { setConfirming(true); a = await geo.reverse(pin).catch(() => null); setConfirming(false); }
    onConfirm({ ...pin, ...(a ?? {}) });
  };
  const pick = (p: Place) => { Keyboard.dismiss(); setHits([]); setQ(p.label); go({ latitude: p.latitude, longitude: p.longitude }); setAddr({ address: p.address, city: p.city, state: p.state, zip: p.zip, country: p.country }); };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.canvas }}>
        <MapLibre style={{ flex: 1, backgroundColor: MAP_BG }} mapStyle={STYLE} androidView="texture" attribution={false} logo={false} compass={false} touchRotate={false} touchPitch={false}
          onRegionDidChange={(e: NativeSyntheticEvent<ViewStateChangeEvent>) => { const [lng, lat] = e.nativeEvent.center; setPin({ latitude: round6(lat), longitude: round6(lng) }); }}
          onPress={(e: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>) => { const [lng, lat] = e.nativeEvent.lngLat; go({ latitude: round6(lat), longitude: round6(lng) }); }}>
          <Camera ref={camera} initialViewState={{ center: lngLat(pin), zoom: zoomOf(!!value) }} />
        </MapLibre>
        <OsmCredit top={120} />
        {/* fixed centre pin: its tip sits on the map centre */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ marginBottom: 50 }}><SalonPin violet={t.violet} /></View>
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
            <Button label={tr('lp.confirm')} size="lg" block loading={confirming} onPress={() => void confirm()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
