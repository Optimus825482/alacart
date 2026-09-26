import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const withNotes = await prisma.menuItem.findMany({ where: { defaultNotes: { not: null } }, select: { name: true, defaultNotes: true, active: true, category: { select: { name: true } } }, take: 12 });
  console.log("SERVIS NOTU OLAN MENU OGELERI (" + (await prisma.menuItem.count({ where: { defaultNotes: { not: null } } })) + "):");
  for (const m of withNotes) console.log("  " + (m.active ? "[A]" : "[P]") + " " + m.name.padEnd(38) + " | " + m.defaultNotes);
  const total = await prisma.menuItem.count();
  console.log("\nTOPLAM MENU OGESI: " + total + " | notu olan: " + (await prisma.menuItem.count({ where: { defaultNotes: { not: null } } })));
  await prisma.$disconnect();
}
main();