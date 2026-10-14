# MERIT ROYAL ALACARTE — Garson ve Servis Personeli Kullanım El Kitabı

**Hedef Kitle:** Salon Servis Personeli, Garsonlar, Komiler, Barmenler  
**Geçerli Restoranlar:** The Roof Garden, The Steak House, Blue Sea Seafood, Royal Mandarin, Bella Merit  
**Cihaz Standardı:** 5.5" / 6" Android Wi-Fi 6 El Terminali veya 10" Servis Tableti  
**Sistem Felsefesi:** %100 Fiyatsız Lüks Servis Koordinasyonu (Adisyonda veya ekranda fiyat/tahsilat bulunmaz)

---

## 1. Hızlı Başlangıç & Giriş (PIN Ekranı)

1. El terminalinin ekranını uyandırın. Ekranda **SCR-01 PIN Giriş Ekranı** görüntülenecektir.
2. Size tanımlı olan **4 Haneli Servis PIN Kodunuzu** tuşlayın.
3. Giriş başarılı olduğunda doğrudan restoranınızın **Masa Planı (SCR-02)** açılır.
4. **Vardiya Güvenliği:** Terminali masada veya cepte taşırken başkasının işlem yapmaması için her işlemden sonra sağ üstteki `KİLİTLE` butonuna basabilir veya 60 saniyelik otomatik kilitlenmeye bırakabilirsiniz.

---

## 2. Masa Durumları ve Masa Açma

Masa planında masaların renkleri operasyonel durumları gösterir:

| Renk | Anlamı | Yapılacak İşlem |
| :--- | :--- | :--- |
| 🟢 **YEŞİL (BOŞ)** | Masa temiz, misafir kabulüne hazır. | Masaya dokunun -> Kuver sayısını girin -> Masayı açın. |
| 🟡 **SARI (SİPARİŞ ALINIYOR)** | Masada misafir var, henüz ilk sipariş mutfağa gönderilmedi. | Masaya dokunun -> Sipariş girişine devam edin. |
| 🔵 **MAVİ (SERVİSTE)** | Sipariş mutfağa iletildi, misafir yemeklerini bekliyor/yiyor. | Yeni tur, içecek ekleme veya hesap kapatma için dokunun. |
| 🟣 **MOR (BİRLEŞİK MASA)** | İki veya daha fazla masa kalabalık grup için birleştirildi. | Ana masadan tüm grubun siparişi tek elden yönetilir. |
| 🔴 **KIRMIZI (RUSH / UYARI)** | Masada acil sipariş veya şef müdahalesi bekleyen talep var. | Öncelikli servis verin. |

### Adım Adım Masa Açma:
1. Boş (Yeşil) masaya dokunun.
2. Açılan pencerede **Kuver (Kişi) Sayısını** seçin (Örn: 4 Kişi).
3. `MASAYI AÇ` butonuna dokunun. Sistem otomatik olarak **Koltuk 1 (Seat 1)** seçili halde sipariş ekranına yönlendirir.

---

## 3. Sipariş Alma: Koltuk (Seat) ve Tur (Course) Mantığı

MICROS lüks otel standardı gereği, tabakların hangi misafire gideceği baştan belirlenir; masaya servis yapılırken "Bu kimindi?" diye sorulmaz.

```
[Masa 12 - 4 Kişi]
  ├── Koltuk 1 (Seat 1) -> Dana Antrikot (Orta Pişmiş, Ekstra Sarımsaklı Tereyağı)
  ├── Koltuk 2 (Seat 2) -> Deniz Levreği (Glutensiz, Sos Yanda)
  ├── Koltuk 3 (Seat 3) -> Kuzu İncik
  └── Koltuk 4 (Seat 4) -> Sezar Salata (Tavuksuz)
```

### Sipariş Adımları:
1. **Koltuk Seçimi:** Ekranın üst bandındaki `Koltuk 1`, `Koltuk 2`, `Koltuk 3`, `Koltuk 4` sekmelerinden ilgili misafiri seçin.
2. **Kategori Seçimi:** Soldaki menü kategorilerinden (Başlangıçlar, Etler, Deniz Ürünleri, Garnitürler, İçecekler) seçim yapın.
3. **Ürün Ekleme:** Ürüne dokunun. Eğer ürünün zorunlu seçenekleri (Modifier) varsa ekran otomatik olarak seçenek pop-up'ını açacaktır.
4. **Ortaya Siparişler (Paylaşımlı):** Masanın ortasına gelen meze, salata veya şarap için `ORTAYA / PAYLAŞIMLI` sekmesine dokunarak ürünü ekleyin.

