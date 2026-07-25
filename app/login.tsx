import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'name'>('phone');
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = () => {
    if (phone.trim().length < 10) { Alert.alert('Uyarı', 'Geçerli bir telefon numarası girin'); return; }
    setStep('name');
  };

  const handleLogin = async () => {
    if (!name.trim()) { Alert.alert('Uyarı', 'Adınızı girin'); return; }
    setLoading(true);
    try {
      const res = await api.post<{ user: { id: string; name: string }; token: string }>('/auth/register', {
        phone: phone.trim(), name: name.trim(), role,
      });
      login(res.user.name, res.token, res.user.id, role!);
      router.replace(role === 'caregiver' ? '/caregiver' : '/home');
    } catch (err: any) {
      if (err?.message?.includes('zaten kayıtlı')) {
        try {
          const res = await api.post<{ user: { id: string; name: string }; token: string }>('/auth/login', { phone: phone.trim(), role });
          login(res.user.name, res.token, res.user.id, role!);
          router.replace(role === 'caregiver' ? '/caregiver' : '/home');
        } catch { Alert.alert('Hata', 'Giriş yapılamadı'); }
      } else {
        Alert.alert('Hata', err?.message || 'Bir hata oluştu');
      }
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <View style={styles.logoCircle}><Text style={{ fontSize: 32 }}>❤️</Text></View>
        <Text style={{ ...typography.h3, color: colors.primary }}>Famicare</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
          {role === 'caregiver' ? 'Yakınım İçin' : 'Kendim İçin'}
        </Text>
      </View>

      {step === 'phone' ? (
        <>
          <Text style={{ ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.lg }}>Telefon numaranızı girin</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+90 532 XXX XX XX" keyboardType="phone-pad" maxLength={15} autoFocus />
          <Button title="Devam" onPress={handlePhoneSubmit} disabled={phone.trim().length < 10} style={{ marginTop: spacing.md }} />
        </>
      ) : (
        <>
          <Text style={{ ...typography.body, color: colors.text, textAlign: 'center', marginBottom: spacing.lg }}>Adınızı girin</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Adınız Soyadınız" autoFocus />
          <Button title={loading ? 'Giriş yapılıyor...' : 'Giriş Yap'} onPress={handleLogin} disabled={loading || !name.trim()} style={{ marginTop: spacing.md }} />
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
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight + '30', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
});
