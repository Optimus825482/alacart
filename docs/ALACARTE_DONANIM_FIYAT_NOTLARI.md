# ALACARTE — Donanım Fiyat Notları ve Maliyet Özeti

Merit Royal Hotel & Casino bünyesindeki 5 alakart restoran için belirlenen güncel donanım birim fiyatları, tekil kalem toplamları ve restoran bazlı maliyet dökümü aşağıda özetlenmiştir.

---

## 1. Donanım Kalemleri ve Birim Fiyat Listesi

| Sıra | Donanım Kalemi | Model / Teknik Detay | Birim Fiyat (TL) | Açıklama / Kullanım Alanı |
|:---:|---|---|:---:|---|
| **1** | **Dokunmatik Server Kasa** | Tiwox TP-8610 All-in-One POS | **40.000 TL** | Restoranın ana veritabanı, Web POS ve yazdırma motoru (15.6"–18.5" Dokunmatik, Ubuntu Linux 24.04 + Docker) |
| **2** | **Termal Adisyon Yazıcısı (80mm)** | Epson TM-T20III USB (Model 011) | **9.000 TL** | Kasa yanında fiyatsız masa servis koordinasyon dökümü için USB bağlantılı yazıcı |
| **3** | **Termal Mutfak Yazıcısı (80mm Ethernet)** | Epson TM-T88VII-112 Termal Fiş Yazıcı | **18.000 TL** | Mutfak tezgâhında 500 mm/sn ultra hızlı, dahili Gigabit Ethernet + USB portlu, sesli buzzer uyumlu fiş yazıcısı |
| **4** | **Salon Tavan All-in-One Router & Wi-Fi 6 AP** | Keenetic Voyager Pro KN-3510 (AX1800) | **16.000 TL** | Tavanda bağımsız DHCP Router & Wi-Fi 6 erişim noktası (PoE beslemeli, kasa arkasında harici router kutusu ihtiyacını kaldırır) |
| **5** | **Kasa Yanı Gigabit PoE+ Enjektör** | Keenetic / TP-Link TL-POE160S (802.3at 30W) | **3.000 TL** | Kasadan çıkan tek CAT6 kabloya elektrik basarak tavandaki Voyager Pro'yu besler (Tavanda 220V priz ihtiyacını sıfırlar) |
| **6** | **Mutfak Kablosuz Mesh AP / Köprü** | Keenetic Orbiter Pro KN-3610 | **7.000 TL** | Salondan mutfağa kablo çekilmesini önler; 5 GHz kablosuz mesh ile bağlanarak Ethernet portundan mutfak yazıcısına köprü sağlar |
| **7** | **Dış Mekan Mesh AP (IP65 Long-Range)** | Keenetic Stellar 6 (KAP-650) | **9.000 TL** | Açık teras ve deniz iskelesi olan restoranlar için suya/tuza dayanıklı dış alan Wi-Fi 6 vericisi |

> [!NOTE]
> Garson mobil terminalleri (akıllı telefonlar/tabletler) ve yedekleme USB bellekleri otel işletme envanterinden karşılanmaktadır.

---

## 2. Toplam Maliyet Hesaplamaları

### A. Listelenen 7 Kalemin Tekil Toplamı
Yukarıdaki 7 donanım kaleminden 1'er adet satın alındığında birim toplam:
$$\text{Tekil Liste Toplamı} = 40.000 + 9.000 + 18.000 + 16.000 + 3.000 + 7.000 + 9.000 = \mathbf{102.000\text{ TL}}$$

---

### B. Restoran Başına Paket Maliyeti

1. **Standart Restoran Paketi (Kapalı Salon & Standart Alan):**
   * *Restoranlar:* The Steak House, Royal Mandarin, Bella Merit (1–6. kalemler)
   * $\text{Paket Tutarı} = 40.000 + 9.000 + 18.000 + 16.000 + 3.000 + 7.000 = \mathbf{93.000\text{ TL}}$

2. **Dış Alanlı Restoran Paketi (Geniş Teras veya Açık İskele):**
   * *Restoranlar:* The Roof Garden (Geniş Çatı Terası), Blue Sea (50–80m Açık Deniz İskelesi)
   * Standart Paket (93.000 TL) + 1x Keenetic Stellar 6 Dış Ortam AP (9.000 TL)
   * $\text{Paket Tutarı} = 93.000 + 9.000 = \mathbf{102.000\text{ TL}}$

---

### C. 5 Restoranın Genel Donanım Yatırım Bütçesi

| Restoran | Restoran Tipi | Donanım Kapsamı | Tutar (TL) |
|---|---|---|:---:|
| **The Steak House** | Standart Salon + Havuz Başı | 1 Dokunmatik Kasa + 2 Yazıcı + Tavan Router + PoE + Mutfak Mesh AP | **93.000 TL** |
| **Royal Mandarin** | Standart Salon + Sakin Bahçe | 1 Dokunmatik Kasa + 2 Yazıcı + Tavan Router + PoE + Mutfak Mesh AP | **93.000 TL** |
| **Bella Merit** | Standart Salon + Bahçe Terası | 1 Dokunmatik Kasa + 2 Yazıcı + Tavan Router + PoE + Mutfak Mesh AP | **93.000 TL** |
| **The Roof Garden** | Lounge + 250 m² Açık Teras | Standart Paket + 1x Keenetic Stellar 6 Dış Ortam AP | **102.000 TL** |
| **Blue Sea** | İç Salon + 80m Deniz İskelesi | Standart Paket + 1x Keenetic Stellar 6 Dış Ortam AP | **102.000 TL** |
| **GENEL TOPLAM** | **5 Restoranın Tamamı** | **7 Kalem Donanım Dağılımı (Toplam 37 Donanım Ünitesi)** | **483.000 TL** |
