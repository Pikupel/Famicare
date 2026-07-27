import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';

export default function DrugSafetyScreen() {
  const router = useRouter();
  const userId = useAuthStore(state => state.userId);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!userId) { setLoading(false); return; }
    api.get<any[]>(`/medications/profile/${userId}`)
      .then(setMedications)
      .catch(() => setMedications([]))
      .finally(() => setLoading(false));
  }, [userId]));

  if (loading) return (
    <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text }}>İlaç Bilgileri</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
          TİTCK kataloğu ile kayıt eşleştirme durumu
        </Text>
      </View>
      <ScrollView style={styles.content}>
        <View style={[styles.notice, shadow.card]}>
          <Text style={{ ...typography.h3, color: '#92400E' }}>Klinik etkileşim kontrolü etkin değil</Text>
          <Text style={{ ...typography.body, color: '#92400E', marginTop: spacing.xs }}>
            Doğrulanmış bir klinik veri sağlayıcısı bağlanana kadar uygulama ilaçlarınızın birbiriyle güvenli veya çakışmasız olduğunu söylemez.
          </Text>
        </View>

        <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.md }}>Aktif İlaçlarınız</Text>
        {medications.length === 0 ? (
          <Text style={{ ...typography.body, color: colors.textLight }}>Henüz ilaç eklenmemiş</Text>
        ) : medications.map(medication => (
          <View key={medication.id} style={[styles.medCard, shadow.card]}>
            <Text style={{ ...typography.body, fontWeight: '600', color: colors.text }}>{medication.name}</Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 3 }}>
              {medication.dosage} · {medication.times?.join(', ')}
            </Text>
            <Text style={[styles.status, medication.drugRefId ? styles.linked : styles.unlinked]}>
              {medication.drugRefId ? 'TİTCK katalog kaydı bağlı' : 'Manuel kayıt — ürün eşleştirilmedi'}
            </Text>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          İlaçlarınızda değişiklik yapmadan önce doktorunuza veya eczacınıza danışın. Acil durumda 112’yi arayın.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  back: { minHeight: 48, justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.text },
  content: { flex: 1, padding: spacing.lg },
  notice: { backgroundColor: '#FEF3C7', borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.lg, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  medCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 14, marginBottom: spacing.sm },
  status: { ...typography.small, marginTop: spacing.sm, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  linked: { color: '#166534', backgroundColor: '#DCFCE7' },
  unlinked: { color: '#92400E', backgroundColor: '#FEF3C7' },
  disclaimer: { ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.xxl, lineHeight: 20 },
});
