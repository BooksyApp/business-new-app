import { Redirect } from 'expo-router';
import { useApp } from '@/lib/app';

/**
 * Entry route. Must pick a destination the current auth state allows: /calendar is behind Stack.Protected,
 * so redirecting signed-out users there left the navigator with nothing to render (blank app after splash).
 */
export default function Index() {
  const { status } = useApp();
  return <Redirect href={status === 'in' ? '/today' : '/login'} />;
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
