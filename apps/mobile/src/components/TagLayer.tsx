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

/** Tag chips drawn where the owner dropped them (x, y are 0..1 of the editor photo), kept inside the photo and clear of top/bottom controls. */
export function TagLayer({ tags, w, h, top = 8, bottom = 8 }: { tags: PhotoTag[]; w: number; h: number; top?: number; bottom?: number }) {
  if (!tags.length || !w || !h) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
      {tags.map((g, i) => (
        <View key={`${g.k}${i}`} style={{ position: 'absolute', left: Math.max(8, Math.min(g.x * w, w * 0.5)), top: Math.max(top, Math.min(g.y * h, h - bottom - 32)), maxWidth: w * 0.5 - 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, height: 32, paddingHorizontal: 12 }}>
          {g.k === 'svc' ? <Icon name="tag" size={14} color="#5b3fd6" /> : null}
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.b, fontSize: 13.5, color: '#1d1730' }}>{g.t}</Text>
        </View>
      ))}
    </View>
  );
}
