import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { useAuthStore } from '../src/stores/useAuthStore';
import { useThemedStyles } from '../src/theme/ThemeProvider';

const getProfiles = () => [
  { id: 'self', icon: '🙋', label: 'Kendim', desc: 'Kendi sağlığımı takip et', role: 'elderly' as const, color: colors.primary },
  { id: 'child', icon: '🧒', label: 'Çocuğum', desc: 'Çocuğumun ilaçlarını yönet', role: 'caregiver' as const, color: colors.secondary },
  { id: 'mother', icon: '👩‍🦳', label: 'Annem', desc: 'Annemin sağlığını takip et', role: 'caregiver' as const, color: colors.tertiary },
  { id: 'father', icon: '👨‍🦳', label: 'Babam', desc: 'Babamın ilaçlarını yönet', role: 'caregiver' as const, color: colors.primaryLight },
  { id: 'spouse', icon: '💕', label: 'Eşim', desc: 'Eşimin tedavisini yönet', role: 'caregiver' as const, color: colors.secondaryContainer },
  { id: 'other', icon: '🤝', label: 'Yakınım', desc: 'Bir yakınım için kurulum', role: 'caregiver' as const, color: colors.surfaceVariant },
];

export default function WelcomeScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const setRole = useAuthStore((s) => s.setRole);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
        <Text style={{ ...typography.h1, color: colors.primary, marginBottom: spacing.sm }}>Famicare</Text>
        <Text style={{ ...typography.h3, color: colors.textSecondary, textAlign: 'center', lineHeight: 28 }}>Sevdikleriniz güvende,{'\n'}siz içiniz rahat.</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm }}>
        {getProfiles().map((p) => (
          <TouchableOpacity key={p.id} style={[styles.card, { borderColor: p.color + '40' }]} onPress={() => { setRole(p.role); router.push('/login'); }}>
            <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>{p.icon}</Text>
            <Text style={{ ...typography.body, fontWeight: '600', color: colors.text, textAlign: 'center' }}>{p.label}</Text>
            <Text style={{ ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: 4 }}>{p.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={{ marginTop: spacing.xl, alignItems: 'center', minHeight: 48, justifyContent: 'center' }} onPress={() => router.push('/login?existing=1')}>
        <Text style={{ ...typography.body, color: colors.primary, fontWeight: '600' }}>🔑 Zaten kayıtlıyım</Text>
        <Text style={{ ...typography.small, color: colors.textLight, marginTop: 2 }}>Telefon + PIN ile giriş yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  card: { width: '48%', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 20, alignItems: 'center', borderWidth: 1.5, minHeight: 140, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
});
