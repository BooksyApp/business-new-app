import React from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/kit';
import { Screen } from '@/components/ui';
import { t as tr } from '@/i18n';

/**
 * Per-route error boundary (expo-router picks up `export { ScreenErrorBoundary as ErrorBoundary }` in every route file).
 * One screen failing on an unexpected live response shows a calm retry card instead of the red crash page, and the tab bar,
 * back button and every other screen keep working.
 */
export function ScreenErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  if (typeof console !== 'undefined') console.warn('[screen-error]', error?.message);
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState title={tr('state.errorTitle')} body={tr('state.offlineBody')} action={{ label: tr('state.retry'), onPress: () => { void retry(); } }} />
      </View>
    </Screen>
  );
}
