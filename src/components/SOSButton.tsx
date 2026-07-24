import { useState, useRef } from 'react';
import { TouchableOpacity, Text, Alert, Animated } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import { colors } from '../theme/colors';

export function SOSButton() {
  const userId = useAuthStore((s) => s.userId);
  const [pressing, setPressing] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout>();

  const handlePressIn = () => {
    setPressing(true);
    Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, friction: 8 }).start();
    timerRef.current = setTimeout(() => {
      setPressing(false);
      Alert.alert('🆘 Yardım İster Misiniz?', 'Acil durum bildirimi gönderilecek ve yakınlarınıza konumunuz iletilecek.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'EVET, GÖNDER', style: 'destructive', onPress: async () => {
          try {
            await api.post('/emergency', { profileId: userId });
            Alert.alert('✅ Gönderildi', 'Yakınlarınıza acil durum bildirimi gönderildi.');
          } catch { Alert.alert('❌ Hata', 'Gönderilemedi. Lütfen doğrudan 112\'yi arayın.'); }
        }},
      ]);
    }, 3000);
  };

  const handlePressOut = () => {
    setPressing(false);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <Animated.View style={{ position: 'absolute', bottom: 160, right: 16, transform: [{ scale: scaleAnim }], zIndex: 999 }}>
      <TouchableOpacity
        style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: pressing ? '#DC2626' : '#EF4444',
          alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444',
          shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
          borderWidth: pressing ? 3 : 0, borderColor: '#FFFFFF',
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        accessibilityLabel="Acil yardım butonu — 3 saniye basılı tutun"
        accessibilityRole="button"
      >
        <Text style={{ fontSize: 24 }}>🆘</Text>
      </TouchableOpacity>
      {pressing && <Text style={{ color: '#FFF', textAlign: 'center', fontSize: 10, marginTop: 4, fontWeight: '600' }}>BASILI TUT</Text>}
    </Animated.View>
  );
}
