import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useThemedStyles } from '../src/theme/ThemeProvider';

export default function InviteScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const isCaregiver = role === 'caregiver';
  const [code, setCode] = useState('');
  const [linked, setLinked] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!isCaregiver) {
      api.get<any>('/profiles/my-link').then(d => setLinked(d)).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isCaregiver]));

  const handleDigit = (d: string) => { if (code.length < 8) setCode(code + d); };
  const handleDelete = () => setCode(code.slice(0, -1));

  const acceptInvite = async () => {
    if (code.length < 8) { Alert.alert('Uyarı', '8 haneli kodu tam girin'); return; }
    setAccepting(true);
    try {
      const res = await api.post<any>('/profiles/accept', { inviteCode: code });
      Alert.alert('Başarılı', `${res.caregiverName || 'Yakınınız'} ile bağlantı kuruldu.`);
      setLinked({ linked: true, caregiverName: res.caregiverName });
    } catch (e: any) { Alert.alert('Hata', e.message || 'Geçersiz kod'); }
    finally { setAccepting(false); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  if (linked?.linked) {
    const disconnect = () => {
      Alert.alert('Bağlantıyı Kaldır', 'Yakınınızla bağlantınız kaldırılacak. İlaç ve sağlık verileriniz artık paylaşılmayacak.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Kaldır', style: 'destructive', onPress: async () => {
          try { await api.post('/profiles/disconnect', {}); setLinked({ linked: false }); Alert.alert('Kaldırıldı', 'Bağlantı sonlandırıldı.'); } catch { Alert.alert('Hata', 'Kaldırılamadı'); }
        }},
      ]);
    };
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }}>
        <Text style={{ fontSize: 48, marginBottom: spacing.lg }}>🔗</Text>
        <Text style={{ ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm }}>Bağlantı Kuruldu</Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }}>{linked.caregiverName || 'Yakınınız'} ile başarıyla bağlandınız.</Text>
        <Button title="Ana Sayfaya Dön" onPress={() => router.replace('/home')} style={{ marginBottom: spacing.md }} />
        <TouchableOpacity style={{ minHeight: 48, justifyContent: 'center' }} onPress={disconnect}>
          <Text style={{ ...typography.body, color: colors.danger }}>Bağlantıyı Kaldır</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isCaregiver) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', top: 56, left: spacing.lg, minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ fontSize: 28, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: spacing.md }}>🔗</Text>
        <Text style={{ ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm }}>Davet Kodu Oluştur</Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }}>
          Yakınını bağlamak için önce profiline bir {"\n"} davet kodu oluşturmalısın.
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }}>
          Bunun için "Sevdiklerim" listesinden {"\n"}bir yakınına tıkla, kodunu gör.
        </Text>
        <Button title="Sevdiklerime Git" onPress={() => router.replace('/caregiver')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
      <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', top: 56, left: spacing.lg, minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, color: colors.text }}>←</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: spacing.md }}>🔗</Text>
      <Text style={{ ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm }}>Yakınına Bağlan</Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl }}>
        Yakınının sana verdiği 8 haneli kodu gir,{'\n'}ilaçların ve sağlık verilerin paylaşılsın
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.xxl }}>
        {[0,1,2,3,4,5,6,7].map(i => (
          <View key={i} style={[styles.codeBox, { backgroundColor: code.length > i ? colors.primary + '15' : colors.surface, borderColor: code.length > i ? colors.primary : colors.border }]}>
            <Text style={{ ...typography.h3, color: code.length > i ? colors.primary : colors.textLight }}>{code[i] || ''}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
        {['1','2','3','4','5','6','7','8','9','', '0','⌫'].map((d, i) => (
          d === '' ? <View key={i} style={{ width: 72, height: 72 }} /> :
          <TouchableOpacity key={i} style={styles.key} onPress={() => d === '⌫' ? handleDelete() : handleDigit(d)}>
            <Text style={{ ...typography.h2, color: colors.text }}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button title={accepting ? 'Bağlanıyor...' : 'Bağlan'} onPress={acceptInvite} disabled={code.length < 8 || accepting} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  codeBox: { width: 36, height: 48, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  key: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
});
