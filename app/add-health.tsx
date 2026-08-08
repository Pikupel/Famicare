import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useThemedStyles } from '../src/theme/ThemeProvider';

type MeasureType = 'blood_pressure' | 'blood_sugar' | 'weight';

export default function AddHealthScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { id, profileId, editType, editSystolic, editDiastolic, editSugar, editWeight } = useLocalSearchParams();
  const isEdit = !!id;

  const [type, setType] = useState<MeasureType>((editType as MeasureType) || 'blood_pressure');
  const [systolic, setSystolic] = useState(String(editSystolic || ''));
  const [diastolic, setDiastolic] = useState(String(editDiastolic || ''));
  const [sugar, setSugar] = useState(String(editSugar || ''));
  const [weight, setWeight] = useState(String(editWeight || ''));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const sys = Number(systolic), dia = Number(diastolic), glucose = Number(sugar), kg = Number(weight);
    if (type === 'blood_pressure' && (sys < 50 || sys > 260 || dia < 30 || dia > 160 || sys <= dia)) {
      Alert.alert('Geçersiz Değer', 'Tansiyon değerlerini kontrol edin.'); return;
    }
    if (type === 'blood_sugar' && (glucose < 20 || glucose > 700)) {
      Alert.alert('Geçersiz Değer', 'Kan şekeri 20–700 mg/dL arasında olmalıdır.'); return;
    }
    if (type === 'weight' && (kg < 2 || kg > 500)) {
      Alert.alert('Geçersiz Değer', 'Kilo 2–500 kg arasında olmalıdır.'); return;
    }
    setSaving(true);
    try {
      const valueData: any = {};
      if (type === 'blood_pressure') { valueData.systolic = Number(systolic); valueData.diastolic = Number(diastolic); }
      if (type === 'blood_sugar') valueData.sugar = Number(sugar);
      if (type === 'weight') valueData.weight = Number(weight);
      if (isEdit) {
        await api.patch(`/health/${id}`, { valueData });
      } else {
        await api.post('/health', { profileId: String(profileId || userId), recordType: type, valueData });
      }
      Alert.alert('Başarılı', isEdit ? 'Ölçüm güncellendi' : 'Ölçüm kaydedildi');
      router.back();
    } catch (e: any) { Alert.alert('Hata', e.message || 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!isEdit) return;
    Alert.alert('Ölçümü Sil', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.del(`/health/${id}`); router.back(); } catch { Alert.alert('Hata', 'Silinemedi'); }
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>{isEdit ? 'Ölçüm Düzenle' : 'Yeni Ölçüm'}</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxl + 120 }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {(['blood_pressure', 'blood_sugar', 'weight'] as MeasureType[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.typeBtn, type === t && styles.typeActive]} onPress={() => setType(t)}>
              <Text style={{ fontSize: 20, marginBottom: 4 }}>{t === 'blood_pressure' ? '❤️' : t === 'blood_sugar' ? '🩸' : '⚖️'}</Text>
              <Text style={{ ...typography.small, color: type === t ? colors.onPrimary : colors.textSecondary }}>{t === 'blood_pressure' ? 'Tansiyon' : t === 'blood_sugar' ? 'Şeker' : 'Kilo'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {type === 'blood_pressure' && (
          <><Text style={styles.label}>Büyük</Text><TextInput style={styles.input} value={systolic} onChangeText={(v) => setSystolic(v.replace(/[^0-9]/g, ''))} placeholder="120" keyboardType="numeric" />
            <Text style={styles.label}>Küçük</Text><TextInput style={styles.input} value={diastolic} onChangeText={(v) => setDiastolic(v.replace(/[^0-9]/g, ''))} placeholder="80" keyboardType="numeric" /></>
        )}
        {type === 'blood_sugar' && <><Text style={styles.label}>Kan Şekeri</Text><TextInput style={styles.input} value={sugar} onChangeText={(v) => setSugar(v.replace(/[^0-9]/g, ''))} placeholder="110" keyboardType="numeric" /></>}
        {type === 'weight' && <><Text style={styles.label}>Kilo</Text><TextInput style={styles.input} value={weight} onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ''))} placeholder="74.5" keyboardType="decimal-pad" /></>}
        <Button title={saving ? 'Kaydediliyor...' : 'Kaydet'} onPress={save} disabled={saving} style={{ marginTop: spacing.xl }} />
        {isEdit && <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}><Text style={{ ...typography.button, color: colors.danger }}>Ölçümü Sil</Text></TouchableOpacity>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const baseStyles = StyleSheet.create({
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: borderRadius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 56 },
  typeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
  deleteBtn: { marginTop: spacing.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
});
