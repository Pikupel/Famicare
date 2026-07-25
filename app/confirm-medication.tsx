import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { api } from '../src/services/api';

export default function ConfirmMedicationScreen() {
  const router = useRouter();
  const { id, name, dosage, purpose, time } = useLocalSearchParams();
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [confirmed, setConfirmed] = useState<'taken' | 'postponed' | null>(null);

  const handleAction = async (action: 'taken' | 'postponed') => {
    setConfirmed(action);
    const timer = setTimeout(async () => {
      try {
        await api.post(`/medications/${id}/log`, { status: action, confirmedBy: 'elderly' });
        Alert.alert(action === 'taken' ? '✅ Kaydedildi' : '⏰ Ertelendi', action === 'taken' ? 'İlaç alındı olarak işaretlendi.' : '15 dk sonra tekrar hatırlatılacak.');
        router.back();
      } catch { Alert.alert('Hata', 'Kaydedilemedi'); }
      setConfirmed(null);
    }, 5000);
    setUndoTimer(timer);
  };

  const handleUndo = () => {
    if (undoTimer) clearTimeout(undoTimer);
    setConfirmed(null);
    setUndoTimer(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
          <Text style={{ fontSize: 64, marginBottom: spacing.lg }}>💊</Text>
          <Text style={{ ...typography.h1, color: colors.text, textAlign: 'center' }}>{String(name || 'İlaç')}</Text>
          <Text style={{ ...typography.h3, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>{String(dosage || '')}</Text>
          <Text style={{ ...typography.h2, color: colors.primary, textAlign: 'center', marginTop: spacing.md }}>⏰ {String(time || '')}</Text>
          {purpose ? <Text style={{ ...typography.body, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' }}>💊 {String(purpose)}</Text> : null}
        </View>

        {confirmed ? (
          <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
            <Text style={{ ...typography.button, color: '#FFFFFF' }}>↩ GERİ AL (5sn)</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.takenBtn} onPress={() => handleAction('taken')}>
              <Text style={{ ...typography.h2, color: '#FFFFFF' }}>✅ ALDIM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.postponeBtn} onPress={() => handleAction('postponed')}>
              <Text style={{ ...typography.button, color: colors.text }}>⏰ HENÜZ ALMADIM</Text>
            </TouchableOpacity>
          </>
        )}

        {!confirmed && (
          <TouchableOpacity style={{ marginTop: spacing.lg, alignItems: 'center', minHeight: 48, justifyContent: 'center' }} onPress={() => router.back()}>
            <Text style={{ ...typography.body, color: colors.textLight }}>Kapat</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  takenBtn: { height: 64, borderRadius: 16, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, shadowColor: colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  postponeBtn: { height: 56, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  undoBtn: { height: 56, borderRadius: 16, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' },
});
