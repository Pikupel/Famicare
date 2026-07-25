import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { useAuthStore } from '../src/stores/useAuthStore';
import { api } from '../src/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const login = useAuthStore((s) => s.login);
  const isExisting = role === 'existing';
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'name_pin'>('phone');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = () => {
    if (phone.trim().length < 10) { Alert.alert('Uyarı', 'Geçerli bir telefon numarası girin'); return; }
    setStep('name_pin');
  };

  const handleLogin = async () => {
    if (isExisting) {
      if (pin.length < 4) { Alert.alert('Uyarı', 'PIN girin'); return; }
      setLoading(true);
      try {
        const res = await api.post<{ user: { id: string; name: string; role: string }; token: string }>('/auth/login', { phone: phone.trim(), role: undefined });
        login(res.user.name, res.token, res.user.id, res.user.role as any);
        await AsyncStorage.setItem('famicare_pin', pin);
        await AsyncStorage.setItem('famicare_session', 'true');
        router.replace(res.user.role === 'caregiver' ? '/caregiver' : '/home');
      } catch (e: any) { Alert.alert('Hata', e.message || 'Giriş yapılamadı'); }
      finally { setLoading(false); }
      return;
    }

    if (!name.trim()) { Alert.alert('Uyarı', 'Adınızı girin'); return; }
    if (pin.length < 4) { Alert.alert('Uyarı', 'PIN girin'); return; }
    setLoading(true);
    try {
      const res = await api.post<{ user: { id: string; name: string }; token: string }>('/auth/register', {
        phone: phone.trim(), name: name.trim(), role,
      });
      login(res.user.name, res.token, res.user.id, role!);
      await AsyncStorage.setItem('famicare_pin', pin);
      await AsyncStorage.setItem('famicare_session', 'true');
      router.replace(role === 'caregiver' ? '/caregiver' : '/home');
    } catch (err: any) {
      if (err?.message?.includes('zaten kayıtlı')) {
        try {
          const res = await api.post<{ user: { id: string; name: string }; token: string }>('/auth/login', { phone: phone.trim(), role });
          login(res.user.name, res.token, res.user.id, role!);
          await AsyncStorage.setItem('famicare_pin', pin);
          await AsyncStorage.setItem('famicare_session', 'true');
          router.replace(role === 'caregiver' ? '/caregiver' : '/home');
        } catch { Alert.alert('Hata', 'Giriş yapılamadı'); }
      } else {
        Alert.alert('Hata', err?.message || 'Bir hata oluştu');
      }
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Text style={{ ...typography.h3, color: colors.primary }}>Famicare</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
          {isExisting ? 'Kayıtlı kullanıcı girişi' : (role === 'caregiver' ? 'Yakınım İçin' : 'Kendim İçin')}
        </Text>
      </View>

      {step === 'phone' ? (
        <>
          <Text style={{ ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.lg }}>
            {isExisting ? 'Kayıtlı telefon numaranızı girin' : 'Telefon numaranızı girin'}
          </Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+90 532 XXX XX XX" keyboardType="phone-pad" maxLength={15} autoFocus />
          <Button title="Devam" onPress={handlePhoneSubmit} disabled={phone.trim().length < 10} style={{ marginTop: spacing.md }} />
        </>
      ) : (
        <>
          {!isExisting ? (
            <>
              <Text style={{ ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.lg }}>Adınızı girin</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Adınız Soyadınız" autoFocus />
            </>
          ) : null}
          <Text style={{ ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.lg }}>{isExisting ? 'PIN Kodunuzu girin' : 'Bir PIN kodu belirleyin (4 haneli)'}</Text>
          <TextInput style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 8 }]} value={pin} onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="••••" keyboardType="number-pad" maxLength={4} secureTextEntry autoFocus />
          <Button title={loading ? 'Giriş yapılıyor...' : 'Giriş Yap'} onPress={handleLogin} disabled={loading || pin.length < 4 || (!isExisting && !name.trim())} style={{ marginTop: spacing.md }} />
          <TouchableOpacity onPress={() => setStep('phone')} style={{ marginTop: spacing.md, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ ...typography.body, color: colors.primary }}>← Geri</Text>
          </TouchableOpacity>
        </>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
});
