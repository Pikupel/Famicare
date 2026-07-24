import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';

const TABS = ['Tümü', 'İlaç', 'Randevu', 'Sistem'];

export default function NotificationsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!userId) { setLoading(false); return; }
    api.get<any[]>(`/notifications`).then(d => setItems(d)).catch(() => {}).finally(() => setLoading(false));
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
            <Text style={{ ...typography.caption, color: i === tab ? '#FFF' : colors.textSecondary, fontWeight: i === tab ? '600' : '400' }}>{t}</Text>
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
            <View key={n.id} style={[styles.notif, { backgroundColor: (colorMap[n.type] || colors.gray) + '12' }]}>
              <View style={[styles.dot, { backgroundColor: colorMap[n.type] || colors.gray }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.text }}>{n.title}</Text>
                {n.body ? <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>{n.body}</Text> : null}
              </View>
              <Text style={{ ...typography.small, color: colors.textLight, marginLeft: spacing.sm }}>{n.createdAt ? new Date(n.createdAt).toLocaleDateString('tr-TR') : ''}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.background },
  notif: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: borderRadius.card, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
});
