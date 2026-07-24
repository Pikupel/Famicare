import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    api.get<any[]>('/emergency-contacts').then(setContacts).catch(() => {});
  }, []));

  const add = async () => {
    if (!name.trim() || !phone.trim()) { Alert.alert('Uyarı', 'İsim ve telefon gerekli'); return; }
    setSaving(true);
    try {
      await api.post('/emergency-contacts', { name: name.trim(), phone: phone.trim() });
      setName(''); setPhone(''); setShowForm(false);
      const data = await api.get<any[]>('/emergency-contacts');
      setContacts(data);
    } catch (e: any) { Alert.alert('Hata', e.message); }
    finally { setSaving(false); }
  };

  const remove = (id: string) => {
    Alert.alert('Sil', 'Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        await api.del(`/emergency-contacts/${id}`);
        setContacts(prev => prev.filter(c => c.id !== id));
      }},
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Acil Durum Kişileri</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        {contacts.length === 0 && !showForm && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Text style={{ fontSize: 48, marginBottom: spacing.md, opacity: 0.5 }}>🆘</Text>
            <Text style={{ ...typography.body, color: colors.textLight, textAlign: 'center' }}>Henüz acil durum kişisi eklenmemiş</Text>
          </View>
        )}
        {contacts.map((c: any) => (
            <View key={c.id} style={styles.card}>
            <TouchableOpacity style={{ flexDirection: 'row', flex: 1, alignItems: 'center', minHeight: 48 }} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
              <View style={styles.avatar}><Text style={{ ...typography.h3, color: colors.primary }}>{c.name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.text, fontWeight: '600' }}>{c.name}</Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>{c.phone}</Text>
              </View>
              <Text style={{ fontSize: 18, color: colors.primary, fontWeight: '600' }}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(c.id)} style={{ padding: spacing.sm, minHeight: 48, justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, color: colors.danger }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {showForm ? (
          <View style={{ marginTop: spacing.md }}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ad Soyad" />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+90 532 XXX XX XX" keyboardType="phone-pad" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Kaydet" onPress={add} disabled={saving} style={{ flex: 1 }} />
              <Button title="İptal" variant="outline" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Button title="+ Acil Durum Kişisi Ekle" onPress={() => setShowForm(true)} style={{ marginTop: spacing.md }} />
        )}
      </ScrollView>
      <View style={{ paddingBottom: insets.bottom }} />
    </View>
  );
}
const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 14, marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight + '30', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
});
