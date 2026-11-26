import React from 'react';
import { useRouter } from 'expo-router';
import { TodayHome } from '@/components/TodayHome';
import { Screen } from '@/components/ui';

export default function Today() {
  const router = useRouter();
  return <Screen><TodayHome onOpen={(a) => router.push(`/booking/${a.id}` as never)} onBlock={() => router.navigate('/calendar')} onCalendar={() => router.navigate('/calendar')} /></Screen>;
}
