import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { useThemedStyles } from '../src/theme/ThemeProvider';

export default function AddProfileScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('aile');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Uyarı', 'İsim gerekli'); return; }
    setSaving(true);
    try {
      await api.post('/profiles', { name: name.trim(), birthDate, phone, relationship });
      Alert.alert('Başarılı', 'Profil eklendi');
      router.back();
    } catch (e: any) { Alert.alert('Hata', e.message); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Yakın Ekle</Text>
      </View>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.label}>Ad Soyad</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Annem, Babam..." />
        <Text style={styles.label}>Doğum Tarihi (GG.AA.YYYY)</Text>
        <TextInput style={styles.input} value={birthDate} onChangeText={setBirthDate} placeholder="15.03.1944" keyboardType="numbers-and-punctuation" />
        <Text style={styles.label}>Telefon</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+90 532 XXX XX XX" keyboardType="phone-pad" />
        <Text style={styles.label}>Yakınlık</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {['aile', 'anne', 'baba', 'eş'].map((opt) => (
            <TouchableOpacity key={opt} style={[styles.option, relationship === opt && styles.optionActive]} onPress={() => setRelationship(opt)}>
              <Text style={{ ...typography.body, color: relationship === opt ? '#FFF' : colors.text }}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button title={saving ? 'Kaydediliyor...' : 'Kaydet'} onPress={save} disabled={saving} />
      </View>
    </ScrollView>
  );
}
const baseStyles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
  option: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.input, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
