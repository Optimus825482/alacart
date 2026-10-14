# MERIT ROYAL ALACARTE — Yerel Sistem Yöneticisi, Bakım ve Felaket Kurtarma Kılavuzu

**Hedef Kitle:** Otel Bilgi İşlem (IT) Ekibi, Saha Sistem Yöneticileri, Teknik Destek Mühendisleri  
**Sistem Altyapısı:** Air-Gapped (Dış Dünyaya Kapalı) Yerel Ağ, Ubuntu 24.04 LTS, Docker Compose, PostgreSQL / SQLite, Next.js, Keenetic Wi-Fi 6 Mesh  
**Temel İlke:** Sıfır İnternet Bağımlılığı, Sıfır Veri Kaybı (RPO < 1 dk), Maksimum 5 Dakika Kurtarma Süresi (RTO < 5 dk)

---

## 1. Sistem Mimarisi & IP Adresleme Planı

Her alakart restoran tamamen bağımsız ve izole bir yerel ağa (Subnet) sahiptir. Restoranların genel ağ şeması şu şekildedir:

```
[Keenetic Voyager Pro - Ana Router / Wi-Fi 6 AP] (192.168.X.1)
  ├── Port 1 (PoE IN): Boş (Bağımsız Güç Adaptörlü)
  ├── Port 2: Master POS Kasa / Yerel Sunucu (192.168.X.10 - Statik)
  ├── Wi-Fi 6 Mesh Bağlantısı: Mutfak Wi-Fi Köprüsü (Keenetic Orbiter Pro) (192.168.X.2)
  │     └── LAN Portu: Ethernet Mutfak Yazıcısı (192.168.X.50 - Statik, Port 9100)
  └── Wi-Fi 6 SSID (WPA3-SAE): El Terminalleri & Tabletler (192.168.X.100 - .200 DHCP)
```

### Restoran IP Blok Tablosu:
* **The Roof Garden:** `192.168.11.0/24` (Sunucu: `.11.10`, Yazıcı: `.11.50`)
* **The Steak House:** `192.168.12.0/24` (Sunucu: `.12.10`, Yazıcı: `.12.50`)
* **Blue Sea Seafood:** `192.168.13.0/24` (Sunucu: `.13.10`, Yazıcı: `.13.50`)
* **Royal Mandarin:** `192.168.14.0/24` (Sunucu: `.14.10`, Yazıcı: `.14.50`)
* **Bella Merit:** `192.168.15.0/24` (Sunucu: `.15.10`, Yazıcı: `.15.50`)

---

## 2. Sunucu Başlatma, Kapatma ve Otomatik Servis Yönetimi

Dokunmatik Kasa (Master POS), restoranın ana sunucusudur.

### Otomatik Açılış (Power On on AC):
* Kasanın BIOS ayarlarında `Restore on AC Power Loss` seçeneği **`Power On`** olarak kilitlenmiştir.
* Şalter veya elektrik açıldığında kasa düğmesine basılmasa dahi otomatik olarak açılır.

### Docker Servislerinin Otomatik Başlaması:
Ubuntu işletim sistemi açıldığında `systemd` servisi Docker daemon'ı ve konteynerleri ayağa kaldırır:
```bash
# Servislerin durumunu kontrol etme
sudo docker compose -f /opt/alacarte/docker-compose.yml ps

# Servisleri yeniden başlatma (Gerektiğinde)
sudo docker compose -f /opt/alacarte/docker-compose.yml restart

# Canlı logları izleme
sudo docker compose -f /opt/alacarte/docker-compose.yml logs -f --tail=100
```

---

## 3. Mutfak Yazıcısı Yönetimi ve Arıza Giderme

Mutfaktaki tek termal yazıcı (80mm ESC/POS), ağ üzerinden TCP soket bağlantısıyla (`Port 9100`) çalışır.

### Otomatik Yazdırma Kuyruğu & Retry Mekanizması:
1. Sipariş verildiğinde sunucu doğrudan yazıcıya bağlanır (`192.168.X.50:9100`).
2. Eğer yazıcı kapalıysa veya kağıdı bitmişse sistem siparişi bellekteki kuyrukta (**PrintQueue**) bekletir.
3. Yazıcı tekrar hatta girdiğinde fiş **hiçbir veri kaybı olmadan otomatik olarak basılır**.

