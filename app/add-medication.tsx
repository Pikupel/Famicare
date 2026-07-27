import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/useAuthStore';
import { DrugSearch } from '../src/components/DrugSearch';
import { useThemedStyles } from '../src/theme/ThemeProvider';

export default function AddMedicationScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const userId = useAuthStore((s) => s.userId);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instruction, setInstruction] = useState('Aç karnına');
  const [times, setTimes] = useState<string[]>(['09:00']);
  const [purpose, setPurpose] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stockTotal, setStockTotal] = useState('');
  const [unitsPerDose, setUnitsPerDose] = useState('1');
  const [drugRefId, setDrugRefId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addTime = () => setTimes([...times, '09:00']);
  const removeTime = (i: number) => setTimes(times.filter((_, idx) => idx !== i));
  const updateTime = (i: number, val: string) => { const t = [...times]; t[i] = val; setTimes(t); };

  const save = async () => {
    if (!name.trim()) { Alert.alert('Uyarı', 'İlaç adı gerekli'); return; }
    if (name.trim().length < 2) { Alert.alert('Uyarı', 'İlaç adı en az 2 karakter olmalıdır'); return; }
    if (!times.length || times.some(t => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))) {
      Alert.alert('Uyarı', 'Saatleri SS:DD biçiminde ve geçerli aralıkta girin'); return;
    }
    setSaving(true);
    const targetProfileId = profileId || userId || 'default';
    try {
      await api.post('/medications', { profileId: targetProfileId, name, dosage, instructions: instruction, times, endDate, purpose, stockTotal: stockTotal ? Number(stockTotal) : undefined, unitsPerDose: Number(unitsPerDose) || 1, drugRefId });
      Alert.alert('Başarılı', 'İlaç eklendi');
      router.back();
    } catch (e: any) { Alert.alert('Hata', e.message); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>İlaç Ekle</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>İlaç Adı</Text>
        <DrugSearch onSelect={(drug) => { setName(drug.ilac_adi); setDrugRefId(drug.barkod); if (drug.recete_turu === 'Mor') Alert.alert('🔮 Mor Reçete', 'Bu ilaç mor reçeteye tabidir. Kullanım için doktor izni gereklidir.'); }} />
        <TextInput style={styles.input} value={name} onChangeText={(value) => { setName(value); setDrugRefId(null); }} placeholder="Seçim yapın veya manuel girin..." />
        <Text style={styles.label}>Doz</Text>
        <TextInput style={styles.input} value={dosage} onChangeText={setDosage} placeholder="1 Tablet" />
        <Text style={styles.label}>Kullanım Şekli</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {[['🍽️', 'Aç karnına'], ['🍴', 'Tok karnına'], ['🌅', 'Sabah'], ['☀️', 'Öğlen'], ['🌙', 'Akşam']].map(([icon, label]) => (
            <TouchableOpacity key={label} style={[styles.option, { width: '30%' }, instruction === label && styles.optionActive]} onPress={() => setInstruction(label)}>
              <Text style={{ fontSize: 18 }}>{icon}</Text>
              <Text style={{ ...typography.body, color: instruction === label ? '#FFF' : colors.text, textAlign: 'center' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Saatler</Text>
        {times.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={t} onChangeText={(v) => updateTime(i, v)} placeholder="09:00" />
            <TouchableOpacity onPress={() => removeTime(i)} style={{ padding: spacing.sm }}><Text style={{ fontSize: 20, color: colors.danger }}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={addTime} style={{ paddingVertical: spacing.sm }}><Text style={{ ...typography.body, color: colors.primary, fontWeight: '600' }}>+ Saat Ekle</Text></TouchableOpacity>

        <Text style={styles.label}>Kullanım Amacı (isteğe bağlı, 80 karakter)</Text>
        <TextInput style={styles.input} value={purpose} onChangeText={(v) => v.length <= 80 && setPurpose(v)} placeholder="Örnek: Tansiyon için, kalp ilacı" />
        <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'right', marginTop: -8, marginBottom: spacing.md }}>{purpose.length}/80</Text>

        <Text style={styles.label}>Kutudaki Toplam Adet (isteğe bağlı)</Text>
        <TextInput style={styles.input} value={stockTotal} onChangeText={(v) => setStockTotal(v.replace(/[^0-9]/g, ''))} placeholder="Örn: 100" keyboardType="numeric" />
        <Text style={styles.label}>Her kullanımda düşülecek adet</Text>
        <TextInput style={styles.input} value={unitsPerDose} onChangeText={(v) => setUnitsPerDose(v.replace(/[^0-9.]/g, ''))} placeholder="Örn: 1" keyboardType="decimal-pad" />
        <Text style={styles.label}>Bitiş Tarihi (isteğe bağlı)</Text>
        <TextInput style={styles.input} value={endDate} onChangeText={(v) => setEndDate(v.replace(/[^0-9.]/g, ''))} placeholder="GG.AA.YYYY" keyboardType="numeric" maxLength={10} />

        <Button title={saving ? 'Kaydediliyor...' : 'Kaydet'} onPress={save} disabled={saving} style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }} />
      </ScrollView>
      <View style={{ paddingBottom: insets.bottom }} />
    </KeyboardAvoidingView>
  );
}
const baseStyles = StyleSheet.create({
  scanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 20, marginBottom: spacing.lg, borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed' },
  label: { ...typography.body, color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  option: { flex: 1, paddingVertical: 14, borderRadius: borderRadius.input, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
