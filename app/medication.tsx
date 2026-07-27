import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { EmptyState } from '../src/components/EmptyState';
import { BottomNav } from '../src/components/BottomNav';
import { useThemedStyles } from '../src/theme/ThemeProvider';

export default function MedicationScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const profileId = String(params.profileId || userId || '');
  const NAV = role === 'caregiver' ? [
    { label: 'Ana Sayfa', icon: '⌂', route: '/caregiver' },
    { label: 'Profil', icon: '◉', route: '/profile' },
  ] : [
    { label: 'Ana Sayfa', icon: '⌂', route: '/home' },
    { label: 'Randevular', icon: '◷', route: '/appointments' },
    { label: 'Profil', icon: '◉', route: '/profile' },
  ];
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!profileId) { setLoading(false); return; }
    try {
      const data = await api.get<any[]>(`/medications/profile/${profileId}`);
      setMedications(data);
    } catch (error: any) {
      Alert.alert('İlaçlar yüklenemedi', error?.message || 'Lütfen tekrar deneyin.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.replace(role === 'caregiver' ? '/caregiver' : '/home')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Tüm İlaçlarım</Text>
      </View>

      <ScrollView style={{ flex: 1, paddingTop: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[colors.primary]} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      >
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-medication')}>
          <Text style={{ fontSize: 18, marginRight: spacing.sm }}>➕</Text>
          <Text style={{ ...typography.button, color: colors.primary }}>İlaç Ekle</Text>
        </TouchableOpacity>
        {medications.length === 0 ? (
          <EmptyState icon="💊" title="Henüz ilaç eklenmemiş" description="Yukarıdaki butonu kullanarak ilaç ekleyebilirsiniz." />
        ) : medications.map((m: any) => (
          <TouchableOpacity key={m.id} style={[styles.card, shadow.card]} onPress={() => router.push({ pathname: '/edit-medication', params: { id: m.id, medName: m.name, medDosage: m.dosage, editTimes: (m.times || []).join(','), medStock: m.stockTotal || '', medPurpose: m.purpose || '' } })}>
            <View style={{ width: 56 }}><Text style={{ ...typography.h2, fontSize: 20, color: colors.text }}>{m.times?.[0] || '--'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, fontWeight: '500', color: colors.text }}>{m.name}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{m.dosage}</Text>
              {m.purpose ? <Text style={{ ...typography.small, color: colors.textLight, fontStyle: 'italic', marginTop: 2 }}>💊 {m.purpose}</Text> : null}
            </View>
            <Text style={{ fontSize: 22, color: colors.textLight }}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BottomNav items={NAV} activeIndex={1} />
    </View>
  );
}
const baseStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, padding: 14, borderRadius: borderRadius.card, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', minHeight: 48 },
});
