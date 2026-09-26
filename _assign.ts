import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PLAN: Record<string, string[]> = {
  // Garsonlar TUM alakartlara bagli -> giriste alakart secim ekrani gelir
  "ahmet":   ["ROOF_GARDEN", "STEAK_HOUSE", "BLUE_SEA", "MANDARIN", "BELLA_MERIT"],
  "mehmet":  ["ROOF_GARDEN", "STEAK_HOUSE", "BLUE_SEA", "MANDARIN", "BELLA_MERIT"],
  "garson":  ["ROOF_GARDEN", "STEAK_HOUSE", "BLUE_SEA", "MANDARIN", "BELLA_MERIT"],
  // Ekip mutfak hesabi tek alakarta
  "mutfak":  ["ROOF_GARDEN"],
  // Admin ve Sef tum alakartlari gorebilir -> secim ekrani kalsin
  "admin":   ["ROOF_GARDEN", "STEAK_HOUSE", "BLUE_SEA", "MANDARIN", "BELLA_MERIT"],
  "sef":     ["ROOF_GARDEN", "STEAK_HOUSE", "BLUE_SEA", "MANDARIN", "BELLA_MERIT"],
};

async function main() {
  const rests = await prisma.restaurant.findMany();
  for (const [username, codes] of Object.entries(PLAN)) {
    const u = await prisma.user.findUnique({ where: { username } });
    if (!u) { console.log("  [" + username + "] kullanici yok"); continue; }
    await prisma.restaurantUser.deleteMany({ where: { userId: u.id } });
    for (const code of codes) {
      const r = rests.find(x => x.code === code);
      if (!r) { console.log("  [" + username + "] alakart yok: " + code); continue; }
      await prisma.restaurantUser.create({ data: { userId: u.id, restaurantId: r.id } });
    }
    console.log("  " + username.padEnd(9) + " (" + String(codes.length).padStart(2) + " alakart) " + (codes.length === 1 ? "-> OTOMATIK KILIT" : "-> SECIM EKRANI"));
  }

  const all = await prisma.user.findMany({ where: { active: true }, select: { username: true, role: true, assignedTo: { select: { restaurant: { select: { code: true } } } } } });
  console.log("\nSON DURUM (aktif kullanicilar):");
  for (const u of all) {
    const c = u.assignedTo.map(a => a.restaurant.code);
    console.log("  " + u.role.padEnd(7) + " | " + u.username.padEnd(20) + " | " + String(c.length).padStart(2) + " alakart " + (c.length === 1 ? "[OTOMATIK] " : "[SECIM]    ") + c.join(","));
  }
  await prisma.$disconnect();
}
main();
