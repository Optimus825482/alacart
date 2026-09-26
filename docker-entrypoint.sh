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

# 4. Başlangıç Tohum (Seed) Verileri
echo ">> Başlangıç verileri kontrol ediliyor..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const restCount = await prisma.restaurant.count();
  const restCatCount = await prisma.category.count({ where: { restaurantId: { not: null } } });
  if (restCount < 5 || restCatCount === 0) {
    console.log('>> Alakart restoranlara özel menüler ve kullanıcılar yükleniyor (seed)...');
    require('child_process').execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
  } else {
    console.log('>> Veritabanında restorana özel menüler mevcut (' + restCatCount + ' kategori), seed adımı atlandı.');
  }
}
check().finally(() => prisma.\$disconnect());
" || echo "Seed adımı tamamlandı veya atlandı."

echo "=== [A LA CARTE] Uygulama Başlatılıyor (Port 3000) ==="
exec "$@"
