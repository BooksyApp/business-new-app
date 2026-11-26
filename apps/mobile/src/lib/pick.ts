import * as ImagePicker from 'expo-image-picker';
import { uploadForm } from '@/lib/api';

export type Uploaded = { id: string; url: string };

/** Opens the photo library and uploads the chosen image to POST /api/uploads with the given purpose. Resolves null when cancelled. */
export async function pickAndUpload(purpose: 'STAFF_AVATAR' | 'BUSINESS_LOGO' | 'BUSINESS_COVER' | 'BUSINESS_PHOTO' | 'LOOK' | 'STAFF_PORTFOLIO'): Promise<Uploaded | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('permission');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const form = new FormData();
  form.append('file', { uri: a.uri, name: a.fileName ?? 'photo.jpg', type: a.mimeType ?? 'image/jpeg' } as unknown as Blob);
  form.append('purpose', purpose);
  return uploadForm<Uploaded>('/uploads', form);
}

/** Story: image only (the picker is limited to images here) posted as multipart to /businesses/{id}/stories. */
export async function pickAndPostStory(businessId: string | number, caption: string): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('permission');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (r.canceled || !r.assets[0]) return false;
  const a = r.assets[0];
  const form = new FormData();
  form.append('file', { uri: a.uri, name: a.fileName ?? 'story.jpg', type: a.mimeType ?? 'image/jpeg' } as unknown as Blob);
  if (caption.trim()) form.append('caption', caption.trim());
  await uploadForm(`/businesses/${businessId}/stories`, form);
  return true;
}

export type Picked = { uri: string; name: string; type: string };
/** Gallery or camera; resolves null when cancelled. Throws 'permission' when denied. */
export async function pickImage(source: 'library' | 'camera'): Promise<Picked | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('permission');
  const opts = { mediaTypes: ['images'] as ('images')[], quality: 0.85 };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: a.fileName ?? 'photo.jpg', type: a.mimeType ?? 'image/jpeg' };
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
