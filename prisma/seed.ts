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

  // 6. HİYERARŞİK MENÜ KATEGORİLERİ VE HER ALAKARTA ÖZEL LEZZETLER (FİYAT YOKTUR)
  console.log("Her alakart restoran için özel menü ağacı ve lezzetler oluşturuluyor...");

  // ==========================================
  // 1. THE ROOF GARDEN MENÜSÜ
  // ==========================================
  const roofFoods = await prisma.category.create({
    data: { name: "Yiyecekler", description: "The Roof Garden Uluslararası Gurme Menü", displayOrder: 1, restaurantId: roofGarden.id },
  });
  const roofDrinks = await prisma.category.create({
    data: { name: "İçecekler", description: "Panoramik Kokteyller & Seçkin İçecekler", displayOrder: 2, restaurantId: roofGarden.id },
  });
  const roofStarters = await prisma.category.create({
    data: { name: "Başlangıçlar", parentId: roofFoods.id, displayOrder: 1, restaurantId: roofGarden.id },
  });
  const roofMains = await prisma.category.create({
    data: { name: "Uluslararası Gurme Ana Yemekler", parentId: roofFoods.id, displayOrder: 2, restaurantId: roofGarden.id },
  });
  const roofDesserts = await prisma.category.create({
    data: { name: "Tatlılar", parentId: roofFoods.id, displayOrder: 3, restaurantId: roofGarden.id },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Taze İtalyan Burrata Peyniri",
        description: "Organik salkım domates, fesleğen pesto sos ve 12 yıllık Modena balzamik glaze ile",
        allergens: "Süt ve Süt Ürünleri",
        imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6ef23963?w=500&auto=format&fit=crop&q=80",
        categoryId: roofStarters.id,
      },
      {
        name: "Trüflü Çıtır Jumbo Karides",
        description: "Japon panko kaplama jumbo karides, tatlı-acı trüflü mayonez sos eşliğinde",
        allergens: "Kabuklular, Gluten",
        imageUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80",
        categoryId: roofStarters.id,
      },
      {
        name: "Akdeniz Somon & Avokado Tartar",
        description: "Limonlu ponzu sos, çıtır susam ve taze frenk soğanı ile",
        allergens: "Balık, Susam",
        imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80",
        categoryId: roofStarters.id,
      },
      {
        name: "Ağır Ateşte Kuzu İncik Konfi (12 Saat)",
        description: "Taş fırında ağır ateşte pişmiş, safranlı risotto yatağında demi-glace sos ile",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: roofMains.id,
      },
      {
        name: "Fırınlanmış Norveç Somonu & Kuşkonmaz",
        description: "Taze narenciye sosu ve baby patatesler ile",
        allergens: "Balık",
        imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80",
        categoryId: roofMains.id,
      },
      {
        name: "Trüf Mantarlı & Porcinili Risotto",
        description: "Acquerello pirinci, porcini mantarı, parmesan tekerinde bağlama ve taze trüf dilimi",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=500&auto=format&fit=crop&q=80",
        categoryId: roofMains.id,
      },
      {
        name: "Çarkıfelek Panna Cotta",
        description: "Taze passion fruit coulis ve nane filizleri",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
        categoryId: roofDesserts.id,
      },
      {
        name: "Sıcak Çikolatalı Valrhona Sufle",
        description: "Madagascar vanilyalı dondurma eşliğinde",
        allergens: "Gluten, Süt, Yumurta",
        imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80",
        categoryId: roofDesserts.id,
      },
    ],
  });

  const roofCocktails = await prisma.category.create({
    data: { name: "İmza Kokteyller & Şaraplar", parentId: roofDrinks.id, displayOrder: 1, restaurantId: roofGarden.id },
  });
  const roofHotDrinks = await prisma.category.create({
    data: { name: "Sıcak & Soğuk İçecekler", parentId: roofDrinks.id, displayOrder: 2, restaurantId: roofGarden.id },
  });

  await prisma.menuItem.createMany({
    data: [
      { name: "Roof Sunset Spritz", description: "Aperol, prosecco, greyfurt köpüğü ve taze biberiye", categoryId: roofCocktails.id },
      { name: "Merit Signature Smoked Bourbon", description: "Tütsülenmiş meşe dalı, Angostura bitter ve portakal kabuğu", categoryId: roofCocktails.id },
      { name: "Chablis Premier Cru (Kadeh / Şişe)", description: "Fransız seçkin beyaz şarap", categoryId: roofCocktails.id },
      { name: "Rize Demleme Çay / Espresso", description: "Taze demlenmiş", categoryId: roofHotDrinks.id },
      { name: "San Pellegrino Doğal Maden Suyu (750ml)", description: "Limon dilimi ile", categoryId: roofHotDrinks.id },
    ],
  });

  // ==========================================
  // 2. THE STEAK HOUSE MENÜSÜ
  // ==========================================
  const steakFoods = await prisma.category.create({
    data: { name: "Yiyecekler", description: "The Steak House Seçkin Et Menüsü", displayOrder: 1, restaurantId: steakHouse.id },
  });
  const steakDrinks = await prisma.category.create({
    data: { name: "İçecekler", description: "Kırmızı Şarap Mahzeni & Kokteyller", displayOrder: 2, restaurantId: steakHouse.id },
  });
  const steakStarters = await prisma.category.create({
    data: { name: "Başlangıçlar & Salatalar", parentId: steakFoods.id, displayOrder: 1, restaurantId: steakHouse.id },
  });
  const steakMains = await prisma.category.create({
    data: { name: "Dry-Aged Seçkin Etler & Odun Ateşi", parentId: steakFoods.id, displayOrder: 2, restaurantId: steakHouse.id },
  });
  const steakDesserts = await prisma.category.create({
    data: { name: "Tatlılar", parentId: steakFoods.id, displayOrder: 3, restaurantId: steakHouse.id },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Dana Carpaccio con Tartufo",
        description: "Siyah trüf yağı, taze roka yaprakları, kapari ve 24 aylık parmesan tekeri dilimleri",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: steakStarters.id,
      },
      {
        name: "Fırınlanmış İlikli Dana Kemiği & Sarımsaklı Ekmek",
        description: "Kaya tuzu ve karamelize soğan ile fırınlanmış kemik iliği",
        allergens: "Gluten",
        imageUrl: "https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=80",
        categoryId: steakStarters.id,
      },
      {
        name: "Dry Aged T-Bone Steak (450g)",
        description: "28 gün özel himalaya tuzu odasında dinlendirilmiş, trüflü patates püresi ile",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: steakMains.id,
      },
      {
        name: "Wagyu Ribeye Steak (300g)",
        description: "A5 kalite Japon Wagyu, kömür ateşinde pişmiş kuşkonmaz eşliğinde",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=80",
        categoryId: steakMains.id,
      },
      {
        name: "Prime Tomahawk Steak (Paylaşımlı 900g)",
        description: "Meşe kömürü ızgarasında pişirilmiş, fırınlanmış kemik iliği ve taze kuşkonmaz",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop&q=80",
        categoryId: steakMains.id,
      },
      {
        name: "Kömür Ateşinde Dallas Steak (400g)",
        description: "Özel baharat marineli, ızgara mısır ve baby patatesler ile",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: steakMains.id,
      },
      {
        name: "Geleneksel New York Cheesecake",
        description: "Yaban mersini sosu ve taze frambuaz ile",
        allergens: "Gluten, Süt",
        imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&auto=format&fit=crop&q=80",
        categoryId: steakDesserts.id,
      },
    ],
  });

  const steakWines = await prisma.category.create({
    data: { name: "Kırmızı Şaraplar & Single Malt", parentId: steakDrinks.id, displayOrder: 1, restaurantId: steakHouse.id },
  });
  await prisma.menuItem.createMany({
    data: [
      { name: "Chianti Classico Riserva DOCG", description: "Meşe fıçıda yıllandırılmış İtalyan kırmızısı", categoryId: steakWines.id },
      { name: "Cabernet Sauvignon Reserve", description: "Yoğun gövdeli seçkin kırmızı şarap", categoryId: steakWines.id },
      { name: "Macallan 12 Double Cask Single Malt Viski", description: "Buz ve kuru meyveler ile servis", categoryId: steakWines.id },
      { name: "Geleneksel Türk Kahvesi", description: "Lokum ve su eşliğinde", categoryId: steakWines.id },
    ],
  });

  // ==========================================
  // 3. BLUE SEA MENÜSÜ
  // ==========================================
  const blueFoods = await prisma.category.create({
    data: { name: "Yiyecekler", description: "Blue Sea Akdeniz Balık & Meze Menüsü", displayOrder: 1, restaurantId: blueSea.id },
  });
  const blueDrinks = await prisma.category.create({
    data: { name: "İçecekler", description: "Seçkin Rakılar, Beyaz Şaraplar & Meşrubatlar", displayOrder: 2, restaurantId: blueSea.id },
  });
  const blueMezze = await prisma.category.create({
    data: { name: "Ege Mezeleri & Soğuk Deniz Mahsulleri", parentId: blueFoods.id, displayOrder: 1, restaurantId: blueSea.id },
  });
  const blueWarm = await prisma.category.create({
    data: { name: "Sıcak Ara Sıcaklar", parentId: blueFoods.id, displayOrder: 2, restaurantId: blueSea.id },
  });
  const blueFish = await prisma.category.create({
    data: { name: "Günlük Taze Balıklar", parentId: blueFoods.id, displayOrder: 3, restaurantId: blueSea.id },
  });
  const blueDesserts = await prisma.category.create({
    data: { name: "Tatlılar", parentId: blueFoods.id, displayOrder: 4, restaurantId: blueSea.id },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Ege Gurme Meze Üçlüsü",
        description: "Köz patlıcan ezmesi, cevizli fava ve taze deniz börülcesi",
        allergens: "Ceviz",
        imageUrl: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500&auto=format&fit=crop&q=80",
        categoryId: blueMezze.id,
      },
      {
        name: "Taze Levrek Marin & Hardal Sos",
        description: "Tane karabiber ve taze dereotu yaprakları ile",
        allergens: "Balık, Hardal",
        imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80",
        categoryId: blueMezze.id,
      },
      {
        name: "Izgara Ege Ahtapot Bacağı",
        description: "Köz biberli fava yatağında, kapari meyveleri ve zeytinyağlı limon sos",
        allergens: "Yumuşakçalar",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: blueWarm.id,
      },
      {
        name: "Tereyağlı & Sarımsaklı Jumbo Karides Güveç",
        description: "Kiraz domates, taze kekik ve pul biber ile köpüren tereyağında",
        allergens: "Kabuklular, Süt",
        imageUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80",
        categoryId: blueWarm.id,
      },
      {
        name: "Çıtır Kalamar Tava & Tarator Sos",
        description: "Taze halka kalamar, cevizli ev yapımı tarator sos ile",
        allergens: "Yumuşakçalar, Gluten, Ceviz",
        imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80",
        categoryId: blueWarm.id,
      },
      {
        name: "Tuzda Fırınlanmış Kaya Levreği (Bütün)",
        description: "Deniz tuzu kabuğunda fırınlanmış, masada alevli sunum ve körpe patates",
        allergens: "Balık",
        imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80",
        categoryId: blueFish.id,
      },
      {
        name: "Izgara Lagos Şiş",
        description: "Defne yaprağı ve arpacık soğan marineli taze lagos fileto",
        allergens: "Balık",
        imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80",
        categoryId: blueFish.id,
      },
      {
        name: "Fırında Sıcak Tahin Helvası",
        description: "Güveçte eritilmiş helva, limon kabuğu rendesi ile",
        allergens: "Susam",
        imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
        categoryId: blueDesserts.id,
      },
    ],
  });

  const blueRaki = await prisma.category.create({
    data: { name: "Rakılar & Beyaz Şaraplar", parentId: blueDrinks.id, displayOrder: 1, restaurantId: blueSea.id },
  });
  await prisma.menuItem.createMany({
    data: [
      { name: "Yeni Rakı Giz / Ala (Kadeh / Şişe)", description: "Meşe fıçıda dinlendirilmiş özel seri", categoryId: blueRaki.id },
      { name: "Beylerbeyi Göbek Rakısı", description: "Yaş üzüm üç distile", categoryId: blueRaki.id },
      { name: "Sauvignon Blanc Ege Bölgesi", description: "Ferah ve meyvemsi taze beyaz şarap", categoryId: blueRaki.id },
      { name: "Rize Demleme Çay", description: "İnce belli bardakta", categoryId: blueRaki.id },
    ],
  });

  // ==========================================
  // 4. MANDARIN MENÜSÜ (PAN-ASYA & TEPPANYAKI)
  // ==========================================
  const mandarinFoods = await prisma.category.create({
    data: { name: "Yiyecekler", description: "Mandarin Uzakdoğu & Pan-Asya Gurme Menü", displayOrder: 1, restaurantId: mandarin.id },
  });
  const mandarinDrinks = await prisma.category.create({
    data: { name: "İçecekler", description: "Asya Kokteylleri, Sake & Yeşil Çay", displayOrder: 2, restaurantId: mandarin.id },
  });
  const mandarinStarters = await prisma.category.create({
    data: { name: "Dim Sum & Başlangıçlar", parentId: mandarinFoods.id, displayOrder: 1, restaurantId: mandarin.id },
  });
  const mandarinSushi = await prisma.category.create({
    data: { name: "Sushi & Sashimi Bar", parentId: mandarinFoods.id, displayOrder: 2, restaurantId: mandarin.id },
  });
  const mandarinTeppanyaki = await prisma.category.create({
    data: { name: "Teppanyaki & Wok Lezzetleri", parentId: mandarinFoods.id, displayOrder: 3, restaurantId: mandarin.id },
  });
  const mandarinDesserts = await prisma.category.create({
    data: { name: "Tatlılar", parentId: mandarinFoods.id, displayOrder: 4, restaurantId: mandarin.id },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Buharda Karidesli Dim Sum (Har Gow)",
        description: "Şeffaf hamurda karides bohçası, zencefilli soya sos ile",
        allergens: "Kabuklular, Gluten, Soya",
        imageUrl: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinStarters.id,
      },
      {
        name: "Çıtır Sebzeli Wonton",
        description: "Tatlı-ekşi erik sosu ile çıtır kızarmış wonton börekleri",
        allergens: "Gluten, Soya",
        imageUrl: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinStarters.id,
      },
      {
        name: "Tom Yum Goong Çorbası",
        description: "Tayland usulü acılı ekşili jumbo karides çorbası, limon otu ve taze kişniş",
        allergens: "Kabuklular, Balık Sosu",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinStarters.id,
      },
      {
        name: "Royal Dragon Roll (8 Parça Sushi)",
        description: "Yılan balığı, avokado, çıtır karides, tobiko ve unagi sos",
        allergens: "Balık, Kabuklular, Soya",
        imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinSushi.id,
      },
      {
        name: "Somon & Avokado Uramaki (8 Parça)",
        description: "Taze Norveç somonu, avokado, susam ve Japon mayonezi",
        allergens: "Balık, Susam",
        imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinSushi.id,
      },
      {
        name: "Geleneksel Çıtır Pekin Ördeği",
        description: "İnce buharda krepler, taze salatalık, taze soğan ve hoisin sosu ile masada servis",
        allergens: "Gluten, Soya",
        imageUrl: "https://images.unsplash.com/photo-1514944298352-f67a28e55e2e?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinTeppanyaki.id,
      },
      {
        name: "Teppanyaki Wagyu Dana Eti & Wok Sebzeler",
        description: "Japon teppanyaki ızgarasında teriyaki sosu ve sarımsaklı pirinç ile",
        allergens: "Soya, Susam",
        imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinTeppanyaki.id,
      },
      {
        name: "Tatlı Ekşi Soslu Çıtır Tavuk",
        description: "Ananas, renkli biberler ve susam eşliğinde wok tava sunumu",
        allergens: "Gluten, Soya, Susam",
        imageUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinTeppanyaki.id,
      },
      {
        name: "Kızarmış Dondurmalı Muz & Bal",
        description: "Çıtır Uzakdoğu usulü hamurda muz, bal ve hindistan cevizi",
        allergens: "Gluten, Süt",
        imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
        categoryId: mandarinDesserts.id,
      },
    ],
  });

  const mandarinCocktails = await prisma.category.create({
    data: { name: "Sake, Asya Kokteylleri & Çaylar", parentId: mandarinDrinks.id, displayOrder: 1, restaurantId: mandarin.id },
  });
  await prisma.menuItem.createMany({
    data: [
      { name: "Geleneksel Japon Sıcak Sake (Tokkuri)", description: "Seramik kasede sunulan pirinç şarabı", categoryId: mandarinCocktails.id },
      { name: "Mandarin Dragon Passion Kokteyl", description: "Cin, lychee likörü, zencefil şurubu ve taze lime", categoryId: mandarinCocktails.id },
      { name: "Japon Sencha Yeşil Çay", description: "Porselen seramik demlikte demleme", categoryId: mandarinCocktails.id },
      { name: "Yaseminli Çin Çayı", description: "Doğal yasemin çiçekli demleme", categoryId: mandarinCocktails.id },
    ],
  });

  // ==========================================
  // 5. BELLA MERIT MENÜSÜ (OTANTİK İTALYAN)
  // ==========================================
  const bellaFoods = await prisma.category.create({
    data: { name: "Yiyecekler", description: "Bella Merit Otantik İtalyan Mutfağı", displayOrder: 1, restaurantId: bellaMerit.id },
  });
  const bellaDrinks = await prisma.category.create({
    data: { name: "İçecekler", description: "İtalyan Şarapları, Aperitivo & Espresso", displayOrder: 2, restaurantId: bellaMerit.id },
  });
  const bellaAntipasti = await prisma.category.create({
    data: { name: "Antipasti & Başlangıçlar", parentId: bellaFoods.id, displayOrder: 1, restaurantId: bellaMerit.id },
  });
  const bellaPasta = await prisma.category.create({
    data: { name: "Taze El Yapımı Makarnalar & Risotto", parentId: bellaFoods.id, displayOrder: 2, restaurantId: bellaMerit.id },
  });
  const bellaSecundi = await prisma.category.create({
    data: { name: "Taş Fırın & İtalyan Ana Yemekleri", parentId: bellaFoods.id, displayOrder: 3, restaurantId: bellaMerit.id },
  });
  const bellaDesserts = await prisma.category.create({
    data: { name: "Dolci (Tatlılar)", parentId: bellaFoods.id, displayOrder: 4, restaurantId: bellaMerit.id },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        name: "Taze İtalyan Burrata Peyniri",
        description: "Organik salkım domates, fesleğen pesto sos ve 12 yıllık Modena balzamik glaze ile",
        allergens: "Süt ve Süt Ürünleri",
        imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6ef23963?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaAntipasti.id,
      },
      {
        name: "Bruschetta al Pomodoro & Basilico",
        description: "Kızarmış focaccia ekmeği üzerinde sarımsak, sızma zeytinyağı ve taze fesleğen",
        allergens: "Gluten",
        imageUrl: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaAntipasti.id,
      },
      {
        name: "Istakozlu Siyah Tagliolini",
        description: "Mürekkep balıklı el yapımı taze makarna, tereyağlı ıstakoz kuyruğu ve kiraz domates",
        allergens: "Gluten, Kabuklular, Süt",
        imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaPasta.id,
      },
      {
        name: "Trüf Mantarlı & Porcinili Risotto",
        description: "Acquerello pirinci, porcini mantarı, parmesan tekerinde bağlama ve taze trüf dilimi",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaPasta.id,
      },
      {
        name: "El Yapımı Fettuccine Alfredo & Tavuk",
        description: "Tereyağlı krema sosu, taze parmesan ve ızgara tavuk dilimleri",
        allergens: "Gluten, Süt",
        imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaPasta.id,
      },
      {
        name: "Dana Osso Buco alla Milanese",
        description: "Ağır ateşte sebzelerle fırınlanmış dana incik, safranlı risotto eşliğinde",
        allergens: "Süt Ürünü",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaSecundi.id,
      },
      {
        name: "Pollo alla Parmigiana",
        description: "Mozzarella ve parmesan ile fırınlanmış domates soslu çıtır tavuk göğsü",
        allergens: "Gluten, Süt",
        imageUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaSecundi.id,
      },
      {
        name: "Geleneksel Mascarpone Tiramisu",
        description: "Savoiardi bisküvisi, espresso ve saf Belçika kakaosu ile",
        allergens: "Gluten, Süt, Yumurta",
        imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaDesserts.id,
      },
      {
        name: "Çıtır Cannoli Siciliani",
        description: "Tatlı ricotta kreması, antep fıstığı ve çikolata damlacıkları",
        allergens: "Gluten, Süt, Fıstık",
        imageUrl: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
        categoryId: bellaDesserts.id,
      },
    ],
  });

  const bellaWines = await prisma.category.create({
    data: { name: "İtalyan Şarapları, Aperitivo & Kahve", parentId: bellaDrinks.id, displayOrder: 1, restaurantId: bellaMerit.id },
  });
  await prisma.menuItem.createMany({
    data: [
      { name: "Aperol Spritz Veneziano", description: "Aperol, Prosecco DOC, soda ve taze portakal dilimi", categoryId: bellaWines.id },
      { name: "Chianti Classico DOCG (Kırmızı)", description: "Toscana bölgesinin seçkin kırmızı şarabı", categoryId: bellaWines.id },
      { name: "Pinot Grigio delle Venezie (Beyaz)", description: "Canlı ve meyvemsi İtalyan beyaz şarabı", categoryId: bellaWines.id },
      { name: "Double Espresso Illy", description: "%100 Arabica çekirdeklerinden", categoryId: bellaWines.id },
      { name: "Limoncello di Sorrento (Digestivo)", description: "Soğuk kristal kadehte servis", categoryId: bellaWines.id },
    ],
  });

  console.log("5 Alakart Restorana özel menü ağaçları ve yemekler başarıyla oluşturuldu.");
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
