import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useThemedStyles } from '../src/theme/ThemeProvider';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function toLocalDate(isoDate: string) {
  if (!isoDate) return { d: '', m: '', y: '' };
  const [y, m, d] = isoDate.split('-');
  return { d, m, y };
}

export default function AppointmentsScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.userId);
  const searchParams = useLocalSearchParams();
  const profileId = String(searchParams.profileId || userId || '');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState(new Date().getDate());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);
  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelected(1);
  };

  const loadData = useCallback(async () => {
    if (!profileId) { setLoading(false); return; }
    try { const d = await api.get<any[]>(`/appointments/profile/${profileId}`); setAppointments(d); }
    catch (error: any) { Alert.alert('Randevular yüklenemedi', error?.message || 'Lütfen tekrar deneyin.'); }
    setLoading(false); setRefreshing(false);
  }, [profileId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const selectedAppts = appointments.filter((a: any) => {
    const { d, m } = toLocalDate(a.date);
    return parseInt(d) === selected && parseInt(m) === month + 1;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => { const r = useAuthStore.getState().role; router.replace(r === 'caregiver' ? '/caregiver' : '/home'); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Randevularım</Text>
      </View>

      <View style={[styles.calendarCard, shadow.card]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22, color: colors.primary }}>‹</Text></TouchableOpacity>
          <Text style={{ ...typography.h3, color: colors.text }}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22, color: colors.primary }}>›</Text></TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
          {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(d => <View key={d} style={{ flex: 1, alignItems: 'center' }}><Text style={{ ...typography.small, color: colors.textLight }}>{d}</Text></View>)}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: (new Date(year, month, 1).getDay() + 6) % 7 }).map((_, i) => <View key={`e-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />)}
          {days.map(day => {
            const hasAppt = appointments.some((a: any) => { const { d, m: mo } = toLocalDate(a.date); return parseInt(d) === day && parseInt(mo) === month + 1; });
            return (
              <TouchableOpacity key={day} style={[styles.day, day === selected && { backgroundColor: colors.primary }]} onPress={() => setSelected(day)}>
                <Text style={{ ...typography.body, color: day === selected ? '#FFF' : colors.text, fontWeight: day === selected ? '700' : '400' }}>{day}</Text>
                {hasAppt && <View style={[styles.dot, { backgroundColor: day === selected ? '#FFF' : colors.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ paddingTop: spacing.lg }} /> : (
        <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[colors.primary]} tintColor={colors.primary} />}
        >
          <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>{selected} {MONTHS[month]} {year}</Text>
          {selectedAppts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}><Text style={{ ...typography.body, color: colors.textLight }}>Bu günde randevu yok</Text></View>
          ) : selectedAppts.map((a: any) => {
            const { d, m, y } = toLocalDate(a.date);
            const formattedDate = `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`;
            return (
              <TouchableOpacity key={a.id} style={[styles.apptCard, shadow.card]}
                onPress={() => router.push({ pathname: '/add-appointment', params: { id: a.id, profileId, editTitle: a.title, editLocation: a.location, editDoctor: a.doctorName, editDate: formattedDate, editTime: a.time, editNotes: a.notes || '' } })}
              >
                <View style={[styles.bar, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1, paddingLeft: spacing.md }}>
                  <Text style={{ ...typography.h3, color: colors.text }}>{a.title}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: spacing.sm }}>
                    <View style={{ backgroundColor: colors.primary + '10', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ ...typography.small, color: colors.primary, fontWeight: '600' }}>⏰ {a.time}</Text>
                    </View>
                    {a.doctorName ? <View style={{ backgroundColor: colors.secondary + '10', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ ...typography.small, color: colors.secondary, fontWeight: '600' }}>👨‍⚕️ {a.doctorName}</Text>
                    </View> : null}
                    {a.location ? <View style={{ backgroundColor: colors.tertiary + '10', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ ...typography.small, color: colors.tertiary, fontWeight: '600' }}>📍 {a.location}</Text>
                    </View> : null}
                  </View>
                  {a.notes ? <Text style={{ ...typography.small, color: colors.textLight, marginTop: 4, fontStyle: 'italic' }}>📝 {a.notes}</Text> : null}
                </View>
                <Text style={{ fontSize: 20, color: colors.textLight, padding: spacing.sm }}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={{ position: 'absolute', bottom: insets.bottom + 16, right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 }}
        onPress={() => router.push({ pathname: '/add-appointment', params: { profileId } })}
      >
        <Text style={{ fontSize: 28, color: '#FFF', marginTop: -2 }}>+</Text>
      </TouchableOpacity>
      <View style={{ paddingBottom: insets.bottom }} />
    </View>
  );
}
const baseStyles = StyleSheet.create({
  calendarCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 20, marginHorizontal: spacing.lg, marginTop: spacing.md },
  day: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20, minHeight: 44 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  apptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, marginBottom: spacing.sm, overflow: 'hidden', paddingVertical: 6 },
  bar: { width: 4, height: '100%', position: 'absolute', left: 0, top: 0, bottom: 0 },
});