---

## 4. Hazırlama Seçenekleri (Modifiers) & Prefix Kullanımı

Bir ürüne dokunduğunuzda açılan seçenek ekranında iki tip kural vardır:

### A. Zorunlu Seçenekler (Örn: Pişme Derecesi)
* Et siparişlerinde pişme derecesi seçilmeden ürün siparişe eklenemez:
  - `AZ PİŞMİŞ (RARE)`
  - `ORTA AZ (MEDIUM RARE)`
  - `ORTA (MEDIUM)`
  - `ORTA İYİ (MEDIUM WELL)`
  - `İYİ PİŞMİŞ (WELL DONE)`

### B. Prefix (Ön Ek) Butonları (MICROS Standardı)
Misafirin özel isteklerini mutfağa tek dokunuşla ve hatasız iletmek için ürün veya garnitür seçmeden önce ilgili Prefix butonuna dokunun:

| Prefix Butonu | Mutfak Fişindeki Görünümü | Anlamı ve Örnek |
| :--- | :--- | :--- |
| **`NO` (İstemiyor)** | `- NO TUZ` / `- NO SOĞAN` | Üründen o malzemenin tamamen çıkarılması. |
| **`EXTRA` (Bol / İlave)** | `+ EXTRA SOS` / `+ EXTRA PARMESAN` | Malzemenin bol konulması. |
| **`ON SIDE` (Yanda / Ayrı)** | `* SOS YANDA (ON THE SIDE)` | Sosun tabağa dökülmeyip ayrı kapta gelmesi. |
| **`PLAIN` (Sade)** | `* SADE (PLAIN - HİÇBİR SOS/GARNİTÜR YOK)` | Ürünün katkısız ve yalın hazırlanması. |
| **`SUB` (Değiştir)** | `~ SUB: PATATES YERİNE KUŞKONMAZ` | Standart garnitürün başka bir ürünle değişimi. |

---

## 5. Özel Servis Fonksiyonları (Hızlı Butonlar)

Sipariş ekranının alt çubuğunda operasyonu hızlandıran özel butonlar yer alır:

### 🚨 RUSH (Acil Sipariş)
* Misafir acelesi olduğunu belirttiyse veya geciken bir sipariş varsa kullanılır.
* İlgili ürünün yanındaki `RUSH` butonuna dokunun.
* Ürün mutfak fişinde en üstte **`*** RUSH / ACIL SIPARIS ***`** kalın başlığıyla çıkar ve mutfak zili iki kez çalar.

### 🔁 RE-ORDER (Aynı Siparişi Tekrarla)
* Özellikle içecek servisinde (Örn: Masadaki viski, şarap veya su kadehi bittiğinde) kullanılır.
* Menüde tekrar ürün aramak yerine `RE-ORDER` butonuna dokunup önceki kadehi seçtiğinizde, aynı koltuğa saniyeler içinde yeni sipariş oluşturulur.

### 🛑 86 SAYACI (Tükenen Ürün Uyarısı)
* Bir ürün mutfakta bittiğinde ekranda üzeri kırmızı çizgiyle kapatılır ve üzerinde **`86`** rozeti belirir.
* Sistem bu ürünü seçmenize izin vermez.
* Eğer ürünün yanında `[Son 3 Porsiyon]` gibi bir sayaç varsa, porsiyonlar tükendikçe sayaç otomatik düşer.

---

## 6. Servis Turları (Courses) & FIRE (Pişir) Akışı

Mutfakta yemeklerin soğumaması ve misafirin ritmine göre servis edilmesi için siparişler turlara ayrılır:

```
[TUR 1: SOĞUK BAŞLANGIÇ & MEZE]  ──> Doğrudan Hazırlanır (SEND ile Mutfakta)
[TUR 2: ARA SICAK]              ──> Beklemede (HOLD)
[TUR 3: ANA YEMEK]              ──> Beklemede (HOLD)
```

