import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import * as Speech from 'expo-speech';
import { setupNotifications, scheduleMedicationReminder, cancelAllReminders } from '../src/services/notifications';
import { useAuthStore } from '../src/stores/useAuthStore';
import { api } from '../src/services/api';
import { EmptyState } from '../src/components/EmptyState';
import { BottomNav } from '../src/components/BottomNav';
import { SOSButton } from '../src/components/SOSButton';
import { cacheData, getCachedData } from '../src/services/cache';


function isTimePassed(timeStr: string | undefined): boolean {
  if (!timeStr) return false;
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date(), current = now.getHours() * 60 + now.getMinutes();
  return (h * 60 + m) < current;
}

const NAV = [
  { label: 'Ana Sayfa', icon: '⌂', route: '' },
  { label: 'Randevular', icon: '◷', route: '/appointments' },
  { label: 'Profil', icon: '◉', route: '/profile' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userName = useAuthStore((s) => s.userName);
  const userId = useAuthStore((s) => s.userId);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      getCachedData<any[]>('medications').then(cached => {
        if (cached) setMedications(cached.data);
      });
      setLoading(true);
      try {
        const data = await api.get<any[]>(`/medications/profile/${userId}`);
        setMedications(data);
        cacheData('medications', data);
        await setupNotifications();
        await cancelAllReminders();
        for (const m of data) {
          if (m.times?.[0]) await scheduleMedicationReminder(m.id, m.name, m.times[0]);
        }
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const missed = data.filter((m: any) => {
          if (!m.times?.length) return false;
          const [mh, mm] = m.times[0].split(':').map(Number);
          const minutesSince = currentMinutes - (mh * 60 + mm);
          return minutesSince > 30 && minutesSince < 90;
        });
        if (missed.length > 0) {
          const names = missed.map((m: any) => m.name).join(', ');
          Alert.alert('⚠️ Kaçırılan Doz', `${names} ilaçlarınızı zamanında almadınız.`);
          api.post('/notifications', { userId, type: 'missed_dose', title: '⚠️ Doz Kaçırıldı', body: `${names} zamanında alınmadı` }).catch(() => {});
        }
      } catch {
        const cached = await getCachedData<any[]>('medications');
        if (!cached) Alert.alert('Bağlantı Hatası', 'Sunucuya erişilemiyor.');
      }
      setLoading(false);
    })();
  }, [userId]));



  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={{ ...typography.h2, color: colors.primary }}>{(userName || 'A')[0]}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>İyi günler</Text>
          <Text style={{ ...typography.h3, color: colors.text }}>{userName || 'Ayşe Hanım'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications')}><Text style={{ fontSize: 22, color: colors.text }}>🔔</Text></TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, paddingTop: spacing.md }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.primary, borderRadius: borderRadius.card, padding: 20, marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={{ ...typography.h3, color: '#FFFFFF', marginBottom: spacing.xs }}>Ailemle Sağlık</Text>
          <Text style={{ ...typography.body, color: 'rgba(255,255,255,0.8)' }}>Sevdiklerinizin sağlığını birlikte takip edin.</Text>
        </View>
        <View style={[styles.card, shadow.card]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ ...typography.h3, color: colors.text }}>Bugünkü İlaçlar</Text>
            <TouchableOpacity style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => { if (medications.length > 0) Speech.speak(`${medications.map(m => m.name).join(' ve ')} ilaçlarınızı almayı unutmayın`, { language: 'tr' }); }}>
              <Text style={{ fontSize: 22 }}>🔊</Text>
            </TouchableOpacity>
          </View>
          {medications.length === 0 && (
            <Text style={{ ...typography.body, color: colors.secondary, fontWeight: '600', textAlign: 'center', marginBottom: spacing.md }}>
              ✅ Tüm ilaçlarınızı aldınız, harika! 👏
            </Text>
          )}
          {medications.length > 0 && medications.length <= 2 && (
            <Text style={{ ...typography.body, color: colors.warning, fontWeight: '500', textAlign: 'center', marginBottom: spacing.md }}>
              ⏳ {medications.length} ilacınız kaldı, hadi!
            </Text>
          )}
          {medications.length === 0 ? (
            <EmptyState icon="💊" title="Henüz ilaç eklenmemiş" description="İlaçlarınızı eklemek için aşağıdaki butonu kullanın." actionLabel="İlaç Ekle" onAction={() => router.push('/add-medication')} />
          ) : (
            <>
              {medications.map((m: any) => (
                <View key={m.id} style={[styles.medRow, isTimePassed(m.times?.[0]) && { borderLeftWidth: 3, borderLeftColor: colors.danger }]}>
                  <TouchableOpacity style={{ width: 56, minHeight: 48, justifyContent: 'center' }} onPress={() => router.push({ pathname: '/confirm-medication', params: { id: m.id, name: m.name, dosage: m.dosage, purpose: m.purpose || '', time: m.times?.[0] || '' } })}>
                    <Text style={{ ...typography.h2, fontSize: 20, color: isTimePassed(m.times?.[0]) ? colors.danger : colors.primary }}>{m.times?.[0] || '--'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, minHeight: 48, justifyContent: 'center' }} onPress={() => router.push({ pathname: '/confirm-medication', params: { id: m.id, name: m.name, dosage: m.dosage, purpose: m.purpose || '', time: m.times?.[0] || '' } })}>
                    <Text style={{ ...typography.body, fontWeight: '500', color: colors.text }}>{m.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>{m.dosage}</Text>
                    {m.purpose ? <Text style={{ ...typography.small, color: colors.textLight, fontStyle: 'italic', marginTop: 2 }}>{m.purpose}</Text> : null}
                  </TouchableOpacity>
                  <TouchableOpacity style={{ minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }} onPress={() => Speech.speak(`${m.name} ilacınızı almayı unutmayın`, { language: 'tr' })}>
                    <Text style={{ fontSize: 18 }}>🔊</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <SOSButton />
      <BottomNav items={NAV} activeIndex={0} />
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight + '30', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 20, marginHorizontal: spacing.lg },
  medRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  done: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },


});
