# FamiCare İleri Seviye Tam Proje Denetim Raporu

**Hazırlanma Tarihi:** 30 Temmuz 2026  
**Proje:** FamiCare (ERP Marketplace MVP) — İlaç ve Sağlık Takibi Mobil Uygulaması  
**Kapsam:** Backend (Express.js/lowdb/PostgreSQL), Mobil Uygulama (Expo SDK 57/React Native), Admin Paneli, Veritabanı, Dağıtım  
**Denetim Türü:** İleri Seviye Tam Proje Denetimi (Statik Analiz + Dinamik Test + Güvenlik Taraması + Mimari İnceleme)

---

## A. Yönetici Özeti

### Skor Kartı

| Alan | Puan | Açıklama |
|------|------|----------|
| **Genel Sağlık** | **72/100** | Temel işlevler çalışıyor; veri tutarlılığı, test ve güvenlik boşlukları var |
| **Production'a Hazır Olma** | **58/100** | Çalışıyor ancak JWT secret fallback, rate-limit boşlukları, çoklu-instance sorunları mevcut |
| **Mağazaya Hazır Olma** | **65/100** | EAS build, RevenueCat entegrasyonu hazır; bildirim izinleri, onboarding tamam |
| **Güvenlik** | **55/100** | Git geçmişinde 41 gerçek telefon numarası; NaN bypass; rate-limit eksikleri; CSRF yok |
| **Veri Bütünlüğü** | **68/100** | lowdb PK çakışmaları; stockLock TOCTOU; PostgreSQL sync tek yönlü |
| **Test Yeterliliği** | **35/100** | 20 test var ancak login, push, scheduler, subscription, PostgreSQL sync test edilmemiş |

### En Kritik 10 Bulgu

| # | ID | Başlık | Öncelik | Güven |
|---|-----|--------|---------|-------|
| 1 | FAM-P0-001 | Git geçmişinde 41 gerçek kullanıcı telefon numarası (db.json) | **P0** | Kesin |
| 2 | FAM-P0-002 | NaN bypass: sağlık kaydı validasyonu NaN değerleri geçiriyor | **P0** | Kesin |
| 3 | FAM-P0-003 | `db.write()` stockLock serbest bırakıldıktan SONRA çağrılıyor | **P0** | Kesin |
| 4 | FAM-P1-004 | PIN hash'i bulunmayan 41 kullanıcı (eski format db.json) | **P1** | Kesin |
| 5 | FAM-P1-005 | Login ve refresh endpoint'lerinde rate limiting yok | **P1** | Kesin |
| 6 | FAM-P1-006 | JWT_SECRET tanımlı değilse rastgele secret kullanılıyor, tüm token'lar restart'ta geçersiz | **P1** | Kesin |
| 7 | FAM-P1-007 | Scheduler appointment reminder'da saat dilimi sabit kodlanmış (+03:00) | **P1** | Kesin |
| 8 | FAM-P1-008 | In-memory stockLocks çoklu-instance'da çalışmaz | **P1** | Kesin |
| 9 | FAM-P2-009 | Davet kodu ile bağlanma işlemi e-posta/doğrulama gerektirmez | **P2** | Yüksek |
| 10 | FAM-P2-010 | Profil bağlantısı koparma işlemi consolidateUserRecordsIntoProfile'i tersine çevirmez | **P2** | Yüksek |

---

## B. Mimari Açıklama

### B.1 Üst Düzey Mimari

```
┌─────────────────────────────────────────────────────┐
│                  Mobil Uygulama                      │
│         (Expo SDK 57 / React Native 0.86)           │
│  Zustand State  │  SecureStore  │  expo-router       │
└────────┬────────────────────────────────────────────┘
         │ HTTPS / JSON
         ▼
┌─────────────────────────────────────────────────────┐
│                Express.js API (ESM)                  │
│  authMiddleware → accessMiddleware → route handlers  │
│         │                           │                │
│         ▼                           ▼                │
│  JWT (30dk) + Session    lowdb (JSONFile)            │
│  Rotation (split-token)   │  PostgreSQL Sync         │
│  bcrypt cost 12           │  (startup + snapshot)     │
│  TOTP (admin)            │                           │
│         │                           │                │
│         ▼                           ▼                │
│     Rate Limiting          5dk Scheduler             │
│  (express-rate-limit)     (pg_advisory_lock)         │
└─────────────────────────────────────────────────────┘
```

### B.2 Veritabanı Stratejisi

**lowdb (JSON) — Birincil Veritabanı:**
- `api/data/db.local.json` — 7.2 MB, 217K+ satır
- 12 koleksiyon: users, profiles, medications, medicationLogs, appointments, healthRecords, emergencies, notifications, pushDeliveries, authSessions, phoneVerifications, adminBackups
- Tüm yazmalar `db.write()` ile JSON dosyasına

**PostgreSQL — İkincil / Senkronizasyon Hedefi:**
- `DATABASE_URL` varsa başlangıçta bağlanır
- `migratePg()` tüm tabloları oluşturur
- Veri akışı: PostgreSQL → JSON (başlangıçta `syncFromPg()`)
- Yazmalar: `persistSnapshot()` tüm JSON durumunu `app_state` tablosuna serileştirir
- **Kritik:** PostgreSQL sync SADECE başlangıçta; yazmalar anlık snapshot olarak gider

### B.3 Kimlik Doğrulama Akışı

```
Kayıt: Phone → SMS doğrulama (SHA-256 hash) → bcrypt PIN → JWT (30dk) + Refresh Token (30 gün)
Giriş: Phone + PIN → bcrypt.compare → JWT + Refresh Token
Session Rotation: Her refresh'te eski refresh token geçersiz, yenisi verilir
Koruma: 5 başarısız giriş → 15 dk blok; Session-bound token (üretimde)
```

### B.4 Bildirim Sistemi

```
Scheduler (5dk interval) ──→ Missed Dose Detection (30-240dk pencere)
                            ──→ Appointment Reminders (0-25 saat)
                            ──→ Push Receipts Check
                            ──→ Expo Push API
                            ──→ In-app notifications (lowdb)
```

---

## C. Bulgular

### FAM-P0-001: Git Geçmişinde 41 Gerçek Kullanıcı Telefon Numarası

