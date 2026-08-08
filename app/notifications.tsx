import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useThemedStyles } from '../src/theme/ThemeProvider';

const TABS = ['Tümü', 'İlaç', 'Randevu', 'Sistem'];

export default function NotificationsScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!userId) { setLoading(false); return; }
    api.get<any[]>(`/notifications`).then(d => setItems(d))
      .catch((error: any) => Alert.alert('Bildirimler yüklenemedi', error?.message || 'Lütfen tekrar deneyin.'))
      .finally(() => setLoading(false));
  }, [userId]));

  const colorMap: Record<string, string> = { missed_dose: colors.danger, taken_confirmation: colors.secondary, appointment_reminder: colors.primary, medication_reminder: colors.primary, system: colors.gray };
  const iconMap: Record<string, string> = { missed_dose: '⚠️', taken_confirmation: '✅', appointment_reminder: '📅', medication_reminder: '💊', system: 'ℹ️' };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ fontSize: 24, color: colors.text, marginRight: spacing.md }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text }}>Bildirimler</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface, gap: spacing.sm }}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[styles.tab, i === tab && { backgroundColor: colors.primary }]} onPress={() => setTab(i)}>
            <Text style={{ ...typography.caption, color: i === tab ? colors.onPrimary : colors.textSecondary, fontWeight: i === tab ? '600' : '400' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ paddingTop: spacing.xxl }} /> : (
        <ScrollView style={{ flex: 1, padding: spacing.lg }}>
          {items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={{ ...typography.body, color: colors.textLight }}>Henüz bildirim yok</Text>
            </View>
          ) : items.filter(n => {
            if (tab === 0) return true;
            const map: Record<number, string[]> = { 1: ['medication', 'missed'], 2: ['appointment'], 3: ['system'] };
            return map[tab]?.some(k => n.type?.includes(k));
          }).map((n: any) => (
            <TouchableOpacity key={n.id} style={[styles.notif, { backgroundColor: (colorMap[n.type] || colors.gray) + (n.isRead ? '08' : '18'), opacity: n.isRead ? 0.72 : 1 }]}
              onPress={async () => {
                if (!n.isRead) {
                  try {
                    await api.put(`/notifications/${n.id}/read`, {});
                    setItems(current => current.map(item => item.id === n.id ? { ...item, isRead: true } : item));
                  } catch { setItems(current => current.map(item => item.id === n.id ? { ...item, isRead: false } : item)); }
                }
                if (n.type === 'medication_reminder' || n.type === 'missed_dose') {
                  if (n.data?.medicationId) {
                    router.push({ pathname: '/confirm-medication', params: { id: n.data.medicationId, name: n.title?.replace('💊 ','').replace('⚠️ ','') || '', time: n.data.scheduledTime || '' } });
                  }
                } else if (n.type?.includes('appointment')) {
                  router.push('/appointments');
                } else if (n.data?.url) {
                  router.push(n.data.url as never);
                }
              }}
            >
              <View style={[styles.dot, { backgroundColor: colorMap[n.type] || colors.gray }]} />
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{iconMap[n.type] || 'ℹ️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.text }}>{n.title}</Text>
                {n.body ? <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>{n.body}</Text> : null}
              </View>
              <Text style={{ ...typography.small, color: colors.textLight, marginLeft: spacing.sm }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString('tr-TR') : ''}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
const baseStyles = StyleSheet.create({
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.background },
  notif: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: borderRadius.card, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
});
