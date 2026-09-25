import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating default notes for menu items...");

  const items = await prisma.menuItem.findMany({
    include: {
      category: {
        include: {
          parent: true,
        },
      },
    },
  });

  let updatedCount = 0;

  for (const item of items) {
    const nameLower = item.name.toLowerCase();
    const catName = (item.category?.name || "").toLowerCase();
    const parentCatName = (item.category?.parent?.name || "").toLowerCase();

    let notes: string | null = null;

    if (nameLower.includes("ribeye") || nameLower.includes("tomahawk") || nameLower.includes("bonfile") || nameLower.includes("steak") || nameLower.includes("dana") || nameLower.includes("antrikot") || nameLower.includes("kuzu")) {
      notes = "Az Pişmiş, Orta Az Pişmiş, Orta Pişmiş, Orta İyi Pişmiş, İyi Pişmiş, Sosu Ayrı, Hardal İle";
    } else if (nameLower.includes("somon") || nameLower.includes("levrek") || nameLower.includes("ahtapot") || nameLower.includes("karides") || nameLower.includes("ıstakoz") || nameLower.includes("balık")) {
      notes = "Limonlu, Zeytinyağlı, Acısız, Sosu Ayrı, Kılçıksız Servis";
    } else if (nameLower.includes("spritz") || nameLower.includes("bourbon") || nameLower.includes("martini") || nameLower.includes("mojito") || nameLower.includes("kokteyl") || nameLower.includes("margarita") || nameLower.includes("şarap") || catName.includes("kokteyl")) {
      notes = "Buzlu, Buzsuz, Bol Buzlu, Limon Dilimli, Alkolsüz, Pipetli";
    } else if (nameLower.includes("kahve") || nameLower.includes("espresso") || nameLower.includes("çay") || nameLower.includes("latte") || catName.includes("sıcak")) {
      notes = "Şekersiz, Az Şekerli, Orta Şekerli, Şekerli, Yulaf Sütlü, Soğuk Sütlü, Sıcak Servis";
    } else if (nameLower.includes("sufle") || nameLower.includes("panna cotta") || nameLower.includes("tiramisu") || nameLower.includes("baklava") || nameLower.includes("pasta") || catName.includes("tatlı")) {
      notes = "Dondurmalı, Dondurmasız, Ilık Servis, Şurubu Az, Çatal ve Kaşık İle";
    } else if (nameLower.includes("risotto") || nameLower.includes("makarna") || nameLower.includes("tagliatelle") || nameLower.includes("ravioli") || nameLower.includes("spaghetti")) {
      notes = "Al Dente, Bol Parmesanlı, Acılı, Acısız, Glutensiz, Trüf Yağı İle";
    } else if (nameLower.includes("burrata") || nameLower.includes("salata") || nameLower.includes("tartar") || nameLower.includes("meze") || nameLower.includes("carpaccio")) {
      notes = "Sosu Ayrı, Ekstra Balzamik, Zeytinyağlı, Soslu, Çıtır Ekmek İle";
    }

    if (notes) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { defaultNotes: notes },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated defaultNotes for ${updatedCount} / ${items.length} menu items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
