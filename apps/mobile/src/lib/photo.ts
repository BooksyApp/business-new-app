import type { ImageSourcePropType } from 'react-native';
import { API_BASE } from '@/lib/config';
import { DEMO_IMG } from '@/demo/photos';

/**
 * Any photo reference -> Image source. Bundled asset ids pass through, "demo:<key>" maps to a bundled demo photo
 * (works offline and in release builds), API paths ("/api/public/uploads/...") get the API origin.
 */
export function photoSource(u?: string | number | null): ImageSourcePropType | null {
  if (u == null || u === '') return null;
  if (typeof u === 'number') return u;
  if (u.startsWith('demo:')) return DEMO_IMG[u.slice(5)] ?? null;
  if (/^(https?|file|data|content|asset|blob):/i.test(u)) return { uri: u };
  return { uri: `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}` };
}
