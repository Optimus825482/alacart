import { PrismaClient, Role, TableStatus, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- Seeding Database for 5-Star Hotel A La Carte System ---");

  // 1. Temizleme
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurantUser.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  // 2. Kullanıcılar
  const admin = await prisma.user.create({
    data: {
      name: "Sistem Yöneticisi",
      username: "admin",
      pin: "1111",
      role: Role.ADMIN,
    },
  });

  const waiter1 = await prisma.user.create({
    data: {
      name: "Ahmet Yılmaz",
      username: "ahmet",
      pin: "1234",
      role: Role.WAITER,
    },
  });

  const waiter2 = await prisma.user.create({
    data: {
      name: "Mehmet Kaya",
      username: "mehmet",
      pin: "5678",
      role: Role.WAITER,
    },
  });

  const kitchen = await prisma.user.create({
    data: {
      name: "Baş Aşçı Mutfak",
      username: "mutfak",
      pin: "9999",
      role: Role.KITCHEN,
    },
  });

  console.log("Kullanıcılar oluşturuldu (Admin PIN: 1111, Garson PIN: 1234 / 5678, Mutfak PIN: 9999)");

  // 3. Alakart Restoranlar
  const italian = await prisma.restaurant.create({
    data: {
      name: "Bella Vista İtalyan A La Carte",
      code: "ITALIAN",
      description: "Geleneksel İtalyan lezzetleri, taze el yapımı makarnalar ve seçkin şaraplar.",
    },
  });

  const aegean = await prisma.restaurant.create({
    data: {
      name: "Mavi Dalga Ege & Balık A La Carte",
      code: "AEGEAN_FISH",
      description: "Günlük taze deniz mahsulleri ve geleneksel Ege mezeleri.",
    },
  });

  const steak = await prisma.restaurant.create({
    data: {
      name: "Fire & Prime Steakhouse",
      code: "STEAKHOUSE",
      description: "Kuru dinlendirilmiş etler, özel ızgaralar ve gurme sunumlar.",
    },
  });

  console.log("Alakart restoranlar oluşturuldu (İtalyan, Ege Balık, Steakhouse)");

  // 4. Masalar
  const tablesItalian = [
    { name: "Masa 1", capacity: 2 },
    { name: "Masa 2", capacity: 4 },
    { name: "Masa 3", capacity: 4 },
    { name: "Teras 01", capacity: 4 },
    { name: "Teras 02", capacity: 6 },
    { name: "VIP Salone", capacity: 8 },
  ];

  for (const t of tablesItalian) {
    await prisma.restaurantTable.create({
      data: {
        name: t.name,
        capacity: t.capacity,
        restaurantId: italian.id,
      },
    });
  }

  const tablesAegean = [
    { name: "İskele 1", capacity: 4 },
    { name: "İskele 2", capacity: 6 },
    { name: "Deniz Kenarı 10", capacity: 2 },
    { name: "Bahçe 05", capacity: 4 },
  ];

  for (const t of tablesAegean) {
    await prisma.restaurantTable.create({
      data: {
        name: t.name,
        capacity: t.capacity,
        restaurantId: aegean.id,
      },
    });
  }

  // Garson yetkilendirmeleri
  await prisma.restaurantUser.createMany({
    data: [
      { userId: waiter1.id, restaurantId: italian.id },
      { userId: waiter1.id, restaurantId: aegean.id },
      { userId: waiter2.id, restaurantId: italian.id },
      { userId: waiter2.id, restaurantId: steak.id },
    ],
  });

  // 5. Hiyerarşik Menü Kategorileri & Ürünler
  // Kök 1: Yiyecekler
  const catFoods = await prisma.category.create({
    data: {
      name: "Yiyecekler",
      description: "Tüm yemek seçenekleri",
      displayOrder: 1,
    },
  });

  // Alt Kategori: Başlangıçlar
  const catStarters = await prisma.category.create({
    data: {
      name: "Başlangıçlar",
      parentId: catFoods.id,
      displayOrder: 1,
    },
  });

  // Alt-Alt Kategori: Soğuk Başlangıçlar
  const catColdStarters = await prisma.category.create({
    data: {
      name: "Soğuk Başlangıçlar",
      parentId: catStarters.id,
      displayOrder: 1,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Taze Burrata Peyniri",
        description: "Organik salkım domates, fesleğen pesto sos ve balzamik glaze ile",
        allergens: "Süt ve Süt Ürünleri",
        categoryId: catColdStarters.id,
        displayOrder: 1,
      },
      {
        name: "Dana Carpaccio",
        description: "Trüf yağı, taze roka yaprakları ve 24 aylık parmesan dilimleri eşliğinde",
        allergens: "Süt Ürünü",
        categoryId: catColdStarters.id,
        displayOrder: 2,
      },
      {
        name: "Ege Gurme Meze Üçlüsü",
        description: "Fava, köz patlıcan ezmesi ve cevizli atom",
        allergens: "Ceviz",
        categoryId: catColdStarters.id,
        displayOrder: 3,
      },
    ],
  });

  // Alt-Alt Kategori: Sıcak Başlangıçlar
  const catHotStarters = await prisma.category.create({
    data: {
      name: "Sıcak Başlangıçlar",
      parentId: catStarters.id,
      displayOrder: 2,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Trüflü Çıtır Karides",
        description: "Panko ile kaplanmış jumbo karides, tatlı-acı trüflü mayonez sos ile",
        allergens: "Kabuklular, Gluten",
        categoryId: catHotStarters.id,
        displayOrder: 1,
      },
      {
        name: "Izgara Ahtapot Bacağı",
        description: "Fava yatağında, kurutulmuş domates ve kapari sos eşliğinde",
        allergens: "Yumuşakçalar",
        categoryId: catHotStarters.id,
        displayOrder: 2,
      },
    ],
  });

  // Alt Kategori: Ana Yemekler
  const catMains = await prisma.category.create({
    data: {
      name: "Ana Yemekler",
      parentId: catFoods.id,
      displayOrder: 2,
    },
  });

  // Alt-Alt Kategori: Et & Izgaralar
  const catMeat = await prisma.category.create({
    data: {
      name: "Et & Izgaralar",
      parentId: catMains.id,
      displayOrder: 1,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Dry Aged Dana Antrikot (300g)",
        description: "28 gün dinlendirilmiş antrikot, trüflü patates püresi ve kuşkonmaz ile",
        allergens: "Süt Ürünü",
        categoryId: catMeat.id,
        displayOrder: 1,
      },
      {
        name: "Ağır Ateşte Kuzu İncik Konfi",
        description: "12 saat pişirilmiş kuzu incik, safranlı risotto yatağında",
        allergens: "Süt Ürünü",
        categoryId: catMeat.id,
        displayOrder: 2,
      },
    ],
  });

  // Alt-Alt Kategori: El Yapımı Makarnalar & Risotto
  const catPasta = await prisma.category.create({
    data: {
      name: "El Yapımı Makarnalar & Risotto",
      parentId: catMains.id,
      displayOrder: 2,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Istakozlu Siyah Tagliolini",
        description: "Mürekkep balıklı taze makarna, tereyağında ıstakoz parçaları ve taze fesleğen",
        allergens: "Gluten, Kabuklular, Süt",
        categoryId: catPasta.id,
        displayOrder: 1,
      },
      {
        name: "Trüf Mantarlı Porcini Risotto",
        description: "Acquerello pirinci, porcini mantarı, parmesan tekeri ve siyah trüf dilimleri",
        allergens: "Süt Ürünü",
        categoryId: catPasta.id,
        displayOrder: 2,
      },
    ],
  });

  // Alt Kategori: Tatlılar
  const catDesserts = await prisma.category.create({
    data: {
      name: "Tatlılar",
      parentId: catFoods.id,
      displayOrder: 3,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Geleneksel Mascarpone Tiramisu",
        description: "Savoiardi bisküvisi, espresso ve saf kakao ile",
        allergens: "Gluten, Süt, Yumurta",
        categoryId: catDesserts.id,
        displayOrder: 1,
      },
      {
        name: "Sıcak Çikolatalı Sufle",
        description: "Valrhona bitter çikolata ve Madagascar vanilyalı dondurma eşliğinde",
        allergens: "Gluten, Süt, Yumurta",
        categoryId: catDesserts.id,
        displayOrder: 2,
      },
    ],
  });

  // Kök 2: İçecekler
  const catBeverages = await prisma.category.create({
    data: {
      name: "İçecekler",
      description: "Sıcak, soğuk, alkollü ve alkolsüz tüm içecekler",
      displayOrder: 2,
    },
  });

  // Alt Kategori: Sıcak İçecekler
  const catHotDrinks = await prisma.category.create({
    data: {
      name: "Sıcak İçecekler",
      parentId: catBeverages.id,
      displayOrder: 1,
    },
  });

  // Alt-Alt: Çaylar
  const catTeas = await prisma.category.create({
    data: {
      name: "Çay Çeşitleri",
      parentId: catHotDrinks.id,
      displayOrder: 1,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { name: "Rize Geleneksel Demleme Çay", description: "İnce belli bardakta taze demlenmiş", categoryId: catTeas.id },
      { name: "Japon Sencha Yeşil Çay", description: "Porselen demlikte sunum", categoryId: catTeas.id },
      { name: "Kış Harmanı (Ihlamur & Adaçayı & Zencefil)", description: "Bal ve limon dilimi eşliğinde", categoryId: catTeas.id },
    ],
  });

  // Alt-Alt: Kahveler
  const catCoffees = await prisma.category.create({
    data: {
      name: "Kahve Çeşitleri",
      parentId: catHotDrinks.id,
      displayOrder: 2,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { name: "Geleneksel Türk Kahvesi (Orta / Sade / Şekerli)", description: "Lokum ve su ikramı ile", categoryId: catCoffees.id },
      { name: "Double Espresso", description: "%100 Arabica çekirdeklerinden taze çekilmiş", categoryId: catCoffees.id },
      { name: "Caffe Latte / Cappuccino", description: "İpeksi süt kreması ile", categoryId: catCoffees.id },
    ],
  });

  // Alt Kategori: Soğuk İçecekler
  const catColdDrinks = await prisma.category.create({
    data: {
      name: "Soğuk İçecekler",
      parentId: catBeverages.id,
      displayOrder: 2,
    },
  });

  // Alt-Alt: Alkolsüz İçecekler
  const catNonAlcoholic = await prisma.category.create({
    data: {
      name: "Alkolsüz İçecekler & Mocktailler",
      parentId: catColdDrinks.id,
      displayOrder: 1,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { name: "Taze Nane & Zencefilli Ev Yapımı Limonata", description: "Buz ve taze nane yaprakları ile", categoryId: catNonAlcoholic.id },
      { name: "Sıkma Portakal / Greyfurt Suyu", description: "Anlık taze sıkılmış", categoryId: catNonAlcoholic.id },
      { name: "San Pellegrino Doğal Maden Suyu (750ml)", description: "Limon dilimi ile", categoryId: catNonAlcoholic.id },
    ],
  });

  // Alt-Alt: Alkollü İçecekler
  const catAlcoholic = await prisma.category.create({
    data: {
      name: "Alkollü İçecekler & Şaraplar",
      parentId: catColdDrinks.id,
      displayOrder: 2,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { name: "Signature Royal Passion Kokteyl", description: "Rom, çarkıfelek meyvesi, lime ve taze fesleğen", categoryId: catAlcoholic.id },
      { name: "Aperol Spritz", description: "Prosecco, Aperol, soda ve taze portakal dilimi", categoryId: catAlcoholic.id },
      { name: "Château Kalecik Karası Reserve (Kadeh)", description: "Kırmızı şarap", categoryId: catAlcoholic.id },
      { name: "Moët & Chandon Brut Impérial Şampanya", description: "Buz kovasında servis", categoryId: catAlcoholic.id },
    ],
  });

  console.log("Hiyerarşik menü kategorileri ve zengin yemek/içecek tanımları eklendi!");
  console.log("--- Seeding tamamlandı! ---");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
