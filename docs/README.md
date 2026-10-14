# MERIT ROYAL ALACARTE — Proje Dokümantasyon Dizini

Bu dizin, Merit Royal Hotel & Casino bünyesindeki 5 A La Carte restoran (**The Roof Garden**, **The Steak House**, **Blue Sea Seafood**, **Royal Mandarin**, **Bella Merit**) için geliştirilen özel dijital servis, mutfak sevk ve izole ağ sistemine ait tüm resmi plan, mimari ve kılavuz belgelerini içerir.

---

## Doküman İndeksi

| Doküman | Kapsam ve Açıklama |
| :--- | :--- |
| [**MERIT_ROYAL_5_ALACARTE_IZOLE_AG_VE_OPERASYON_MIMARISI.md**](file:///d:/merit/alacarte/docs/MERIT_ROYAL_5_ALACARTE_IZOLE_AG_VE_OPERASYON_MIMARISI.md) | 5 restoranın saha mimarisi, izole kapalı ağ (Air-Gapped) topolojisi, MICROS referanslı fiyatsız servis akışı, ESC/POS fiş formatları ve restoran bazlı devreye alma kontrol listesi. |
| [**ALACARTE_DONANIM_PAKET_PLANI.md**](file:///d:/merit/alacarte/docs/ALACARTE_DONANIM_PAKET_PLANI.md) | Restoran başına 7 kalemlik standart donanım paketi (BOM), All-in-One tavan Router & Wi-Fi 6 AP'ler (Keenetic Voyager Pro), kablosuz mutfak mesh köprüsü, dahili Ethernetli mutfak yazıcısı ve satın alma maliyet tablosu (60.942 TL / Restoran). |
| [**ALACARTE_SIFIRDAN_URUN_VE_KURULUM_PLANI.md**](file:///d:/merit/alacarte/docs/ALACARTE_SIFIRDAN_URUN_VE_KURULUM_PLANI.md) | 19 ekranlı Alacarte sisteminin uçtan uca mimari şartnamesi, iş kuralları, RBAC yetki matrisi, veri saklama politikası, 15 kopyalı döngüsel yedekleme ve donanım kabul kriterleri. |
| [**ALACARTE_UYGULAMA_VE_DEVREYE_ALMA_FAZLARI.md**](file:///d:/merit/alacarte/docs/ALACARTE_UYGULAMA_VE_DEVREYE_ALMA_FAZLARI.md) | Faz 1'den Faz 5'e uygulama hazırlık, izole ağ & donanım kurulumu, uçtan uca simülasyon, pilot canlı servis ve 5 restorana yayılım kontrol listesi. |
| [**ALACARTE_GARSON_KULLANIM_KILAVUZU.md**](file:///d:/merit/alacarte/docs/ALACARTE_GARSON_KULLANIM_KILAVUZU.md) | Salon servis personeli ve garsonlar için el terminalinden PIN ile giriş, kuver/koltuk bazlı sipariş, Prefix (NO/EXTRA/ON SIDE), Rush, Re-Order ve Fire kullanım el kitabı. |
| [**ALACARTE_YONETICI_VE_SEF_KILAVUZU.md**](file:///d:/merit/alacarte/docs/ALACARTE_YONETICI_VE_SEF_KILAVUZU.md) | Restoran Müdürü ve Mutfak Şefi için Kasa Master POS ekranından iptal (void) onayı, 86 stok sayacı yönetimi, masa taşıma/birleştirme, garson devri, fiş tekrar basma (reprint) ve fiyatsız Z-raporu operasyon SOP'si. |
| [**ALACARTE_BAKIM_VE_FELAKET_KURTARMA_KILAVUZU.md**](file:///d:/merit/alacarte/docs/ALACARTE_BAKIM_VE_FELAKET_KURTARMA_KILAVUZU.md) | Otel IT ekibi için Air-Gapped yerel ağ yönetimi, Keenetic Wi-Fi 6 Mesh bakımı, TCP 9100 mutfak yazıcı kuyruğu arıza giderme, 15 kopyalı USB yedekleme ve 5 dakikada Hot-Spare felaket kurtarma (Disaster Recovery). |
| [**ALACARTE_PLAN_UYGUNLUK_RAPORU.md**](file:///d:/merit/alacarte/docs/ALACARTE_PLAN_UYGUNLUK_RAPORU.md) | Kod tabanının kurulum ve ürün planına uygunluk analizi, tespit edilen ve çözülen kritik hatalar (atomik sipariş, kısmi iptal, saat dilimi, hash zinciri, tip güvenliği). |
| [**COOLIFY_DEPLOY_GUIDE.md**](file:///d:/merit/alacarte/docs/COOLIFY_DEPLOY_GUIDE.md) | Demo ve test ortamları için Coolify / Docker Compose dağıtım kılavuzu ve ortam değişkenleri (Secret) konfigürasyonu. |

---

> [!IMPORTANT]
> **Temel Sistem Standartları:**
> 1. **Fiyat & Tahsilat Yok:** Sistem hiçbir adisyon fişinde veya ekranda fiyat, toplam, vergi veya ödeme tutarı barındırmaz; fiyatsız servis koordinasyonu sağlar.
> 2. **Sıfır Dış Entegrasyon:** Otel PMS (Opera/Fidelio), muhasebe veya internete kesinlikle bağlı değildir. Her restoran kendi kapalı yerel ağında çalışır.
> 3. **Saat Dilimi:** Sistem saat dilimi Kıbrıs / Lefkoşa standardı olan **`Asia/Nicosia`** olarak yapılandırılmıştır.
> 4. **Sunucu Mimarisi:** Dokunmatik kasa üzerinde Ubuntu Linux 24.04 LTS ve Docker Compose altyapısıyla çalışır.
