# MERIT ROYAL ALACARTE — Restoran Yöneticisi ve Mutfak Şefi Operasyon Kılavuzu

**Hedef Kitle:** Restoran Müdürü, Restoran Kaptanları, Mutfak Şefi (Executive / Sous Chef), F&B Denetçileri  
**Geçerli Restoranlar:** The Roof Garden, The Steak House, Blue Sea Seafood, Royal Mandarin, Bella Merit  
**Cihaz Standardı:** 15.6" Dokunmatik Kasa Ekranı (Master POS) veya 10" Yönetici Tableti  
**Sistem Felsefesi:** Fiyatsız Lüks Operasyon, Yüksek Disiplinli Mutfak Koordinasyonu ve Tam Denetim İzi (Audit Log)

---

## 1. Yönetici Yetkilendirmesi ve Giriş

Yönetici fonksiyonları standart garson ekranından ayrı bir güvenlik katmanına sahiptir:

1. Kasa ana ekranında sağ üst köşedeki **`YÖNETİCİ PANELİ`** butonuna dokunun.
2. Açılan pencerede **Yönetici PIN Kodunuzu** (6 Haneli Güvenlik PIN'i) girin.
3. Yetkili oturumu açıldığında ekran çerçevesinde altın renkli yönetici bandı belirir.
4. **Denetim Prensibi:** Bu modda yapılan her işlem (iptal onayı, masa birleştirme, stok kapatma) işlem yapan yöneticinin kimliği, zaman damgası ve SHA-256 hash imzasıyla `AuditLog` tablosuna kalıcı olarak işlenir.

---

## 2. Ürün İptali (Void) ve İade Onay Prosedürü

Mutfak fişi basılmış hiçbir sipariş, garson tarafından doğrudan iptal edilemez. Bu kural mutfak zayiatını ve kontrolsüz tabak çıkışını önler.

```
[Garson İptal Talebi Açar] 
       │
       ▼
[Kasa / Şef Ekranında Sesli & Görsel Uyarı (Kırmızı Rozet)]
       │
       ▼
[Şef veya Müdür Talebi İnceler: Hazırlandı mı? / Ateşte mi?]
    ├── HAZIRLANDI (MİSAFİR VAZGEÇTİ) ──> ONAYLA (ZAYİAT / FIRE KAYDI)
    ├── HENÜZ PİŞMEDİ                  ──> ONAYLA (MUTFAK İPTAL FİŞİ BASILIR)
    └── İPTAL UYGUN DEĞİL              ──> GEREKÇE İLE REDDET
```

### Onay / Ret Adımları:
1. Kasa ekranındaki **`İPTAL TALEPLERİ (VOID)`** sekmesine dokunun.
2. Bekleyen talebin detayını inceleyin: Masa Numarası, Ürün Adı, Koltuk No, Talep Eden Garson ve Gerekçe.
3. Kararınızı verin:
   - **`ONAYLA`**: Sistem onayladığınız anda mutfak yazıcısından otomatik olarak ters renkli/kalın **`*** SIPARIS IPTAL / VOID EDILDI ***`** fişi basar. Ürün masadan düşer ve iptal istatistiklerine kaydedilir.
   - **`REDDET`**: Ürünün piştiğini veya servise çıktığını belirterek `REDDET` butonuna basın. Garsonun el terminaline "İptal Şef Tarafından Reddedildi" mesajı iletilir.

---

## 3. "86" Stok Sayacı ve Ürün Kapatma Yönetimi

Restoranda bir malzemenin (Örn: Wagyu Antrikot, Taze Istakoz veya Günün Balığı) son porsiyonları kaldığında veya tükendiğinde MICROS standardı olan **"Item 86"** sistemi kullanılır.

### A. Kalan Porsiyon Sayacı Tanımlama:
1. Yönetici panelinden **`86 SAYACI / STOK KONTROL`** menüsüne girin.
2. İlgili ürünü seçin (Örn: *Dana Şaşlık*).
3. `Kalan Porsiyon Sayısı` alanına eldeki miktarı yazın (Örn: `6`).
4. `SAYACI AKTİF ET` butonuna dokunun.
5. **Sonuç:** Tüm garsonların el terminallerindeki ürün butonunda `[Son 6]` ibaresi çıkar. Her sipariş girildiğinde sayaç canlı olarak `5, 4, 3...` şeklinde düşer.

### B. Ürünü Tamamen Servise Kapatma (86 Etme):
1. Sayaç sıfıra ulaştığında veya şef anlık olarak ürünü durdurmak istediğinde `ÜRÜNÜ KAPAT (86 YAP)` butonuna basılır.
2. Tüm el terminallerinde ürünün üzeri anında kırmızı çizgiyle çizilir ve pasife alınır. Hiçbir garson o ürünü seçemez.

### C. Ürünü Yeniden Açma:
* Mutfaktan yeni tedarik sağlandığında aynı ekrandan `SERVİSE AÇ` butonuna basılarak ürün anında menüye geri kazandırılır.

---

## 4. Masa Operasyonları: Taşıma, Birleştirme ve Garson Devri

Yoğun servis saatlerinde salon operasyonunu esnetmek için 3 temel masa fonksiyonu kullanılır:

### 1. Masa Taşıma (Table Transfer)
Misafir masasını değiştirmek istediğinde (Örn: Rüzgar sebebiyle Masa 4'ten Masa 10'a geçiş):
1. Kasa ekranında kaynak masaya (Masa 4) dokunun.
2. Alt menüden **`MASA TAŞI`** butonuna basın.
3. Hedef masayı (Masa 10) seçin.
4. `ONAYLA` butonuna basın.
5. **Sonuç:** Masadaki tüm kuverler, koltuk siparişleri, pişmekte olan turlar eksiksiz olarak yeni masaya aktarılır. Mutfaktaki aşçıların karışıklık yaşamaması için mutfak yazıcısından **`>>> BILGI: MASA 4 -> MASA 10'A TASINDI <<<`** bilgi fişi basılır.

### 2. Masa Birleştirme (Table Merge)
Kalabalık VIP gruplar için iki veya daha fazla masa birleştirildiğinde (Örn: Masa 7 ve Masa 8):
1. Ana masaya (Masa 7) dokunun.
2. **`MASA BİRLEŞTİR`** butonuna basın.
3. Birleştirilecek yan masayı (Masa 8) seçin.
4. `BİRLEŞTİR` butonuna basın.
5. **Sonuç:** Masa planında her iki masa da **🟣 MOR (BİRLEŞİK)** renge bürünür. Siparişler tek bir adisyon altında toplanır. Grup kalktığında masalar otomatik olarak eski bağımsız durumlarına döner.

### 3. Garson Devri (Server Shift Transfer)
Vardiya bittiğinde veya mola saatinde bir garsonun açık masalarını başka bir personele devretmesi:
1. Yönetici panelinden **`GARSON DEVRİ`** butonuna basın.
2. Devreden garsonu (Örn: *Ahmet K.*) ve Devralan garsonu (Örn: *Mehmet Y.*) seçin.
3. Devredilecek masaları işaretleyin (veya `TÜMÜNÜ SEÇ`).
4. Yönetici PIN'i ile onaylayın.
5. Açık masaların tüm servis sorumluluğu yeni personele geçer; denetim logunda devir saati kayıt altına alınır.

---

## 5. Fiş Tekrar Basma (Duplicate / Reprint Receipt)

Mutfakta ıslanan, kaybolan veya servis koordinasyonu için tekrar basılması gereken fişler için:

1. Kasa ekranından ilgili masanın detayına girin.
2. Sayfanın üstündeki **`FİŞ TEKRAR BAS (REPRINT)`** butonuna dokunun.
3. Hangi fişin basılacağını seçin:
   - `Mutfak Sipariş Fişi (Son Sipariş)`
   - `Adisyon Servis Döküm Fişi`
4. `YAZDIR` butonuna basın.
5. **Güvenlik Standardı:** Çıkan fişin en üstünde büyük ve çift satır olarak:
   ```
   ================================================
   *** KOPYA / DUPLICATE FIS (GECERSIZDIR) ***
   YAZDIRILMA SAYISI: 2
   YAZDIRAN: RESTORAN MUDURU (PIN: ****)
   ZAMAN: 14.10.2026 21:45
   ================================================
   ```
   bilgisi basılır. Bu sayede mutfakta mükerrer yemek pişirilmesi kesinlikle engellenir.

---

## 6. Gün Sonu Kapanış ve Z-Raporu (End of Day)

Merit Royal A La Carte sisteminde **ciro, tahsilat, vergi veya nakit/kredi kartı toplamı bulunmaz.**  
Gün Sonu Raporu tamamen **operasyonel verimlilik, kuver ve mutfak servis analizi** üzerine kuruludur.

### Kapanış Prosedürü:
1. Salondaki tüm masaların kapatıldığından (Masa planında tüm masaların yeşil olduğundan) emin olun. Açık masa varken gün sonu alınamaz.
2. Yönetici panelinden **`GÜN SONU / Z-RAPORU`** sekmesine girin.
3. `GÜNÜ KAPAT VE RAPOR ÜRET` butonuna dokunun.
4. Yönetici PIN kodunuzu girerek işlemi onaylayın.

### Çıkan Z-Raporunun İçeriği:
Yazıcıdan ve ekrandan dökülen fiyatsız operasyonel Z-Raporu şu metrikleri içerir:
* **Toplam Oturum & Kuver:** Restoranda ağırlanan toplam misafir sayısı (Örn: *148 Kuver*).
* **Masa Devir Hızı:** Ortalama bir masada misafirin kalış süresi (Örn: *82 Dakika*).
* **İstasyon Bazlı Tabak Sayıları:**
  - Soğuk / Meze: 210 Tabak
  - Izgara / Et: 124 Tabak
  - Tava / Sıcak: 98 Tabak
  - Tatlı / Bar: 135 Tabak
* **Zayiat & İptal (Void) Raporu:** Gün içinde iptal edilen ürün adedi ve iptal gerekçeleri dağılımı.
* **Rush (Acil) Sipariş Oranı:** Servis temposunu ölçmek için acil bayrağı ile gönderilen sipariş sayısı.

---

## 7. Menü, İstasyon ve Zorunlu Modifier Yönetimi

Sistem ilk kurulum sonrasında menüde yapılacak değişiklikleri (yeni ürün, garnitür, pişme derecesi kuralı) yönetici ekranından destekler:

1. Yönetici Panelinden **`MENÜ YÖNETİMİ`** sekmesine girin.
2. İlgili ürünü seçin.
3. **Zorunlu Seçenek Ekleme:** `Yeni Modifier Grubu` -> `Zorunlu (Required)` işaretleyin. (Örn: *Minimum 1, Maksimum 1 seçim* kuralı koyun).
4. **İstasyon Yönlendirme:** Ürünün hangi mutfak istasyonuna ait olduğunu seçin (`SICAK`, `SOGUK_MEZE`, `IZGARA`, `BAR_TATLI`).
5. `KAYDET` dediğiniz anda tüm el terminalleri 3 saniye içinde yeni menü ağacını canlı olarak günceller.
