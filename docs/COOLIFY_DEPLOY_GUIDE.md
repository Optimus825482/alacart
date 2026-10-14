# Coolify Docker Compose Deploy Rehberi

Bu proje; **Coolify** üzerinde tek bir `docker-compose.yaml` ile hem **Next.js 16 Web Uygulamasını** hem de **PostgreSQL 16 Veritabanını** bağımsız konteynerlar olarak ayağa kaldıracak şekilde hazırlanmıştır.

**Hedef Domain:** `http://alacarte.erkanerdem.online` (ve otomatik HTTPS SSL)

---

## 1. Hazırlanan Dosyalar

* **[docker-compose.yaml](file:///d:/merit/alacarte/docker-compose.yaml)**:
  * `alacarte-db`: PostgreSQL 16 Alpine, kalıcı disk (`alacarte_pgdata`), sağlık kontrolü (`pg_isready`).
  * `alacarte-app`: Next.js 16 uygulaması, Traefik reverse proxy etiketleri (`alacarte.erkanerdem.online`), SSL ve HTTP->HTTPS yönlendirmesi.
* **[Dockerfile](file:///d:/merit/alacarte/Dockerfile)**: Multi-stage, hafif ve güvenli Alpine tabanlı üretim imajı.
* **[docker-entrypoint.sh](file:///d:/merit/alacarte/docker-entrypoint.sh)**: Konteyner açılışında DB bağlantısını ve şemayı hazırlar. Seed varsayılan olarak kapalıdır; açıkça etkinleştirilen seed yalnız boş veritabanında çalışır.
* **[.env.coolify](file:///d:/merit/alacarte/.env.coolify)**: Coolify paneline girilecek çevre değişkenleri.

---

## 2. Coolify Üzerinde Dağıtım (Adım Adım)

### Yöntem A: Git Deposu Üzerinden (Önerilen)
1. Coolify'de repository kaynağını ve **Docker Compose** dağıtımını seçin.
2. Compose dosyasının bulunduğu kök dizini bağlayın.
3. Coolify Secret/Environment bölümünde `DB_USER`, güçlü ve benzersiz `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL` ve benzersiz en az 32 karakterlik `SCHEDULER_SECRET` tanımlayın. `DATABASE_URL` uygulama içinden `alacarte-db:5432` hostunu kullanmalı; paroladaki özel karakterler URL-encode edilmelidir. Repo içindeki veya eski `.env.coolify` dosyasındaki bilinen parolayı kullanmayın.
4. `ALACARTE_COOKIE_SECURE=true` bırakın. `SEED_ON_START=false` ve `ALLOW_DESTRUCTIVE_SEED=false` değerleri standart dağıtımda kapalı kalmalıdır.
5. `https://alacarte.erkanerdem.online` alan adını tanımlayıp deploy edin. PostgreSQL portunu dışarı yayınlamayın.
6. İlk demo hesabı gerekiyorsa seed sırlarını (admin/manager/waiter parolaları ve PIN'leri ile setup anahtarı) Coolify Secret olarak ekleyin; `SEED_ON_START=true` ve `ALLOW_DESTRUCTIVE_SEED=true` değerlerini yalnız boş demo DB'nin ilk açılışında geçici olarak açın. Seed dosyası yıkıcıdır; mevcut veritabanında tekrar çalıştırılmaz. Seed tamamlanınca bu iki değişkeni hemen `false` yapıp yeniden deploy edin.

Mevcut PostgreSQL volume kullanılıyorsa DB parolası rotasyonu yalnızca Compose'daki `DB_PASSWORD` ve `DATABASE_URL` değerlerini değiştirmekle tamamlanmaz; PostgreSQL rol parolası da Coolify'den kontrollü bakımda eşzamanlı değiştirilmelidir. Aksi halde uygulama veritabanına bağlanamaz.

---

### Yöntem B: Coolify Boş Docker Compose Projesi Olarak
1. Coolify panelinde **"New Resource"** ➔ **"Docker Compose"** (Empty Compose) seçin.
2. [docker-compose.yaml](file:///d:/merit/alacarte/docker-compose.yaml) dosyasının içeriğini doğrudan kopyalayıp editöre yapıştırın.
3. Git reposunu bağlayıp **"Deploy"** butonuna basın.

---

## 3. İlk Açılış Akışı
Konteyner başladığında `docker-entrypoint.sh` devreye girer:
1. `alacarte-db` konteynerının hazır olmasını bekler.
2. `npx prisma db push` komutunu çalıştırarak tüm tabloları (Alakartlar, Masalar, Hiyerarşik Kategoriler, Menü Öğeleri, Siparişler vb.) PostgreSQL üzerinde anında oluşturur.
3. Seed varsayılan olarak çalışmaz. Yalnız yukarıdaki iki açık seed anahtarı verilirse ve veritabanında restoran/kullanıcı kaydı yoksa örnek menü ve hesapları yükler.
4. Uygulamayı 3000 portunda başlatır.
5. Coolify Traefik; `http://alacarte.erkanerdem.online` isteklerini otomatik olarak uygulamaya yönlendirir ve Let's Encrypt SSL sertifikasını üretir.

---

## 4. Canlılık Kontrolü (Healthcheck)
`/api/health` yalnızca `{ "status": "ok" }` veya hata durumunda HTTP 503 ve `{ "status": "error" }` döndürür. İç yapılandırma, restoran, kullanıcı, yazıcı veya audit bilgisi yayımlamaz.

## 5. Demo kapsamı ve gerçek donanım sınırı

Coolify dağıtımı web demosudur; restoranın kapalı LAN'ına ve fiziksel yazıcılara bağlanmaz. Sipariş/çıktı kayıtları uygulama içinde incelenebilir, ancak yazdırma işleri **PENDING** kalır ve kullanıcıya fiziksel çıktının teslim edildiği söylenmez. Yedekleme, geri yükleme ve fiziksel cihaz onarımı için doğrulanmış gerçek adaptör/backup hedefi bu dağıtımda bulunmadığından işlemler engellenir. Ağ, yazıcı ve OS spooler göstergeleri ölçülemiyorsa “Bilinmiyor” olarak kalır.

Bu nedenle Coolify demo, kapalı restoran ağına kurulacak üretim sürümünün saha kabulünü veya yazıcı/USB yedek testini karşılamaz. Demo için tutulan Docker/Coolify topolojisi, planın yerel restoran dağıtım hedefinden ayrı değerlendirilir.
