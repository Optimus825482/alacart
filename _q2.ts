import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const os = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { table: true, items: true, restaurant: { select: { code: true } } } });
  for (const o of os) {
    console.log("#" + o.orderNumber + " | " + o.status + " | " + o.restaurant.code + " | " + (o.table?.name || "-") + " | " + o.createdAt.toISOString() + " | kalem:" + o.items.length);
    for (const it of o.items) console.log("      - " + it.name + " x" + it.quantity + " not:" + JSON.stringify(it.itemNotes));
  }
  const u = await prisma.user.findUnique({ where: { username: "ahmet" }, select: { id: true, name: true } });
  const mine = await prisma.order.count({ where: { waiterId: u!.id } });
  console.log("");
  console.log("ahmet'in toplam siparisi: " + mine);
  await prisma.$disconnect();
}
main();