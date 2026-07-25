import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { api } from '../src/services/api';

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    api.get<any[]>('/dashboard').then(async (data) => {
      const results = [];
      for (const p of data) {
        const pid = p.profile?.id;
        if (!pid) continue;
        try {
          const pending = await api.get<any[]>(`/medications/profile/${pid}/pending`);
          if (pending.length > 0) results.push({ ...p, pending });
        } catch {}
      }
      setProfiles(results);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []));

  const markTaken = async (logId: string, medName: string) => {
    try {
      await api.post(`/medications/${logId}/log`, { status: 'caregiver_marked', confirmedBy: 'caregiver', caregiverOverride: true });
      setProfiles(prev => prev.map(p => ({ ...p, pending: p.pending.filter((l: any) => l.id !== logId) })));
      Alert.alert('✅ İşaretlendi', `${medName} bakıcı tarafından alındı olarak işaretlendi.`);
    } catch { Alert.alert('Hata', 'İşaretlenemedi'); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Gözden Geçir</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>Yanıtlanmamış dozları kontrol edin</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }}>
        {profiles.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>✅</Text>
            <Text style={{ ...typography.h3, color: colors.secondary }}>Yanıtlanmamış doz yok</Text>
            <Text style={{ ...typography.body, color: colors.textLight, marginTop: spacing.sm }}>Tüm dozlar takip ediliyor.</Text>
          </View>
        ) : profiles.map((p: any) => (
          <View key={p.profile?.id} style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>{p.profile?.name}</Text>
            {p.pending.map((log: any) => (
              <View key={log.id} style={[styles.card, shadow.card]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, fontWeight: '600', color: colors.text }}>{log.medication?.name || 'Bilinmeyen'}</Text>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>⏰ {log.scheduledTime} • Durum: Yanıtsız</Text>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={() => markTaken(log.id, log.medication?.name || '')}>
                  <Text style={{ ...typography.small, color: '#FFF', fontWeight: '600' }}>✅ Alındı</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 14, marginBottom: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.warning },
  actionBtn: { marginLeft: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
});
