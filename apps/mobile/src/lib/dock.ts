import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Floating dock (artifact F62): 64 tall, 14 from the sides, ~24 from the bottom (10 above the iOS home indicator). */
export const DOCK_HEIGHT = 64;
export const DOCK_SIDE = 14;
/** Distance from the screen bottom to the dock's bottom edge. Floats above the iOS home indicator, the Android gesture bar and the 3-button bar. */
export const dockBottom = (insBottom: number) => (Platform.OS === 'ios' ? Math.max(insBottom - 10, 24) : Math.max(insBottom + 12, 24));
/** Distance from the screen bottom to the dock's top edge. */
export const dockTop = (insBottom: number) => dockBottom(insBottom) + DOCK_HEIGHT;
/** Bottom padding for scrollables so the last item clears the dock with some air. */
export function useDockInset(extra = 16) {
  const ins = useSafeAreaInsets();
  return dockTop(ins.bottom) + extra;
}