1. Siparişi girerken ürünleri ilgili tura ekleyin (`BAŞLANGIÇ`, `ARA SICAK`, `ANA YEMEK`, `TATLI`).
2. `SİPARİŞİ GÖNDER (SEND)` dediğinizde 1. Tur hemen hazırlanmaya başlar; sonraki turlar **BEKLEMEDE (HOLD)** olarak kaydedilir.
3. Misafir başlangıçlarını bitirmeye yakın masanın sipariş detayına girip Ana Yemek turunun yanındaki **`🔥 FIRE (PİŞİR)`** butonuna basın.
4. Mutfaktaki tek yazıcıdan doğrudan **`>>> FIRE: MASA 12 - ANA YEMEK HAZIRLA <<<`** fişi çıkar ve aşçılar pişirmeye başlar.

---

## 7. Mutfak Fişi ve Tek Yazıcı Sistemi

Restoranımızda her istasyonda ayrı yazıcı bulunmamaktadır; mutfakta tek bir yüksek hızlı termal yazıcı bulunur.

* Yazıcıdan çıkan fişin en üst bandında büyük harflerle ilgili istasyon yazar:
  - `>>> İSTASYON: [ IZGARA / ET ] <<<`
  - `>>> İSTASYON: [ SOĞUK / MEZE ] <<<`
  - `>>> İSTASYON: [ SICAK TAVA ] <<<`
  - `>>> İSTASYON: [ BAR / TATLI ] <<<`
* Mutfak şefi çıkan fişleri istasyon başlıklarına göre ayırarak ilgili aşçıya sevk eder.

---

## 8. Ürün İptali (Void) ve Şef Onayı

Sipariş mutfağa **GÖNDERİLMEDEN ÖNCE** sepetten serbestçe silinebilir.  
Ancak mutfağa **GÖNDERİLDİKTEN SONRA** aşçılar ürünü hazırlamaya başladığı için garson kendi başına silemez:

1. Sipariş detayında iptal edilecek ürünün yanındaki `İPTAL TALEP ET` butonuna dokunun.
2. Açılan listeden standart iptal gerekçesini seçin:
   - `MİSAFİR VAZGEÇTİ`
   - `YANLIŞ ÜRÜN GİRİLDİ`
   - `ALERJİ / SAĞLIK GEREKÇESİ`
   - `SERVİS GECİKTİ`
3. Talep oluşturulduğunda Kasa / Şef ekranına bildirim düşer.
4. **Şef veya Restoran Müdürü PIN kodu ile onay verene kadar ürün masada sarı renkte "İptal Bekliyor" olarak görünür.**
5. Şef onayladığı anda mutfaktaki yazıcıdan kırmızı iptal ikaz fişi basılır ve ürün kuverden düşer.

---

## 9. Masayı Kapatma (Check-Out)

Merit Royal A La Carte sisteminde **hesap tahsilatı ve para işlemi yoktur**:

1. Misafir masadan ayrıldığında masanın detayına girin.
2. Tüm siparişlerin servis edildiğinden emin olun.
3. Sağ alttaki **`HİZMETİ TAMAMLA & MASAYI KAPAT`** butonuna basın.
4. Sistem masayı kapatır, kuver süresini ve servis dökümünü hafızaya alır ve masa planında masayı tekrar **🟢 YEŞİL (BOŞ / TEMİZ)** durumuna getirir.

---

## 10. Hata ve Acil Durum Rehberi (Sıkça Sorulan Sorular)

| Sorun | Sebebi | Çözüm |
| :--- | :--- | :--- |
| **"Ağ Bağlantısı Kesildi" Uyarısı** | El terminali Wi-Fi kapsama alanı dışına çıkmış veya AP kopmuş olabilir. | Restoran içine doğru birkaç adım atın. Cihaz izole ağa (Keenetic) otomatik bağlanır. Siparişleriniz cihaz hafızasında güvendedir, silinmez. |
| **Mutfak Fişi Çıkmadı** | Yazıcının kağıdı bitmiş veya kapağı açık kalmış olabilir. | Kasa ekranından yazıcı durumunu kontrol edin. Kağıt takıldığında bekleyen fiş otomatik basılır; siparişi ikinci kez girmeyin. |
| **Yanlış Masaya Sipariş Girdim** | Dikkatsizlik sonucu farklı masa numarası seçilmiş. | Hemen Şefe/Kaptana bildirin. Kasa ekranından **Masa Taşıma** işlemiyle sipariş doğru masaya aktarılır. |
| **PIN Kodumu Unuttum** | Güvenlik kilitlenmesi. | Restoran Kaptanına veya Sistem Yöneticisine başvurun; Kasa Yönetim panelinden yeni PIN tanımlanır. |
