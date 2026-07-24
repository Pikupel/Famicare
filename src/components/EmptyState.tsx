import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { typography } from '../theme/typography';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  icon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
  title: { ...typography.h3, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs },
  description: { ...typography.body, color: colors.textLight, textAlign: 'center', lineHeight: 24, marginBottom: spacing.lg },
  button: { backgroundColor: colors.primary, borderRadius: borderRadius.button, paddingHorizontal: 24, paddingVertical: 14, minHeight: 48, justifyContent: 'center' },
  buttonText: { ...typography.button, color: '#FFFFFF' },
});
