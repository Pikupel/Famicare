import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';

const AVATARS = [
  { id: 'elderly_woman', emoji: '👵' },
  { id: 'elderly_man', emoji: '👴' },
  { id: 'elderly_hijabi', emoji: '🧕' },
  { id: 'woman', emoji: '👩' },
  { id: 'man', emoji: '👨' },
  { id: 'young_woman', emoji: '👧' },
  { id: 'young_man', emoji: '👦' },
  { id: 'girl', emoji: '👶' },
  { id: 'doctor', emoji: '👨‍⚕️' },
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
          <Text style={{ fontSize: 32 }}>{a.emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  item: { alignItems: 'center', padding: 8, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, width: '20%' },
  selected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
});
