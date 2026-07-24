import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { useAuthStore } from '../src/stores/useAuthStore';
import { api } from '../src/services/api';
import { BottomNav } from '../src/components/BottomNav';
import { SOSButton } from '../src/components/SOSButton';

const NAV = [
  { label: 'Ana Sayfa', icon: '⌂', route: '/caregiver' },
  { label: 'Profil', icon: '◉', route: '/profile' },
];

export default function CaregiverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userName = useAuthStore((s) => s.userName);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    api.get<any[]>('/dashboard').then(setProfiles).catch(() => {}).finally(() => setLoading(false));
  }, []));

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={styles.avatar}><Text style={{ ...typography.h2, color: colors.primary }}>{(userName || 'Z')[0]}</Text></View>
          <View><Text style={{ ...typography.caption, color: colors.textSecondary }}>Merhaba</Text><Text style={{ ...typography.h3, color: colors.text }}>{userName || 'Zeynep'}</Text></View>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications')} style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>🔔</Text></TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, paddingTop: spacing.md, paddingHorizontal: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
            <Text style={{ ...typography.h3, color: colors.primary, textAlign: 'center' }}>{profiles.reduce((s: number, p: any) => s + (p.totalDoses || 0), 0)}</Text>
            <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: 4 }}>Toplam Doz</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: colors.secondary }]}>
            <Text style={{ ...typography.h3, color: colors.secondary, textAlign: 'center' }}>{profiles.length}</Text>
            <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: 4 }}>Kişi</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 3, borderLeftColor: colors.warning }]}>
            <Text style={{ ...typography.h3, color: colors.text, textAlign: 'center' }}>
              {profiles.length > 0 ? Math.round(profiles.reduce((s: number, p: any) => s + (p.adherence || 0), 0) / profiles.length) : 0}%
            </Text>
            <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: 4 }}>Uyum</Text>
          </View>
        </View>

        <Text style={{ ...typography.h2, color: colors.text, marginBottom: spacing.md }}>Sevdiklerim</Text>
        {profiles.length === 0 ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <Text style={{ ...typography.body, color: colors.textLight }}>Henüz profil eklenmemiş</Text>
          </View>
        ) : profiles.map((p: any) => (
          <TouchableOpacity key={p.profile?.id || p.id} style={[styles.card, shadow.card]} onPress={() => router.push({ pathname: '/profile', params: { profileId: p.profile?.id || p.id, name: p.profile?.name || 'İsimsiz', inviteCode: p.profile?.inviteCode || '------', adherence: p.adherence, taken: p.takenDoses, total: p.totalDoses } })}>
            <View style={[styles.pAvatar, { backgroundColor: colors.primaryLight + '30' }]}>
              <Text style={{ ...typography.h2, color: colors.primary }}>{(p.profile?.name || '?').charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, color: colors.text, fontWeight: '600' }}>{p.profile?.name || 'İsimsiz'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.sm }}>
                <View style={[styles.badge, { backgroundColor: p.adherence > 70 ? colors.secondary + '20' : colors.warning + '20' }]}>
                  <Text style={{ ...typography.small, color: p.adherence > 70 ? colors.secondary : colors.warning, fontWeight: '600' }}>%{p.adherence || 0}</Text>
                </View>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>{p.takenDoses || 0}/{p.totalDoses || 0} doz</Text>
              </View>
            </View>
            <Text style={{ fontSize: 22, color: colors.textLight }}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.adherenceBtn} onPress={() => router.push('/adherence')}>
          <Text style={{ fontSize: 18, marginRight: spacing.sm }}>📊</Text>
          <Text style={{ ...typography.button, color: colors.primary }}>Uyum Raporu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { marginTop: spacing.md, marginBottom: spacing.xxl }]} onPress={() => router.push('/add-profile')}>
          <Text style={{ fontSize: 18, marginRight: spacing.sm }}>👤</Text>
          <Text style={{ ...typography.button, color: colors.primary }}>Yeni Yakın Ekle</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav items={NAV} activeIndex={1} />
    </View>
  );
}
const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight + '30', alignItems: 'center', justifyContent: 'center' },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.sm },
  pAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: 14, borderRadius: borderRadius.card, borderWidth: 1.5, borderColor: colors.primary, minHeight: 48 },
  adherenceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: 14, borderRadius: borderRadius.card, borderWidth: 1.5, borderColor: colors.primary, minHeight: 48, marginTop: spacing.md },
  nav: { flexDirection: 'row', backgroundColor: colors.surface, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
