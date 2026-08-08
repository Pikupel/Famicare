import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { EmptyState } from '../src/components/EmptyState';
import { isAbnormalValue } from '../src/theme/health-thresholds';
import { useThemedStyles } from '../src/theme/ThemeProvider';
import type { HealthRecord } from '../src/types/models';

const TABS = ['Tansiyon', 'Şeker', 'Kilo'];
const RANGES = ['1 Hafta', '1 Ay', '3 Ay'];
const RANGE_DAYS = [7, 30, 90];

export default function HealthScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const params = useLocalSearchParams();
  const profileId = String(params.profileId || userId || '');
  const [tab, setTab] = useState(0);
  const [rangeIndex, setRangeIndex] = useState(0);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!profileId) { setLoading(false); return; }
    try {
      const data = await api.get<HealthRecord[]>(`/health/profile/${profileId}`);
      setRecords(data);
    } catch (error: any) {
      Alert.alert('Sağlık verileri yüklenemedi', error?.message || 'Lütfen tekrar deneyin.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const types = ['blood_pressure', 'blood_sugar', 'weight'];
  const cutoff = new Date(Date.now() - RANGE_DAYS[rangeIndex] * 86400000);
  const filtered = records.filter(r => r.recordType === types[tab] && new Date(r.measuredAt) >= cutoff);
  const lastRecord = filtered[0];

  const valueDisplay = (r: HealthRecord) => {
    if (r.recordType === 'blood_pressure') return `${r.valueData?.systolic || '?'}/${r.valueData?.diastolic || '?'}`;
    if (r.recordType === 'blood_sugar') return `${r.valueData?.sugar || '?'}`;
    return `${r.valueData?.weight || '?'}`;
  };
  const unitDisplay = (t: string) => t === 'blood_pressure' ? '' : t === 'blood_sugar' ? ' mg/dL' : ' kg';

  const weekRecords = filtered.slice(0, 7).reverse();
  const maxVal = Math.max(...weekRecords.map(r => {
    if (r.recordType === 'blood_pressure') return r.valueData?.systolic || 0;
    if (r.recordType === 'blood_sugar') return r.valueData?.sugar || 0;
    return r.valueData?.weight || 0;
  }), 1);
  const minVal = Math.min(...weekRecords.map(r => {
    if (r.recordType === 'blood_pressure') return r.valueData?.diastolic || 0;
    if (r.recordType === 'blood_sugar') return r.valueData?.sugar || 0;
    return r.valueData?.weight || 0;
  }), 0);

  const avgVal = filtered.length > 0
    ? filtered.reduce((s, r) => {
        if (r.recordType === 'blood_pressure') return s + (r.valueData?.systolic || 0);
        if (r.recordType === 'blood_sugar') return s + (r.valueData?.sugar || 0);
        return s + (r.valueData?.weight || 0);
      }, 0) / filtered.length
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Sağlık Günlüğü</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[styles.tab, i === tab && { backgroundColor: colors.primary }]} onPress={() => setTab(i)}>
            <Text style={{ ...typography.caption, color: i === tab ? colors.onPrimary : colors.textSecondary, fontWeight: i === tab ? '600' : '400' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm }}>
        {RANGES.map((r, i) => (
          <TouchableOpacity key={r} style={[styles.rangeBtn, i === rangeIndex && { backgroundColor: colors.primaryLight + '30', borderColor: colors.primary }]} onPress={() => setRangeIndex(i)}>
            <Text style={{ ...typography.small, color: i === rangeIndex ? colors.primary : colors.textSecondary, fontWeight: i === rangeIndex ? '600' : '400' }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ paddingTop: spacing.xxl }} /> : filtered.length === 0 ? (
        <EmptyState icon="❤️" title="Henüz ölçüm yok" description="Yeni ölçüm ekleyerek sağlık verilerinizi takip edin." actionLabel="Ölçüm Ekle" onAction={() => router.push('/add-health')} />
      ) : (
        <ScrollView style={{ flex: 1, padding: spacing.lg }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <View style={[styles.mainCard, shadow.card]}>
            <Text style={{ ...typography.h1, color: colors.text, textAlign: 'center' }}>{valueDisplay(lastRecord)}{unitDisplay(types[tab])}</Text>
            <Text style={{ ...typography.body, color: colors.secondary, textAlign: 'center', fontWeight: '600', marginTop: spacing.xs }}>Son ölçüm</Text>
            {lastRecord && (() => { const check = isAbnormalValue(types[tab], lastRecord.valueData); return check.abnormal ? <Text style={{ ...typography.caption, color: colors.danger, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm, backgroundColor: colors.danger + '10', padding: spacing.sm, borderRadius: 8 }}>{check.message}</Text> : null; })()}
          </View>

          {weekRecords.length > 1 && (
            <>
              <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.md }}>Son {weekRecords.length} Ölçüm (En düşük: {minVal} - En yüksek: {maxVal})</Text>
              <View style={[styles.chartCard, shadow.card]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingBottom: 20 }}>
                  {weekRecords.map((r, i) => {
                    const val = r.recordType === 'blood_pressure' ? (r.valueData?.systolic || 0) : r.recordType === 'blood_sugar' ? (r.valueData?.sugar || 0) : (r.valueData?.weight || 0);
                    const h = Math.max(20, (val / maxVal) * 100);
                    return (
                      <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ ...typography.small, color: colors.textSecondary, fontSize: 8, marginBottom: 2 }}>{val}</Text>
                        <View style={{ width: 20, height: h, backgroundColor: r.recordType === 'blood_pressure' ? (val > 130 ? colors.warning : colors.primaryLight) : colors.primaryLight, borderRadius: 6, opacity: 0.5 + (val / maxVal) * 0.5 }} />
                        <Text style={{ ...typography.small, color: colors.textLight, marginTop: spacing.xs, fontSize: 8 }}>{new Date(r.measuredAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' })}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={[styles.statCard, { flex: 1 }]}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>Ortalama</Text>
              <Text style={{ ...typography.h3, color: colors.text, marginTop: spacing.xs }}>{avgVal.toFixed(1)}{unitDisplay(types[tab])}</Text>
              <Text style={{ ...typography.small, color: colors.textLight }}>{filtered.length} ölçüm</Text>
            </View>
            <View style={[styles.statCard, { flex: 1 }]}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>Son kayıt</Text>
              <Text style={{ ...typography.h3, color: colors.text, marginTop: spacing.xs }}>{new Date(lastRecord.measuredAt).toLocaleDateString('tr-TR')}</Text>
            </View>
          </View>

          <Text style={{ ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }}>Geçmiş Ölçümler</Text>
          {filtered.slice(0, 10).map((r) => (
            <TouchableOpacity key={r.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: spacing.xs, minHeight: 48 }}
              onPress={() => router.push({ pathname: '/add-health', params: { id: r.id, editType: r.recordType, editSystolic: String(r.valueData?.systolic || ''), editDiastolic: String(r.valueData?.diastolic || ''), editSugar: String(r.valueData?.sugar || ''), editWeight: String(r.valueData?.weight || '') } })}
            >
              <Text style={{ fontSize: 18, marginRight: spacing.md }}>{r.recordType === 'blood_pressure' ? '❤️' : r.recordType === 'blood_sugar' ? '🩸' : '⚖️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.text, fontWeight: '500' }}>{valueDisplay(r)}{unitDisplay(r.recordType)}</Text>
                <Text style={{ ...typography.small, color: colors.textLight }}>{new Date(r.measuredAt).toLocaleDateString('tr-TR')}</Text>
              </View>
              <Text style={{ fontSize: 18, color: colors.textLight }}>›</Text>
            </TouchableOpacity>
          ))}

          <Button title="Yeni Ölçüm Ekle" onPress={() => router.push({ pathname: '/add-health', params: { profileId } })} style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }} />
        </ScrollView>
      )}
    </View>
  );
}
const baseStyles = StyleSheet.create({
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.background },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mainCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 24, marginBottom: spacing.lg, alignItems: 'center' },
  chartCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 20 },
  statCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16 },
});
