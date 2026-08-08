import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useSubscriptionStore } from '../src/stores/useSubscriptionStore';
import { BottomNav } from '../src/components/BottomNav';
import { api } from '../src/services/api';
import { useTheme, useThemedStyles } from '../src/theme/ThemeProvider';
import { clearLocalUserData } from '../src/services/auth-cleanup';

const AVATAR_EMOJI: Record<string, string> = {
  elderly_woman: '👵', elderly_man: '👴', elderly_hijabi: '🧕',
  woman: '👩', man: '👨', young_woman: '👧', young_man: '👦',
  girl: '👶', doctor: '👨‍⚕️',
};

export default function ProfileScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const params = useLocalSearchParams();
  const userName = useAuthStore((s) => s.userName);
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const { toggleTheme, isDark, colors: themeColors } = useTheme();
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const homeRoute = role === 'caregiver' ? '/caregiver' : '/home';
  const [avatarEmoji, setAvatarEmoji] = useState('👤');
  const [bloodType, setBloodType] = useState('Eklenmedi');
  const [latestWeight, setLatestWeight] = useState('Eklenmedi');

  useEffect(() => {
    AsyncStorage.getItem('famicare_avatar').then(a => {
      if (a && AVATAR_EMOJI[a]) setAvatarEmoji(AVATAR_EMOJI[a]);
    });
    SecureStore.getItemAsync('famicare_bloodtype').then(b => { if (b) setBloodType(b); }).catch(() => {});
    if (userId) {
      api.get<any[]>(`/health/profile/${userId}?type=weight`).then(records => {
        const latest = records.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0];
        const value = latest?.valueData?.weight;
        if (value !== undefined && value !== null && value !== '') setLatestWeight(`${value} kg`);
      }).catch(() => { setLatestWeight('Eklenmedi'); });
    }
  }, [userId]);
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
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: themeColors.surface }}>
        <TouchableOpacity onPress={() => router.push(homeRoute)} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ fontSize: 28, color: isDark ? '#EAF1FF' : colors.text }}>←</Text>
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
          <><View style={[styles.section, { backgroundColor: themeColors.surface }, shadow.card]}>
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
            <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/health', params: { profileId: String(params.profileId || '') } })}>
              <Text style={{ fontSize: 18, marginRight: spacing.md }}>❤️</Text>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Sağlık Günlüğü</Text>
              <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.action, { borderBottomWidth: 0 }]} onPress={() => router.push({ pathname: '/reports', params: { profileId: String(params.profileId || userId), profileName: String(params.name || '') } })}>
              <Text style={{ fontSize: 18, marginRight: spacing.md }}>📊</Text>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Uyum Raporu</Text>
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
            <View style={[styles.section, { backgroundColor: themeColors.surface }, shadow.card]}>
              <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>Vital Bulgular</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[{ icon: '🩸', label: 'Kan Grubu', value: bloodType }, { icon: '📏', label: 'Boy', value: 'Eklenmedi' }, { icon: '⚖️', label: 'Kilo', value: latestWeight }].map((v, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: colors.surfaceVariant + '40', borderRadius: 12 }}>
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{v.icon}</Text>
                    <Text style={{ ...typography.h3, color: colors.text }}>{v.value}</Text>
                    <Text style={{ ...typography.small, color: colors.textLight }}>{v.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.section, { backgroundColor: themeColors.surface }, shadow.card]}>
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
              <TouchableOpacity style={styles.action} onPress={() => router.push('/emergency-contacts')}>
                <Text style={{ fontSize: 18, marginRight: spacing.md }}>📞</Text>
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Acil Kişiler</Text>
                <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.action, { borderBottomWidth: 0 }]} onPress={() => router.push('/invite')}>
                <Text style={{ fontSize: 18, marginRight: spacing.md }}>🔗</Text>
                <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>Yakınına Bağlan</Text>
                <Text style={{ fontSize: 20, color: colors.textLight }}>›</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/subscribe')}>
              <Text style={{ ...typography.button, color: isSubscribed ? colors.secondary : colors.primary }}>
                {isSubscribed ? '🌟 Premium Üye' : '🌟 Premium\'a Geç'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpBtn} onPress={toggleTheme}>
              <Text style={{ ...typography.button, color: colors.textLight }}>{isDark ? '☀️' : '🌙'} {isDark ? 'Aydınlık Tema' : 'Karanlık Tema'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/help')}>
              <Text style={{ ...typography.button, color: colors.textLight }}>❓ Yardım</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => router.push('/delete-account')}>
              <Text style={{ ...typography.button, color: colors.danger }}>Hesabımı ve Verilerimi Sil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={async () => {
              if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch((e: any) => { if (e?.status !== 401) Alert.alert('Uyarı', 'Oturum sunucuda kapatılamadı. Yeniden giriş yapmanız gerekebilir.'); });
              await clearLocalUserData();
              logout();
              router.replace('/welcome');
            }}>
              <Text style={{ ...typography.button, color: colors.danger }}>Çıkış Yap</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <BottomNav items={NAV} activeIndex={NAV.length - 1} />
    </View>
  );
}
const baseStyles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 48 },
  helpBtn: { marginTop: spacing.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
  deleteBtn: { marginTop: spacing.md, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
  logoutBtn: { marginTop: spacing.md, marginBottom: spacing.xxl, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
});
