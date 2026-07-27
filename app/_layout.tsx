import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function NavigationRoot() {
  const { isDark, colors } = useTheme();
  useEffect(() => {
    const open = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener(response => open(response.notification));
    return () => subscription.remove();
  }, []);
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}

export default function RootLayout() {
  return <ThemeProvider><NavigationRoot /></ThemeProvider>;
}
