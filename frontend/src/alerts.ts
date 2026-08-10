/**
 * Cross-platform dialogs.
 *
 * React Native Web has no `Alert` implementation — `Alert.alert(...)` is a silent
 * no-op in the browser, which makes any button whose feedback (or whose action,
 * when nested in an Alert button callback) lives inside `Alert.alert` appear
 * dead on web. These helpers fall back to the browser's native dialogs on web
 * and use the real RN `Alert` on device.
 */
import { Alert, Platform } from 'react-native';

/** A simple notice with an OK button. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** A destructive confirm; `onConfirm` runs only if the user accepts. */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
