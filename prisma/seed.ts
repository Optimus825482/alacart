import { PrismaClient, Role, TableStatus, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== MERİT HOTELS & RESORTS A LA CARTE VERİTABANI KURULUMU BAŞLIYOR ===");

  // 1. Temizleme
  await prisma.auditLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.restaurantUser.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  // 2. Kullanıcı Tanımları (Kullanıcı Adı ve Şifre)
  const admin = await prisma.user.create({
    data: {
      name: "Sistem Yöneticisi (Admin)",
      username: "admin",
      password: "admin123",
      pin: "1111",
      role: Role.ADMIN,
    },
  });

  const chef = await prisma.user.create({
    data: {
      name: "Executive Chef (Koordinatör Şef)",
      username: "sef",
      password: "sef123",
      pin: "8888",
      role: Role.CHEF,
    },
  });

  console.log("Yönetici (admin/admin123) ve Şef (sef/sef123) oluşturuldu.");

  // 3. MERİT 5 İMZA ALAKART RESTORANLARI
  const roofGarden = await prisma.restaurant.create({
    data: {
      name: "The Roof Garden",
      code: "ROOF_GARDEN",
      themeKey: "ROOF_GARDEN",
      primaryColor: "#10b981",
      accentColor: "#047857",
      description: "Panoramik Akdeniz manzarası eşliğinde imza kokteyller ve uluslararası modern gurme mutfak.",
      coverImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
    },
  });

  const steakHouse = await prisma.restaurant.create({
    data: {
      name: "The Steak House",
      code: "STEAK_HOUSE",
      themeKey: "STEAK_HOUSE",
      primaryColor: "#ef4444",
      accentColor: "#b91c1c",
      description: "Özel odun ateşinde 28 gün dinlendirilmiş dry-aged etler, tomahawk, t-bone ve zengin şarap mahzeni.",
      coverImage: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
    },
  });

  const blueSea = await prisma.restaurant.create({
    data: {
      name: "Blue Sea",
      code: "BLUE_SEA",
      themeKey: "BLUE_SEA",
      primaryColor: "#06b6d4",
      accentColor: "#0284c7",
      description: "Taze günlük Akdeniz balıkları, jumbo karides, ıstakoz, ahtapot ve geleneksel Ege mezeleri.",
      coverImage: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&auto=format&fit=crop&q=80",
    },
  });

  const mandarin = await prisma.restaurant.create({
    data: {
      name: "Mandarin",
      code: "MANDARIN",
      themeKey: "MANDARIN",
      primaryColor: "#e11d48",
      accentColor: "#eab308",
      description: "Uzakdoğu lezzetleri, canlı teppanyaki şovları, taze sashimi & sushi barı ve Pekin ördeği.",
      coverImage: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&auto=format&fit=crop&q=80",
    },
  });

  const bellaMerit = await prisma.restaurant.create({
    data: {
      name: "Bella Merit",
      code: "BELLA_MERIT",
      themeKey: "BELLA_MERIT",
      primaryColor: "#f97316",
      accentColor: "#d97706",
      description: "İtalyan şeflerin elinden taze ev yapımı makarnalar, taş fırın lezzetleri, ossobuco ve tiramisu.",
      coverImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    },
  });

  console.log("5 Merit Alakart Restoranı oluşturuldu: The Roof Garden, The Steak House, Blue Sea, Mandarin, Bella Merit.");

  // 4. Mutfak ve Garson Kullanıcıları
  // Her restoran için özel mutfak şefi
  const kitchenRoof = await prisma.user.create({
    data: {
      name: "The Roof Garden Mutfak",
      username: "mutfak.roof",
      password: "1234",
      pin: "2001",
      role: Role.KITCHEN,
      assignedTo: { create: [{ restaurantId: roofGarden.id }] },
    },
  });

  const kitchenSteak = await prisma.user.create({
    data: {
      name: "The Steak House Mutfak",
      username: "mutfak.steak",
      password: "1234",
      pin: "2002",
      role: Role.KITCHEN,
      assignedTo: { create: [{ restaurantId: steakHouse.id }] },
    },
  });

  const kitchenBlueSea = await prisma.user.create({
    data: {
      name: "Blue Sea Mutfak",
      username: "mutfak.bluesea",
      password: "1234",
      pin: "2003",
      role: Role.KITCHEN,
      assignedTo: { create: [{ restaurantId: blueSea.id }] },
    },
  });

  const kitchenMandarin = await prisma.user.create({
    data: {
      name: "Mandarin Mutfak",
      username: "mutfak.mandarin",
      password: "1234",
      pin: "2004",
      role: Role.KITCHEN,
      assignedTo: { create: [{ restaurantId: mandarin.id }] },
    },
  });

  const kitchenBella = await prisma.user.create({
    data: {
      name: "Bella Merit Mutfak",
      username: "mutfak.bella",
      password: "1234",
      pin: "2005",
      role: Role.KITCHEN,
      assignedTo: { create: [{ restaurantId: bellaMerit.id }] },
    },
  });

  // Garsonlar
  const waiterAhmet = await prisma.user.create({
    data: {
      name: "Ahmet Yılmaz (Garson)",
      username: "ahmet",
      password: "1234",
      pin: "1234",
      role: Role.WAITER,
      assignedTo: {
        create: [
          { restaurantId: roofGarden.id },
          { restaurantId: steakHouse.id },
          { restaurantId: blueSea.id },
          { restaurantId: mandarin.id },
          { restaurantId: bellaMerit.id },
        ],
      },
    },
  });

  const waiterMehmet = await prisma.user.create({
    data: {
      name: "Mehmet Kaya (Garson)",
      username: "mehmet",
      password: "1234",
      pin: "5678",
      role: Role.WAITER,
      assignedTo: {
        create: [
          { restaurantId: blueSea.id },
          { restaurantId: bellaMerit.id },
        ],
      },
    },
  });

  console.log("Mutfak şefleri ve garson kullanıcıları başarıyla oluşturuldu.");

  // 5. MASALARIN OLUŞTURULMASI (Her Restoranın Gerçekçi Salon & Masa Düzeni)
  // The Roof Garden Masaları
  for (let i = 1; i <= 8; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Panoramik Teras ${i}`, capacity: 4, restaurantId: roofGarden.id },
    });
  }
  for (let i = 1; i <= 4; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Lounge Bahçe ${i}`, capacity: 6, restaurantId: roofGarden.id },
    });
  }
  await prisma.restaurantTable.create({
    data: { name: "VIP Sky Salone", capacity: 10, restaurantId: roofGarden.id },
  });

  // The Steak House Masaları
  for (let i = 1; i <= 6; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Şömine Salonu ${i}`, capacity: 4, restaurantId: steakHouse.id },
    });
  }
  for (let i = 1; i <= 4; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Mahzen Loca ${i}`, capacity: 6, restaurantId: steakHouse.id },
    });
  }
  await prisma.restaurantTable.create({
    data: { name: "Diamond Prime VIP", capacity: 8, restaurantId: steakHouse.id },
  });

  // Blue Sea Masaları
  for (let i = 1; i <= 6; i++) {
    await prisma.restaurantTable.create({
      data: { name: `İskele ${i}`, capacity: 4, restaurantId: blueSea.id },
    });
  }
  for (let i = 1; i <= 4; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Deniz Kenarı ${i}`, capacity: 4, restaurantId: blueSea.id },
    });
  }
  await prisma.restaurantTable.create({
    data: { name: "Kaptan Köşkü VIP", capacity: 8, restaurantId: blueSea.id },
  });

  // Mandarin Masaları
  for (let i = 1; i <= 4; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Teppanyaki Masa ${i}`, capacity: 6, restaurantId: mandarin.id },
    });
  }
  for (let i = 1; i <= 6; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Lotus Salon ${i}`, capacity: 4, restaurantId: mandarin.id },
    });
  }
  await prisma.restaurantTable.create({
    data: { name: "Zen Bahçesi VIP", capacity: 8, restaurantId: mandarin.id },
  });

  // Bella Merit Masaları
  for (let i = 1; i <= 6; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Roma Salonu ${i}`, capacity: 4, restaurantId: bellaMerit.id },
    });
  }
  for (let i = 1; i <= 4; i++) {
    await prisma.restaurantTable.create({
      data: { name: `Toscana Avlu ${i}`, capacity: 6, restaurantId: bellaMerit.id },
    });
  }
  await prisma.restaurantTable.create({
    data: { name: "Venezia VIP Loca", capacity: 8, restaurantId: bellaMerit.id },
  });

  console.log("Tüm alakart masaları tanımlandı.");

  // 6. HİYERARŞİK MENÜ KATEGORİLERİ VE GERÇEKÇİ LEZZETLER (FİYAT YOKTUR)
  // Kök 1: Yiyecekler
  const catFoods = await prisma.category.create({
    data: { name: "Yiyecekler", description: "Tüm gurme yemek seçenekleri", displayOrder: 1 },
  });

  // Kök 2: İçecekler
  const catDrinks = await prisma.category.create({
    data: { name: "İçecekler", description: "Sıcak, soğuk, şarap ve kokteyl seçenekleri", displayOrder: 2 },
  });

  // --- BAŞLANGIÇLAR ---
  const catStarters = await prisma.category.create({
    data: { name: "Başlangıçlar & Mezeler", parentId: catFoods.id, displayOrder: 1 },
  });
  const catColdStarters = await prisma.category.create({
    data: { name: "Soğuk Başlangıçlar", parentId: catStarters.id, displayOrder: 1 },
  });
  const catHotStarters = await prisma.category.create({
    data: { name: "Sıcak Başlangıçlar", parentId: catStarters.id, displayOrder: 2 },
  });

  // Soğuk Başlangıçlar
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Taze İtalyan Burrata Peyniri",
        description: "Organik salkım domates, fesleğen pesto sos ve 12 yıllık Modena balzamik glaze ile",
        allergens: "Süt ve Süt Ürünleri",
        imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6ef23963?w=500&auto=format&fit=crop&q=80",
        categoryId: catColdStarters.id,
      },
      {
        name: "Dana Carpaccio con Tartufo",
        description: "Siyah trüf yağı, taze roka yaprakları, kapari ve 24 aylık parmesan tekeri dilimleri",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: catColdStarters.id,
      },
      {
        name: "Akdeniz Taze Somon & Avokado Tartar",
        description: "Limonlu ponzu sos, çıtır susam ve taze frenk soğanı ile",
        allergens: "Balık, Susam",
        imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80",
        categoryId: catColdStarters.id,
      },
      {
        name: "Ege Gurme Meze Üçlüsü",
        description: "Köz patlıcan ezmesi, cevizli fava ve taze deniz börülcesi",
        allergens: "Ceviz",
        imageUrl: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500&auto=format&fit=crop&q=80",
        categoryId: catColdStarters.id,
      },
    ],
  });

  // Sıcak Başlangıçlar
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Trüflü Çıtır Jumbo Karides",
        description: "Japon panko kaplama jumbo karides, tatlı-acı trüflü mayonez sos eşliğinde",
        allergens: "Kabuklular, Gluten",
        imageUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80",
        categoryId: catHotStarters.id,
      },
      {
        name: "Izgara Ege Ahtapot Bacağı",
        description: "Köz biberli fava yatağında, kapari meyveleri ve zeytinyağlı limon sos",
        allergens: "Yumuşakçalar",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: catHotStarters.id,
      },
      {
        name: "Buharda Karidesli Dim Sum (Har Gow)",
        description: "Şeffaf hamurda karides bohçası, zencefilli soya sos ile",
        allergens: "Kabuklular, Gluten, Soya",
        imageUrl: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=500&auto=format&fit=crop&q=80",
        categoryId: catHotStarters.id,
      },
    ],
  });

  // --- ANA YEMEKLER ---
  const catMains = await prisma.category.create({
    data: { name: "Ana Yemekler", parentId: catFoods.id, displayOrder: 2 },
  });
  const catSteaks = await prisma.category.create({
    data: { name: "Dinlendirilmiş Etler & Izgaralar", parentId: catMains.id, displayOrder: 1 },
  });
  const catFish = await prisma.category.create({
    data: { name: "Deniz Mahsulleri & Balıklar", parentId: catMains.id, displayOrder: 2 },
  });
  const catAsian = await prisma.category.create({
    data: { name: "Asya & Teppanyaki Lezzetleri", parentId: catMains.id, displayOrder: 3 },
  });
  const catPasta = await prisma.category.create({
    data: { name: "Taze İtalyan Makarnaları & Risotto", parentId: catMains.id, displayOrder: 4 },
  });

  // Etler
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Dry Aged Dana Antrikot (320g)",
        description: "28 gün özel himalaya tuzu odasında dinlendirilmiş, trüflü patates püresi ile",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: catSteaks.id,
      },
      {
        name: "Prime Tomahawk Steak (Paylaşımlı 900g)",
        description: "Meşe kömürü ızgarasında pişirilmiş, fırınlanmış kemik iliği ve taze kuşkonmaz",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=80",
        categoryId: catSteaks.id,
      },
      {
        name: "Ağır Ateşte Kuzu İncik Konfi (12 Saat)",
        description: "Taş fırında ağır ateşte pişmiş, safranlı risotto yatağında demi-glace sos ile",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: catSteaks.id,
      },
    ],
  });

  // Balıklar
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Tuzda Fırınlanmış Kaya Levreği (Bütün)",
        description: "Deniz tuzu kabuğunda fırınlanmış, masada alevli sunum ve körpe patates",
        allergens: "Balık",
        imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80",
        categoryId: catFish.id,
      },
      {
        name: "Izgara Lagos Şiş & Kalamar Tava",
        description: "Taze kekik ve defne yaprağı marineli lagos, tarator sos ile",
        allergens: "Balık, Yumuşakçalar",
        imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80",
        categoryId: catFish.id,
      },
    ],
  });

  // Asya & Teppanyaki
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Geleneksel Çıtır Pekin Ördeği",
        description: "İnce buharda krepler, taze salatalık, taze soğan ve hoisin sosu ile",
        allergens: "Gluten, Soya",
        imageUrl: "https://images.unsplash.com/photo-1514944298352-f67a28e55e2e?w=500&auto=format&fit=crop&q=80",
        categoryId: catAsian.id,
      },
      {
        name: "Teppanyaki Wagyu Dana Eti & Wok Sebzeler",
        description: "Japon teppanyaki ızgarasında teriyaki sosu ve sarımsaklı pirinç ile",
        allergens: "Soya, Susam",
        imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=80",
        categoryId: catAsian.id,
      },
      {
        name: "Royal Dragon Roll (8 Parça Sushi)",
        description: "Yılan balığı, avokado, çıtır karides, tobiko ve unagi sos",
        allergens: "Balık, Kabuklular, Soya",
        imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=80",
        categoryId: catAsian.id,
      },
    ],
  });

  // Makarnalar
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Istakozlu Siyah Tagliolini",
        description: "Mürekkep balıklı el yapımı makarna, tereyağlı ıstakoz kuyruğu ve kiraz domates",
        allergens: "Gluten, Kabuklular, Süt",
        imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80",
        categoryId: catPasta.id,
      },
      {
        name: "Trüf Mantarlı & Porcinili Risotto",
        description: "Acquerello pirinci, porcini mantarı, parmesan tekerinde bağlama ve taze trüf dilimi",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=500&auto=format&fit=crop&q=80",
        categoryId: catPasta.id,
      },
    ],
  });

  // --- TATLILAR ---
  const catDesserts = await prisma.category.create({
    data: { name: "Tatlılar", parentId: catFoods.id, displayOrder: 3 },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Mascarpone Tiramisu al Caffe",
        description: "Savoiardi bisküvisi, espresso ve saf Belçika kakaosu ile",
        allergens: "Gluten, Süt, Yumurta",
        imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&auto=format&fit=crop&q=80",
        categoryId: catDesserts.id,
      },
      {
        name: "Sıcak Çikolatalı Valrhona Sufle",
        description: "Erimiş bitter çikolata kalbi ve Madagascar vanilyalı dondurma eşliğinde",
        allergens: "Gluten, Süt, Yumurta",
        imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80",
        categoryId: catDesserts.id,
      },
      {
        name: "Kızarmış Dondurmalı Muz & Bal (Uzakdoğu Usulü)",
        description: "Çıtır hamurda muz, bal ve hindistan cevizi parçacıkları ile",
        allergens: "Gluten, Süt",
        imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
        categoryId: catDesserts.id,
      },
    ],
  });

  // --- İÇECEKLER ---
  const catHot = await prisma.category.create({
    data: { name: "Sıcak İçecekler", parentId: catDrinks.id, displayOrder: 1 },
  });
  const catCold = await prisma.category.create({
    data: { name: "Soğuk & Alkolsüz İçecekler", parentId: catDrinks.id, displayOrder: 2 },
  });
  const catAlcohol = await prisma.category.create({
    data: { name: "Kokteyller & Seçkin Şaraplar", parentId: catDrinks.id, displayOrder: 3 },
  });

  // Sıcak İçecekler
  await prisma.menuItem.createMany({
    data: [
      { name: "Rize Geleneksel Demleme Çay", description: "İnce belli kristal bardakta taze sunum", categoryId: catHot.id },
      { name: "Geleneksel Türk Kahvesi (Orta / Sade / Şekerli)", description: "Merit çifte kavrulmuş lokum ve su ile", categoryId: catHot.id },
      { name: "Double Espresso / Americano", description: "%100 Arabica çekirdeklerinden anlık taze çekilmiş", categoryId: catHot.id },
      { name: "Japon Sencha Yeşil Çay", description: "Porselen seramik demlikte demleme", categoryId: catHot.id },
    ],
  });

  // Soğuk İçecekler
  await prisma.menuItem.createMany({
    data: [
      { name: "Taze Zencefilli Ev Yapımı Limonata", description: "Nane yaprakları ve kırık buz ile", categoryId: catCold.id },
      { name: "San Pellegrino Doğal Maden Suyu (750ml)", description: "Limon dilimi ile servis", categoryId: catCold.id },
      { name: "Taze Sıkma Portakal & Greyfurt Suyu", description: "Anlık taze sıkılmış", categoryId: catCold.id },
    ],
  });

  // Kokteyller & Şaraplar
  await prisma.menuItem.createMany({
    data: [
      { name: "Signature Merit Royal Passion Kokteyl", description: "Havana Club Rom, taze çarkıfelek meyvesi, lime ve fesleğen", categoryId: catAlcohol.id },
      { name: "Klasik Negroni Reserve", description: "Tanqueray Gin, Campari, Antica Formula Vermut ve portakal kabuğu", categoryId: catAlcohol.id },
      { name: "Chianti Classico DOCG (Kadeh / Şişe)", description: "Geleneksel İtalyan meşe fıçı kırmızı şarap", categoryId: catAlcohol.id },
      { name: "Moët & Chandon Brut Impérial Şampanya", description: "Buz kovasında kadeh sunumu", categoryId: catAlcohol.id },
    ],
  });

  console.log("Hiyerarşik kategoriler ve gurme yiyecek/içecekler oluşturuldu.");
  console.log("=== KURULUM TAMAMLANDI! ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
