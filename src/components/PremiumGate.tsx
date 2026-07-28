import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../stores/useSubscriptionStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadow } from '../theme/spacing';

interface PremiumGateProps {
  children: React.ReactNode;
  featureName?: string;
}

export function PremiumGate({ children, featureName }: PremiumGateProps) {
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);
  const router = useRouter();

  if (isSubscribed) return <>{children}</>;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🌟</Text>
        <Text style={{ ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm }}>
          Premium Özellik
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }}>
          {featureName || 'Bu özellik'} premium üyelik gerektirir.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/subscribe')}>
          <Text style={{ ...typography.button, color: '#FFFFFF' }}>Premium'a Geç</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={{ ...typography.body, color: colors.textLight }}>← Geri</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 32, alignItems: 'center', width: '100%', maxWidth: 360, ...shadow.card },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', width: '100%', marginBottom: spacing.md },
  back: { padding: 12, minHeight: 44, justifyContent: 'center' },
});
