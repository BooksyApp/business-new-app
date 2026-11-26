import React from 'react';
import { SvgXml } from 'react-native-svg';
import { WORDMARK } from '@/theme/wordmarkData';

/** booqi wordmark. `color` recolours the letters; `g1`/`g2` recolour the gradient "o" (cream on ink uses lilac to blush, as on the icon). */
export function Wordmark({ height = 28, color, g1, g2 }: { height?: number; color?: string; g1?: string; g2?: string }) {
  let xml = color ? WORDMARK.replace(/#1D1730/gi, color) : WORDMARK;
  if (g1) xml = xml.replace(/#5B3FD6/i, g1);
  if (g2) xml = xml.replace(/#E83E63/i, g2);
  return <SvgXml xml={xml} width={(467.19 / 200) * height} height={height} />;
}
