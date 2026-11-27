import React from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { font } from '@/theme/tokens';

export type PhotoTag = { k: 'svc' | 'who'; t: string; x: number; y: number };

export function parseTags(raw?: string | null): PhotoTag[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as PhotoTag[];
    return Array.isArray(a) ? a.filter((g) => g && typeof g.t === 'string' && Number.isFinite(g.x) && Number.isFinite(g.y)).slice(0, 4) : [];
  } catch { return []; }
}

/** Where a picture of aspect `ar` (w/h) lands when shown `contain` inside a w x h box. Unknown aspect = the whole box. */
export function fitRect(w: number, h: number, ar?: number | null): { x: number; y: number; w: number; h: number } {
  if (!ar || !(ar > 0) || !w || !h) return { x: 0, y: 0, w, h };
  const pw = Math.min(w, h * ar); const ph = pw / ar;
  return { x: (w - pw) / 2, y: (h - ph) / 2, w: pw, h: ph };
}

/** Tag chips drawn where the owner dropped them. x, y are 0..1 of the PHOTO rectangle (not of the screen): pass the viewer box as w x h and the
 *  picture's aspect `ar` and the photo rect is derived exactly as `contain` lays it out. `top` / `bottom` are screen-relative control zones. */
export function TagLayer({ tags, w, h, ar, top = 8, bottom = 8 }: { tags: PhotoTag[]; w: number; h: number; ar?: number | null; top?: number; bottom?: number }) {
  if (!tags.length || !w || !h) return null;
  const r = fitRect(w, h, ar);
  const tp = Math.max(8, top - r.y); const bt = Math.max(8, bottom - (h - r.y - r.h));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }}>
      {tags.map((g, i) => (
        <View key={`${g.k}${i}`} style={{ position: 'absolute', left: Math.max(8, Math.min(g.x * r.w, r.w * 0.5)), top: Math.max(tp, Math.min(g.y * r.h, r.h - bt - 32)), maxWidth: r.w * 0.5 - 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, height: 32, paddingHorizontal: 12 }}>
          {g.k === 'svc' ? <Icon name="tag" size={14} color="#5b3fd6" /> : null}
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.b, fontSize: 13.5, color: '#1d1730' }}>{g.t}</Text>
        </View>
      ))}
    </View>
  );
}
