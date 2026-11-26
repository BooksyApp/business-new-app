import React from 'react';
import { SvgXml } from 'react-native-svg';
import { WORDMARK } from '@/theme/wordmarkData';

export function Wordmark({ height = 28, color }: { height?: number; color?: string }) {
  const xml = color ? WORDMARK.replace(/#1D1730/gi, color) : WORDMARK;
  return <SvgXml xml={xml} width={(467.19 / 200) * height} height={height} />;
}
