import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const rest = await prisma.restaurant.findUnique({ where: { code: "STEAK_HOUSE" } });
  const table = await prisma.restaurantTable.findFirst({ where: { restaurantId: rest!.id }, orderBy: { name: "asc" } });
  const waiter = await prisma.user.findUnique({ where: { username: "ahmet" } });
  const item = await prisma.menuItem.findFirst({ where: { category: { restaurantId: rest!.id } } });
  const o = await prisma.order.create({
    data: {
      restaurantId: rest!.id, tableId: table!.id, waiterId: waiter!.id,
      notes: "Yazici fis testi",
      items: { create: [{ menuItemId: item!.id, quantity: 2, itemNotes: "Az pişmiş" }] },
    },
  });
  console.log("SIPARIS: #" + o.orderNumber + " " + o.status);
  await prisma.$disconnect();
}
main();
