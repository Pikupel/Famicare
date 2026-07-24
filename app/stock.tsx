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

export default function StockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.userId);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!userId) { setLoading(false); return; }
    api.get<any[]>(`/medications/profile/${userId}`).then(setMedications).catch(() => {}).finally(() => setLoading(false));
  }, [userId]));

  const refill = async (id: string) => {
    try {
      await api.post(`/medications/${id}/refill`, {});
      setMedications(prev => prev.map(m => m.id === id ? { ...m, stockTotal: m.stockTotal } : m));
    } catch {}
  };

  const hasStock = medications.filter(m => m.stockTotal);
  const critical = hasStock.filter(m => Number(m.stockTotal) <= 10);
  const low = hasStock.filter(m => Number(m.stockTotal) > 10 && Number(m.stockTotal) <= 30);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Stok Takibi</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }}>
        {critical.length > 0 && (
          <>
            <Text style={{ ...typography.h3, color: colors.danger, marginBottom: spacing.sm }}>🔴 Kritik</Text>
            {critical.map(m => {
              const daysLeft = Math.round(Number(m.stockTotal) / (m.times?.length || 1));
              return (
                <View key={m.id} style={[styles.card, { borderLeftColor: colors.danger, borderLeftWidth: 4 }, shadow.card]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, fontWeight: '600', color: colors.text }}>{m.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>{m.stockTotal} adet • ~{daysLeft} günlük doz</Text>
                    <View style={[styles.bar, { backgroundColor: colors.danger + '20' }]}>
                      <View style={[styles.barFill, { width: `${Math.min(100, (Number(m.stockTotal) / 100) * 100)}%`, backgroundColor: colors.danger }]} />
                    </View>
                  </View>
                  <TouchableOpacity style={styles.refillBtn} onPress={() => refill(m.id)}>
                    <Text style={{ ...typography.small, color: colors.primary, fontWeight: '600' }}>Yenile</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {low.length > 0 && (
          <>
            <Text style={{ ...typography.h3, color: colors.warning, marginTop: spacing.lg, marginBottom: spacing.sm }}>🟡 Azalıyor</Text>
            {low.map(m => (
              <View key={m.id} style={[styles.card, { borderLeftColor: colors.warning, borderLeftWidth: 4 }, shadow.card]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, fontWeight: '600', color: colors.text }}>{m.name}</Text>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{m.stockTotal} adet</Text>
                  <View style={[styles.bar, { backgroundColor: colors.warning + '20' }]}>
                    <View style={[styles.barFill, { width: `${Math.min(100, (Number(m.stockTotal) / 100) * 100)}%`, backgroundColor: colors.warning }]} />
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {critical.length === 0 && low.length === 0 && hasStock.length > 0 && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md }}>✅</Text>
            <Text style={{ ...typography.h3, color: colors.secondary }}>Tüm stoklar yeterli</Text>
          </View>
        )}

        {hasStock.length === 0 && (
          <Text style={{ ...typography.body, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.xxl }}>
            Stok takibi için ilaç eklerken kutu adedi girin.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 14, marginBottom: spacing.sm },
  bar: { height: 6, borderRadius: 3, marginTop: spacing.sm },
  barFill: { height: 6, borderRadius: 3 },
  refillBtn: { marginLeft: spacing.sm, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary + '10' },
});
