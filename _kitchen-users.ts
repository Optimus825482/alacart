import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

// Her alakart icin ozel mutfak kullanici adi: mutfak.<kucuk kod>
function kitchenUsername(code: string) {
  const c = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  const short = c.startsWith("mutfak") ? c.slice(6) : c;
  return "mutfak." + (short.length > 0 ? short : "genel");
}

async function main() {
  const rests = await prisma.restaurant.findMany({ orderBy: { name: "asc" } });
  const hash = await bcrypt.hash("1234", 10);

  console.log("ALAKART BAZLI MUTFAK KULLANICILARI:\n");
  for (const r of rests) {
    const username = kitchenUsername(r.code);
    const name = r.name + " Mutfak";
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      await prisma.user.update({ where: { username }, data: { name, role: "KITCHEN", active: true } });
      await prisma.restaurantUser.deleteMany({ where: { userId: existing.id } });
      await prisma.restaurantUser.create({ data: { userId: existing.id, restaurantId: r.id } });
      console.log("  [GUNCELDI] " + username.padEnd(22) + " | " + name.padEnd(30) + " | " + r.code);
    } else {
      const u = await prisma.user.create({ data: { username, name, password: hash, role: "KITCHEN", active: true } });
      await prisma.restaurantUser.create({ data: { userId: u.id, restaurantId: r.id } });
      console.log("  [YENI]     " + username.padEnd(22) + " | " + name.padEnd(30) + " | " + r.code);
    }
  }

  const all = await prisma.user.findMany({ where: { role: "KITCHEN" }, include: { assignedTo: { include: { restaurant: true } } } });
  console.log("\nTUM MUTFAK KULLANICILARI:");
  for (const u of all) {
    const codes = u.assignedTo.map(a => a.restaurant.code).join(",");
    console.log("  " + u.username.padEnd(22) + " | " + (codes || "YOK").padEnd(26) + " | " + (u.assignedTo.length === 1 ? "OTOMATIK ATAMA" : "SECIM GEREKIYOR (" + u.assignedTo.length + ")"));
  }
  await prisma.$disconnect();
}
main();