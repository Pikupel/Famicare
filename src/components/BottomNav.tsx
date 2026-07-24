import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/useAuthStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface NavItem {
  label: string;
  icon: string;
  route?: string;
}

interface BottomNavProps {
  items: NavItem[];
  activeIndex: number;
}

export function BottomNav({ items, activeIndex }: BottomNavProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);

  const handlePress = (item: NavItem) => {
    if (!item.route) return;
    const route = item.route.replace('{role}', role || 'elderly');
    router.replace(route);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      {items.map((item, i) => (
        <TouchableOpacity
          key={item.label}
          style={styles.item}
          onPress={() => handlePress(item)}
          activeOpacity={0.6}
        >
          <Text style={[styles.icon, { color: i === activeIndex ? colors.primary : colors.gray }]}>
            {item.icon}
          </Text>
          <Text style={[styles.label, { color: i === activeIndex ? colors.primary : colors.gray, fontWeight: i === activeIndex ? '700' : '500' }]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: colors.surface, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
  icon: { fontSize: 22, marginBottom: 2 },
  label: { fontSize: 12, marginTop: 2 },
});
