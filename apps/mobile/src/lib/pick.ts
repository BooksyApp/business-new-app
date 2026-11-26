import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';
import { uploadForm } from '@/lib/api';
import { t as tr } from '@/i18n';

type Asset = { uri: string; fileName?: string | null; mimeType?: string | null };
const part = (a: Asset, fallback: string) => {
  const png = (a.mimeType ?? '').includes('png') || /\.png$/i.test(a.fileName ?? '');
  // The picker re-encodes (quality < 1) to JPEG/PNG; a HEIC name or type would make the server reject the part.
  return { uri: a.uri, name: png ? 'photo.png' : fallback, type: png ? 'image/png' : 'image/jpeg' };
};
/** Library: the system picker (PHPicker / Android photo picker) needs no permission, so it is never gated on one
 *  (gating on `granted` blocked the picker whenever iOS reported denied/limited or Android lacked READ_MEDIA_IMAGES).
 *  Camera: needs the permission; a denial surfaces a clear message and opens Settings when the OS will not ask again. */
async function launch(source: 'library' | 'camera', allowsEditing: boolean): Promise<Asset | null> {
  const opts = { mediaTypes: ['images'] as ('images')[], quality: 0.85, allowsEditing };
  if (source === 'camera') {
    let perm = await ImagePicker.getCameraPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { if (!perm.canAskAgain) Linking.openSettings().catch(() => {}); throw new Error(tr('ad.permission')); }
  }
  let r: ImagePicker.ImagePickerResult;
  try { r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts); }
  catch (e) { throw new Error(tr('ad.permission') + ((e as Error).message ? ` (${(e as Error).message})` : '')); }
  return r.canceled || !r.assets?.[0] ? null : r.assets[0];
}

export type Uploaded = { id: string; url: string };

/** Opens the photo library and uploads the chosen image to POST /api/uploads with the given purpose. Resolves null when cancelled. */
export async function pickAndUpload(purpose: 'STAFF_AVATAR' | 'BUSINESS_LOGO' | 'BUSINESS_COVER' | 'BUSINESS_PHOTO' | 'LOOK' | 'STAFF_PORTFOLIO' | 'CLIENT_PHOTO'): Promise<Uploaded | null> {
  const a = await launch('library', false);
  if (!a) return null;
  return uploadPicked(part(a, 'photo.jpg'), purpose);
}

/** Story: image only, posted as multipart to /businesses/{id}/stories. */
export async function pickAndPostStory(businessId: string | number, caption: string): Promise<boolean> {
  const a = await launch('library', false);
  if (!a) return false;
  await postStoryPicked(businessId, part(a, 'story.jpg'), caption);
  return true;
}

export type Picked = { uri: string; name: string; type: string };
/** Gallery or camera; resolves null when cancelled. Throws a localized Error when the camera is denied. */
export async function pickImage(source: 'library' | 'camera'): Promise<Picked | null> {
  const a = await launch(source, false);
  return a ? part(a, 'photo.jpg') : null;
}
export async function uploadPicked(p: Picked, purpose: string): Promise<Uploaded> {
  const form = new FormData();
  form.append('file', { uri: p.uri, name: p.name, type: p.type } as unknown as Blob);
  form.append('purpose', purpose);
  return uploadForm<Uploaded>('/uploads', form);
}
export async function postStoryPicked(businessId: string | number, p: Picked, caption: string): Promise<void> {
  const form = new FormData();
  form.append('file', { uri: p.uri, name: p.name, type: p.type } as unknown as Blob);
  if (caption.trim()) form.append('caption', caption.trim());
  await uploadForm(`/businesses/${businessId}/stories`, form);
}