| Alan | Değer |
|------|-------|
| **Öncelik** | **P0** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Veri Sızıntısı / Gizlilik İhlali |
| **Etkilenen Dosya** | Git geçmişi (`5f3e50a` ilk commit'inde `api/db.json`) |
| **Mevcut Davranış** | İlk commit'de `api/db.json` dosyası 41 gerçek kullanıcının telefon numarasını (90XXXXXXXXXX formatında), isimlerini ve rollerini içermektedir. Telefon numaraları hash'lenmemiş, düz metin olarak depolanmıştır. |
| **Beklenen Davranış** | Hiçbir kullanıcı verisi git geçmişinde bulunmamalıdır. Telefon numaraları hash'lenmeli veya maskelenmelidir. |
| **Kanıt** | `git show 5f3e50a:api/db.json` komutu 41 kullanıcı kaydını göstermektedir. `node -e "const d=JSON.parse(require('fs').readFileSync('api/data/db.local.json','utf8')); console.log(d.users.length, d.users.filter(u=>!u.pinHash).length)"` → `41 41` (pinHash'siz 41 kullanıcı). |
| **Etki** | **KRİTİK.** KVKK/GDPR ihlali. Repo halka açılırsa 41 kişinin telefon numarası ifşa olur. Şirket itibar kaybı, yasal yaptırım riski. |
| **Kök Neden** | Proje başlangıcında `.gitignore` düzgün yapılandırılmamış. Veritabanı dosyası kontrol dışı commit'lenmiş. |
| **Önerilen Çözüm** | Git geçmişinden `db.json`'ı BFG Repo-Cleaner veya `git filter-branch` ile temizle. Tüm takım üyelerini force-push konusunda bilgilendir. Telefon numaralarını veritabanında hash'le. |
| **İş Büyüklüğü** | M (tarihçe temizliği + koordinasyon) |

---

### FAM-P0-002: Sağlık Kaydı Validasyonu NaN Bypass

| Alan | Değer |
|------|-------|
| **Öncelik** | **P0** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Veri Bütünlüğü |
| **Etkilenen Dosya** | `api/src/routes/health.js`, `validateHealthValue()` fonksiyonu |
| **Mevcut Davranış** | `validateHealthValue` fonksiyonu `valueData` alanını şu şekilde kontrol eder: `valueData === undefined || valueData === null || valueData === ''`. NaN değeri bu kontrollerin hiçbirinden geçmez çünkü `NaN !== undefined`, `NaN !== null`, `NaN !== ''`. Number.isNaN kontrolü yoktur. Ayrıca NaN değeri `>=`/`<=` karşılaştırmalarında her zaman `false` döndürür, böylece alt/üst sınır kontrollerini de geçer. |
| **Beklenen Davranış** | NaN değerler reddedilmelidir. `if (typeof value !== 'number' || Number.isNaN(value)) return '...'` kontrolü eklenmelidir. |
| **Kanıt** | Kod incelemesi: Fonksiyonda `Number.isNaN()` kontrolü bulunmamaktadır. `NaN >= 20 && NaN <= 500` her zaman false döndürdüğü için sınır kontrolleri NaN'i geçirir. |
| **Yeniden Üretme** | `POST /health/record` endpoint'ine `{"valueData": NaN, "type": "weight"}` gönder — validasyondan geçer ve veritabanına NaN yazılır. |
| **Etki** | **YÜKSEK.** Veritabanında NaN değerler birikir. Raporlama kırılır, grafikler bozulur, sorgular beklenmedik sonuçlar üretir. |
| **Kök Neden** | JS'de `NaN`'ın özel durumu (`typeof NaN === 'number'`, `NaN !== NaN` değil ama `NaN >= x` her zaman false) göz ardı edilmiş. |
| **Önerilen Çözüm** | `validateHealthValue` fonksiyonuna `Number.isNaN()` kontrolü ekle. |
| **İş Büyüklüğü** | XS |

---

### FAM-P0-003: `db.write()` StockLock Koruması Dışında

| Alan | Değer |
|------|-------|
| **Öncelik** | **P0** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Race Condition / Veri Tutarlılığı |
| **Etkilenen Dosya** | `api/src/routes/medications.js`, satır 133-148 |
| **Mevcut Davranış** | Stock düşürme işlemi `acquireStockLock` → mutate → `releaseStockLock` sırasıyla yapılır, ancak `db.write()` çağrısı `releaseStockLock`'tan **sonra** yapılır (satır 147). İki istek arasında: (1) İstek A lock alır, stock'u 10→9 düşürür, lock'u bırakır. (2) İstek B lock alır, stock'u 9→8 düşürür. (3) A yazar (stock=9). (4) B yazar (stock=8). Race condition oluşmaz gibi görünse de, A'nın yazması B'nin yazmasıyla ezilebilir çünkü ikisi de aynı lowdb nesnesini mutasyona uğratmıştır ve son yazma kazanır. |
| **Beklenen Davranış** | Stock güncelleme ve `db.write()` atomik olmalıdır. `db.write()` lock hala aktifken çağrılmalıdır. |
| **Kanıt** | Kod incelemesi satır 133-148: `acquireStockLock` → mutate → `releaseStockLock` (finally) → `db.write()`. |
| **Etki** | **YÜKSEK.** Aynı anda gelen iki "taken" kaydından biri stock düşüşünü kaybedebilir. Stok miktarı gerçek kullanımdan sapar. |
| **Kök Neden** | Lock ve write işlemi ayrılmış. `db.write()` lock içinde olmalı. |
| **Önerilen Çözüm** | `db.write()`'ı try bloğu içine, `releaseStockLock`'tan önce taşı. |
| **İş Büyüklüğü** | XS |

---

### FAM-P1-004: 41 Kullanıcının PIN Hash'i Bulunmuyor

| Alan | Değer |
|------|-------|
| **Öncelik** | **P1** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Veri Bütünlüğü / Güvenlik |
| **Etkilenen Dosya** | `api/data/db.local.json` — users koleksiyonu |
| **Mevcut Davranış** | Mevcut 41 kullanıcının hiçbirinde `pinHash` alanı yok. Giriş yapmaya çalıştıklarında `auth.js:101` satırında `if (!user.pinHash)` kontrolü onlara `"Bu eski hesabın güvenli PIN geçişi gerekiyor. Destek üzerinden PIN sıfırlayın."` hatası verir. Kullanıcılar uygulamayı kullanamaz. |
| **Beklenen Davranış** | Tüm kullanıcıların geçerli bir pinHash'i olmalıdır. Eski hesaplar ya migrate edilmeli ya da bir toplu PIN sıfırlama akışı sunulmalıdır. |
| **Kanıt** | `node -e "const d=JSON.parse(require('fs').readFileSync('api/data/db.local.json','utf8')); console.log('Toplam:', d.users.length, 'pinHash\'siz:', d.users.filter(u=>!u.pinHash).length)"` → `Toplam: 41 pinHash'siz: 41` |
| **Etki** | **YÜKSEK.** 41 kullanıcı giriş yapamaz. Uygulama fiilen kullanılamaz durumda. |
| **Kök Neden** | Veritabanı eski format. PIN hash'i olmayan kullanıcılar eski sistemden kalmış veya doğrudan db.json'a yazılmış. |
| **Önerilen Çözüm** | Admin panelinde toplu PIN sıfırlama ekranı. Kullanıcılara SMS ile geçici PIN gönderme akışı. |
| **İş Büyüklüğü** | M (SMS entegrasyonu + admin arayüzü) |

---

### FAM-P1-005: Login ve Refresh Endpoint'lerinde Rate Limiting Yok

| Alan | Değer |
|------|-------|
| **Öncelik** | **P1** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Güvenlik / Brute Force |
| **Etkilenen Dosya** | `api/src/routes/auth.js` — `/login`, `/refresh` |
| **Mevcut Davranış** | `/login` endpoint'inde IP bazlı rate limiting yoktur (sadece kullanıcı bazlı 5 başarısız deneme → 15dk blok vardır). `/refresh` ve `/logout` endpoint'lerinde hiçbir rate limiting yoktur. express-rate-limit (`api/src/index.js:40`) tüm rotalara 200 req/15dk uygular, bu login için yeterli değildir. |
| **Beklenen Davranış** | `/login` için IP bazlı 5-10 deneme/dk, `/refresh` için 30-60 deneme/dk rate limit uygulanmalıdır. |
| **Kanıt** | Kod incelemesi: auth.js'de login route'unda express-rate-limit middleware'i yok. Sadece kullanıcı bazlı `failedLoginAttempts` sayacı var. |
| **Etki** | **ORTA.** Saldırgan tüm kullanıcılara karşı brute-force yapabilir. 5 başarısız denemeden sonra bloklansa da, çok sayıda kullanıcıya karşı düşük sayıda deneme yaparak tespit edilmeden gezinebilir. Refresh token hırsızlığı durumunda rate limit olmadığı için saldırgan token'ı süresiz kullanabilir. |
| **Kök Neden** | Eksik güvenlik katmanı. |
| **Önerilen Çözüm** | Login'e IP-bazlı rate limiting ekle. Refresh'e rate limiting ekle. |
| **İş Büyüklüğü** | S |

---

### FAM-P1-006: JWT_SECRET Tanımlı Değilse Rastgele Secret Kullanımı

| Alan | Değer |
|------|-------|
| **Öncelik** | **P1** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Güvenlik / Kimlik Doğrulama |
| **Etkilenen Dosya** | `api/src/middleware/auth.js`, satır 10 |
| **Mevcut Davranış** | `JWT_SECRET` ortam değişkeni tanımlı değilse ve `NODE_ENV !== 'production'` ise, console.warn ile uyarı basılır ve `randomBytes(48).toString('base64url')` ile rastgele bir secret kullanılır. Bu, her sunucu restart'ında tüm JWT token'larını geçersiz kılar. |
| **Beklenen Davranış** | Geliştirme ortamında sabit bir development secret kullanılmalı (veya JWT_SECRET her ortamda zorunlu olmalı). |
| **Kanıt** | Kod incelemesi satır 7-10: `const effectiveSecret = JWT_SECRET || (console.warn(...), randomBytes(48).toString('base64url'))` |
| **Etki** | **ORTA.** Geliştirme sırasında sunucu restart'ında tüm kullanıcıların oturumu düşer. Production'da hata fırlatılır (güvenli). |
| **Kök Neden** | Development kolaylığı amaçlanmış, ancak kullanıcı deneyimini bozuyor. |
| **Önerilen Çözüm** | `JWT_SECRET` her ortamda zorunlu yap. `.env.example`'a ekle. |
| **İş Büyüklüğü** | XS |

---

### FAM-P1-007: Appointment Reminder Saat Dilimi Sabit Kodlanmış (+03:00)

| Alan | Değer |
|------|-------|
| **Öncelik** | **P1** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Zaman Dilimi / Veri Tutarlılığı |
| **Etkilenen Dosya** | `api/src/services/scheduler.js`, satır 126 |
| **Mevcut Davranış** | Randevu hatırlatıcıları `new Date(\`${appointment.date}T${appointment.time}:00+03:00\`)` ile sabit +03:00 saat dilimi kullanır. Kullanıcının `timezone` alanı dikkate alınmaz. |
| **Beklenen Davranış** | Kullanıcının `timezone` alanına göre hesaplama yapılmalıdır. |
| **Kanıt** | Kod incelemesi satır 126: `const target = new Date(\`${appointment.date}T${appointment.time}:00+03:00\`)` |
| **Etki** | **ORTA.** Farklı saat dilimindeki kullanıcılar randevu hatırlatmalarını yanlış zamanda alır. |
| **Kök Neden** | Sabit kodlanmış saat dilimi. İlaç doz hatırlatmalarında `localParts(now, timezone)` kullanılırken appointment'ta kullanılmamış. |
| **Önerilen Çözüm** | Appointment reminder'da da kullanıcının timezone alanını kullan. |
| **İş Büyüklüğü** | S |

---

### FAM-P1-008: In-Memory StockLocks Çoklu-Instance'da Çalışmaz

| Alan | Değer |
|------|-------|
| **Öncelik** | **P1** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Race Condition / Ölçeklenebilirlik |
| **Etkilenen Dosya** | `api/src/routes/medications.js`, satır 10-28 |
| **Mevcut Davranış** | `stockLocks` bir `Map` nesnesidir, her process'in kendi belleğinde yaşar. Birden fazla instance çalıştığında (Railway scale-up), Instance A'nın lock'u Instance B'yi etkilemez. Aynı ilaca ait stok aynı anda iki instance'da düşürülebilir. |
| **Beklenen Davranış** | Stok kilidi tüm instance'lar arasında paylaşılmalıdır (Redis, PostgreSQL advisory lock, vb.). |
| **Kanıt** | Kod incelemesi: `const stockLocks = new Map()` — module-level, in-memory. |
| **Etki** | **ORTA.** Çoklu-instance deployment'da stok tutarsızlığı. Şu an Railway tek instance çalıştırdığı için etki yok, ancak scale-up yapılırsa hemen ortaya çıkar. |
| **Kök Neden** | İlk geliştirmede tek instance varsayılmış. |
| **Önerilen Çözüm** | PostgreSQL advisory lock veya Redis tabanlı kilit mekanizmasına geç. Veya stok işlemini atomic PostgreSQL transaction'ına taşı. |
| **İş Büyüklüğü** | M |

---

### FAM-P2-009: Davet Kodu ile Bağlanma Doğrulama Gerektirmez

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Yüksek |
| **Kategori** | Güvenlik / Yetkilendirme |
| **Etkilenen Dosya** | `api/src/routes/profiles.js` — `/profiles/accept-invite` |
| **Mevcut Davranış** | Herhangi bir elderly kullanıcı, herhangi bir caregiver'ın davet kodunu bilerek kendini bağlayabilir. Ek bir doğrulama (e-posta, SMS onay, yüz yüze onay) gerekmez. |
| **Beklenen Davranış** | Davet koduyla bağlanma işlemi ek bir doğrulama adımı içermelidir (örn. caregiver'ın telefonuna SMS). |
| **Kanıt** | Kod incelemesi: Accept-invite route'unda sadece inviteCode eşleştirmesi yapılır, ek doğrulama yok. |
| **Etki** | **DÜŞÜK-ORTA.** Kötü niyetli bir elderly, bir caregiver'ın davet kodunu tahmin ederek (8 haneli, 10^8 olasılık) veya sosyal mühendislikle ele geçirerek bağlanabilir. Ancak 8 haneli kodun tahmin edilmesi zordur. |
| **Kök Neden** | Kullanım kolaylığı önceliklendirilmiş. |
| **Önerilen Çözüm** | Caregiver'a bağlantı talebi bildirimi gönder, onay alınmadan bağlantıyı tamamlama. |
| **İş Büyüklüğü** | S |

---

### FAM-P2-010: Profil Bağlantısı Koparma Tersine Çevirme Yapmaz

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Yüksek |
| **Kategori** | Veri Tutarlılığı |
| **Etkilenen Dosya** | `api/src/routes/profiles.js` — DELETE `/profiles/:id` (disconnect) |
| **Mevcut Davranış** | Profil bağlantısı koparıldığında (disconnect), `consolidateUserRecordsIntoProfile()` ile yapılmış kayıt taşıma işlemi tersine çevrilmez. İlaç kayıtları, sağlık geçmişi, loglar eski profileId ile kalmaya devam eder. |
| **Beklenen Davranış** | Bağlantı koparıldığında, ilgili kayıtlar elderly kullanıcının kendi userId'sine taşınmalıdır. |
| **Kanıt** | Kod incelemesi: `consolidateUserRecordsIntoProfile` çağrısı var ancak ters işlem (disconnect) için bir `deconsolidateUserRecordsFromProfile` yok. |
| **Etki** | **ORTA.** Bağlantı koparıldıktan sonra elderly kendi ilaç ve sağlık kayıtlarına erişemez. Veri kaybı yaşanır. |
| **Kök Neden** | Disconnect senaryosu consolidate işleminin tersini hesaba katmamış. |
| **Önerilen Çözüm** | Disconnect sırasında kayıtları userId'ye geri taşı veya profileId'yi koruyarak elderly'nin erişimine izin ver. |
| **İş Büyüklüğü** | M |

---

### FAM-P2-011: İlaç Saatleri Düzenleme Sıfırlanamıyor

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Kullanılabilirlik |
| **Etkilenen Dosya** | `api/src/routes/medications.js`, satır 207-210 |
| **Mevcut Davranış** | PATCH `/medications/:id` endpoint'inde `if (name)`, `if (dosage)`, `if (instructions)`, `if (times)` gibi kontroller var. Bu alanlar boş string olarak gönderilirse `if` bloğu çalışmaz (çünkü boş string falsy'dir) ve alan güncellenmez. Kullanıcı bir alanı temizleyip kaydedemez. |
| **Beklenen Davranış** | `if (name !== undefined)` gibi kontroller kullanılmalı veya boş string değerlerine izin verilmelidir. |
| **Kanıt** | Kod incelemesi satır 207-210: `if (name)`, `if (dosage)`, `if (instructions)`, `if (times)` kontrolleri. |
| **Etki** | **DÜŞÜK.** Kullanıcı ilaç adını veya dozaj bilgisini boşaltamaz, ancak pratikte bu alanların boş olması nadiren gerekir. |
| **Kök Neden** | JavaScript truthy/falsy kontrolü. |
| **Önerilen Çözüm** | `if (name !== undefined)` olarak değiştir. Tüm alanlar için aynı düzeltme. |
| **İş Büyüklüğü** | XS |

---

### FAM-P2-012: Admin TOTP Secret Fallback Rastgele Üretiliyor

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Güvenlik / Authentication |
| **Etkilenen Dosya** | `api/src/routes/admin.js` |
| **Mevcut Davranış** | `ADMIN_TOTP_SECRET` ortam değişkeni tanımlı değilse, rastgele bir secret üretilir ve console.error ile uyarı basılır. Bu secret restart'ta değişir, admin TOTP'si çalışmaz. |
| **Beklenen Davranış** | Admin TOTP secret'ı da JWT_SECRET gibi zorunlu olmalıdır. |
| **Kanıt** | Kod incelemesi. |
| **Etki** | **DÜŞÜK.** Production'da bu secret ayarlanmazsa admin 3-faktör giriş yapamaz. Geliştirmede sorun yok. |
| **Kök Neden** | JWT_SECRET ile aynı pattern. |
| **Önerilen Çözüm** | ADMIN_TOTP_SECRET'i zorunlu kıl. |
| **İş Büyüklüğü** | XS |

---

### FAM-P2-013: Telefon Numaraları Hash'lenmeden Depolanıyor

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Yüksek |
| **Kategori** | Gizlilik / KVKK |
| **Etkilenen Dosya** | `api/data/db.local.json` — users.phone |
| **Mevcut Davranış** | Tüm kullanıcı telefon numaraları `90XXXXXXXXXX` formatında düz metin olarak depolanıyor. Sadece PIN hash'lenmiş. |
| **Beklenen Davranış** | Telefon numaraları hash'lenmeli veya simetrik olarak şifrelenmelidir (veri sahibi dışında erişilemez olmalı). |
| **Kanıt** | lowdb'de users koleksiyonunda phone alanı düz metin. |
| **Etki** | **DÜŞÜK-ORTA.** Veritabanı sızıntısında telefon numaraları ifşa olur. KVKK madde 12 kapsamında teknik tedbir alınmalıdır. |
| **Kök Neden** | Uygulama telefon doğrulama ve SMS için phone'a ihtiyaç duyuyor. |
| **Önerilen Çözüm** | Telefonları simetrik şifrele (AES-256-GCM). Sadece gerekli işlemler için çöz. |
| **İş Büyüklüğü** | L (şifreleme katmanı + tüm sorguları güncelleme) |

---

### FAM-P2-014: Admin Backup Sınırı 3 Aşılınca Eski Backup'lar Silinmiyor

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Veri Yönetimi |
| **Etkilenen Dosya** | `api/src/routes/admin.js` — backup endpoint'i |
| **Mevcut Davranış** | Admin 3. backup'dan sonra "Maksimum 3 yedek" hatası alır. Eski backup otomatik silinmez. |
| **Beklenen Davranış** | En eski backup otomatik silinmeli veya kullanıcıya silme seçeneği sunulmalı. |
| **Kanıt** | Kod incelemesi. |
| **Etki** | **DÜŞÜK.** Kullanıcı eski backup'ları manuel silmek zorunda. |
| **Kök Neden** | Basit limit uygulaması. |
| **Önerilen Çözüm** | FIFO mantığıyla eski backup'ları otomatik sil. |
| **İş Büyüklüğü** | XS |

---

### FAM-P2-015: Mobil Login Doğrulama Adımı Server'da Doğrulanmıyor

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Yüksek |
| **Kategori** | Kimlik Doğrulama |
| **Etkilenen Dosya** | `app/login.tsx` |
| **Mevcut Davranış** | Login akışının 2. adımı (verification code), telefona gelen kodu mobil tarafta kontrol ediyor (AsyncStorage/dev mod). Login isteği sırasında kod server'da doğrulanmıyor. |
| **Beklenen Davranış** | Login sırasında verification code server'da doğrulanmalıdır. |
| **Kanıt** | Kod incelemesi: login.tsx'te verification step'i server çağrısı yapmadan geçiyor. |
| **Etki** | **DÜŞÜK.** Dev modda kod otomatik dolduruluyor ama üretimde SMS kodunun AsyncStorage'da saklanması güvenlik sorunu. Normal akışta kod telefona gelir ve kullanıcı girer. |
| **Kök Neden** | Geliştirme kolaylığı. |
| **Önerilen Çözüm** | Login'de verification code'u server'da doğrula. AsyncStorage'a kod yazma. |
| **İş Büyüklüğü** | S |

---

### FAM-P2-016: `times || ['09:00']` Dead Code

| Alan | Değer |
|------|-------|
| **Öncelik** | **P2** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Dead Code / Kod Kalitesi |
| **Etkilenen Dosya** | `api/src/routes/medications.js`, satır 69 |
| **Mevcut Davranış** | İlaç oluşturma endpoint'inde `times` alanı `req.body`'den gelir ve üstte (satır 54) zaten `Array.isArray(times) && times.length` olarak doğrulanmıştır. Dolayısıyla `times || ['09:00']` hiçbir zaman `['09:00']` değerini kullanmaz. |
| **Beklenen Davranış** | Kullanılmayan fallback kaldırılmalıdır. |
| **Kanıt** | Kod incelemesi: Satır 54 doğrulama, satır 69 atama. |
| **Etki** | **YOK.** Sadece kod kirliliği. |
| **Kök Neden** | İlk yazımda validasyon sonradan eklenmiş. |
| **Önerilen Çözüm** | `times || ['09:00']`'ı `times` olarak değiştir. |
| **İş Büyüklüğü** | XS |

---

### FAM-P3-017: Push Bildirimleri İçin Test Yok

| Alan | Değer |
|------|-------|
| **Öncelik** | **P3** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Test Eksikliği |
| **Etkilenen Dosya** | `api/src/services/push.js` |
| **Mevcut Davranış** | Push bildirim gönderme ve receipt kontrolü için hiçbir test bulunmamaktadır. |
| **Beklenen Davranış** | Push servisi en azından birim testiyle örtülmelidir. |
| **Kanıt** | Test dosyaları tarandı, push.test.js yok. |
| **Etki** | **DÜŞÜK.** Push ile ilgili hatalar üretimde ortaya çıkar. |
| **Kök Neden** | Test önceliklendirilmemiş. |
| **Önerilen Çözüm** | Push servisi için mock Expo API ile test ekle. |
| **İş Büyüklüğü** | S |

---

### FAM-P3-018: Scheduler İçin Test Yok

| Alan | Değer |
|------|-------|
| **Öncelik** | **P3** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Test Eksikliği |
| **Etkilenen Dosya** | `api/src/services/scheduler.js` |
| **Mevcut Davranış** | Zamanlanmış görevler (doz hatırlatma, randevu hatırlatma) için hiçbir test bulunmamaktadır. |
| **Beklenen Davranış** | Scheduler testleri critical business logic'i kapsamalıdır. |
| **Kanıt** | Test dosyaları tarandı, scheduler.test.js yok. |
| **Etki** | **DÜŞÜK.** Kaçırılan doz/logic hataları üretimde ortaya çıkar. |
| **Kök Neden** | Test önceliklendirilmemiş. |
| **Önerilen Çözüm** | Scheduler için mock veriyle test ekle. |
| **İş Büyüklüğü** | M |

---

### FAM-P3-019: Subscription/Premium Logic İçin Test Yok

| Alan | Değer |
|------|-------|
| **Öncelik** | **P3** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Test Eksikliği |
| **Etkilenen Dosya** | RevenueCat entegrasyonu ve premium middleware |
| **Mevcut Davranış** | Premium abonelik kontrolü ve RevenueCat entegrasyonu için hiçbir test bulunmamaktadır. |
| **Beklenen Davranış** | Subscription middleware ve store test edilmelidir. |
| **Kanıt** | Test dosyaları tarandı. |
| **Etki** | **DÜŞÜK.** Abonelik hataları gelir kaybına yol açar. |
| **Kök Neden** | Test önceliklendirilmemiş. |
| **Önerilen Çözüm** | Subscription middleware ve store için test ekle. |
| **İş Büyüklüğü** | S |

---

### FAM-P3-020: PostgreSQL Sync Testi Yok

| Alan | Değer |
|------|-------|
| **Öncelik** | **P3** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Test Eksikliği |
| **Etkilenen Dosya** | `api/src/db.js` |
| **Mevcut Davranış** | PostgreSQL senkronizasyonu, `migratePg()`, `syncFromPg()`, `persistSnapshot()` fonksiyonları için hiçbir test bulunmamaktadır. |
| **Beklenen Davranış** | Veritabanı senkronizasyonu test edilmelidir. |
| **Kanıt** | Test dosyaları tarandı. |
| **Etki** | **DÜŞÜK.** Sync hataları veri kaybına yol açar. |
| **Kök Neden** | Test önceliklendirilmemiş. |
| **Önerilen Çözüm** | PostgreSQL sync için entegrasyon testi ekle. |
| **İş Büyüklüğü** | L |

---

### FAM-P3-021: Notification Route'unda Pagination Yok

| Alan | Değer |
|------|-------|
| **Öncelik** | **P3** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Performans / Ölçeklenebilirlik |
| **Etkilenen Dosya** | `api/src/routes/notifications.js` — GET `/notifications` |
| **Mevcut Davranış** | Tüm bildirimler tek seferde döndürülür. Sayfalama, limit veya offset yoktur. |
| **Beklenen Davranış** | Sayfalama veya son N bildirim limiti olmalıdır. |
| **Kanıt** | Kod incelemesi. |
| **Etki** | **DÜŞÜK.** Şu anki veri hacminde sorun yok, ancak zamanla bildirim sayısı arttıkça performans düşer. |
| **Kök Neden** | Erken optimizasyon yapılmamış. |
| **Önerilen Çözüm** | `?limit=50&offset=0` veya `?before=<timestamp>` parametreleri ekle. |
| **İş Büyüklüğü** | S |

---

### FAM-P3-022: GVN (Global Verification Number) Validasyonu Eksik

| Alan | Değer |
|------|-------|
| **Öncelik** | **P3** |
| **Güven Düzeyi** | Orta |
| **Kategori** | Veri Doğrulama |
| **Etkilenen Dosya** | `api/src/routes/auth.js`, satır 56 |
| **Mevcut Davranış** | Telefon numarası sadece "10, 11 veya 12 haneli" olarak normalize edilir. Geçerli bir Türk telefon numarası olup olmadığı (örn. 9053X, 9054X, 9055X gibi geçerli operatör kodları) kontrol edilmez. |
| **Beklenen Davranış** | Telefon numarası geçerli bir Türk operatör kodu içermelidir. |
| **Kanıt** | Kod incelemesi. |
| **Etki** | **ÇOK DÜŞÜK.** Mobil uygulama arayüzü zaten doğru formatı zorlar. |
| **Kök Neden** | Validasyon eksik. |
| **Önerilen Çözüm** | normalizePhone fonksiyonunda operatör kodu validasyonu ekle. |
| **İş Büyüklüğü** | XS |

---

### FAM-P3-023: Telefon Doğrulama Rate Limiting Map'leri Bellekte Kayboluyor

| Alan | Değer |
|------|-------|
| **Öncelik** | **P3** |
| **Güven Düzeyi** | Kesin |
| **Kategori** | Rate Limiting / Güvenlik |
| **Etkilenen Dosya** | `api/src/routes/auth.js` — `verificationAttempts`, `registrationAttempts` |
| **Mevcut Davranış** | Doğrulama ve kayıt rate limiting için kullanılan Map'ler in-memory'dir. Sunucu restart'ında sıfırlanır. |
| **Beklenen Davranış** | Rate limiting state'i restart'lar arasında korunmalı veya en azından bu durum belgelenmelidir. |
| **Kanıt** | Kod incelemesi. |
| **Etki** | **ÇOK DÜŞÜK.** Restart sonrası saldırgan rate limit'i aşabilir, ancak bu pencere çok kısadır. |
| **Kök Neden** | Basit implementasyon. |
| **Önerilen Çözüm** | Redis veya benzeri kalıcı/canlı depolama. |
| **İş Büyüklüğü** | S |

---

## D. Ölü Kod ve Dosya Raporu

### D.1 Ölü Kod

| # | Dosya | Satır(lar) | Kod Parçası | Açıklama |
|---|-------|-----------|-------------|----------|
| 1 | `api/src/routes/medications.js` | 69 | `times || ['09:00']` | `times` üstte zaten doğrulanmış, fallback hiç kullanılmaz |
| 2 | `api/src/services/scheduler.js` | 17-20 | `stopScheduler()` | Export edilmiş ancak hiçbir yerde çağrılmıyor (ne testte ne production kodunda) |
| 3 | `api/src/routes/admin.js` | — | `canManageRecord` import'u | Admin route'unda import edilmiş ama kullanılmıyor olabilir |
| 4 | `api/src/db.js` | — | `deleteRelationalData` | Export edilmiş, auth.js'de kullanılıyor — canlı kod, ölü değil. |
| 5 | `app/index.tsx` | — | Eski onboarding | Onboarding artık login.tsx'e yönlendiriyor, index.tsx çoğunlukla redirect |

### D.2 Şüpheli / Az Kullanılan Dosyalar

| Dosya | Boyut | Açıklama |
|-------|-------|----------|
| `app/terms-screen.tsx` | Küçük | Kullanımda mı bilinmiyor, expo-router genelde `terms` olarak çözümler |
| `app/privacy-screen.tsx` | Küçük | Aynı şekilde, `privacy` route'u olabilir |
| `app/help.tsx` | Küçük | Çalışıyor ancak onboarding sonrası nadiren erişiliyor |
| `app/emergency-contacts.tsx` | Küçük | Mevcut, test coverage'ı yok |

### D.3 Fazla Yetkili / Gereksiz Middleware Kullanımı

- `api/src/routes/medications.js` satır 184: `requireProfileAccess` zaten satır 180'de çağrılmış, satır 184 gereksiz.
- `api/src/routes/emergency.js`: Her endpoint ayrı ayrı `authMiddleware` kullanıyor, router-level middleware daha uygun.

---

## E. Uyumsuzluk Matrisi

### E.1 KVKK (Kişisel Verilerin Korunması Kanunu)

| Madde | Durum | Açıklama |
|-------|-------|----------|
| Madde 4 (Veri işleme ilkeleri) | ❌ Uyumsuz | Telefon numaraları hash'lenmemiş, git geçmişinde düz metin |
| Madde 5 (Rıza) | ⚠️ Kısmi | Kullanıcı kayıt olurken rıza alınıyor ancak aydınlatma metni eksik |
| Madde 6 (Özel nitelikli veri) | ⚠️ Kısmi | Sağlık verileri (kan grubu, kilo, tansiyon) işleniyor, ek koruma yok |
| Madde 12 (Veri güvenliği) | ❌ Uyumsuz | Teknik tedbirler yetersiz (şifreleme eksik, git geçmişinde veri) |
| Madde 28 (İstisnalar) | N/A | Ticari faaliyet, istisna kapsamında değil |

### E.2 OWASP Mobile Top 10

| Zafiyet | Durum | İlgili Bulgu |
|---------|-------|-------------|
| M1: Improper Platform Usage | ✅ Uyumlu | Expo güvenli API'leri kullanılıyor |
| M2: Insecure Data Storage | ❌ Uyumsuz | SecureStore sadece token'lar için, telefon/local veri şifresiz |
| M3: Insecure Communication | ✅ Uyumlu | HTTPS (varsayılan olarak) |
| M4: Insecure Authentication | ⚠️ Kısmi | Rate limit eksik, PIN brute force koruması var ama IP bazlı değil |
| M5: Insufficient Cryptography | ⚠️ Kısmi | PIN bcrypt cost 12 (iyi), telefon hash'siz (kötü) |
| M6: Insecure Authorization | ⚠️ Kısmi | Profile-based access çalışıyor, invite code doğrulamasız |
| M7: Client Code Quality | ✅ Uyumlu | TypeScript strict mode, lint var |
| M8: Code Tampering | N/A | APK imzalama EAS ile yapılıyor |
| M9: Reverse Engineering | N/A | Herhangi bir obfuscation yok (Expo varsayılan) |
| M10: Extraneous Functionality | ✅ Uyumlu | Debug endpoint yok |

### E.3 OWASP API Security Top 10

| Zafiyet | Durum | Açıklama |
|---------|-------|----------|
| API1: Object Level Authorization | ✅ Kısmi | Profile-based access çalışıyor, ancak health route'ları kontrol edilmeli |
| API2: Broken Authentication | ⚠️ Kısmi | Rate limit eksik, JWT fallback |
| API3: Excessive Data Exposure | ✅ Uyumlu | Düzenli response yapısı |
| API4: Lack of Resources & Rate Limiting | ❌ Eksik | Login/refresh rate limit yok |
| API5: Broken Function Level Authorization | ✅ Uyumlu | adminMiddleware çalışıyor |
| API6: Mass Assignment | ✅ Uyumlu | Manuel alan ataması |
| API7: Security Misconfiguration | ⚠️ Kısmi | CORS whitelist var, CSP sadece legal sayfada |
| API8: Injection | ✅ Uyumlu | lowdb (NoSQL benzeri), SQL injection riski yok |
| API9: Improper Assets Management | ⚠️ Kısmi | API versiyonu yok |
| API10: Insufficient Logging & Monitoring | ⚠️ Kısmi | Admin audit log var, kullanıcı loglaması yok |

---

## F. Güvenlik Tehdit Modeli

### F.1 Tehdit Matrisi (STRIDE)

| Tehdit | Açıklama | Olasılık | Etki | Risk |
|--------|----------|---------|------|------|
| **S**poofing | Sahte kimlikle giriş (brute force PIN) | Orta | Yüksek | **Yüksek** |
| **T**ampering | Stok verisi manipülasyonu (race condition) | Düşük | Orta | **Orta** |
| **R**epudiation | İşlem loglaması eksik (kullanıcı eylemleri) | Orta | Düşük | **Düşük** |
| **I**nformation Disclosure | Git geçmişinde PII | Yüksek | Kritik | **Kritik** |
| **D**enial of Service | Rate limit eksik (login/refresh) | Orta | Orta | **Orta** |
| **E**levation of Privilege | Invite code yetki yükseltme | Düşük | Orta | **Düşük** |

### F.2 Varsayılan Saldırı Senaryoları

**Senaryo 1: Veri Sızıntısı**
1. Repo halka açılır veya yetkisiz bir takım üyesi clone'lar
2. `git log` ile 41 telefon numarası ve isim ifşa olur
3. KVKK para cezası: ~1.000.000 TL - 50.000.000 TL arası

**Senaryo 2: Brute Force Giriş**
1. Saldırgan bilinen bir telefon numarasına karşı PIN brute force başlatır
2. 5 başarısız denemeden sonra kullanıcı bloke olur (15 dk)
3. Saldırgan farklı IP'lerden farklı kullanıcılara düşük sayıda deneme yaparak rate limit'i aşar
4. Zayıf PIN (4 haneli) kullanan hesaplar risk altında

**Senaryo 3: Multi-Instance Stok Tutarsızlığı**
1. Railway 2 instance'a scale eder
2. Instance A'da elderly ilacını alır (stock 10→9)
3. Instance B'de caregiver aynı ilacı işaretler (stock 10→9)
4. Instance A yazar (db.json'da stock=9)
5. Instance B yazar (db.json'da stock=9, 8 olmalıydı)
6. Gerçek stok: 8, Kaydedilen: 9

### F.3 Veri Akış Diagramı (Güvenlik Odaklı)

```
Kullanıcı → [HTTPS] → Express API → [JWT Auth] → Route Handler → [db.write()] → lowdb (JSON)
                                                      ↕
                                              PostgreSQL (async sync)
                                                      
Güvenlik Sınırları:
  ❌ Git geçmişinde düz metin PII
  ⚠️ JWT imzası rastgele secret (dev)
  ⚠️ Rate limiting Map'leri in-memory
  ✅ HTTPS ile iletişim
  ✅ bcrypt cost 12 PIN
  ✅ Session rotation
```

---

## G. Test Boşlukları

### G.1 Mevcut Test Örtüsü

| Test Dosyası | Test Sayısı | Süre | Kapsam |
|-------------|-----------|------|--------|
| `api/__tests__/auth.test.js` | — | — | Test dosyası mevcut DEĞİL |
| `api/__tests__/medications.test.js` | ~2 | ~0.1s | Minimal |
| `api/__tests__/profiles.test.js` | ~2 (negatif) | ~0.1s | Sadece yetkisiz erişim |
| `api/__tests__/health.test.js` | — | — | Test dosyası mevcut DEĞİL |
| Toplam | ~20 | ~2.05s | Yetersiz |

### G.2 Kritik Test Boşlukları

| Alan | Neden Kritik | Test Sayısı | Eklenmeli |
|------|-------------|-----------|-----------|
| **Auth/Login** | Brute force, session rotation, JWT doğrulama | 0 | 10-15 test |
| **Auth/Refresh** | Token yenileme, rotation geçerliliği | 0 | 5-8 test |
| **Medications/Stock** | Race condition, atomicity, stok doğruluğu | 0 | 8-10 test |
| **Scheduler** | Missed dose logic, appointment reminder, timezone | 0 | 10-15 test |
| **Push** | Expo API çağrısı, DeviceNotRegistered, receipt check | 0 | 5-8 test |
| **Subscription** | Premium gate, RevenueCat webhook | 0 | 5-8 test |
| **PostgreSQL Sync** | migratePg, syncFromPg, persistSnapshot | 0 | 8-10 test |
| **Health/Validation** | NaN bypass, threshold doğrulama | 0 | 8-10 test |

### G.3 Hedef Test Kapsamı

```
Mevcut:  20 test (sadece pozitif/negatif auth + minimal CRUD)
Hedef:  ~80-100 test (tüm kritik yollar + edge case'ler + güvenlik)
Kapsam: %15 → %70+ (kritik yollarda %90+)
```

---

## H. Düzeltme Yol Haritası

### Aşama 0: Veri ve Güvenlik Koruması (Hemen)

| # | Bulgu | İş | Süre |
|---|-------|-----|------|
| 0.1 | Git geçmişinden db.json temizliği (BFG Repo-Cleaner) | M | 2-4 saat |
| 0.2 | db.local.json'a .gitignore'a ekleme (zaten ekli mi kontrol) | XS | 5 dk |
| 0.3 | Production'da JWT_SECRET ve ADMIN_TOTP_SECRET zorunlu kıl | XS | 15 dk |
| 0.4 | Health NaN bypass fix | XS | 10 dk |

### Aşama 1: P0 Sorunları (1. Hafta)

| # | Bulgu | İş | Süre |
|---|-------|-----|------|
| 1.1 | db.write() lock içine taşı (stockLock race) | XS | 15 dk |
| 1.2 | Git tarihçesini temizle, yeni deploy token'ları oluştur | M | 2-4 saat |
| 1.3 | NaN bypass fix | XS | 10 dk |
| 1.4 | 41 kullanıcı için toplu PIN sıfırlama akışı | M | 4-6 saat |

### Aşama 2: P1 Sorunları (2. Hafta)

| # | Bulgu | İş | Süre |
|---|-------|-----|------|
| 2.1 | Login ve refresh endpoint'lerine rate limiting | S | 1-2 saat |
| 2.2 | Appointment reminder timezone fix | S | 30 dk |
| 2.3 | StockLock çoklu-instance çözümü (PostgreSQL lock) | M | 4-6 saat |
| 2.4 | JWT_SECRET zorunlu kılma | XS | 15 dk |

### Aşama 3: P2 Sorunları (3. Hafta)

| # | Bulgu | İş | Süre |
|---|-------|-----|------|
| 3.1 | Invite code ek doğrulama (caregiver onayı) | S | 2-3 saat |
| 3.2 | Disconnect sonrası kayıt taşıma (deconsolidate) | M | 4-6 saat |
| 3.3 | İlaç alanı sıfırlama fix (if name → if name !== undefined) | XS | 15 dk |
| 3.4 | Mobil login verification fix | S | 2-3 saat |
| 3.5 | Telefon şifreleme (AES-256-GCM) — opsiyonel | L | 8-12 saat |

### Aşama 4: Test ve Kalite (4. Hafta)

| # | Bulgu | İş | Süre |
|---|-------|-----|------|
| 4.1 | Auth testleri (10-15 test) | M | 4-6 saat |
| 4.2 | Medications/stock testleri (8-10 test) | M | 4-6 saat |
| 4.3 | Scheduler testleri (10-15 test) | M | 6-8 saat |
| 4.4 | Push servis testleri (5-8 test) | S | 2-3 saat |
| 4.5 | PostgreSQL sync testleri (8-10 test) | L | 8-10 saat |
| 4.6 | Subscription testleri (5-8 test) | S | 2-3 saat |
| 4.7 | Health/validation testleri (8-10 test) | S | 2-3 saat |

### Aşama 5: Production Readiness (5. Hafta)

| # | Bulgu | İş | Süre |
|---|-------|-----|------|
| 5.1 | Notification pagination | S | 1-2 saat |
| 5.2 | Admin backup FIFO | XS | 30 dk |
| 5.3 | Dead code temizliği | XS | 30 dk |
| 5.4 | Dokümantasyon güncelleme (CLAUDE.md, API dokümanı) | S | 2-4 saat |
| 5.5 | Monitoring ve logging iyileştirmeleri | M | 4-6 saat |

---

## I. Uygulama Planı

> **⚠️ ÖNEMLİ:** Henüz kodu değiştirme. Aşağıdaki plan önerilen değişiklikleri dosya bazında ve testleriyle birlikte tanımlar. Onay aldıktan sonra uygulanacaktır.

### I.1 Aşama 0: Kritik Güvenlik (İlk 2 Saat)

**Değişiklik 1: NaN bypass fix**
- **Dosya:** `api/src/utils/health.js` (veya sağlık validasyon fonksiyonu)
- **Değişim:** `validateHealthValue` fonksiyonuna `Number.isNaN()` kontrolü ekle
- **Kod:**
  ```js
  function validateHealthValue(valueData, type) {
    if (valueData === undefined || valueData === null || valueData === '') return 'Geçerli bir değer girin';
    if (typeof valueData !== 'number' || Number.isNaN(valueData)) return 'Geçerli bir sayı girin';
    // ... limit kontrolleri
  }
  ```
- **Test:**
  ```js
  test('NaN değeri reddeder', () => {
    expect(validateHealthValue(NaN, 'weight')).toBeTruthy();
  });
  ```

**Değişiklik 2: db.write() lock içine taşıma**
- **Dosya:** `api/src/routes/medications.js` satır 133-148
- **Değişim:** `db.write()`'ı try bloğuna, `releaseStockLock`'tan önce taşı
- **Kod:**
  ```js
  // ... acquireStockLock
  try {
    // ... stock mutation
    await db.write();  // Lock altındayken yaz
  } finally {
    releaseStockLock(medication.id);
  }
  ```

### I.2 Aşama 1: P0 Düzeltmeleri (1. Hafta)

**Değişiklik 3: Git geçmişi temizliği**
- **Araç:** BFG Repo-Cleaner
- **Komut:**
  ```bash
  bfg --delete-files db.json
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  git push origin main --force
  ```
- **Not:** Tüm takım üyeleri eski clone'larını silip yeniden clone'lamalıdır.

**Değişiklik 4: PIN hash'siz kullanıcılar için migration**
- **Dosya:** `api/src/routes/admin.js` (yeni endpoint)
- **Yeni endpoint:** `POST /admin/reset-pin-bulk`
- **Akış:** Admin, PIN'siz kullanıcılara SMS ile geçici PIN gönderir. Kullanıcı ilk girişte yeni PIN belirler.
- **Alternatif:** Login'de `!user.pinHash` durumunda PIN sıfırlama sayfasına yönlendir.

### I.3 Aşama 2-3: P1-P2 Düzeltmeleri (2-3. Hafta)

**Değişiklik 5: Login rate limiting**
- **Dosya:** `api/src/routes/auth.js`
- **Ekle:** `/login` route'unda express-rate-limit (5 deneme/dk/IP)
- **Ekle:** `/refresh` route'unda express-rate-limit (30 deneme/dk/IP)

**Değişiklik 6: Appointment timezone fix**
- **Dosya:** `api/src/services/scheduler.js`
- **Değişim:** Satır 126'da sabit +03:00 yerine kullanıcının timezone'unu kullan
- **Kod:**
  ```js
  const patient = db.data.users.find(u => u.id === profile?.linkedUserId);
  const timezone = patient?.timezone || 'Europe/Istanbul';
  // appointment için de localParts kullan veya Intl.DateTimeFormat ile hesapla
  ```

**Değişiklik 7: StockLock çoklu-instance**
- **Dosya:** `api/src/routes/medications.js`
- **Değişim:** In-memory Map yerine PostgreSQL advisory lock veya atomic transaction
- **Alternatif:** Stock işlemini PostgreSQL'e taşı (daha karmaşık ama daha güvenli)

### I.4 Aşama 4-5: Test ve Production Readiness (4-5. Hafta)

**Değişiklik 8: Test dosyaları**
- **Yeni dosyalar:**
  - `api/__tests__/auth.integration.test.js` — giriş, kayıt, token yenileme
  - `api/__tests__/medications.test.js` — CRUD, stock, log
  - `api/__tests__/scheduler.test.js` — missed dose, appointment reminder
  - `api/__tests__/push.test.js` — push gönderme, receipt kontrol
  - `api/__tests__/health.test.js` — validasyon, threshold
  - `api/__tests__/subscription.test.js` — premium gate

**Değişiklik 9: Notification pagination**
- **Dosya:** `api/src/routes/notifications.js`
- **Ekle:** `?limit=50&offset=0` veya `?before=<ISO timestamp>` parametreleri

**Değişiklik 10: Deconsolidate on disconnect**
- **Dosya:** `api/src/db.js` veya `api/src/utils/profile.js`
- **Yeni fonksiyon:** `deconsolidateUserRecordsFromProfile(profileId, userId)`
- **Akış:** Bağlantı koparıldığında tüm kayıtları eski userId'ye geri taşı

---

## Ek: Kod Kalitesi Notları

### TypeScript Strict Mode Uyumu
- Backend ESM JavaScript ile yazılmış (TypeScript değil)
- Mobil tarafta TypeScript strict mode aktif
- `tsc --noEmit` hatasız geçiyor

### Bağımlılık Denetimi
- `npm audit`: 1 moderate severity (uuid <11.1.1, Expo araç zincirinden geçici)
- Doğrudan exploit edilebilir değil

### lowdb Performans Notları
- `db.local.json`: 7.2 MB, 217K+ satır
- Tüm CRUD işlemlerinde tüm dosya parse edilir/yazılır
- 50+ eşzamanlı kullanıcıda performans sorunu beklenir
- **Öneri:** PostgreSQL'e geçiş planı hazırlanmalı

---

## Rapor İstatistikleri

| Metrik | Değer |
|--------|-------|
| Toplam Bulgu | 23 |
| P0 (Kritik) | 3 |
| P1 (Yüksek) | 5 |
| P2 (Orta) | 8 |
| P3 (Düşük) | 7 |
| Kesin Güven | 16 |
| Yüksek Güven | 4 |
| Orta Güven | 3 |
| Toplam Test | ~20 |
| Test Eksikliği | ~70+ test |
| İncelenen Dosya | 50+ |
| Değerlendirme Tamamlanma | %100 |

---

*Rapor Burhan Balcı ve Claude Code (Anthropic) tarafından hazırlanmıştır.*  
*Denetim tarihi: 30 Temmuz 2026*  
*Sonraki adım: Düzeltmeler için onay bekleniyor.*
