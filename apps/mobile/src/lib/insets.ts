import { Platform } from 'react-native';
import { useSafeAreaInsets as useRaw } from 'react-native-safe-area-context';

/** Safe-area insets. In the dev web preview (EXPO_PUBLIC_MOCK=1) a notch + home indicator are simulated so screenshots match a phone. */
export function useSafeAreaInsets() {
  const ins = useRaw();
  if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_MOCK === '1') return { ...ins, top: 47, bottom: 22 };
  return ins;
}
