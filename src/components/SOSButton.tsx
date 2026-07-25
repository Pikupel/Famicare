import { TouchableOpacity, Text, Alert } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import { colors } from '../theme/colors';

export function SOSButton() {
  const userId = useAuthStore((s) => s.userId);

  const handleSOS = () => {
    Alert.alert('🆘 Yardım', 'Acil durum bildirimi gönderilecek.', [
      { text: 'İptal', style: 'cancel' },
      { text: 'GÖNDER', style: 'destructive', onPress: async () => {
        try { await api.post('/emergency', { profileId: userId }); Alert.alert('✅ Gönderildi', 'Yakınlarınıza haber verildi.'); }
        catch { Alert.alert('❌ Hata', 'Gönderilemedi. 112\'yi arayın.'); }
      }},
    ]);
  };

  return (
    <TouchableOpacity
      style={{
        position: 'absolute', bottom: 160, right: 16, width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
      }}
      onPress={handleSOS}
      activeOpacity={0.7}
      accessibilityLabel="Acil yardım butonu"
    >
      <Text style={{ fontSize: 28 }}>🆘</Text>
    </TouchableOpacity>
  );
}
