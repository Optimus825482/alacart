import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // Eski kisa adli mutfak hesaplari: mutfak.roof, mutfak.steak, mutfak.bella
  // (yeni alakart-bazli adlarla degistirildi) -> pasif yap, silme (denetim izi korunsun)
  const legacy = ["mutfak.roof", "mutfak.steak", "mutfak.bella"];
  for (const u of legacy) {
    const f = await prisma.user.findUnique({ where: { username: u } });
    if (!f) { console.log("  yok: " + u); continue; }
    await prisma.user.update({ where: { username: u }, data: { active: false } });
    await prisma.restaurantUser.deleteMany({ where: { userId: f.id } });
    console.log("  [PASIF] " + u + " (yeni: mutfak." + (u.split(".")[1] === "roof" ? "roofgarden" : u.split(".")[1] === "steak" ? "steakhouse" : "bellamerit") + ")");
  }
  // Coklu alakarta bagli "mutfak" ekip hesabi kalsin mi? TUM alakartlari gorebilir -> secim ekrani gosterir
  const all = await prisma.user.findMany({ where: { role: "KITCHEN" }, select: { username: true, name: true, active: true } });
  console.log("\nMUTFAK HESAPLARI (aktif/pasif):");
  all.forEach(u => console.log("  " + (u.active ? "AKTIF " : "PASIF ") + " | " + u.username.padEnd(22) + " | " + u.name));
  await prisma.$disconnect();
}
main();