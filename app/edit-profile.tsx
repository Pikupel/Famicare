import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { useAuthStore } from '../src/stores/useAuthStore';
import { api } from '../src/services/api';
import { AvatarPicker } from '../src/components/AvatarPicker';

const AVATAR_MAP: Record<string, string> = {
  elderly_woman: '👵', elderly_man: '👴', elderly_hijabi: '🧕',
  woman: '👩', man: '👨', young_woman: '👧', young_man: '👦',
  girl: '👶', doctor: '👨‍⚕️',
};

export default function EditProfileScreen() {
  const router = useRouter();
  const userName = useAuthStore((s) => s.userName);
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const [name, setName] = useState(userName);
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Uyarı', 'Adınızı girin'); return; }
    setSaving(true);
    try {
      await api.patch('/me', { name: name.trim() });
      if (avatar) await AsyncStorage.setItem('famicare_avatar', avatar);
      login(name.trim(), token || '', userId, role);
      Alert.alert('Başarılı', 'Profil güncellendi');
      router.back();
    } catch (e: any) { Alert.alert('Hata', e.message); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Profili Düzenle</Text>
      </View>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.label}>Profil İkonu Seç</Text>
        <AvatarPicker selected={avatar} onSelect={setAvatar} />
        <Text style={styles.label}>Ad Soyad</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Adınız Soyadınız" />
        <Button title={saving ? 'Kaydediliyor...' : 'Kaydet'} onPress={save} disabled={saving} style={{ marginTop: spacing.lg }} />
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
});
