import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/useAuthStore';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { Button } from '../src/components/Button';

const { width } = Dimensions.get('window');
const STEPS = [
  { icon: '💊', title: 'İlaç Hatırlatma', desc: 'İlaçlarınızı zamanında almanız için\nsize ve yakınınıza hatırlatma gönderir.' },
  { icon: '❤️', title: 'Aile Takibi', desc: 'Yakınlarınızın ilaçlarını alıp\n almadığını anında görürsünüz.' },
  { icon: '🏠', title: 'Hazırsınız', desc: 'Telefon numaranızla giriş yapın,\nbir dakikada kullanmaya başlayın.' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [ready, setReady] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    AsyncStorage.getItem('famicare_session').then(session => {
      if (session === 'true') {
        const { isLoggedIn, role } = useAuthStore.getState();
        if (isLoggedIn && role) {
          router.replace(role === 'caregiver' ? '/caregiver' : '/home');
          return;
        }
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  if (!ready) return null;

  const next = () => {
    if (page < STEPS.length - 1) {
      flatRef.current?.scrollToIndex({ index: page + 1 });
      setPage(page + 1);
    } else {
      router.replace('/welcome');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={() => router.replace('/welcome')}>
        <Text style={{ ...typography.body, color: colors.primary }}>Atla</Text>
      </TouchableOpacity>
      <FlatList ref={flatRef} data={STEPS} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <View style={styles.iconCircle}><Text style={{ fontSize: 56 }}>{item.icon}</Text></View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
        keyExtractor={(_, i) => String(i)}
      />
      <View style={styles.bottom}>
        <View style={styles.dots}>{STEPS.map((_, i) => (<View key={i} style={[styles.dot, i === page && { backgroundColor: colors.primary, width: 24 }]} />))}</View>
        <Button title={page < STEPS.length - 1 ? 'Devam' : 'Başla'} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  skip: { position: 'absolute', top: 56, right: spacing.lg, zIndex: 10 },
  page: { width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primaryLight + '25', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  desc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 26 },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: 48, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
});
