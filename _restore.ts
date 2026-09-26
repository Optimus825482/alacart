import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const o = await prisma.order.findFirst({ where: { orderNumber: 8 } });
  if (o) {
    await prisma.order.update({
      where: { id: o.id },
      data: {
        status: "CANCELLED",
        cancelledAt: o.cancelledAt || new Date(),
        cancellationReason: o.cancellationReason || "Misafir vazgecti",
      },
    });
  }
  const n = await prisma.order.findUnique({
    where: { id: o!.id },
    select: {
      orderNumber: true,
      status: true,
      cancellationReason: true,
      cancelledAt: true,
      items: { select: { itemNotes: true, menuItem: { select: { name: true } } } },
    },
  });
  console.log("#" + n!.orderNumber + " -> " + n!.status + " | sebep: " + n!.cancellationReason);
  for (const it of n!.items) console.log("   " + it.menuItem.name + " not:" + JSON.stringify(it.itemNotes));
  const all = await prisma.order.findMany({
    orderBy: { orderNumber: "asc" },
    select: { orderNumber: true, status: true, cancellationReason: true, createdAt: true },
  });
  console.log("--- tum siparisler ---");
  for (const a of all) console.log("#" + a.orderNumber + " " + a.status + (a.cancellationReason ? " (" + a.cancellationReason + ")" : ""));
  await prisma.$disconnect();
}
main();
