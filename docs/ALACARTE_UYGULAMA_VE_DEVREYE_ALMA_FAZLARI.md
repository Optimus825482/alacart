# ALACARTE — Uygulama ve Devreye Alma Fazları Planı

**Belge türü:** Proje Uygulama, Dağıtım Aşamaları ve Saha Kabul Kılavuzu  
**Tarih:** 14.10.2026  
**Durum:** Yürürlükte  
**Kapsam:** Alacarte Restoran Operasyon Sistemi'nin sıfırdan kurulum, test, pilot ve beş restorana yaygınlaştırma adımları.

---

## 1. Devreye Alma Yaklaşımı ve Prensipler

Alacarte sistemi, her restoranın kendi bağımsız yerel sunucusunda (Ubuntu 24.04 LTS + Docker), izole kapalı ağında (Keenetic Router/AP) ve harici internet/otel ağı bağımlılığı olmaksızın çalışır.

Devreye alma süreci 5 ana fazdan oluşur. Sistem prototip aşamasını geçmiş, çalışan gerçek üretim platformu olarak kurgulanmıştır.

---

## 2. Devreye Alma Fazları

### Faz 1 — Ürün Tanımı, Donanım Hazırlığı ve Saha Keşfi
- Restoran masa planları, koltuk sayıları, alanlar (Salon, Teras, Bahçe), menü ağacı (Kategoriler, Alt Kategoriler, Ürünler) ve hazırlama kuralları (Zorunlu ve İsteğe Bağlı Modifier Grupları) belirlenir.
- **Donanım Paketi Tedariği:**
  - 1x Tiwox TP-8610 Dokunmatik Sunucu-Kasa (18.5" Dokunmatik, Ubuntu 24.04 LTS, Docker Compose).
  - 1x Epson TM-T20III Termal Adisyon Yazıcısı (Doğrudan kasaya USB bağlantı).
  - 1x Epson TM-T88VII-112 Termal Fiş Yazıcı (Mutfak için dahili Ethernet portlu, mutfakta kablosuz mesh AP'ye CAT6 ile bağlı).
  - 1x Keenetic Voyager Pro (KN-3510) All-in-One Router & Wi-Fi 6 Tavan AP (Ana router ve DHCP sunucusu).
  - 1x Keenetic Orbiter Pro (KN-2810) Mutfak Kablosuz Mesh AP (Kasadan mutfağa kablo çekilmeden kablosuz köprü kurar, yazıcı bu AP'nin Ethernet portuna bağlanır).
  - 1x Keenetic EAP650-Outdoor Wi-Fi 6 AP (Geniş teras veya açık alan varsa kapsama için).
  - 1x TP-Link TL-POE160S PoE+ Enjektör (Kasada tek PoE kablosuyla tavan AP'yi besler).
  - 1x Sandisk Ultra Flair 64GB USB 3.0 Bellek (Sunucuya takılı günlük döngüsel otomatik yedekleme için).
- Restorandaki fiziksel kablolama, priz ve PoE hatları test edilir. Kasadan mutfağa fiziksel kablo çekilmeyeceği doğrulanır.

**Çıkış ölçütü:** Donanım teslim tutanağı ve restoran fiziksel yerleşim krokisi onaylanmış olmalıdır.

---

### Faz 2 — Temel Platform ve Yerel Sunucu Kurulumu
- Ubuntu Linux 24.04 LTS üzerine Docker ve Docker Compose kurulumu tamamlanır.
- PostgreSQL 16 veritabanı konteyneri ayağa kaldırılır, Prisma şeması migrate edilir.
- Next.js üretim derlemesi (`npm run build`) hazırlanır ve `restart: unless-stopped` politikasıyla servis haline getirilir.
- SCR-01 (Giriş) ve SCR-02 (İlk Kurulum Sihirbazı) çalıştırılarak restoran adı, masa adedi ve sistem yöneticisi oluşturulur.
- Otomatik yedekleme cron/worker servisi devreye alınır; `/mnt/usb/alacarte/backups` ve `/var/lib/alacarte/backups` dizinlerine günlük 15 kopyalık döngüsel yedek yazıldığı doğrulanır.
- Sistem saat dilimi Kıbrıs (`Asia/Nicosia`) olarak sabitlenir.

**Çıkış ölçütü:** Sunucu yeniden başlatıldığında tüm servislerin (Uygulama, DB, Arka Plan Worker) otomatik olarak ayağa kalkması ve giriş ekranının açılması.

---

### Faz 3 — Masa, Menü ve Operasyonel İş Akışları
- Menü hiyerarşisi yüklenir: Ana Kategoriler, Alt Kategoriler, Ürünler ve İstasyon Eşleştirmeleri (SICAK, SOĞUK, IZGARA, TATLI).
- Zorunlu pişme dereceleri ve mutfak hazırlama kuralları tanımlanır (Pişme Derecesi zorunlu, Soslar isteğe bağlı vb.).
- **Oracle MICROS Simphony TSR Standartları Devreye Alınır:**
  - `86 / Menü Mevcudiyeti & Porsiyon Sayacı`: Günlük porsiyonlu ürünlerin kalan stokları girilir, tükenenler tek tıkla 86'ya alınır.
  - `Koltuk ve Kuver Yönetimi`: Check düzeyinde kuver sayısı, kalem düzeyinde koltuk ve ürün paylaşımı test edilir.
  - `Rush (Acil) Sipariş`: Tur ve kalem bazlı öncelikli sipariş bayrakları test edilir.
  - `Re-Order (Turu Tekrarla)`: Önceki turun tek tuşla yeni tura aktarımı doğrulanır.
  - `Prefix Modifiers`: İSTEMEZ, BOL, AYRI, AZ, YERİNE ön ekleriyle hazırlama seçenekleri test edilir.
  - `Masa Taşıma ve Birleştirme`: Açık masaların taşınması ve grupların birleştirilmesi doğrulanır.
  - `Garson / Vardiya Devri`: Masanın sorumluluğunun başka bir personele aktarımı test edilir.
  - `İptal (Void) ve Yönetici Onayı`: Gönderilmiş kalem iptalinin yönetici onayına düşmesi ve mutfağa ayrı VOID fişi basması test edilir.

**Çıkış ölçütü:** 10 eşzamanlı garson el terminali simülasyonunda sıfır sipariş kaybı, çift tıklamada mükerrer sipariş oluşmaması (idempotency doğrulaması).

---

### Faz 4 — Ağ, Mutfak Yazıcısı ve Adisyon Altyapısı
- Keenetic Router üzerinde restoranın kapalı Wi-Fi ağı (`Merit-Alacarte-LAN`) kurulur. WPA3/WPA2 Enterprise veya güçlü PSK ile şifrelenir.
- Mutfak kablosuz mesh AP (Keenetic Orbiter Pro) tavan AP ile eşleştirilir; mutfak yazıcısı bu AP'nin Ethernet portuna (Port 9100 RAW) bağlanır.
- Kasa USB adisyon yazıcısı (Epson TM-T20III) yerel porta bağlanır.
- **Tek Yazıcı Mutfak İstasyon Ayrımı Testi:**
  - Aynı masanın tek bir siparişindeki mezeler (Soğuk), etler (Izgara) ve tatlılar aynı anda tek mutfak yazıcısına gönderilir.
  - Yazıcının her istasyon için ayrı bir fiş kestiği (GS V partial cut) ve her fişin en tepesinde devasa `>>> İSTASYON: [ IZGARA MUTFAK ] <<<` başlığı bastığı doğrulanır.
- **Tekrar Baskı (Duplicate Chit) Testi:**
  - Tekrar basılan mutfak fişlerinde belirgin `*** TEKRAR BASKI / DUPLICATE KOPYA - YENİ SİPARİŞ DEĞİLDİR ***` damgasının çıktığı ve mutfakta mükerrer yemek üretimini engellediği doğrulanır.
- Türkçe karakter seti (Ş, İ, ı, ğ, ç, ö, ü) ve 80mm ESC/POS hizalamaları termal kâğıt üzerinde doğrulanır.

**Çıkış ölçütü:** Test siparişlerinin ve iptal fişlerinin mutfak ve adisyon yazıcılarından hatasız, net ve tam Türkçe karakterlerle çıkması.

---

### Faz 5 — Raporlar, Denetim (Audit), Pilot Çalışma ve Kabul
- **Denetim Günlüğü (SCR-13):** Sistemde yapılan her işlemin (Giriş, masa açma, sipariş, 86 açma/kapama, masa taşıma, garson devri, iptal onayı, tekrar baskı, yedekleme) kimlik, zaman damgası ve eski/yeni değerlerle audit tablosuna kaydedildiği doğrulanır.
- **MICROS Örnekli 10 Operasyonel Rapor (SCR-12):**
  1. Operasyon Özeti
  2. Masa Hareketleri
  3. Ürün Satış/Porsiyon Adetleri
  4. Açık Siparişler
  5. Tamamlanan Oturumlar
  6. Bekletilen ve Zamanlı Siparişler
  7. Garson Servis Günlüğü
  8. Sipariş Denetim İzi
  9. İptal ve Onay Raporu
  10. Yazdırma Kuyruğu Günlüğü
- **Pilot Restoran Uygulaması:**
  - Birinci restoranda gerçek servis saatinde canlı pilot başlatılır.
  - Garson ve yöneticilerin kullanımı gözlemlenir, varsa hız ve ergonomi geri bildirimleri sisteme işlenir.
- **Diğer 4 Restorana Yaygınlaştırma:**
  - Pilot restoranın onaylanmasının ardından, hazırlanan standart Docker Compose imajı ve yapılandırma paketi diğer 4 restorana sırayla kurulur.
  - Her restoran tamamen izole ve bağımsız olarak devreye alınır.

**Çıkış ölçütü:** 5 restoranın tamamında sistemin yerel ağda, internetsiz, hatasız ve işletme yöneticisi imzasıyla kabul edilerek çalışması.

---

## 3. Devreye Alma Kontrol Listesi (Checklist)

| Madde | Kontrol Edilecek Husus | Sorumlu | Onay |
|---|---|---|---|
| **1** | Tiwox Dokunmatik Kasa Ubuntu 24.04 LTS kurulumu ve sabit yerel IP (`192.168.10.10`) | Sistem Yöneticisi | [ ] |
| **2** | Keenetic Tavan AP + Mutfak Mesh AP kablosuz köprüsü ve sinyal gücü (-60 dBm veya daha iyi) | Sistem Yöneticisi | [ ] |
| **3** | Mutfak yazıcısı dahili Ethernet portunun Port 9100 RAW soket üzerinden erişilebilirliği | Sistem Yöneticisi | [ ] |
| **4** | Kasa USB yazıcısından fiyatsız servis adisyonu testi | Restoran Yöneticisi | [ ] |
| **5** | Menü kalemleri, zorunlu hazırlama kuralları (pişme dereceleri) ve 86 stok tanımları | Restoran Yöneticisi | [ ] |
| **6** | Garson kullanıcı hesapları ve kişisel PIN kodlarının oluşturulması | Sistem Yöneticisi | [ ] |
| **7** | Mutfak fişinde istasyon başlığı (`>>> İSTASYON: [ ADI ] <<<`) ve kuver sayısının doğrulanması | Şef / Restoran Yöneticisi | [ ] |
| **8** | Gönderilmiş sipariş iptalinde yönetici onayı ve mutfak VOID fişi testi | Restoran Yöneticisi | [ ] |
| **9** | Çift fiş engelleme: Tekrar basımda `DUPLICATE KOPYA` damgası testi | Restoran Yöneticisi | [ ] |
| **10** | Günlük otomatik yedeklemenin USB belleğe (`/mnt/usb/...`) başarıyla yazıldığının teyidi | Sistem Yöneticisi | [ ] |
