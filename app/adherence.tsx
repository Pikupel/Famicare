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

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function AdherenceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const [month, setMonth] = useState(new Date().getMonth());
  const [logs, setLogs] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const year = new Date().getFullYear();

  useFocusEffect(useCallback(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([
      api.get<any[]>(`/medications/profile/${userId}`),
      api.get<any[]>(`/medications/profile/${userId}/logs?range=90d`),
    ]).then(([meds, logData]) => {
      setMedications(meds);
      setLogs(logData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]));

  const getDayColor = (day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayLogs = logs.filter(l => l.date === dayStr);
    const total = medications.reduce((s, m) => s + (m.times?.length || 0), 0);
    const taken = dayLogs.filter(l => l.status === 'taken').length;
    if (total === 0) return null;
    if (taken >= total) return colors.secondary;
    if (taken > 0) return colors.warning;
    return colors.danger;
  };

  const getSelectedLogs = () => {
    if (!selectedDay) return [];
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    return logs.filter(l => l.date === dayStr);
  };

  const totalDoses = medications.reduce((s, m) => s + (m.times?.length || 0), 0);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const takenThisMonth = logs.filter(l => {
    const [y, m] = l.date.split('-');
    return parseInt(m) === month + 1 && parseInt(y) === year && l.status === 'taken';
  }).length;
  const expectedThisMonth = totalDoses * totalDays;
  const adherence = expectedThisMonth > 0 ? Math.min(100, Math.round((takenThisMonth / expectedThisMonth) * 100)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Uyum Geçmişi</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.calendarCard, shadow.card]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <TouchableOpacity onPress={() => setMonth(m => Math.max(0, m - 1))} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22, color: colors.primary }}>‹</Text></TouchableOpacity>
            <Text style={{ ...typography.h3, color: colors.text }}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => setMonth(m => Math.min(11, m + 1))} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22, color: colors.primary }}>›</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
            {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(d => <View key={d} style={{ flex: 1, alignItems: 'center' }}><Text style={{ ...typography.small, color: colors.textLight }}>{d}</Text></View>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: new Date(year, month, 1).getDay() || 7 }).map((_, i) => <View key={`e-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />)}
            {DAYS.slice(0, totalDays).map(day => {
              const color = getDayColor(day);
              return (
                <TouchableOpacity key={day} style={[styles.day, { borderColor: selectedDay === day ? colors.primary : 'transparent', borderWidth: selectedDay === day ? 2 : 0 }]} onPress={() => setSelectedDay(day === selectedDay ? null : day)}>
                  <Text style={{ ...typography.body, color: colors.text }}>{day}</Text>
                  {color && <View style={[styles.dot, { backgroundColor: color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={[styles.statBox, { borderLeftColor: colors.secondary }]}>
            <Text style={{ ...typography.h2, color: colors.secondary, textAlign: 'center' }}>%{adherence}</Text>
            <Text style={{ ...typography.caption, color: colors.textLight, textAlign: 'center' }}>Bu Ay Uyum</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: colors.primary }]}>
            <Text style={{ ...typography.h2, color: colors.primary, textAlign: 'center' }}>{takenThisMonth}</Text>
            <Text style={{ ...typography.caption, color: colors.textLight, textAlign: 'center' }}>Alınan Doz</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: colors.warning }]}>
            <Text style={{ ...typography.h2, color: colors.warning, textAlign: 'center' }}>{expectedThisMonth - takenThisMonth}</Text>
            <Text style={{ ...typography.caption, color: colors.textLight, textAlign: 'center' }}>Kaçırılan</Text>
          </View>
        </View>

        {selectedDay && (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
            <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>
              {selectedDay} {MONTHS[month]} {year}
            </Text>
            {getSelectedLogs().length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textLight }}>Bu günde kayıt yok</Text>
            ) : getSelectedLogs().map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: spacing.xs }}>
                <View style={[styles.logDot, { backgroundColor: l.status === 'taken' ? colors.secondary : colors.danger }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.text, fontWeight: '500' }}>{l.scheduledTime}</Text>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{l.status === 'taken' ? '✅ Alındı' : '❌ Alınmadı'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xxl }}>
          <Button title="PDF Rapor Oluştur" variant="outline" onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 20, marginHorizontal: spacing.lg, marginTop: spacing.md },
  day: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 44 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 12, borderLeftWidth: 3, ...shadow.card },
  logDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
});
