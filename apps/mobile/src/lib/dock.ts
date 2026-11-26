import { Platform } from 'react-native';
import { useSafeAreaInsets } from '@/lib/insets';

/** Floating dock (artifact F62): 70 tall, 20 from the sides, 18 from the bottom (`.dock` of biz-ui.css), lifted above the home indicator. */
export const DOCK_HEIGHT = 70;
export const DOCK_SIDE = 20;
/** Distance from the screen bottom to the dock's bottom edge. Floats above the iOS home indicator, the Android gesture bar and the 3-button bar. */
export const dockBottom = (insBottom: number) => (Platform.OS !== 'android' ? Math.max(insBottom - 10, 18) : Math.max(insBottom + 12, 18));
/** Distance from the screen bottom to the dock's top edge. */
export const dockTop = (insBottom: number) => dockBottom(insBottom) + DOCK_HEIGHT;
/** Bottom padding for scrollables so the last item clears the dock with some air. */
export function useDockInset(extra = 16) {
  const ins = useSafeAreaInsets();
  return dockTop(ins.bottom) + extra;
}
