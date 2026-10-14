#!/bin/sh
set -e

echo "=== [A LA CARTE] Container Başlatılıyor ==="

# Ortam ve PATH Güvencesi
export HOME="${HOME:-/home/nextjs}"
export PATH="/app/node_modules/.bin:$PATH"

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

# 2. Prisma Şemasını Veritabanına Senkronize Et (db push)
echo ">> Prisma veritabanı şeması aktarılıyor (prisma db push)..."
./node_modules/.bin/prisma db push --schema=prisma/schema.prisma --accept-data-loss || {
  echo "UYARI: Prisma db push sırasında hata oluştu, devam ediliyor..."
}

# 3. Veri Kontrolü ve Otomatik İlk Kurulum (Bootstrap / Seed)
echo ">> Veritabanı veri durumu doğrulanıyor..."
existing_data=$(node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
Promise.all([p.restaurantConfig.count(), p.user.count()])
  .then(([c, u]) => { process.stdout.write(String(c + u)); })
  .catch(() => { process.stdout.write("0"); })
  .finally(() => p.$disconnect());
' 2>/dev/null || echo "0")

# Seed sırları için varsayılanlar (Coolify ortam değişkenlerinden gelmediyse güvenli demo varsayılanları kullanılır)
export SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-Admin1234!}"
export SEED_ADMIN_PIN="${SEED_ADMIN_PIN:-12345678}"
export SEED_MANAGER_PASSWORD="${SEED_MANAGER_PASSWORD:-Manager1234!}"
export SEED_MANAGER_PIN="${SEED_MANAGER_PIN:-12345678}"
export SEED_WAITER_PASSWORD="${SEED_WAITER_PASSWORD:-Waiter1234!}"
export SEED_WAITER_PIN="${SEED_WAITER_PIN:-12345678}"
export SEED_SETUP_KEY="${SEED_SETUP_KEY:-SetupKey1234!}"

if [ "$existing_data" = "0" ] || [ -z "$existing_data" ]; then
  echo ">> BİLGİ: Boş veritabanı tespit edildi (kullanıcı veya restoran kaydı yok)."
  echo ">> İlk kurulum otomatik olarak gerçekleştiriliyor (tohumlama başlatılıyor)..."
  export ALLOW_DESTRUCTIVE_SEED="true"
  ./node_modules/.bin/tsx prisma/seed.ts || echo "UYARI: İlk kurulum seed sırasında hata veya uyarı oluştu, devam ediliyor..."
  echo ">> İlk kurulum verileri hazırlandı!"
  echo ">> GİRİŞ BİLGİLERİ (Demo):"
  echo ">> Sistem Yöneticisi : sistem.yoneticisi (Parola: Admin1234! / PIN: 12345678)"
  echo ">> Restoran Müdürü   : mehmet.kaya (Parola: Manager1234! / PIN: 12345678)"
  echo ">> Garson            : ayse.yilmaz (Parola: Waiter1234! / PIN: 12345678)"
elif [ "${SEED_ON_START:-false}" = "true" ]; then
  if [ "${ALLOW_DESTRUCTIVE_SEED:-false}" = "true" ]; then
    echo ">> SEED_ON_START=true ve ALLOW_DESTRUCTIVE_SEED=true; mevcut veriler sıfırlanıp yeniden tohumlanıyor..."
    ./node_modules/.bin/tsx prisma/seed.ts || echo "UYARI: Seed sırasında bir hata oluştu."
  else
    echo "HATA: SEED_ON_START=true için ALLOW_DESTRUCTIVE_SEED=true zorunludur. Mevcut veriler korundu."
  fi
else
  echo ">> Mevcut restoran/kullanıcı verisi bulundu ($existing_data kayıt); veri korunuyor."
fi

echo "=== [A LA CARTE] Uygulama Başlatılıyor (Port 3000) ==="
exec "$@"
