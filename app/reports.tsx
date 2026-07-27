import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { Button } from '../src/components/Button';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BASE_URL } from '../src/services/api';
import { localDate, addCalendarDays } from '../src/services/date';
import { useThemedStyles } from '../src/theme/ThemeProvider';

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export default function ReportsScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = useAuthStore((s) => s.userId);
  const userName = useAuthStore((s) => s.userName);
  const profileName = String(params.profileName || userName || 'Kullanıcı');
  const profileId = String(params.profileId || userId || '');
  const token = useAuthStore((s) => s.token);
  const [logs, setLogs] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');

  useFocusEffect(useCallback(() => {
    if (!profileId) { setLoading(false); return; }
    Promise.all([
      api.get<any[]>(`/medications/profile/${profileId}`),
      api.get<any[]>(`/medications/profile/${profileId}/logs?range=90d`),
    ]).then(([meds, logData]) => {
      setMedications(meds);
      setLogs(logData);
    }).catch((error: any) => Alert.alert('Rapor verileri yüklenemedi', error?.message || 'Lütfen tekrar deneyin.'))
      .finally(() => setLoading(false));
  }, [profileId]));

  const totalDoses = medications.reduce((s, m) => s + (m.times?.length || 0), 0);
  const today = localDate();
  const todayLogs = logs.filter(l => l.date === today);
  const takenToday = todayLogs.filter(l => ['taken', 'caregiver_marked'].includes(l.status)).length;
  const avgAdherence = totalDoses > 0 ? Math.min(100, Math.round((takenToday / totalDoses) * 100)) : 0;
  const chartDays = period === 'weekly' ? 7 : 30;
  const chartData = Array.from({ length: chartDays }, (_, offset) => {
    const key = addCalendarDays(today, -(chartDays - offset - 1));
    const date = new Date(`${key}T12:00:00`);
    const taken = logs.filter(log => log.date === key && ['taken', 'caregiver_marked'].includes(log.status)).length;
    return { label: period === 'weekly' ? DAYS[(date.getDay() + 6) % 7] : String(date.getDate()), value: totalDoses ? Math.min(100, Math.round(taken / totalDoses * 100)) : 0 };
  });

  const sharePdf = async () => {
    if (!token) return;
    try {
      const file = new File(Paths.cache, `famicare-rapor-${Date.now()}.pdf`);
      const downloaded = await File.downloadFileAsync(
        `${BASE_URL}/reports/adherence?profileId=${encodeURIComponent(profileId)}`,
        file,
        { headers: { Authorization: `Bearer ${token}` }, idempotent: true },
      );
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(downloaded.uri, { mimeType: 'application/pdf', dialogTitle: `${profileName} sağlık raporu` });
      else Alert.alert('Rapor Hazır', downloaded.uri);
    } catch (error: any) {
      Alert.alert('Hata', error?.message || 'PDF raporu oluşturulamadı');
    }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Raporlar</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>{profileName} için uyum raporu</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={[styles.adherenceCard, shadow.card]}>
          <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.md }}>İlaç Uyum Oranı</Text>
          <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10, padding: 3, marginBottom: spacing.lg }}>
            {['Haftalık', 'Aylık'].map((p, i) => (
              <TouchableOpacity key={p} style={[styles.periodBtn, (i === 0 && period === 'weekly') || (i === 1 && period === 'monthly') ? { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}]} onPress={() => setPeriod(i === 0 ? 'weekly' : 'monthly')}>
                <Text style={{ ...typography.small, color: (i === 0 && period === 'weekly') || (i === 1 && period === 'monthly') ? colors.primary : colors.textLight, fontWeight: '600' }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingBottom: 24 }}>
            {chartData.map(({ value: val, label }, i) => (
              <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ ...typography.small, color: colors.textSecondary, fontSize: 10, marginBottom: 4 }}>%{val}</Text>
                <View style={{ width: 24, height: (val / 100) * 100, backgroundColor: val === 100 ? colors.primary : colors.primaryLight, borderRadius: 6, opacity: 0.6 + (val / 100) * 0.4 }} />
                <Text style={{ ...typography.small, color: colors.textLight, marginTop: spacing.xs, fontSize: 9 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: colors.secondary }]}>
            <Text style={{ ...typography.h2, color: colors.secondary, textAlign: 'center' }}>%{avgAdherence}</Text>
            <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center' }}>Bugün</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: colors.primary }]}>
            <Text style={{ ...typography.h2, color: colors.primary, textAlign: 'center' }}>{takenToday}/{totalDoses}</Text>
            <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center' }}>Doz</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: colors.warning }]}>
            <Text style={{ ...typography.h2, color: colors.warning, textAlign: 'center' }}>{totalDoses - takenToday}</Text>
            <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center' }}>Kalan</Text>
          </View>
        </View>

        <Button title={`📄 ${profileName} - Uyum Raporu (PDF)`} variant="outline" onPress={sharePdf} style={{ marginBottom: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  adherenceCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 20, marginBottom: spacing.lg },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.md },
  statCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 14, borderLeftWidth: 3 },
});
