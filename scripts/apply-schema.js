const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const forceReset = process.argv.includes('--force-reset');

  try {
    if (forceReset) {
      console.log('>> Zorunlu şema sıfırlama (--force-reset) uygulanıyor...');
      await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    } else {
      // Check if User table exists but lacks modern columns (like passwordHash)
      const userTable = await prisma.$queryRawUnsafe(`
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User' LIMIT 1;
      `).catch(() => []);

      if (Array.isArray(userTable) && userTable.length > 0) {
        const userCols = await prisma.$queryRawUnsafe(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'passwordHash' LIMIT 1;
        `).catch(() => []);

        if (Array.isArray(userCols) && userCols.length === 0) {
          console.log('>> UYARI: Eski/uyumsuz User tablosu tespit edildi (passwordHash sütunu eksik). Şema temizleniyor...');
          await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        } else {
          // Check if RestaurantConfig exists
          const check = await prisma.$queryRawUnsafe(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'RestaurantConfig'
            LIMIT 1;
          `).catch(() => []);

          if (Array.isArray(check) && check.length > 0) {
            console.log('>> Veritabanı tabloları zaten mevcut ve güncel (RestaurantConfig & User.passwordHash doğrulandı).');
            return;
          }
        }
      }
    }

    console.log('>> Veritabanı tabloları kuruluyor/güncelleniyor (prisma/schema.sql)...');
    const sqlPath = path.join(__dirname, '..', 'prisma', 'schema.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('HATA: prisma/schema.sql dosyası bulunamadı!');
      return;
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const rawStatements = sql.split(/;\s*$/m);
    
    let executed = 0;
    for (const raw of rawStatements) {
      const stmt = raw.trim();
      if (!stmt) continue;
      const cleanStmt = stmt.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
      if (!cleanStmt) continue;

      try {
        await prisma.$executeRawUnsafe(stmt);
        executed++;
      } catch (err) {
        const msg = String(err.message || '');
        if (msg.includes('already exists') || msg.includes('42P07') || msg.includes('42710') || msg.includes('42701')) {
          // ignore already existing type/table/constraint
        } else {
          console.warn('SQL Bildirimi uyarısı:', msg.slice(0, 150));
        }
      }
    }

    console.log(`>> prisma/schema.sql başarıyla uygulandı (${executed} bildirim işlendi).`);
  } catch (err) {
    console.error('>> Şema uygulama hatası:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(0);
});
