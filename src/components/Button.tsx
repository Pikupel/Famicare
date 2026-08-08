import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { borderRadius, shadow } from '../theme/spacing';
import { useThemedStyles } from '../theme/ThemeProvider';

interface Props { title: string; onPress: () => void; variant?: 'primary' | 'outline'; style?: ViewStyle; disabled?: boolean; accessibilityLabel?: string; }
export function Button({ title, onPress, variant = 'primary', style, disabled, accessibilityLabel }: Props) {
  const styles = useThemedStyles(baseStyles);
  return (
    <TouchableOpacity
      style={[styles.base, variant === 'primary' ? styles.primary : styles.outline, disabled && styles.disabled, style]}
      onPress={onPress} disabled={disabled} activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
    >
      <Text style={[styles.text, { color: variant === 'primary' ? colors.onPrimary : colors.primary }]}>{title}</Text>
    </TouchableOpacity>
  );
}
const baseStyles = StyleSheet.create({
  base: { height: 56, borderRadius: borderRadius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primary: { backgroundColor: colors.primary, ...shadow.button },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  text: { ...typography.button },
});
