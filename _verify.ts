import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      username: true, name: true, role: true, active: true,
      assignedTo: { select: { restaurant: { select: { code: true } } } },
    },
  });
  console.log("=== KULLANICILAR (" + users.length + ") ===");
  for (const u of users) {
    const rs = u.assignedTo.map((a) => a.restaurant.code).join(",") || "-";
    console.log((u.active ? "A" : "P") + " " + u.role.padEnd(7) + u.username.padEnd(24) + (u.name || "").padEnd(20) + "| " + rs);
  }
  const rests = await prisma.restaurant.findMany({
    orderBy: { code: "asc" },
    select: { code: true, active: true, _count: { select: { tables: true, categories: true } } },
  });
  console.log("");
  console.log("=== RESTORANLAR (" + rests.length + ") ===");
  for (const r of rests) console.log((r.active ? "A" : "P") + " " + r.code.padEnd(14) + "masa:" + String(r._count.tables).padEnd(3) + "menuGrubu:" + r._count.categories);
  const itemCount = await prisma.menuItem.count();
  const notes = await prisma.menuItem.count({ where: { defaultNotes: { not: null } } });
  console.log("");
  console.log("TOPLAM MENU OGESI: " + itemCount + " | SERVIS NOTLU: " + notes);
  const orders = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("SIPARISLER: " + orders.map((o) => o.status + "=" + o._count._all).join(", "));
  await prisma.$disconnect();
}
main();
