import React, { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Button, T } from '@/components/kit';
import { t as tr } from '@/i18n';
import { getItem, setItem } from '@/lib/secureStorage';
import { useTheme } from '@/theme/ThemeContext';

/**
 * Our own explanation BEFORE the system prompt, asked at the point of use (photos, camera) or once after the first sign-in (push).
 * Already granted (limited counts) = never asked again. Denied for good = the same sheet offers "Ayarları aç".
 */
export type IntroKind = 'photos' | 'camera' | 'push';
/** granted: go ahead. denied/blocked: the OS said no (blocked = only Settings can change it). skipped: the person dismissed our sheet. */
export type IntroResult = 'granted' | 'denied' | 'blocked' | 'skipped';
type Req = { kind: IntroKind; blocked: boolean; resolve: (r: IntroResult) => void };

let host: ((r: Req) => void) | null = null;
const SEEN = (k: IntroKind) => `biz.permIntro.${k}`;
export const openAppSettings = () => Linking.openSettings().catch(() => {});

async function status(kind: IntroKind): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    if (kind === 'push') {
      const N = (require('expo-notifications') as typeof import('expo-notifications'));
      const p = await N.getPermissionsAsync();
      return { granted: p.granted, canAskAgain: p.canAskAgain };
    }
    const p = kind === 'camera' ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch { return { granted: false, canAskAgain: true }; }
}
async function request(kind: IntroKind): Promise<IntroResult> {
  try {
    if (kind === 'push') return 'granted'; // the caller (enablePush) shows the OS prompt itself
    const p = kind === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'denied' : 'blocked';
  } catch { return 'denied'; }
}

/** Shows our sheet first, then the OS prompt. Web has no permissions: always 'granted'. */
export async function askWithIntro(kind: IntroKind): Promise<IntroResult> {
  if (Platform.OS === 'web') return 'granted';
  const p = await status(kind);
  if (p.granted) return 'granted';
  const blocked = !p.canAskAgain;
  if (!blocked && kind !== 'push' && (await getItem(SEEN(kind)).catch(() => null)) === '1') return request(kind);
  if (!host) return blocked ? 'blocked' : request(kind);
  return new Promise((resolve) => host!({ kind, blocked, resolve }));
}

export function PermissionIntro() {
  const { t } = useTheme();
  const [req, setReq] = useState<Req | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { host = (r) => { setReq(r); setOpen(true); }; return () => { host = null; }; }, []);
  if (!req) return null;
  const { kind, blocked } = req;
  const icon = kind === 'camera' ? 'cam' : kind === 'push' ? 'bell' : 'img';
  const title = blocked ? tr(kind === 'camera' ? 'pm.blockedCamera' : kind === 'push' ? 'push.title' : 'pm.blockedPhotos') : tr(kind === 'camera' ? 'pm.cameraTitle' : kind === 'push' ? 'pm.pushTitle' : 'pm.photosTitle');
  const text = blocked ? tr(kind === 'camera' ? 'pm.blockedCameraText' : kind === 'push' ? 'push.body' : 'pm.blockedPhotosText') : tr(kind === 'camera' ? 'pm.cameraText' : kind === 'push' ? 'push.body' : 'pm.photosText');
  const hint = tr(kind === 'camera' ? 'pm.hintCamera' : kind === 'push' ? 'pm.hintPush' : 'pm.hintPhotos');
  const done = (r: IntroResult) => { setOpen(false); req.resolve(r); };
  const mark = () => { if (kind !== 'push') setItem(SEEN(kind), '1').catch(() => {}); };
  const primary = async () => {
    if (blocked) { openAppSettings(); done('blocked'); return; }
    mark(); setOpen(false);
    req.resolve(await request(kind));
  };
  const secondary = () => { mark(); done(blocked && kind === 'photos' ? 'denied' : 'skipped'); };
  const secondLabel = blocked ? (kind === 'camera' ? tr('pm.gallery') : kind === 'photos' ? tr('pm.pickAnyway') : tr('pm.later')) : tr('pm.later');
  return (
    <BottomSheet open={open} onClose={() => done('skipped')}>
      <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 16 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Icon name={icon} size={34} color={t.vtext} /></View>
        <T k="h1" style={{ textAlign: 'center' }}>{title}</T>
        <T k="body" color={t.muted} style={{ textAlign: 'center', marginTop: 8 }}>{text}</T>
        {blocked ? <T k="sm" color={t.vtext} style={{ marginTop: 10 }}>{hint}</T> : null}
      </View>
      <Button label={blocked ? tr('pm.settings') : tr('pm.allow')} size="lg" block onPress={() => void primary()} />
      <Button label={secondLabel} kind="ghost" block onPress={secondary} style={{ marginTop: 6 }} />
    </BottomSheet>
  );
}
