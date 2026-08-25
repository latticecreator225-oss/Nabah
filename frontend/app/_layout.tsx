import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  ScheherazadeNew_400Regular,
  ScheherazadeNew_700Bold,
} from '@expo-google-fonts/scheherazade-new';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { Colors } from '../src/theme';
import { TextScaleProvider } from '../src/textScale';
import { I18nProvider } from '../src/i18n';

// ─────── Foreground handler (module scope, web-guarded) ───────
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data: any = notification.request.content.data || {};
      // A scheduled adhan firing while the app is open: show the banner but stay
      // silent — the in-app audio player sounds the full adhan, so we avoid
      // playing the notification tone on top of it.
      const isAdhan = data.type === 'adhan';
      return {
        shouldShowAlert: true,
        shouldPlaySound: !isAdhan,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      } as any;
    },
  });
}

// ─────── Android default channel (module scope) ───────
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
  }).catch(() => {});
}

function extractUrl(data: any): string | undefined {
  // FCM delivers our payload's fields flat in `data`; the deep link is action_url.
  return data?.deeplink || data?.action_url;
}

export default function RootLayout() {
  const router = useRouter();
  const [loaded] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    ScheherazadeNew_400Regular,
    ScheherazadeNew_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    GreatVibes_400Regular,
  });

  // ── Notification tap routing ──
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response.notification.request.content.data || {};
      const url = extractUrl(data);
      if (!url) return;
      url.startsWith('http') ? Linking.openURL(url) : router.push(url as any);
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data: any = response.notification.request.content.data || {};
        const url = extractUrl(data);
        if (url) {
          url.startsWith('http') ? Linking.openURL(url) : router.push(url as any);
        }
      })
      .catch(() => {});

    return () => {
      tapSub.remove();
    };
  }, [router]);

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
      <SafeAreaProvider>
        <I18nProvider>
        <TextScaleProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.bgPrimary },
              animation: 'fade',
            }}
          />
        </TextScaleProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
