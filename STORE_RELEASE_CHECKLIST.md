# Famicare mağaza yayın kontrol listesi

## Production ortamı

- [ ] `DATABASE_URL`, `JWT_SECRET`, admin değişkenleri ve `CORS_ORIGINS` tanımlandı.
- [ ] `SMS_WEBHOOK_URL` ve gerekiyorsa `SMS_WEBHOOK_TOKEN` tanımlandı; gerçek doğrulama SMS’i alındı.
- [ ] APK testi sırasında gerekirse `ALLOW_UNVERIFIED_REGISTRATION=true` kullanıldı; mağaza/production yayını öncesinde değişken silindi veya `false` yapıldı.
- [ ] EAS production buildine `EXPO_PUBLIC_API_URL` verildi.
- [ ] `api/db.json` yalnızca son committen değil Git geçmişinden de kaldırıldı.
- [ ] Eski repository geçmişinde görünen kullanıcı verileri için gerekli PIN/oturum sıfırlama ve bildirim değerlendirmesi yapıldı.

## Hazır teknik bağlantılar

- Gizlilik politikası: `https://famicare-production-f63d.up.railway.app/privacy`
- Web hesap silme: `https://famicare-production-f63d.up.railway.app/delete-account`
- Destek e-postası: `destek@famicare.app` — yayın öncesi gerçekten çalıştığı doğrulanmalı veya değiştirilmelidir.
- Android paket adı: `com.famicare.app`
- iOS Bundle ID: `com.famicare.app`

## APK testi

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

## Mağaza buildleri

```powershell
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

Production build numarası EAS tarafından otomatik artırılır.

## Google Play Console

- Uygulama türü: Uygulama
- Kategori: Sağlık ve Fitness / Medical uygunluğu geliştirici tarafından seçilmeli
- Health Apps beyanı tamamlanmalı
- Data Safety formu doldurulmalı
- Hesap silme URL’si girilmeli
- Gizlilik politikası URL’si girilmeli
- `SCHEDULE_EXACT_ALARM` kullanım amacı ilaç hatırlatmaları olarak açıklanmalı
- İç test ve kapalı test tamamlanmalı
- Production için AAB kullanılmalı

## Apple App Store Connect

- Gizlilik politikası URL’si girilmeli
- App Privacy veri türleri beyan edilmeli
- TestFlight testi tamamlanmalı
- İnceleme notlarında ilaç hatırlatma, yakın bağlantısı ve hesap silme yolu açıklanmalı
- Production için iOS store build kullanılmalı

## Beyan edilmesi muhtemel veri türleri

- Ad ve telefon numarası: hesap ve uygulama işlevi
- Kullanıcı kimliği ve rolü: hesap ve yetkilendirme
- Sağlık ölçümleri: uygulama işlevi
- İlaç, doz ve kullanım kayıtları: uygulama işlevi
- Randevu bilgileri: uygulama işlevi
- Acil durum kişileri: kullanıcı tarafından seçilen uygulama işlevi
- Bildirim cihaz anahtarı: bildirim gönderme
- Tanılama/güvenlik kayıtları: güvenlik ve kötüye kullanım önleme

Uygulama reklam veya kullanıcı takibi yapmıyor. Mağaza formlarındaki cevaplar yayınlanan sürüm ve kullanılan tüm üçüncü taraf hizmetlerle karşılaştırılarak geliştirici tarafından onaylanmalıdır.

## Yayın öncesi gerçek cihaz testleri

- Android uygulama kapalıyken ilaç bildirimi
- Telefon yeniden başlatıldıktan sonra hatırlatmalar
- Bildirim izni reddedildiğinde uygulama davranışı
- Saat dilimi ve yaz/kış saati
- İlaç alındı/alınmadı ve yakın bildirimi
- Kullanıcı ve profil kalıcı silme
- Web hesap silme
- Çevrimdışı ve zayıf bağlantı
- Acil durum bildirimi
- Rapor/PDF oluşturma ve paylaşma

## Kullanıcı tarafından sağlanması gerekenler

- Apple Developer Program hesabı
- Google Play Console hesabı
- Doğrulanmış geliştirici adı/şirket unvanı
- Geçerli destek e-postası ve destek URL’si
- KVKK aydınlatma/açık rıza metninin hukuk danışmanı tarafından onayı
- Mağaza açıklaması, ekran görüntüleri, yaş derecelendirmesi ve kategori kararları
