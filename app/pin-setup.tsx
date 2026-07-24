import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/useAuthStore';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';

export default function PinSetupScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'set' | 'confirm'>('set');

  const handleDigit = (d: string) => {
    if (step === 'set' && pin.length < 4) {
      const newPin = pin + d;
      setPin(newPin);
      if (newPin.length === 4) setStep('confirm');
    } else if (step === 'confirm' && confirm.length < 4) {
      const newConfirm = confirm + d;
      setConfirm(newConfirm);
      if (newConfirm.length === 4) {
        if (newConfirm === pin) {
          AsyncStorage.setItem('famicare_pin', pin);
          Alert.alert('Başarılı', 'PIN kodu oluşturuldu');
          router.replace(role === 'caregiver' ? '/caregiver' : '/home');
        } else {
          Alert.alert('Hata', 'PIN eşleşmedi, tekrar deneyin');
          setPin(''); setConfirm(''); setStep('set');
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'set') setPin(pin.slice(0, -1));
    else setConfirm(confirm.slice(0, -1));
  };

  const handleSkip = () => {
    AsyncStorage.setItem('famicare_pin_skipped', 'true');
    router.replace(role === 'caregiver' ? '/caregiver' : '/home');
  };

  const display = step === 'set' ? pin : confirm;
  const title = step === 'set' ? 'PIN Kodu Belirleyin' : 'PIN Kodu Tekrar Girin';
  const subtitle = step === 'set' ? 'Hızlı giriş için 4 haneli bir PIN belirleyin' : 'PIN kodunuzu doğrulamak için tekrar girin';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
      <Text style={{ ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm }}>{title}</Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl }}>{subtitle}</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.xxl }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.dot, { backgroundColor: display.length > i ? colors.primary : colors.border }]} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
        {['1','2','3','4','5','6','7','8','9','', '0','⌫'].map((d, i) => (
          d === '' ? <View key={i} style={{ width: 80, height: 80 }} /> :
          <TouchableOpacity key={i} style={styles.key} onPress={() => d === '⌫' ? handleDelete() : handleDigit(d)}>
            <Text style={{ ...typography.h1, color: colors.text }}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title="Atla, daha sonra ayarla" variant="outline" onPress={handleSkip} style={{ marginTop: spacing.xl }} />
      <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: spacing.sm }}>PIN kodu olmadan da giriş yapabilirsiniz</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 16, height: 16, borderRadius: 8 },
  key: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
});
