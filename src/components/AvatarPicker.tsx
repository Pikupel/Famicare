import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';

const AVATARS = [
  { id: 'elderly_woman', emoji: '👵', label: 'Teyze' },
  { id: 'elderly_man', emoji: '👴', label: 'Amca' },
  { id: 'elderly_hijabi', emoji: '🧕', label: 'Başörtülü Teyze' },
  { id: 'woman', emoji: '👩', label: 'Kadın' },
  { id: 'man', emoji: '👨', label: 'Erkek' },
  { id: 'young_woman', emoji: '👧', label: 'Genç Kız' },
  { id: 'young_man', emoji: '👦', label: 'Genç Erkek' },
  { id: 'girl', emoji: '👶', label: 'Bebek' },
  { id: 'doctor', emoji: '👨‍⚕️', label: 'Doktor' },
];

interface AvatarPickerProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function AvatarPicker({ selected, onSelect }: AvatarPickerProps) {
  return (
    <View style={styles.grid}>
      {AVATARS.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={[styles.item, selected === a.id && styles.selected]}
          onPress={() => onSelect(a.id)}
        >
          <Text style={styles.emoji}>{a.emoji}</Text>
          <Text style={[styles.label, selected === a.id && styles.labelSelected]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  item: { alignItems: 'center', padding: 12, borderRadius: borderRadius.card, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, width: '30%', minHeight: 80 },
  selected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  emoji: { fontSize: 32, marginBottom: 4 },
  label: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  labelSelected: { color: colors.primary, fontWeight: '600' },
});
