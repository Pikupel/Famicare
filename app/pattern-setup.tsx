import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/useAuthStore';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { Button } from '../src/components/Button';

const SIZE = 3;
const DOT_SIZE = 60;
const CELL = 80;
const { width } = Dimensions.get('window');
const GRID_SIZE = CELL * (SIZE - 1);
const OFFSET = (width - GRID_SIZE) / 2;

export default function PatternSetupScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const [pattern, setPattern] = useState<number[]>([]);
  const [step, setStep] = useState<'set' | 'confirm'>('set');
  const [savedPattern, setSavedPattern] = useState<number[]>([]);

  const getDotPos = (i: number) => {
    const row = Math.floor(i / SIZE);
    const col = i % SIZE;
    return { x: OFFSET + col * CELL, y: 120 + row * CELL };
  };

  const handleDotPress = (i: number) => {
    if (pattern.includes(i)) return;
    const newPattern = [...pattern, i];
    setPattern(newPattern);
    if (newPattern.length < 3) return;
    if (step === 'set') {
      setSavedPattern(newPattern);
      setPattern([]);
      setStep('confirm');
    } else {
      if (JSON.stringify(newPattern) === JSON.stringify(savedPattern)) {
        AsyncStorage.setItem('famicare_pattern', JSON.stringify(newPattern));
        Alert.alert('Başarılı', 'Desen kilidi oluşturuldu');
        router.replace(role === 'caregiver' ? '/caregiver' : '/home');
      } else {
        Alert.alert('Hata', 'Desen eşleşmedi, tekrar deneyin');
        setPattern([]);
        setStep('set');
      }
    }
  };

  const reset = () => { setPattern([]); setStep('set'); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={{ ...typography.h2, color: colors.text, textAlign: 'center', marginTop: spacing.xxl }}>
        {step === 'set' ? 'Desen Belirleyin' : 'Deseni Tekrar Girin'}
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }}>
        {step === 'set' ? 'En az 3 noktayı birleştirin' : 'Deseni doğrulayın'}
      </Text>

      <View style={{ height: 360, position: 'relative' }}>
        {Array.from({ length: SIZE * SIZE }).map((_, i) => {
          const pos = getDotPos(i);
          const isActive = pattern.includes(i);
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dot, { left: pos.x, top: pos.y }, isActive && styles.dotActive]}
              onPress={() => handleDotPress(i)}
            >
              <View style={[styles.dotInner, isActive && styles.dotInnerActive]} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Button title="Temizle" variant="outline" onPress={reset} />
        <TouchableOpacity onPress={() => router.replace(role === 'caregiver' ? '/caregiver' : '/home')}>
          <Text style={{ ...typography.body, color: colors.textLight }}>Daha sonra ayarla</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  dotActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  dotInner: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border },
  dotInnerActive: { backgroundColor: colors.primary },
});
