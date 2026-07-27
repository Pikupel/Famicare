import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

interface DrugResult {
  id: string;
  ilac_adi: string;
  barkod: string;
  recete_turu: string;
  firma_adi: string;
  atc_kodu?: string;
  atc_adi?: string;
  ingredientStatus?: 'verified' | 'atc_candidate' | 'unmapped';
  ingredients?: Array<{ name: string; amount?: string; unit?: string }>;
}

interface DrugSearchProps {
  onSelect: (drug: DrugResult) => void;
  placeholder?: string;
}

export function DrugSearch({ onSelect, placeholder }: DrugSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DrugResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = async (q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<DrugResult[]>(`/drugs/search?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  };

  const handleSelect = (drug: DrugResult) => {
    setSelected(drug);
    setQuery(drug.ilac_adi);
    setResults([]);
    onSelect(drug);
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={search}
        placeholder={placeholder || 'İlaç adı yazmaya başlayın...'}
        placeholderTextColor={colors.textLight}
      />
      {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.xs }} />}
      {results.length > 0 && (
        <ScrollView style={styles.list} nestedScrollEnabled>
          {results.map((item) => (
            <TouchableOpacity key={item.barkod} style={styles.item} onPress={() => handleSelect(item)}>
              <Text style={{ ...typography.body, color: colors.text, fontWeight: '500' }}>{item.ilac_adi}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 2 }}>
                {item.recete_turu === 'Mor' && <Text style={styles.morBadge}>🔮 Mor Reçete</Text>}
                {item.recete_turu === 'Kırmızı' && <Text style={styles.kirmiziBadge}>🔴 Kırmızı Reçete</Text>}
                <Text style={{ ...typography.small, color: colors.textLight }}>{item.firma_adi}</Text>
              </View>
              <Text style={{ ...typography.small, color: colors.textLight, marginTop: 3 }}>
                {item.atc_adi ? `ATC: ${item.atc_adi}` : 'Etkin madde bilgisi henüz eşleştirilmedi'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 48 },
  list: { maxHeight: 200, backgroundColor: colors.surface, borderRadius: borderRadius.input, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  morBadge: { fontSize: 11, color: '#7C3AED', fontWeight: '600', backgroundColor: '#F3E8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  kirmiziBadge: { fontSize: 11, color: colors.danger, fontWeight: '600', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
