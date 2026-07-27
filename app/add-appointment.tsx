import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useThemedStyles } from '../src/theme/ThemeProvider';

function maskDate(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
}

function maskTime(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export default function AddAppointmentScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { id, profileId, editTitle, editLocation, editDoctor, editDate, editTime, editNotes } = useLocalSearchParams();
  const isEdit = !!id;

  const [title, setTitle] = useState(String(editTitle || ''));
  const [location, setLocation] = useState(String(editLocation || ''));
  const [doctorName, setDoctorName] = useState(String(editDoctor || ''));
  const [date, setDate] = useState(String(editDate || ''));
  const [time, setTime] = useState(String(editTime || ''));
  const [notes, setNotes] = useState(String(editNotes || ''));
  const [saving, setSaving] = useState(false);

  const allFilled = title.trim() && date.length === 10 && time.length === 5;

  const save = async () => {
    if (!allFilled) { Alert.alert('Uyarı', 'Tüm alanları doldurun'); return; }
    const [checkDay, checkMonth, checkYear] = date.split('.').map(Number);
    const [checkHour, checkMinute] = time.split(':').map(Number);
    const candidate = new Date(checkYear, checkMonth - 1, checkDay, checkHour, checkMinute);
    if (candidate.getFullYear() !== checkYear || candidate.getMonth() !== checkMonth - 1 || candidate.getDate() !== checkDay || checkHour > 23 || checkMinute > 59) {
      Alert.alert('Uyarı', 'Geçerli bir tarih ve saat girin'); return;
    }
    setSaving(true);
    try {
      const [d, m, y] = date.split('.');
      const isoDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      if (isEdit) {
        await api.put(`/appointments/${id}`, { title, location, doctorName, date: isoDate, time, notes });
      } else {
        await api.post('/appointments', { profileId: String(profileId || userId), title, location, doctorName, date: isoDate, time, notes });
      }
      Alert.alert('Başarılı', isEdit ? 'Güncellendi' : 'Eklendi');
      router.back();
    } catch (e: any) { Alert.alert('Hata', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = () => {
    Alert.alert('Sil', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.del(`/appointments/${id}`); router.back(); }
        catch (error: any) { Alert.alert('Randevu silinemedi', error?.message || 'Lütfen tekrar deneyin.'); }
      }},
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxl + 120 }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>{isEdit ? 'Randevu Düzenle' : 'Randevu Ekle'}</Text>
      </View>
      <View style={{ padding: spacing.lg }}>
        <TouchableOpacity style={styles.mhrsBtn} onPress={() => Linking.openURL('https://mhrs.gov.tr/vatandas/#/')}>
          <Text style={{ fontSize: 20, marginRight: spacing.sm }}>🏥</Text>
          <View><Text style={{ ...typography.button, color: '#FFF' }}>MHRS'de Randevu Al</Text>
          <Text style={{ ...typography.small, color: 'rgba(255,255,255,0.7)' }}>MHRS'e gidin, randevunuzu alın, sonra takviminize ekleyin</Text></View>
        </TouchableOpacity>

        <Text style={styles.label}>Randevu Başlığı</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Aile Hekimi Kontrolü" />

        <Text style={styles.label}>Doktor</Text>
        <TextInput style={styles.input} value={doctorName} onChangeText={setDoctorName} placeholder="Dr. Adı Soyadı" />

        <Text style={styles.label}>Hastane / Klinik</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Medipol Hastanesi" />

        <Text style={styles.label}>Tarih (GG.AA.YYYY)</Text>
        <TextInput style={styles.input} value={date} onChangeText={(v) => setDate(maskDate(v))} placeholder="18.07.2026" keyboardType="numeric" maxLength={10} />

        <Text style={styles.label}>Saat (SS:DD)</Text>
        <TextInput style={styles.input} value={time} onChangeText={(v) => setTime(maskTime(v))} placeholder="14:30" keyboardType="numeric" maxLength={5} />

        <Text style={styles.label}>Notlar (randevu sonrası doktor notları)</Text>
        <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Doktorun önerileri, tahlil sonuçları..." multiline />

        {allFilled && <Button title={saving ? 'Kaydediliyor...' : 'Kaydet'} onPress={save} disabled={saving} style={{ marginTop: spacing.lg }} />}
        {isEdit && <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}><Text style={{ ...typography.button, color: colors.danger }}>Randevuyu Sil</Text></TouchableOpacity>}
      </View>
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  mhrsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, padding: 16, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
  deleteBtn: { marginTop: spacing.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: borderRadius.button, minHeight: 48, justifyContent: 'center' },
});
