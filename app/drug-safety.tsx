import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { Button } from '../src/components/Button';

export default function DrugSafetyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.userId);
  const [medications, setMedications] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      try {
        const meds = await api.get<any[]>(`/medications/profile/${userId}`);
        setMedications(meds);
        // Check interactions for each medication that has rxcui
        for (const m of meds) {
          try {
            const result = await api.get<any[]>(`/drugs/interactions?rxcui=${m.id}`);
            if (result.length > 0) setInteractions(prev => [...prev, ...result]);
          } catch {}
        }
      } catch {}
      setLoading(false);
    })();
  }, [userId]));

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>İlaç Güvenliği</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>Aktif ilaçlarınız arasındaki etkileşimler</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }}>
        {interactions.length > 0 && (
          <View style={[styles.warningBanner, shadow.card]}>
            <Text style={{ fontSize: 24, marginBottom: spacing.sm }}>⚠️</Text>
            <Text style={{ ...typography.h3, color: '#92400E', marginBottom: spacing.xs }}>Etkileşim Uyarısı</Text>
            <Text style={{ ...typography.body, color: '#92400E' }}>
              {interactions.length} potansiyel ilaç etkileşimi bulundu. Doktorunuza danışın.
            </Text>
          </View>
        )}

        <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.md }}>Aktif İlaçlarınız</Text>
        {medications.length === 0 ? (
          <Text style={{ ...typography.body, color: colors.textLight }}>Henüz ilaç eklenmemiş</Text>
        ) : medications.map((m: any) => (
          <View key={m.id} style={[styles.medCard, shadow.card]}>
            <View style={[styles.medColorBar, { backgroundColor: interactions.some(i => i.ilac1 === m.name || i.ilac2 === m.name) ? colors.warning : colors.secondary }]} />
            <View style={{ flex: 1, paddingLeft: spacing.md }}>
              <Text style={{ ...typography.body, fontWeight: '600', color: colors.text }}>{m.name}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{m.dosage} • {m.times?.[0]}</Text>
            </View>
            {interactions.some(i => i.ilac1 === m.name || i.ilac2 === m.name) && (
              <View style={styles.warningDot}><Text style={{ fontSize: 16 }}>⚠️</Text></View>
            )}
          </View>
        ))}

        {interactions.length > 0 && (
          <>
            <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.md, marginTop: spacing.lg }}>Etkileşim Detayları</Text>
            {interactions.map((item, i) => (
              <View key={i} style={[styles.interactionCard, shadow.card]}>
                <Text style={{ ...typography.body, fontWeight: '600', color: '#92400E' }}>{item.ilac1} ↔ {item.ilac2}</Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 }}>{item.aciklama}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  {item.seviye && <Text style={styles.seviyeBadge}>⚠️ {item.seviye}</Text>}
                  <Text style={styles.infoBadge}>ℹ️ RxNav verisi</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.xxl, lineHeight: 20 }}>
          Bu etkileşim kontrolleri RxNav (NIH/NLM) veritabanı kullanılarak yapılır. Kesin tıbbi tavsiye yerine geçmez. İlaçlarınızla ilgili bir değişiklik yapmadan önce doktorunuza danışın.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  warningBanner: { backgroundColor: '#FEF3C7', borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.lg, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  medCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 14, marginBottom: spacing.sm, overflow: 'hidden' },
  medColorBar: { width: 4, height: '100%', position: 'absolute', left: 0, top: 0, bottom: 0 },
  warningDot: { marginLeft: spacing.sm },
  interactionCard: { backgroundColor: '#FFFBEB', borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#FDE68A' },
  seviyeBadge: { fontSize: 11, color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontWeight: '600' },
  infoBadge: { fontSize: 11, color: colors.textLight, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
