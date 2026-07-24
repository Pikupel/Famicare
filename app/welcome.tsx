import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { useAuthStore } from '../src/stores/useAuthStore';

export default function WelcomeScreen() {
  const router = useRouter();
  const setRole = useAuthStore((s) => s.setRole);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (isLoggedIn && role) {
      router.replace(role === 'caregiver' ? '/caregiver' : '/home');
    }
  }, [isLoggedIn, role]);

  if (isLoggedIn && role) return null;

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.logoCircle}>
          <Image source={require('../assets/logo.png')} style={{ width: 72, height: 72 }} resizeMode="contain" />
        </View>
        <Text style={styles.brand}>Famicare</Text>
        <Text style={styles.slogan}>Sevdikleriniz güvende,{'\n'}siz içiniz rahat.</Text>
      </View>

      <View style={styles.bottom}>
        <Button title="Yakınım İçin" onPress={() => { setRole('caregiver'); router.replace('/login'); }} />
        <Text style={styles.desc}>Annem, babam veya bir yakınım için{'\n'}kurulum yapacağım.</Text>
        <View style={styles.divider} />
        <Button title="Kendim İçin" variant="outline" onPress={() => { setRole('elderly'); router.replace('/login'); }} />
        <Text style={styles.desc}>Kendi ilaçlarımı ve randevularımı{'\n'}takip edeceğim.</Text>
        <View style={styles.langRow}>
          {['TR', 'PT', 'EN'].map((l, i) => (
            <TouchableOpacity key={l} style={[styles.langBtn, i === 0 && { borderColor: colors.primary }]}>
              <Text style={[styles.langText, i === 0 && { color: colors.primary, fontWeight: '600' }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  top: { alignItems: 'center', marginBottom: spacing.xl },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryLight + '30', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  brand: { ...typography.h1, color: colors.primary, marginBottom: spacing.sm },
  slogan: { ...typography.h3, color: colors.textSecondary, textAlign: 'center', lineHeight: 28 },
  bottom: { alignItems: 'center' },
  desc: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: spacing.xs, marginBottom: spacing.md },
  divider: { width: '60%', height: 1, backgroundColor: colors.border, marginBottom: spacing.md },
  langRow: { flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm },
  langBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  langText: { ...typography.caption, color: colors.textLight },
});
