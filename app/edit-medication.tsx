import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { cancelMedicationReminders } from '../src/services/notifications';
import { useThemedStyles } from '../src/theme/ThemeProvider';

export default function EditMedicationScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const { id, medName, medDosage, editTimes, medStock, medPurpose, medUnitsPerDose } = useLocalSearchParams();
  const initialTimes = editTimes ? String(editTimes).split(',') : ['09:00'];
  const [name, setName] = useState(String(medName || ''));
  const [dosage, setDosage] = useState(String(medDosage || ''));
  const [purpose, setPurpose] = useState(String(medPurpose || ''));
  const [stockTotal, setStockTotal] = useState(String(medStock || ''));
  const [unitsPerDose, setUnitsPerDose] = useState(String(medUnitsPerDose || '1'));
  const [times, setTimes] = useState<string[]>(initialTimes);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!id) { Alert.alert('Hata', 'İlaç bilgisi bulunamadı.'); router.back(); return; }
    if (!name.trim()) { Alert.alert('Uyarı', 'İlaç adı gerekli'); return; }
    if (!times.length || times.some(t => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))) {
      Alert.alert('Uyarı', 'Saatleri SS:DD biçiminde ve geçerli aralıkta girin'); return;
    }
    setSaving(true);
    try {
      const parsedUnits = Number(unitsPerDose);
      if (!Number.isFinite(parsedUnits) || parsedUnits <= 0) throw new Error('Doz adedi sıfırdan büyük olmalıdır.');
      await api.patch(`/medications/${id}`, { name: name.trim(), dosage, times, purpose, stockTotal: stockTotal === '' ? undefined : Number(stockTotal), unitsPerDose: parsedUnits });
      Alert.alert('Başarılı', 'İlaç güncellendi');
      router.back();
    } catch (e: any) { Alert.alert('Hata', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = () => {
    Alert.alert('İlacı Sil', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.del(`/medications/${id}`); await cancelMedicationReminders(String(id)); router.back(); }
        catch (error: any) { Alert.alert('İlaç silinemedi', error?.message || 'Lütfen tekrar deneyin.'); }
      }},
    ]);
  };

  const addTime = () => setTimes([...times, '09:00']);
  const removeTime = (i: number) => setTimes(times.filter((_, idx) => idx !== i));
  const updateTime = (i: number, val: string) => { const t = [...times]; t[i] = val; setTimes(t); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>İlaç Düzenle</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Text style={styles.label}>İlaç Adı</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tansiyon İlacı" />
        <Text style={styles.label}>Doz</Text>
        <TextInput style={styles.input} value={dosage} onChangeText={setDosage} placeholder="1 Tablet" />
        <Text style={styles.label}>Kullanım Amacı</Text>
        <TextInput style={styles.input} value={purpose} onChangeText={(v) => v.length <= 80 && setPurpose(v)} placeholder="Örnek: Tansiyon için" />

        <Text style={styles.label}>Saatler</Text>
        {times.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={t} onChangeText={(v) => updateTime(i, v)} placeholder="09:00" />
            <TouchableOpacity onPress={() => removeTime(i)} style={{ padding: spacing.sm, minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 20, color: colors.danger }}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={addTime} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ ...typography.body, color: colors.primary, fontWeight: '600' }}>+ Saat Ekle</Text></TouchableOpacity>
        <Text style={styles.label}>Kalan stok / yeni kutu miktarı</Text>
        <TextInput style={styles.input} value={stockTotal} onChangeText={(value) => setStockTotal(value.replace(/\D/g, ''))} keyboardType="numeric" placeholder="Örn: 28" />
        <Text style={styles.label}>Her kullanımda alınan adet</Text>
        <TextInput style={styles.input} value={unitsPerDose} onChangeText={(value) => setUnitsPerDose(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Örn: 1" />
        <Button title={saving ? 'Kaydediliyor...' : 'Kaydet'} onPress={save} disabled={saving} style={{ marginTop: spacing.xl }} />
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}><Text style={{ ...typography.button, color: colors.danger }}>İlacı Sil</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const baseStyles = StyleSheet.create({
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
  deleteBtn: { marginTop: spacing.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
});
