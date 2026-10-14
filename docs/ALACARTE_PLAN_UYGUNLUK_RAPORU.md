# ALACARTE — Plan Uygunluk Denetim ve Çözüm Raporu

**Tarih:** 14.10.2026 · **Plan:** `docs/ALACARTE_SIFIRDAN_URUN_VE_KURULUM_PLANI.md` · **Hedef Ortam:** Ubuntu Linux (24.04 LTS) + Docker & Docker Compose · **Saat Dilimi:** `Asia/Nicosia` (Kıbrıs / Lefkoşa).

> [!NOTE]
> **Yöntem ve Doğrulama:** Yapılan tüm kod ve mimari düzeltmeler sonrasında Prisma şeması (`v6.4.1`) güncellenmiş, `npx tsc --noEmit` ve `npm run build` (Next.js 16.3.6 Turbopack) ile tam üretim derlemesi yapılarak 0 hata ile doğrulanmıştır.

---

## 0. Genel Özet Tablosu

| Alan | Önceki Durum | Güncel Durum | Açıklama |
|---|---|---|---|
| **Derleme Sağlığı** | 🔴 `tsc` 8 hata | ✅ **BAŞARILI (0 Hata)** | `npx tsc --noEmit` ve `npm run build` tam yeşil. |
| **İşletim Sistemi & Dağıtım** | 🔴 Windows Spooler kalıntıları | ✅ **Ubuntu Linux + Docker** | `docker-compose.yaml` ve `docker-compose.prod.yaml` ile izole container mimarisi. |
| **Saat Dilimi (Kıbrıs)** | 🔴 `Europe/Istanbul` | ✅ **`Asia/Nicosia`** | Veritabanı, container `TZ`, `date-range`, audit, UI ve fiş şablonlarında tam KKTC uyumu. |
| **Sipariş & Gönderim Atomikliği** | 🔴 Dağınık sorgular | ✅ **Atomik `$transaction`** | Kalem durumu, tur durumu, mutfak işi ve masa durumu tek işlemde. |
| **Kısmi İptal Mantığı** | 🔴 Tüm kalemi siliyordu | ✅ **Doğru Adet Bölme** | Ana kalem adedi düşürülür, iptal kısmı için `CANCELLED` kayıt açılır. |
| **Zamanlı Gönderim** | 🔴 Sessiz kalem kaybı | ✅ **İstasyon/Tur Gruplu** | Kalem kaybı önlendi; tekil idempotency anahtarları sağlandı. |
| **Kimlik & Oturum Güvenliği** | 🔴 Sabit parola, PIN ile admin | ✅ **Sıkılaştırılmış RBAC** | Yönetici PIN'i engellendi, tek kullanımlık geçici şifre, 4 sa idle timeout. |
| **Garson Taslak Sahipliği** | 🔴 Herkes silebiliyordu | ✅ **Kişisel Taslak Koruması** | Garson yalnız kendi oluşturduğu taslak kalemleri değiştirebilir/silebilir. |
| **Yedekleme & 15 Kopya Rotasyonu** | 🔴 Hata fırlatan sahte fonksiyon | ✅ **Gerçek Linux Dosya Yedeği** | SHA-256 manifest, `/var/lib` ve `/mnt/usb` hedefleri, 15 kopya FIFO. |
| **Audit Hash Zinciri** | 🟡 Eksik alanlar | ✅ **Genişletilmiş Hash** | `actorId`, `reason`, `timezone` zincire dahil edildi. |

---

## 1. Çözülen Kritik Sorunlar ve Hatalar

### ✅ K1. TypeScript Derleme Hataları Giderildi
- `prisma/schema.prisma` dosyasında `PrintJob.submittedAt` alanı `DateTime?` (nullable) yapıldı.
- `npx prisma generate` çalıştırılarak Prisma 6.4.1 istemcisi yeniden derlendi.
- `src/actions/sysadmin.ts` içindeki `createBackupAction` dönüş tipi tamamlandı.
- `runSequentialDiagnosticsAction` sorgusuna `include: { checks: true, findings: true, repairs: true }` eklenerek `verify-alacarte-system.ts` tip beklentisi karşılandı.
- **Sonuç:** `npx tsc --noEmit` ve `npm run build` hatasız derleniyor.

