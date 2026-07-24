import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/stores/useAuthStore';

const HOME_SCREENS = ['/home', '/caregiver', '/welcome', '/login', '/onboarding'];
const DETAIL_SCREENS = ['/medication', '/appointments', '/health', '/profile', '/notifications',
  '/add-medication', '/add-appointment', '/add-health', '/edit-medication', '/edit-profile',
  '/emergency-contacts', '/add-profile', '/pin-setup', '/pin-entry'];

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onBackPress = () => {
      const role = useAuthStore.getState().role;
      const homeRoute = role === 'caregiver' ? '/caregiver' : '/home';
      if (HOME_SCREENS.includes(pathname)) return false;
      if (DETAIL_SCREENS.includes(pathname)) {
        router.replace(homeRoute);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [pathname]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </>
  );
}
