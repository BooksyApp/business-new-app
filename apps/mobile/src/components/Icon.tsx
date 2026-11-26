import React, { memo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { ICONS } from '@/theme/iconData';

/** Solar Icon Set by 480 Design (CC BY 4.0) - Broken for rest, the Bold twin for active/selected (see theme/iconData.ts).
 *  API unchanged: name (a legacy "-f" suffix also means active), size (16/20/24/26), colour, filled. `bold` is kept for old call sites and is a no-op.
 *  Path data is pre-extracted at build time, so there is nothing to parse at runtime. */
export type IconName = string;
export const Icon = memo(function Icon({ name, size = 20, color = '#000', filled = false }: { name: IconName; size?: number; color?: string; filled?: boolean; bold?: boolean }) {
  const on = filled || name.endsWith('-f');
  const d = ICONS[on ? name.replace(/-f$/, '') : name];
  if (!d) return null;
  if (on && !d[2]) return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={d[1]} fill={color} fillRule="evenodd" /></Svg>;
  // stroke glyph: keep ~1.6px on screen (1.5 in a 24 viewBox is 1.625px at 26px); clamp so small sizes do not go hairline
  const sw = Math.min(2.4, Math.max(1.5, (1.6 * 24) / size));
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={d[0]} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
});
