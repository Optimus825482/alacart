# Coolify Docker Compose Deploy Rehberi

Bu proje; **Coolify** üzerinde tek bir `docker-compose.yaml` ile hem **Next.js 16 Web Uygulamasını** hem de **PostgreSQL 16 Veritabanını** bağımsız konteynerlar olarak ayağa kaldıracak şekilde hazırlanmıştır.

**Hedef Domain:** `http://alacarte.erkanerdem.online` (ve otomatik HTTPS SSL)

---

## 1. Hazırlanan Dosyalar

* **[docker-compose.yaml](file:///d:/merit/alacarte/docker-compose.yaml)**:
  * `alacarte-db`: PostgreSQL 16 Alpine, kalıcı disk (`alacarte_pgdata`), sağlık kontrolü (`pg_isready`).
  * `alacarte-app`: Next.js 16 uygulaması, Traefik reverse proxy etiketleri (`alacarte.erkanerdem.online`), SSL ve HTTP->HTTPS yönlendirmesi.
* **[Dockerfile](file:///d:/merit/alacarte/Dockerfile)**: Multi-stage, hafif ve güvenli Alpine tabanlı üretim imajı.
* **[docker-entrypoint.sh](file:///d:/merit/alacarte/docker-entrypoint.sh)**: Konteyner açıldığında veritabanını bekler, `prisma db push` ile tabloları otomatik oluşturur ve veritabanı boşsa `seed.ts` ile başlangıç menülerini yükler.
* **[.env.coolify](file:///d:/merit/alacarte/.env.coolify)**: Coolify paneline girilecek çevre değişkenleri.

---

## 2. Coolify Üzerinde Dağıtım (Adım Adım)

### Yöntem A: Git Deposu Üzerinden (Önerilen)
1. Bu projeyi GitHub / GitLab / Gitea deponuza push edin:
   ```bash
   git add .
   git commit -m "feat: Coolify Docker Compose deployment files"
   git push origin main
   ```
2. Coolify panelinizde **"New Resource"** ➔ **"Public/Private Repository"** seçin.
3. Projenizin Git adresini girin.
4. **Build Pack** olarak **`Docker Compose`** seçin.
5. **Environment Variables** bölümüne [.env.coolify](file:///d:/merit/alacarte/.env.coolify) içindeki değerleri ekleyin:
   * `DB_USER=alacarte_user`
   * `DB_PASSWORD=AlacarteSecret2026!`
   * `DB_NAME=alacarte_db`
6. **Domains / FQDN** alanına `https://alacarte.erkanerdem.online` yazın.
7. **"Deploy"** butonuna basın.

---

### Yöntem B: Coolify Boş Docker Compose Projesi Olarak
1. Coolify panelinde **"New Resource"** ➔ **"Docker Compose"** (Empty Compose) seçin.
2. [docker-compose.yaml](file:///d:/merit/alacarte/docker-compose.yaml) dosyasının içeriğini doğrudan kopyalayıp editöre yapıştırın.
3. Git reposunu bağlayıp **"Deploy"** butonuna basın.

---

## 3. Otomatik İlk Açılış Akışı (Sıfır Manuel İşlem)
Konteyner ilk çalıştığında `docker-entrypoint.sh` devreye girer:
1. `alacarte-db` konteynerının hazır olmasını bekler.
2. `npx prisma db push` komutunu çalıştırarak tüm tabloları (Alakartlar, Masalar, Hiyerarşik Kategoriler, Menü Öğeleri, Siparişler vb.) PostgreSQL üzerinde anında oluşturur.
3. Veritabanının boş olduğunu tespit ederse `npx tsx prisma/seed.ts` scriptini çalıştırarak İtalyan, Balık, Steakhouse alakartlarını ve örnek zengin menüyü veritabanına yükler.
4. Uygulamayı 3000 portunda başlatır.
5. Coolify Traefik; `http://alacarte.erkanerdem.online` isteklerini otomatik olarak uygulamaya yönlendirir ve Let's Encrypt SSL sertifikasını üretir.

---

## 4. Canlılık Kontrolü (Healthcheck)
Uygulama içinde `/api/health` rotası tanımlanmıştır. Coolify veya Traefik bu endpoint üzerinden uygulamanın ve veritabanının ayakta olduğunu doğrular:
* `GET https://alacarte.erkanerdem.online/api/health` ➔ `{"status": "ok", "database": "connected"}`
