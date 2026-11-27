import * as ImagePicker from 'expo-image-picker';
import { askWithIntro } from '@/components/PermissionIntro';
import { uploadForm } from '@/lib/api';
import { t as tr } from '@/i18n';

type Asset = { uri: string; fileName?: string | null; mimeType?: string | null };
/** The ONLY shape a React Native FormData file part may have: `{ uri: 'file://...', name, type }` (plain strings, no Blob/File/asset objects).
 *  The picker re-encodes (quality < 1) to JPEG/PNG; a HEIC name or type would make the server reject the part. */
const part = (a: Asset, fallback: string): Picked => {
  const png = (a.mimeType ?? '').includes('png') || /\.png$/i.test(a.fileName ?? '');
  const raw = String(a.uri ?? '');
  const uri = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `file://${raw}`;
  return { uri, name: png ? 'photo.png' : fallback, type: png ? 'image/png' : 'image/jpeg' };
};
/** Library and camera both go through our own rationale sheet first (once; 'limited' counts as granted), then the OS prompt.
 *  The system library picker needs no permission, so a refusal never blocks it; only a dismissed sheet cancels. A refused camera cancels. */
async function launch(source: 'library' | 'camera', allowsEditing: boolean): Promise<Asset | null> {
  const opts = { mediaTypes: ['images'] as ('images')[], quality: 0.85, allowsEditing };
  const ask = await askWithIntro(source === 'camera' ? 'camera' : 'photos');
  if (ask === 'skipped') return null;
  if (source === 'camera' && ask !== 'granted') return null;
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
/** Always a fresh plain object with string fields: nothing else is accepted by RN's multipart encoder. */
const filePart = (p: Picked) => { if (!p?.uri) throw new Error(tr('cp.photoLost')); return { uri: String(p.uri), name: String(p.name || 'photo.jpg'), type: String(p.type || 'image/jpeg') }; };
export async function uploadPicked(p: Picked, purpose: string): Promise<Uploaded> {
  const form = new FormData();
  form.append('file', filePart(p) as unknown as Blob);
  form.append('purpose', purpose);
  return uploadForm<Uploaded>('/uploads', form);
}
export async function postStoryPicked(businessId: string | number, p: Picked, caption: string, tags?: string): Promise<void> {
  const form = new FormData();
  form.append('file', filePart(p) as unknown as Blob);
  if (caption.trim()) form.append('caption', caption.trim());
  if (tags) form.append('tags', tags);
  await uploadForm(`/businesses/${businessId}/stories`, form);
}
