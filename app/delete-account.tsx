import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useThemedStyles } from '../src/theme/ThemeProvider';

export default function DeleteAccountScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const logout = useAuthStore(state => state.logout);
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (!/^\d{4,6}$/.test(pin)) return Alert.alert('Kontrol edin', '4-6 haneli PIN kodunuzu girin.');
    if (confirmation !== 'HESABIMI SİL') return Alert.alert('Kontrol edin', 'Onay alanına HESABIMI SİL yazın.');
    Alert.alert(
      'Son onay',
      'Hesabınız, sahip olduğunuz profiller ve ilişkili sağlık verileri kalıcı olarak silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kalıcı Sil',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.del('/me', { pin, confirmation });
              logout();
              router.replace('/welcome');
              Alert.alert('Hesap silindi', 'Hesabınız ve ilişkili uygulama verileriniz silindi.');
            } catch (error: any) {
              Alert.alert('Hesap silinemedi', error.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text }}>Hesabı Sil</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.warning}>
          <Text style={{ ...typography.h3, color: '#991B1B' }}>Bu işlem geri alınamaz</Text>
          <Text style={{ ...typography.body, color: '#991B1B', marginTop: spacing.sm }}>
            Hesabınız, sahip olduğunuz yakın profilleri, ilaç kayıtları, sağlık ölçümleri, randevular ve ilgili bildirim kayıtları kalıcı olarak silinir.
          </Text>
        </View>
        <Text style={styles.label}>PIN kodunuz</Text>
        <TextInput style={styles.input} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ''))} secureTextEntry keyboardType="numeric" maxLength={6} />
        <Text style={styles.label}>Onaylamak için HESABIMI SİL yazın</Text>
        <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" />
        <Button title={deleting ? 'Siliniyor...' : 'Hesabımı ve Verilerimi Kalıcı Sil'} onPress={deleteAccount} disabled={deleting} style={styles.button} />
      </View>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  back: { minHeight: 48, justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.text },
  content: { padding: spacing.lg },
  warning: { backgroundColor: '#FEE2E2', borderRadius: borderRadius.card, padding: 16, borderLeftWidth: 4, borderLeftColor: colors.danger, marginBottom: spacing.lg },
  label: { ...typography.body, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border },
  button: { marginTop: spacing.xl, backgroundColor: colors.danger },
});
