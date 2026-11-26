import React from 'react';
import { Platform, Text as RNText, TextProps } from 'react-native';

/** Text with Android includeFontPadding off (matches artifact line boxes) and dynamic type capped at 1.2x. */
export const Text = React.forwardRef<RNText, TextProps>(function Text({ style, maxFontSizeMultiplier = 1.2, ...rest }, ref) {
  return <RNText ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} style={[style, Platform.OS === 'android' ? { includeFontPadding: false } : null]} />;
});
