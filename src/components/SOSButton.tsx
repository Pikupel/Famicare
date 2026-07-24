import { TouchableOpacity, Text, Alert } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import { colors } from '../theme/colors';

export function SOSButton() {
  const userId = useAuthStore((s) => s.userId);

  const handleSOS = () => {
    Alert.alert('🆘 Yardım İster Misiniz?', 'Acil durum bildirimi gönderilecek.', [
      { text: 'İptal', style: 'cancel' },
      { text: 'EVET, GÖNDER', style: 'destructive', onPress: async () => {
        try {
          await api.post('/emergency', { profileId: userId });
          Alert.alert('Gönderildi', 'Yakınınıza haber verildi.');
        } catch {
          Alert.alert('Hata', 'Gönderilemedi. Lütfen doğrudan arayın.');
        }
      }},
    ]);
  };

  return (
    <TouchableOpacity
      style={{
        position: 'absolute', bottom: 160, right: 16, width: 56, height: 56,
        borderRadius: 28, backgroundColor: colors.danger, alignItems: 'center',
        justifyContent: 'center', zIndex: 999,
        shadowColor: colors.danger, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
      }}
      onPress={handleSOS}
      activeOpacity={0.8}
      accessibilityLabel="Acil yardım butonu"
      accessibilityRole="button"
    >
      <Text style={{ fontSize: 24 }}>🆘</Text>
    </TouchableOpacity>
  );
}
