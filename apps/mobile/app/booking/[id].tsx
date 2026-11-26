import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookingSheet } from '@/components/BookingSheet';
import { ErrorState, Screen, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';

/** Deep link target: booqibiz://booking/<id> (also a tapped push notification) opens the booking sheet over an empty canvas. */
export default function BookingDeepLink() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useLoad(() => api.appointment(String(id)), [id]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/calendar'));
  return (
    <Screen>
      {a.error ? <ErrorState error={a.error} onRetry={() => void a.reload()} /> : !a.data ? <Skeleton rows={2} height={90} /> : null}
      <BookingSheet appt={a.data} onClose={close} />
    </Screen>
  );
}
