import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius, shadow } from '../src/theme/spacing';
import { useSubscriptionStore } from '../src/stores/useSubscriptionStore';
import { getOfferings, purchasePackage, restorePurchases } from '../src/services/purchases';
import { PurchasesPackage } from 'react-native-purchases';

interface Plan {
  title: string;
  sub: string;
  key: 'monthly' | 'annual' | 'lifetime';
  emoji: string;
}

const PLANS: Plan[] = [
  { title: 'Aylık', sub: 'Her ay yenilenir', key: 'monthly', emoji: '📅' },
  { title: 'Yıllık', sub: 'Yılda bir yenilenir — en popüler', key: 'annual', emoji: '⭐' },
  { title: 'Ömür Boyu', sub: 'Tek seferlik, süresiz erişim', key: 'lifetime', emoji: '♾️' },
];

export default function SubscribeScreen() {
  const router = useRouter();
  const setSubscribed = useSubscriptionStore((s) => s.setSubscribed);
  const [offerings, setOfferings] = useState<Awaited<ReturnType<typeof getOfferings>>>({ monthly: null, annual: null, lifetime: null });
  const [selected, setSelected] = useState<'monthly' | 'annual' | 'lifetime'>('annual');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    getOfferings().then(setOfferings).finally(() => setLoading(false));
  }, []);

  const selectedPackage = offerings[selected];

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    setPurchasing(true);
    const success = await purchasePackage(selectedPackage);
    if (success) {
      setSubscribed(true, selectedPackage.product.identifier, null);
      Alert.alert('Hoş geldiniz!', 'Premium özellikleriniz aktif edildi.', [
        { text: 'Başla', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('İptal edildi', 'Satın alma tamamlanmadı.');
    }
    setPurchasing(false);
  };

  const handleRestore = async () => {
    setPurchasing(true);
    const restored = await restorePurchases();
    if (restored) {
      setSubscribed(true);
      Alert.alert('Geri yüklendi', 'Aboneliğiniz geri yüklendi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Bulunamadı', 'Aktif abonelik bulunamadı.');
    }
    setPurchasing(false);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Premium'a Geç</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🌟</Text>
          <Text style={{ ...typography.h1, color: colors.text, textAlign: 'center' }}>Tüm özelliklere erişin</Text>
        </View>

        <View style={[styles.features, shadow.card]}>
          {[
            { icon: '📅', label: 'Randevu takibi ve hatırlatmaları' },
            { icon: '❤️', label: 'Sağlık günlüğü — tansiyon, şeker, kilo' },
            { icon: '📊', label: 'Detaylı uyum raporları (PDF)' },
            { icon: '🚫', label: 'Reklamsız deneyim' },
          ].map((f, i) => (
            <View key={i} style={[styles.feature, i === 3 && { borderBottomWidth: 0 }]}>
              <Text style={{ fontSize: 20, marginRight: spacing.md }}>{f.icon}</Text>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{f.label}</Text>
              <Text style={{ fontSize: 18 }}>✅</Text>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          {PLANS.map((plan) => {
            const pkg = offerings[plan.key] as PurchasesPackage | null;
            return (
              <TouchableOpacity
                key={plan.key}
                style={[styles.planCard, selected === plan.key && styles.planSelected]}
                onPress={() => setSelected(plan.key)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.h3, color: colors.text }}>
                    {plan.emoji} {plan.title}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                    {plan.sub}
                  </Text>
                </View>
                <Text style={{ ...typography.h2, color: selected === plan.key ? colors.primary : colors.text }}>
                  {pkg?.product?.priceString ?? '—'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.buyBtn, purchasing && { opacity: 0.6 }]}
          onPress={handlePurchase}
          disabled={purchasing || !selectedPackage}
        >
          <Text style={{ ...typography.h2, color: '#FFFFFF' }}>
            {purchasing ? 'İşleniyor...' : 'Abone Ol'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={purchasing}>
          <Text style={{ ...typography.body, color: colors.primary }}>Satın almaları geri yükle</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Abonelik, onaylandıktan sonra hesabınıza yansıtılır. Mevcut dönem bitiminden 24 saat önce iptal edilmediği sürece otomatik yenilenir. Aboneliklerinizi App Store veya Google Play hesap ayarlarından yönetebilirsiniz.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  back: { minHeight: 48, justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.text },
  content: { flex: 1, padding: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  features: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 4, marginBottom: spacing.lg },
  feature: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  plans: { gap: spacing.sm, marginBottom: spacing.lg },
  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, borderWidth: 2, borderColor: 'transparent' },
  planSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  buyBtn: { backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: spacing.md },
  restoreBtn: { alignItems: 'center', padding: 14, minHeight: 48, justifyContent: 'center' },
  disclaimer: { ...typography.small, color: colors.textLight, textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.xxl, lineHeight: 20 },
});
