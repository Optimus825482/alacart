const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // 1. Check if public.RestaurantConfig already exists
    const check = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'RestaurantConfig'
      LIMIT 1;
    `).catch(() => []);

    if (Array.isArray(check) && check.length > 0) {
      console.log('>> Veritabanı tabloları zaten mevcut (RestaurantConfig doğrulandı).');
      return;
    }

    console.log('>> Veritabanı tabloları eksik! prisma/schema.sql uygulanıyor...');
    const sqlPath = path.join(__dirname, '..', 'prisma', 'schema.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('HATA: prisma/schema.sql dosyası bulunamadı!');
      return;
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    // Split by semicolons at end of lines
    const rawStatements = sql.split(/;\s*$/m);
    
    let executed = 0;
    for (const raw of rawStatements) {
      const stmt = raw.trim();
      if (!stmt) continue;
      // Skip pure comment blocks
      const cleanStmt = stmt.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
      if (!cleanStmt) continue;

      try {
        await prisma.$executeRawUnsafe(stmt);
        executed++;
      } catch (err) {
        // If it's already exists (42P07, 42710, etc.), safely ignore
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
  process.exit(0); // do not crash container
});
