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

# 2. Prisma Şemasını Senkronize Et (db push)
echo ">> Prisma veritabanı şeması aktarılıyor (prisma db push)..."
npx prisma db push --skip-generate --accept-data-loss

# 3. Başlangıç Tohum (Seed) Verileri
echo ">> Başlangıç verileri kontrol ediliyor..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const restCount = await prisma.restaurant.count();
  if (restCount < 5) {
    console.log('>> 5 İmza Merit Restoranı ve kullanıcılar yükleniyor (seed)...');
    require('child_process').execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
  } else {
    console.log('>> Veritabanında restoranlar mevcut (' + restCount + ' adet), seed adımı atlandı.');
  }
}
check().finally(() => prisma.\$disconnect());
" || echo "Seed adımı tamamlandı veya atlandı."

echo "=== [A LA CARTE] Uygulama Başlatılıyor (Port 3000) ==="
exec "$@"
