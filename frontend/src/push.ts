/**
 * Nabah · Push registration helper
 *
 * Call `registerForPush(userId)` from home.tsx on app open.
 * Safe on web (no-op) and on Expo Go (warns once, no crash).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API, authHeaders } from './api';

let lastTriedToken = '';

export async function registerForPush(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !userId) return;

  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    let granted = status === 'granted';
    if (!granted && canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const device_token = tokenResp.data;
    if (!device_token || device_token === lastTriedToken) return;
    lastTriedToken = device_token;

    await fetch(`${API}/register-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        user_id: userId,
        platform: Platform.OS,
        device_token,
      }),
    });
  } catch (e) {
    // Expected in Expo Go and web preview — silent
    console.log('[push] registration skipped:', String(e));
  }
}
