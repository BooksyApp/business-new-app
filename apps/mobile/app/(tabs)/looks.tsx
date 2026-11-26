import React from 'react';
import { useRouter } from 'expo-router';
import { Looks } from '@/screens/Looks';

export default function LooksTab() {
  const router = useRouter();
  return <Looks onBack={() => router.navigate('/today')} />;
}
