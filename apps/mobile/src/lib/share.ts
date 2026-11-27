import { Share } from 'react-native';

/**
 * Share text right after a bottom sheet (a native Modal) was told to close. iOS freezes the whole app if the system share sheet is
 * presented while that Modal is still animating away, so the share waits until the dismissal has finished.
 */
export function shareAfterSheet(message: string, delayMs = 700): void {
  setTimeout(() => { Share.share({ message }).catch(() => {}); }, delayMs);
}