### Sık Karşılaşılan Yazıcı Sorunları ve Çözümleri:
* **Kağıt Bitti / Kırmızı Işık Yanıyor:** Kapağı açın, yeni 80mm termal rulo takın, mandalı sıkıca kapatın. Kuyrukta bekleyen fiş 5 saniye içinde kendiliğinden basılacaktır.
* **Yazıcıya Ulaşılamıyor (Ping Yanıt Vermiyor):**
  1. Yazıcının Ethernet kablosunun mutfaktaki Keenetic Orbiter Pro'nun LAN portuna takılı olduğundan emin olun.
  2. Yazıcıyı kapatıp açarken `FEED` butonuna basılı tutarak **Self-Test** çıktısı alın. Çıktıdaki IP adresinin `192.168.X.50` olduğunu teyit edin.
  3. Kasa terminalinden ping atın:
     ```bash
     ping -c 4 192.168.X.50
     ```

---

## 4. Keenetic Wi-Fi 6 Mesh Ağı Teşhis ve Bakımı

El terminallerinin salonda kesintisiz dolaşımı için Wi-Fi 6 Mesh (802.11k/v/r) kullanılır:

1. **Yönetim Paneline Giriş:** Kasa tarayıcısından `http://192.168.X.1` adresine gidin (Varsayılan kullanıcı: `admin`, şifre: Restoran IT Kasasında saklıdır).
2. **Kablosuz Cihazları İzleme:** `Kablosuz Cihazlar` menüsünden hangi el terminalinin hangi AP'ye bağlı olduğunu ve sinyal seviyesini (`RSSI` değerini) inceleyin. İdeal değer `-40 dBm` ile `-65 dBm` arasıdır.
3. **El Terminali Statik DHCP Tanımı:** Yeni bir el terminali alındığında listeden cihaz seçilerek `IP Adresini Sabitle` butonuna tıklanır.

---

## 5. Yedekleme Politikası (Döngüsel 15 Kopya & Harici USB)

Veri kaybına karşı sistem çift katmanlı yedekleme yapar:

1. **Yerel NVMe SSD Yedeği:** Her 30 dakikada bir veritabanı yedeği alınır ve son 15 kopya saklanır (`/var/backups/alacarte/`).
2. **Harici USB Flash Disk Yedeği:** Kasaya takılı olan endüstriyel metal gövdeli USB diske her sipariş işleminde eşzamanlı yedek alınır.

### Elle Anlık Yedek Alma Komutu:
```bash
sudo /opt/alacarte/scripts/backup_now.sh
```

---

## 6. Felaket Kurtarma Prosedürü (Disaster Recovery SOP)

**Senaryo:** Ana Dokunmatik Kasa üzerine sıvı döküldü, anakartı yandı veya fiziksel olarak tamamen kullanılmaz hale geldi.  
**Hedef:** 5 dakika içinde yedek Hot-Spare bilgisayar ile restoranı kesintisiz olarak canlıya almak.

### 5 Adımda Anında Canlıya Geçiş:
1. **USB Diski Çıkarın:** Arızalanan kasanın arkasında takılı olan yedekleme USB diskini çıkarın.
2. **Yedek Bilgisayarı (Hot Spare) Konumlandırın:** IT deposunda hazır bekleyen yedek mini PC / dokunmatik kasayı kasapozisyonuna yerleştirin, elektrik ve Ethernet kablosunu takın.
3. **USB Diski Yedek Kasaya Takın:** USB diski yedek kasanın mavi USB 3.0 portuna takın.
4. **Kurtarma Script'ini Çalıştırın:**
   Kasanın masaüstündeki `FELAKET KURTARMA (RESTORE)` kısayoluna çift tıklayın (veya terminalden şu komutu girin):
   ```bash
   sudo /opt/alacarte/scripts/restore_from_usb.sh
   ```
5. **Sistem Doğrulaması:**
   * Script son 30 saniye içindeki en güncel veritabanı yedeğini bularak PostgreSQL/SQLite içine yükler.
   * Kasanın yerel IP'sini otomatik olarak ilgili restoranın sunucu IP'sine (`192.168.X.10`) sabitler.
   * Docker servisleri ayağa kalkar.
   * **Sonuç:** Garson el terminalleri hiçbir ayar değişikliğine gerek duymadan anında yeni kasaya bağlanır; masaların kuverleri, siparişleri ve açık hesapları kaldığı yerden devam eder.

---

## 7. Rutin Bakım Kontrol Listesi

| Periyot | Görev | Sorumlu |
| :--- | :--- | :--- |
| **Hergün (Servis Öncesi)** | Mutfak yazıcısı test fişi alma ve rulo doluluk kontrolü. | Kasa Kaptanı |
| **Haftalık** | Harici USB diskin yedekleme loglarının doğrulanması (`backup.log`). | Saha IT |
| **Aylık** | Keenetic Mesh AP firmware kontrolü ve Wi-Fi sinyal ölçümü (Heatmap kontrolü). | Ağ Mühendisi |
| **3 Aylık** | Kasa iç fan temizliği ve termal yazıcı kafa temizleme kalemi ile bakımı. | Donanım Teknisyeni |
