import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';

const FAQS = [
  { q: 'İlaç nasıl eklenir?', a: 'Ana sayfada "İlaç Ekle" butonuna dokunun. İlaç adı, doz ve saat bilgilerini girin. Bakıcıysanız, yakınınızın profiline gidip "İlaç Ekle"yi kullanabilirsiniz.' },
  { q: 'İlaç alındığı nasıl işaretlenir?', a: 'Ana sayfadaki ilaç satırına dokunun. 5 saniye içinde "Geri Al" diyerek işlemi geri alabilirsiniz.' },
  { q: 'Bakıcı nasıl bağlanır?', a: 'Bakıcı, profilinizdeki davet kodunu size verir. Siz de "Yakınına Bağlan" bölümünde bu 8 haneli kodu girerek bağlanırsınız.' },
  { q: 'İlaç saatini kaçırırsam ne olur?', a: '30 dakika içinde almadıysanız uyarı alırsınız. 10 ve 30 dakika sonra tekrar hatırlatılır. Bakıcınız da bilgilendirilir.' },
  { q: 'SOS butonu ne işe yarar?', a: 'Acil durumda kırmızı 🆘 butonuna basın. Yakınınıza bildirim gönderilir.' },
  { q: 'PIN kodu nedir?', a: 'Hızlı giriş için belirleyebileceğiniz 4 haneli koddur. İsteğe bağlıdır, "Daha sonra" diyerek atlayabilirsiniz.' },
  { q: 'Verilerim güvende mi?', a: 'Tüm verileriniz şifrelenir ve yalnızca sizin ve bağlı yakınınızın erişimine açıktır. İstediğiniz zaman bağlantıyı kaldırabilirsiniz.' },
];

export default function HelpScreen() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ fontSize: 28, color: colors.text }}>←</Text></TouchableOpacity>
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>Yardım</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }}>
        {FAQS.map((faq, i) => (
          <TouchableOpacity key={i} style={styles.faqItem} onPress={() => setOpenIndex(openIndex === i ? null : i)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ ...typography.body, color: colors.text, fontWeight: '600', flex: 1 }}>{faq.q}</Text>
              <Text style={{ fontSize: 20, color: colors.textLight }}>{openIndex === i ? '−' : '+'}</Text>
            </View>
            {openIndex === i && <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }}>{faq.a}</Text>}
          </TouchableOpacity>
        ))}

        <View style={styles.contactCard}>
          <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.sm }}>İletişim</Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm }}>Sorun yaşıyorsanız bize ulaşın:</Text>
          <TouchableOpacity style={{ minHeight: 48, justifyContent: 'center' }} onPress={() => Linking.openURL('mailto:destek@famicare.app')}>
            <Text style={{ ...typography.body, color: colors.primary, fontWeight: '600' }}>📧 destek@famicare.app</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  faqItem: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, marginBottom: spacing.sm },
  contactCard: { backgroundColor: colors.surface, borderRadius: borderRadius.card, padding: 16, marginTop: spacing.lg, marginBottom: spacing.xxl, alignItems: 'center' },
});