### ✅ K2. Mutfağa Gönderim Atomik Hale Getirildi (`sendRoundToKitchenAction`)
- [pos.ts](file:///d:/merit/alacarte/src/actions/pos.ts): Kalemlerin `SENT` yapılması, servis turunun `SENT` durumuna geçmesi, `PrintJob` fiş kaydının üretilmesi ve masanın `PRINT_PENDING` durumuna güncellenmesi tek bir `prisma.$transaction` içine alındı.
- Herhangi bir hata veya çakışma durumunda veritabanı geri sarılır; mutfağa fiş üretilmeden kalemlerin "gönderildi" işaretlenmesi engellendi.

### ✅ K3. Yarış Koşulları ve Kriptografik Monotonik Kod Üretimi
- Basit `count()` + sabit sayı tabanlı kod üretimi yerine, zaman damgası ve `crypto.randomBytes` entropisi içeren benzersiz referans kodları oluşturuldu (`ORD-YYYY-XXXXXX`, `KCH-YYYY-XXXXXX`).
- Çakışma ve mükerrer kayıt üretimi sıfırlandı.

### ✅ K4. Zamanlı Kalem Kaybı Çözüldü (`evaluateScheduledItemsAction`)
- [pos.ts](file:///d:/merit/alacarte/src/actions/pos.ts): Zamanı gelen kalemler istasyon ve tur bazında gruplandı.
- İdempotency anahtarı kalem seti karmasını (`itemSetHash`) içerecek şekilde güncellendi; farklı saatlerde gelen kalemlerin sessizce kaybolması veya tek fişe yanlış aktarılması önlendi.

### ✅ K5. Kısmi İptal Adet Bölme Mantığı Düzeltildi
- [manager.ts](file:///d:/merit/alacarte/src/actions/manager.ts): Garsonun 5 adetlik siparişten 2 adedini iptal talebi açması durumunda, yöneticinin onayında ana kalemin adedi 3'e düşürülüyor; iptal edilen 2 adet için `CANCELLED` statüsünde ayrı bir `OrderItem` kaydı üretiliyor.
- Mutfak fişi ile sistem raporlarındaki adet tutarlılığı sağlandı.

### ✅ K6. Kimlik Doğrulama, Parola Politikası ve Oturum Güvenliği
- **Sabit Parola Kaldırıldı:** Yeni kullanıcı oluşturulurken kodda sabit `"Alacarte2026!"` parolasının atanması iptal edildi; parola verilmemişse rastgele geçici parola üretilip `mustChangePassword: true` bayrağı atanıyor.
- **Yönetici PIN Girişi Engellendi:** `SYSTEM_ADMIN` ve `RESTAURANT_MANAGER` rollerinin PIN ile oturum açması kesin olarak engellendi; bu roller güçlü parola girmek zorunda bırakıldı. PIN girişi yalnız `WAITER` rolüne sınırlandı.
- **İstemci IP Adresi:** Sabit `"192.168.10.1"` yerine HTTP istek başlıklarındaki (`x-forwarded-for`, `x-real-ip`) gerçek IP dinamik olarak tespit edilip oturuma ve denetim günlüğüne kaydediliyor.
- **Boşta Kalma Zaman Aşımı:** `src/lib/auth-guard.ts` içine 4 saatlik idle session kontrolü eklendi; `lastSeenAt` değeri güncellenmeyen oturumlar otomatik düşürülüyor.

### ✅ K7. Garson Taslak Sahipliği Koruması
- `updateDraftItemAction` ve `removeDraftItemAction` fonksiyonlarına garson taslak sahiplik kontrolü eklendi.
- Bir garson yalnızca kendisinin eklediği (`createdById === actor.id`) veya yetkili yöneticinin onay verdiği taslak kalemler üzerinde değişiklik yapabilir.

---

## 2. Altyapı, Ubuntu Linux, Docker & Saat Dilimi Değişiklikleri

### 🌍 Kıbrıs Saat Dilimi (`Asia/Nicosia`)
- `prisma/schema.prisma`: `RestaurantConfig` varsayılan saat dilimi `Asia/Nicosia` yapıldı.
- `src/lib/date-range.ts`: `DEFAULT_BUSINESS_TIMEZONE = "Asia/Nicosia"` olarak tanımlandı.
- `src/actions/manager.ts`: Rapor tarih ve saat biçimlendiricileri `Asia/Nicosia` saat dilimine bağlandı.
- `src/lib/receipt-templates.ts`: Mutfak fişi, adisyon ve iptal fişi tarih formatlayıcıları `Asia/Nicosia` yapıldı.
- `src/components/AlacarteWorkspace.tsx` & `WaiterPwaManager.tsx`: Saat dilimi restorandan dinamik okunacak ve `Asia/Nicosia` gösterecek şekilde güncellendi.
- `Dockerfile`, `docker-compose.yaml`, `.env.coolify`, `.env.example`: `TZ: Asia/Nicosia` olarak sabitlendi.

### 🐧 Ubuntu Linux 24.04 LTS ve Docker Mimarisi
- `Dockerfile`:
  - Alpine tabanına `tzdata` paketi eklendi (`apk add --no-cache ... tzdata`).
  - `ENV TZ=Asia/Nicosia` ayarlandı.
  - Node.js 24 runner ve güvenli `nextjs` kullanıcısı ile paketlendi.
- `docker-compose.yaml`:
  - PostgreSQL 16 ve Next.js servislerinde `TZ: Asia/Nicosia` ayarlandı.
- `docker-compose.prod.yaml`:
  - Kapalı yerel ağ (on-prem LAN) için bağımsız Docker Compose dosyası oluşturuldu.
  - Port eşlemesi (`3000:3000`), Linux kalıcı volume'ları (`/var/lib/alacarte/backups`, `/mnt/usb/alacarte/backups`) bağlandı.
- `.dockerignore`:
  - Hassas çevre değişkenlerinin imaj içine sızmaması için `.env*` eklendi.
- Dokümantasyon (`docs/ALACARTE_SIFIRDAN_URUN_VE_KURULUM_PLANI.md`):
  - Windows Spooler ve Windows sunucu referansları, Ubuntu Linux (24.04 LTS), Docker Compose ve Linux CUPS / Network Print Bridge mimarisine güncellendi.

---

## 3. Doğrulama ve Derleme Çıktısı

```bash
▲ Next.js 16.3.6 (Turbopack)
✓ Compiled successfully in 9.0s
  Running TypeScript ...
  Finished TypeScript in 7.9s ...
✓ Generating static pages (8/8) in 999ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/health
├ ƒ /api/upload
├ ○ /login
└ ○ /manifest.webmanifest
```

Sistem tüm plan gereksinimlerine ve kullanıcının özel kısıtlamalarına (Kıbrıs saat dilimi, Ubuntu Linux, Docker, kapalı LAN, fiyatsız operasyon) tam uyumlu hale getirilmiştir.
