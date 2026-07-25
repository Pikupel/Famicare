import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { useAuthStore } from '../src/stores/useAuthStore';
import { BottomNav } from '../src/components/BottomNav';
import { api } from '../src/services/api';

const AVATAR_EMOJI: Record<string, string> = {
  elderly_woman: '👵', elderly_man: '👴', elderly_hijabi: '🧕',
  woman: '👩', man: '👨', young_woman: '👧', young_man: '👦',
  girl: '👶', doctor: '👨‍⚕️',
};

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const [avatarEmoji, setAvatarEmoji] = useState('👤');
  const homeRoute = role === 'caregiver' ? '/caregiver' : '/home';

  const [bloodType, setBloodType] = useState('A Rh+');

  useEffect(() => {
    AsyncStorage.getItem('famicare_avatar').then(a => {
      if (a && AVATAR_EMOJI[a]) setAvatarEmoji(AVATAR_EMOJI[a]);
    });
    AsyncStorage.getItem('famicare_bloodtype').then(b => { if (b) setBloodType(b); });
  }, []);
  const NAV = role === 'caregiver' ? [
    { label: 'Ana Sayfa', icon: '⌂', route: '/caregiver' },
    { label: 'Profil', icon: '◉', route: '' },
  ] : [
    { label: 'Ana Sayfa', icon: '⌂', route: '/home' },
    { label: 'Randevular', icon: '◷', route: '/appointments' },
    { label: 'Profil', icon: '◉', route: '' },
  ];
  const displayName = String(params.name || userName || 'İsimsiz');
  const isCaregiverView = role === 'caregiver' && !!params.name;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <TouchableOpacity onPress={() => router.push(homeRoute)} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ fontSize: 28, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.md }}>Profil</Text>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight + '20', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Text style={{ fontSize: 40 }}>{avatarEmoji}</Text>
          </View>
          <Text style={{ ...typography.h2, color: colors.text }}>{displayName}</Text>
          {!isCaregiverView && <Text style={{ ...typography.caption, color: colors.textLight, marginTop: spacing.xs }}>{role === 'caregiver' ? 'Yakınım İçin' : 'Kendim İçin'}</Text>}
          {!isCaregiverView && (
            <TouchableOpacity style={{ marginTop: spacing.md, minHeight: 44, justifyContent: 'center' }} onPress={() => router.push('/edit-profile')}>
              <Text style={{ ...typography.button, color: colors.primary }}>✎ Düzenle</Text>
            </TouchableOpacity>
          )}
        </View>

        {isCaregiverView && (
          <><View style={[styles.section, shadow.card]}>
            <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>Hızlı İşlemler</Text>
            <View style={{ backgroundColor: colors.primaryLight + '15', borderRadius: 12, padding: 12, marginBottom: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>Davet Kodu</Text>
              <Text style={{ ...typography.h2, color: colors.primary, letterSpacing: 4 }}>{String(params.inviteCode || '------')}</Text>
              <Text style={{ ...typography.small, color: colors.textLight }}>Bu kodu yakınınıza verin, hesabına bağlansın</Text>
            </View>
            <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/medication', params: { profileId: String(params.profileId || '') } })}>
              <Text style={{ fontSize: 18, marginRight: spacing.md }}>💊</Text>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>İlaçlar</Text>
              <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/add-medication', params: { profileId: String(params.profileId || '') } })}>
              <Text style={{ fontSize: 18, marginRight: spacing.md }}>➕</Text>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>İlaç Ekle</Text>
              <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/appointments', params: { profileId: String(params.profileId || '') } })}>
              <Text style={{ fontSize: 18, marginRight: spacing.md }}>📅</Text>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Randevular</Text>
              <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.action, { borderBottomWidth: 0 }]} onPress={() => router.push({ pathname: '/health', params: { profileId: String(params.profileId || '') } })}>
              <Text style={{ fontSize: 18, marginRight: spacing.md }}>❤️</Text>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Sağlık Günlüğü</Text>
              <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => {
            Alert.alert('Profili Sil', 'Bu profili silmek istediğinize emin misiniz? Tüm ilaç ve sağlık verileri kaybolacak.', [
              { text: 'İptal', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: async () => {
                try { await api.del(`/profiles/${params.profileId}`); router.replace('/caregiver'); Alert.alert('Silindi'); } catch { Alert.alert('Hata', 'Silinemedi'); }
              }},
            ]);
          }}>
            <Text style={{ ...typography.button, color: colors.danger }}>Profili Sil</Text>
          </TouchableOpacity>
          </>
        )}

          {!isCaregiverView && (
          <>
            <View style={[styles.section, shadow.card]}>
              <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>Vital Bulgular</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[{ icon: '🩸', label: 'Kan Grubu', value: bloodType }, { icon: '📏', label: 'Boy', value: '178 cm' }, { icon: '⚖️', label: 'Kilo', value: '82 kg' }].map((v, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: colors.surfaceVariant + '40', borderRadius: 12 }}>
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{v.icon}</Text>
                    <Text style={{ ...typography.h3, color: colors.text }}>{v.value}</Text>
                    <Text style={{ ...typography.small, color: colors.textLight }}>{v.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.section, shadow.card]}>
              <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>Hızlı İşlemler</Text>
              <TouchableOpacity style={styles.action} onPress={() => router.push('/add-medication')}>
                <Text style={{ fontSize: 18, marginRight: spacing.md }}>➕</Text>
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>İlaç Ekle</Text>
                <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => router.push('/medication')}>
                <Text style={{ fontSize: 18, marginRight: spacing.md }}>💊</Text>
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>İlaçlar</Text>
                <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => router.push('/health')}>
                <Text style={{ fontSize: 18, marginRight: spacing.md }}>❤️</Text>
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Sağlık Günlüğüm</Text>
                <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.action, { borderBottomWidth: 0 }]} onPress={() => router.push('/invite')}>
                <Text style={{ fontSize: 18, marginRight: spacing.md }}>🔗</Text>
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Yakınına Bağlan</Text>
                <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/help')}>
              <Text style={{ ...typography.button, color: colors.textLight }}>❓ Yardım</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { logout(); router.replace('/welcome'); }}>
              <Text style={{ ...typography.button, color: colors.danger }}>Çıkış Yap</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <BottomNav items={NAV} activeIndex={3} />
    </View>
  );
}
const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 48 },
  helpBtn: { marginTop: spacing.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
  deleteBtn: { marginTop: spacing.md, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
  logoutBtn: { marginTop: spacing.md, marginBottom: spacing.xxl, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
});
