import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header, Screen, StateView } from '@/components/ui';
import { t as tr, type StringKey } from '@/i18n';

/** Sections of "Daha çox" that the app does not have yet: a clean "coming soon" state, no fake data. */
const ICONS: Record<string, string> = { views: 'spark', services: 'scissors', team: 'users', reviews: 'star', messages: 'chat', settings: 'gear' };

export default function Section() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const k = ICONS[key] ? key : 'settings';
  return (
    <Screen>
      <Header title={tr(`sections.${k}` as StringKey)} onBack={() => router.back()} />
      <StateView icon={ICONS[k]} title={tr('soon.title')} body={tr('soon.body')} />
    </Screen>
  );
}
