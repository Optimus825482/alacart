#!/bin/sh
set -e

echo "=== [A LA CARTE] Container Başlatılıyor ==="

# 1. PostgreSQL Veritabanı Hazırlık Kontrolü
echo ">> Veritabanı bağlantısı doğrulanıyor..."
max_retries=30
counter=0

until nc -z -v -w3 ${DB_HOST:-alacarte-db} 5432 2>/dev/null; do
  counter=$((counter + 1))
  if [ $counter -gt $max_retries ]; then
    echo "HATA: Veritabanına 30 denemede ulaşılamadı. Başlatma durduruluyor."
    exit 1
  fi
  echo "Veritabanı bekleniyor ($counter/$max_retries)..."
  sleep 2
done

echo ">> Veritabanı aktif ve hazır!"

# 2. Prisma İstemcisini Yeniden Oluştur (schema değişikliklerini yansıt)
echo ">> Prisma istemcisi oluşturuluyor (prisma generate)..."
npx prisma generate || { echo "HATA: Prisma generate başarısız oldu!"; exit 1; }

# 3. Prisma Şemasını Veritabanına Senkronize Et (db push - indeksler dahil)
echo ">> Prisma veritabanı şeması aktarılıyor (prisma db push)..."
npx prisma db push --skip-generate || { echo "HATA: Prisma db push başarısız oldu!"; exit 1; }

# Seed yalnızca açıkça etkinleştirilirse ve seed dosyasının yıkıcı çalışması ayrıca onaylanırsa yürütülür.
if [ "${SEED_ON_START:-false}" = "true" ]; then
  if [ "${ALLOW_DESTRUCTIVE_SEED:-false}" != "true" ]; then
    echo "HATA: SEED_ON_START=true için ALLOW_DESTRUCTIVE_SEED=true zorunludur."
    exit 1
  fi
  existing_data=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.restaurantConfig.count(),p.user.count()]).then(([c,u])=>process.stdout.write(String(c+u))).finally(()=>p.\$disconnect())")
  if [ "$existing_data" != "0" ]; then
    echo ">> Seed atlandı: mevcut restoran veya kullanıcı verisi bulundu; veri korunuyor."
  else
    echo ">> Boş veritabanı tespit edildi; açıkça etkinleştirilen ilk kurulum seed'i çalışıyor..."
    npx tsx prisma/seed.ts
  fi
else
  echo ">> Seed devre dışı; mevcut restoran verisi korunuyor."
fi

echo "=== [A LA CARTE] Uygulama Başlatılıyor (Port 3000) ==="
exec "$@"
