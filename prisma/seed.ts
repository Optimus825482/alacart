import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { HARDWARE_BOM_PACKAGE } from "../src/lib/types";
import {
  formatKitchenOrderChit,
  formatKitchenVoidChit,
  formatPricelessCheckSummary,
  formatTestDiagnosticChit,
} from "../src/lib/receipt-templates";
import { recordAuditEvent } from "../src/lib/audit";

const prisma = new PrismaClient();

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Seed mevcut veritabanındaki tüm kayıtları siler. ALLOW_DESTRUCTIVE_SEED=true olmadan çalıştırılamaz.");
  }
  const requiredSecrets = ["SEED_ADMIN_PASSWORD", "SEED_ADMIN_PIN", "SEED_MANAGER_PASSWORD", "SEED_MANAGER_PIN", "SEED_WAITER_PASSWORD", "SEED_WAITER_PIN", "SEED_SETUP_KEY"];
  const missingSecrets = requiredSecrets.filter((key) => !process.env[key] || process.env[key]!.length < 8);
  if (missingSecrets.length) {
    throw new Error(`Seed için güvenli ve en az 8 karakterli ortam sırları gerekli: ${missingSecrets.join(", ")}`);
  }
  console.log("Alacarte yerel PostgreSQL veritabanı sıfırlanıyor ve tohumlanıyor...");

  // 1. Clean existing records in safe FK order
  await prisma.reportExecution.deleteMany();
  await prisma.repairRun.deleteMany();
  await prisma.diagnosticFinding.deleteMany();
  await prisma.diagnosticCheck.deleteMany();
  await prisma.diagnosticRun.deleteMany();
  await prisma.backupRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.printJob.deleteMany();
  await prisma.cancellationRequest.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.serviceRound.deleteMany();
  await prisma.serviceSession.deleteMany();
  await prisma.menuItemModifierGroup.deleteMany();
  await prisma.modifierOption.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.kitchenStation.deleteMany();
  await prisma.printerQueue.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.area.deleteMany();
  await prisma.restaurantConfig.deleteMany();

  const now = new Date();
  const minAgo = (mins: number) => new Date(now.getTime() - mins * 60 * 1000);
  const minAhead = (mins: number) => new Date(now.getTime() + mins * 60 * 1000);
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // 2. Create RestaurantConfig
  const config = await prisma.restaurantConfig.create({
    data: {
      id: "local-restaurant-config",
      name: "Merit Garden · A La Carte",
      code: "MERIT_GARDEN_LOCAL",
      description:
        "Yerel kapalı LAN restoran operasyon sistemi (İnternet, PMS ve ödeme bağlantısız · Fiyatsız Operasyon)",
      timezone: "Asia/Nicosia",
      setupCompleted: true,
      setupKeyHash: bcrypt.hashSync(process.env.SEED_SETUP_KEY!, 10),
      learningModeEnabled: true,
      shiftCancelDelegate: true,
      menuVersion: 3,
      retentionDays: 1825,
      usbBackupPath: "/mnt/usb/alacarte/backups",
      localBackupPath: "/var/lib/alacarte/backups",
      maxBackupCopies: 15,
      appVersion: "1.0.0",
      dbSchemaVersion: "db-19",
      hardwareTopologyJson: JSON.stringify(HARDWARE_BOM_PACKAGE),
      serverStartedAt: minAgo(320),
    },
  });

  // 3. Create 2 PrinterQueue records
  const receiptQueue = await prisma.printerQueue.create({
    data: {
      name: "Adisyon-USB",
      role: "RECEIPT",
      osQueueName: "Adisyon-USB",
      connectionType: "USB_DIRECT",
      deviceModel: "Epson TM-T20III (011), C31CH51011",
      status: "ONLINE",
      spoolerStatus: "RUNNING",
      pendingJobCount: 0,
      lastCheckedAt: now,
      lastSuccessAt: minAgo(6),
      active: true,
    },
  });

  const kitchenQueue = await prisma.printerQueue.create({
    data: {
      name: "Mutfak-Windows",
      role: "KITCHEN",
      osQueueName: "Mutfak-Windows",
      connectionType: "ETHERNET_PRINT_SERVER_BRIDGE",
      deviceModel: "Epson TM-T20III (011), C31CH51011",
      printServerModel: "DIGITUS DN-13003-2",
      bridgeApModel: "TP-Link TL-WA801N (Client/Bridge Modu)",
      routerModel: "TP-Link Archer AX23 (Kapalı LAN)",
      status: "ONLINE",
      spoolerStatus: "RUNNING",
      pendingJobCount: 1,
      lastCheckedAt: now,
      lastSuccessAt: minAgo(2),
      lastErrorMessage: "P-2045 nolu iş için DN-13003-2 yanıt zaman aşımı (Durum: Belirsiz)",
      active: true,
    },
  });

  // 4. Create 4 KitchenStation records linked to Mutfak-Windows
  const stationSicak = await prisma.kitchenStation.create({
    data: {
      name: "SICAK MUTFAK",
      code: "SICAK",
      printerQueueId: kitchenQueue.id,
      displayOrder: 1,
      active: true,
    },
  });

  const stationIzgara = await prisma.kitchenStation.create({
    data: {
      name: "IZGARA İSTASYONU",
      code: "IZGARA",
      printerQueueId: kitchenQueue.id,
      displayOrder: 2,
      active: true,
    },
  });

  const stationSoguk = await prisma.kitchenStation.create({
    data: {
      name: "SOĞUK / MEZE",
      code: "SOGUK",
      printerQueueId: kitchenQueue.id,
      displayOrder: 3,
      active: true,
    },
  });

  const stationTatli = await prisma.kitchenStation.create({
    data: {
      name: "TATLI / İÇECEK",
      code: "TATLI",
      printerQueueId: kitchenQueue.id,
      displayOrder: 4,
      active: true,
    },
  });

  // 5. Create 2 Area records (Salon: Masa 01..16, Teras: Masa 17..24)
  const areaSalon = await prisma.area.create({
    data: {
      name: "Salon",
      description: "Ana kapalı yemek salonu (Masa 01 - Masa 16)",
      displayOrder: 1,
      active: true,
    },
  });

  const areaTeras = await prisma.area.create({
    data: {
      name: "Teras",
      description: "Bahçe ve açık teras bölümü (Masa 17 - Masa 24)",
      displayOrder: 2,
      active: true,
    },
  });

  const statusMap: Record<
    number,
    | "EMPTY"
    | "IN_SERVICE"
    | "DRAFT_PENDING"
    | "SCHEDULED_PENDING"
    | "PRINT_PENDING"
    | "PRINT_WARNING"
    | "CANCEL_PENDING"
  > = {
    3: "IN_SERVICE",
    5: "IN_SERVICE",
    8: "CANCEL_PENDING",
    12: "DRAFT_PENDING",
    16: "PRINT_WARNING",
    20: "SCHEDULED_PENDING",
  };

  const tablesByNumber: Record<number, { id: string; name: string; number: number }> = {};

  for (let num = 1; num <= 24; num++) {
    const padded = String(num).padStart(2, "0");
    const tableName = `Masa ${padded}`;
    const status = statusMap[num] ?? "EMPTY";
    const capacity = num % 4 === 0 ? 6 : num % 2 === 0 ? 4 : 2;
    const tbl = await prisma.restaurantTable.create({
      data: {
        number: num,
        name: tableName,
        capacity,
        status,
        active: true,
        version: status === "EMPTY" ? 1 : 3,
        lastActivityAt: status === "EMPTY" ? minAgo(180) : minAgo(num),
        areaId: num <= 16 ? areaSalon.id : areaTeras.id,
      },
    });
    tablesByNumber[num] = tbl;
  }

  // 6. Create 5 personal User accounts
  const userAdmin = await prisma.user.create({
    data: {
      name: "Sistem Yöneticisi",
      username: "sistem.yoneticisi",
      passwordHash: bcrypt.hashSync(process.env.SEED_ADMIN_PASSWORD!, 10),
      pinHash: bcrypt.hashSync(process.env.SEED_ADMIN_PIN!, 10),
      role: "SYSTEM_ADMIN",
      active: true,
      canApproveCancel: true,
      lastHeartbeatAt: now,
      lastDeviceInfo: "Sunucu-Kasa Tiwox TP-8610",
      lastSyncedMenuVersion: 3,
    },
  });

  const userManager = await prisma.user.create({
    data: {
      name: "Mehmet Kaya",
      username: "mehmet.kaya",
      passwordHash: bcrypt.hashSync(process.env.SEED_MANAGER_PASSWORD!, 10),
      pinHash: bcrypt.hashSync(process.env.SEED_MANAGER_PIN!, 10),
      role: "RESTAURANT_MANAGER",
      active: true,
      canApproveCancel: true,
      lastHeartbeatAt: now,
      lastDeviceInfo: "Kasa Terminali · Chrome",
      lastSyncedMenuVersion: 3,
    },
  });

  const userAyse = await prisma.user.create({
    data: {
      name: "Ayşe Yılmaz",
      username: "ayse.yilmaz",
      passwordHash: bcrypt.hashSync(process.env.SEED_WAITER_PASSWORD!, 10),
      pinHash: bcrypt.hashSync(process.env.SEED_WAITER_PIN!, 10),
      role: "WAITER",
      active: true,
      canApproveCancel: false,
      lastHeartbeatAt: now,
      lastDeviceInfo: "Garson Telefonu #01 · WLAN",
      lastSyncedMenuVersion: 3,
    },
  });

  const userDeniz = await prisma.user.create({
    data: {
      name: "Deniz Kaya",
      username: "deniz.kaya",
      passwordHash: bcrypt.hashSync(process.env.SEED_WAITER_PASSWORD!, 10),
      pinHash: bcrypt.hashSync(process.env.SEED_WAITER_PIN!, 10),
      role: "WAITER",
      active: true,
      canApproveCancel: true,
      lastHeartbeatAt: now,
      lastDeviceInfo: "Garson Telefonu #02 · WLAN",
      lastSyncedMenuVersion: 3,
    },
  });

  await prisma.user.create({
    data: {
      name: "Caner Demir",
      username: "caner.demir",
      passwordHash: bcrypt.hashSync(process.env.SEED_WAITER_PASSWORD!, 10),
      pinHash: bcrypt.hashSync(process.env.SEED_WAITER_PIN!, 10),
      role: "WAITER",
      active: false,
      canApproveCancel: false,
      lastDeviceInfo: "Pasif Hesap",
      lastSyncedMenuVersion: 2,
    },
  });

  // 7. Create ModifierGroup and ModifierOption records
  const modPisme = await prisma.modifierGroup.create({
    data: {
      name: "Pişme Derecesi",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      displayOrder: 1,
      active: true,
      options: {
        create: [
          { name: "Az pişmiş", qualifier: "DEFAULT", isDefault: false, displayOrder: 1 },
          { name: "Orta pişmiş", qualifier: "DEFAULT", isDefault: true, displayOrder: 2 },
          { name: "İyi pişmiş", qualifier: "DEFAULT", isDefault: false, displayOrder: 3 },
        ],
      },
    },
  });

  const modHazirlama = await prisma.modifierGroup.create({
    data: {
      name: "Hazırlama ve Servis Tercihi",
      required: false,
      minSelect: 0,
      maxSelect: 4,
      displayOrder: 2,
      active: true,
      options: {
        create: [
          { name: "Soğansız", qualifier: "REMOVE", isDefault: false, displayOrder: 1 },
          { name: "Sos ayrı", qualifier: "SIDE", isDefault: false, displayOrder: 2 },
          { name: "Limon ayrı", qualifier: "SIDE", isDefault: false, displayOrder: 3 },
          { name: "Tuzsuz", qualifier: "REMOVE", isDefault: false, displayOrder: 4 },
          { name: "Ekstra acı", qualifier: "ADD", isDefault: false, displayOrder: 5 },
        ],
      },
    },
  });

  const modIcecek = await prisma.modifierGroup.create({
    data: {
      name: "İçecek Tercihi",
      required: false,
      minSelect: 0,
      maxSelect: 2,
      displayOrder: 3,
      active: true,
      options: {
        create: [
          { name: "Buzlu", qualifier: "DEFAULT", isDefault: false, displayOrder: 1 },
          { name: "Buzsuz", qualifier: "REMOVE", isDefault: false, displayOrder: 2 },
          { name: "Limon dilimli", qualifier: "ADD", isDefault: false, displayOrder: 3 },
          { name: "Oda sıcaklığında", qualifier: "DEFAULT", isDefault: false, displayOrder: 4 },
        ],
      },
    },
  });

  // 8. Create Category and Subcategory hierarchy
  const catBaslangic = await prisma.category.create({
    data: { name: "Başlangıçlar", description: "Soğuk mezeler ve sıcak başlangıçlar", displayOrder: 1 },
  });
  const subSogukMeze = await prisma.category.create({
    data: { name: "Soğuk Mezeler", parentId: catBaslangic.id, displayOrder: 1 },
  });
  const subAraSicak = await prisma.category.create({
    data: { name: "Ara Sıcaklar", parentId: catBaslangic.id, displayOrder: 2 },
  });

  const catCorbaSalata = await prisma.category.create({
    data: { name: "Çorbalar ve Salatalar", description: "Günlük çorbalar ve taze bahçe salataları", displayOrder: 2 },
  });
  const subCorba = await prisma.category.create({
    data: { name: "Çorbalar", parentId: catCorbaSalata.id, displayOrder: 1 },
  });
  const subSalata = await prisma.category.create({
    data: { name: "Salatalar", parentId: catCorbaSalata.id, displayOrder: 2 },
  });

  const catAnaYemek = await prisma.category.create({
    data: { name: "Ana Yemekler", description: "Izgara etler, taze deniz ürünleri ve taş fırın", displayOrder: 3 },
  });
  const subIzgara = await prisma.category.create({
    data: { name: "Izgaralar", parentId: catAnaYemek.id, displayOrder: 1 },
  });
  const subDeniz = await prisma.category.create({
    data: { name: "Deniz Ürünleri", parentId: catAnaYemek.id, displayOrder: 2 },
  });
  const subFirin = await prisma.category.create({
    data: { name: "Fırın & Makarna", parentId: catAnaYemek.id, displayOrder: 3 },
  });

  const catTatli = await prisma.category.create({
    data: { name: "Tatlılar", description: "Geleneksel ve modern restoran tatlıları", displayOrder: 4 },
  });
  const subTatli = await prisma.category.create({
    data: { name: "Geleneksel ve Modern Tatlılar", parentId: catTatli.id, displayOrder: 1 },
  });

  const catIcecek = await prisma.category.create({
    data: { name: "İçecekler", description: "Soğuk meşrubatlar ve sıcak çay/kahve servisi", displayOrder: 5 },
  });
  const subSogukIcecek = await prisma.category.create({
    data: { name: "Soğuk İçecekler", parentId: catIcecek.id, displayOrder: 1 },
  });
  const subSicakIcecek = await prisma.category.create({
    data: { name: "Sıcak İçecekler", parentId: catIcecek.id, displayOrder: 2 },
  });

  // Helper to create MenuItem and attach ModifierGroups (ZERO price fields!)
  async function createMenuProduct(params: {
    name: string;
    receiptName: string;
    description: string;
    allergens?: string;
    dietaryTags?: string;
    productClass?: "STANDARD" | "BEVERAGE" | "SHAREABLE";
    askSeatOnAdd?: boolean;
    isShareable?: boolean;
    displayOrder: number;
    categoryId: string;
    stationId: string;
    modifierGroupIds?: string[];
  }) {
    const item = await prisma.menuItem.create({
      data: {
        name: params.name,
        receiptName: params.receiptName,
        description: params.description,
        allergens: params.allergens ?? null,
        dietaryTags: params.dietaryTags ?? null,
        productClass: params.productClass ?? "STANDARD",
        askSeatOnAdd: params.askSeatOnAdd ?? false,
        isShareable: params.isShareable ?? false,
        status: "ACTIVE",
        active: true,
        displayOrder: params.displayOrder,
        menuVersion: 3,
        categoryId: params.categoryId,
        stationId: params.stationId,
      },
    });

    if (params.modifierGroupIds && params.modifierGroupIds.length > 0) {
      for (const groupId of params.modifierGroupIds) {
        await prisma.menuItemModifierGroup.create({
          data: {
            menuItemId: item.id,
            modifierGroupId: groupId,
          },
        });
      }
    }

    return item;
  }

  // Create 20 rich MenuItem records across all subcategories
  const itemOrtayaMeze = await createMenuProduct({
    name: "Ortaya Meze Seçkisi",
    receiptName: "Ortaya Meze Seçkisi",
    description: "Humus, babagannuş, atom, vişneli yaprak sarma ve köz patlıcan",
    allergens: "Susam, Süt Ürünü, Ceviz",
    dietaryTags: "Vejetaryen, Paylaşımlık",
    productClass: "SHAREABLE",
    askSeatOnAdd: true,
    isShareable: true,
    displayOrder: 1,
    categoryId: subSogukMeze.id,
    stationId: stationSoguk.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemDenizBorulcesi = await createMenuProduct({
    name: "Ege Deniz Börülcesi",
    receiptName: "Deniz Börülcesi",
    description: "Sızma zeytinyağı ve sarımsak soslu taze deniz börülcesi",
    allergens: "Yok",
    dietaryTags: "Vegan, Glutensiz",
    productClass: "SHAREABLE",
    askSeatOnAdd: false,
    isShareable: true,
    displayOrder: 2,
    categoryId: subSogukMeze.id,
    stationId: stationSoguk.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemHumusPastirma = await createMenuProduct({
    name: "Sıcak Pastırmalı Humus",
    receiptName: "Pastırmalı Humus",
    description: "Güveçte tereyağlı Kayseri pastırmalı sıcak humus",
    allergens: "Susam, Süt Ürünü",
    dietaryTags: "Şefin Önerisi",
    productClass: "SHAREABLE",
    askSeatOnAdd: false,
    isShareable: true,
    displayOrder: 1,
    categoryId: subAraSicak.id,
    stationId: stationSicak.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemKalamarTava = await createMenuProduct({
    name: "Çıtır Kalamar Tava",
    receiptName: "Kalamar Tava",
    description: "Ev yapımı tartar sos ile servis edilen Ege kalamarı",
    allergens: "Yumuşakça, Gluten, Yumurta",
    dietaryTags: "Deniz Ürünü",
    productClass: "SHAREABLE",
    askSeatOnAdd: false,
    isShareable: true,
    displayOrder: 2,
    categoryId: subAraSicak.id,
    stationId: stationSicak.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemMercimekCorba = await createMenuProduct({
    name: "Süzme Mercimek Çorbası",
    receiptName: "Mercimek Çorbası",
    description: "Kruton ekmek ve tereyağlı nane sosu ile",
    allergens: "Gluten, Süt Ürünü",
    dietaryTags: "Vejetaryen",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 1,
    categoryId: subCorba.id,
    stationId: stationSicak.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemBalikCorba = await createMenuProduct({
    name: "Kremalı Deniz Mahsulleri Çorbası",
    receiptName: "Deniz Mah. Çorbası",
    description: "Levrek, karides ve kök sebzelerle hazırlanan şef çorbası",
    allergens: "Balık, Kabuklu Deniz Ürünü, Süt Ürünü, Kereviz",
    dietaryTags: "Şefin Önerisi",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 2,
    categoryId: subCorba.id,
    stationId: stationSicak.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemMevsimSalata = await createMenuProduct({
    name: "Bahçe Mevsim Salata",
    receiptName: "Mevsim Salata",
    description: "Nar ekşili ve sızma zeytinyağlı taze yeşillik salatası",
    allergens: "Yok",
    dietaryTags: "Vegan, Glutensiz",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: true,
    displayOrder: 1,
    categoryId: subSalata.id,
    stationId: stationSoguk.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemTulumSalata = await createMenuProduct({
    name: "Erzincan Tulum Peynirli Roka Salatası",
    receiptName: "Tulumlu Roka Salata",
    description: "Ceviz içi, çeri domates, tulum peyniri ve balzamik sos",
    allergens: "Süt Ürünü, Ceviz",
    dietaryTags: "Vejetaryen, Glutensiz",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: true,
    displayOrder: 2,
    categoryId: subSalata.id,
    stationId: stationSoguk.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemDanaBonfile = await createMenuProduct({
    name: "Dinlendirilmiş Dana Bonfile (220g)",
    receiptName: "Dana Bonfile",
    description: "Fırın bebek patates, ızgara kuşkonmaz ve demi-glace sos ile",
    allergens: "Süt Ürünü",
    dietaryTags: "Yüksek Protein, Şefin Önerisi",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 1,
    categoryId: subIzgara.id,
    stationId: stationIzgara.id,
    modifierGroupIds: [modPisme.id, modHazirlama.id],
  });

  const itemKuzuPirzola = await createMenuProduct({
    name: "Kekikli Kuzu Pirzola",
    receiptName: "Kuzu Pirzola",
    description: "Közlenmiş biber, domates ve firik pilavı eşliğinde",
    allergens: "Gluten",
    dietaryTags: "Şefin Önerisi",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 2,
    categoryId: subIzgara.id,
    stationId: stationIzgara.id,
    modifierGroupIds: [modPisme.id, modHazirlama.id],
  });

  const itemIzgaraKofte = await createMenuProduct({
    name: "Kasap Izgara Köfte",
    receiptName: "Izgara Köfte",
    description: "Piyaz, köz biber ve ızgara lavaş ile geleneksel ızgara köfte",
    allergens: "Gluten",
    dietaryTags: "Klasik",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 3,
    categoryId: subIzgara.id,
    stationId: stationIzgara.id,
    modifierGroupIds: [modPisme.id, modHazirlama.id],
  });

  const itemIzgaraLevrek = await createMenuProduct({
    name: "Kömürde Izgara Deniz Levreği",
    receiptName: "Izgara Levrek",
    description: "Roka, kırmızı soğan ve limon-zeytinyağı sosu ile",
    allergens: "Balık",
    dietaryTags: "Glutensiz, Sağlıklı Seçim",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 1,
    categoryId: subDeniz.id,
    stationId: stationIzgara.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemSomonIzgara = await createMenuProduct({
    name: "Izgara Norveç Somonu",
    receiptName: "Izgara Somon",
    description: "Sote ıspanak, kapari ve limonlu tereyağı sosu ile",
    allergens: "Balık, Süt Ürünü",
    dietaryTags: "Omega-3, Glutensiz",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 2,
    categoryId: subDeniz.id,
    stationId: stationIzgara.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemDenizMahLinguine = await createMenuProduct({
    name: "Deniz Mahsullü Linguine",
    receiptName: "Deniz Mah. Linguine",
    description: "Karides, kalamar, kum midyesi ve fesleğenli domates soslu taze makarna",
    allergens: "Gluten, Kabuklu Deniz Ürünü, Yumuşakça, Yumurta",
    dietaryTags: "El Yapımı Makarna",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 1,
    categoryId: subFirin.id,
    stationId: stationSicak.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemMantarRisotto = await createMenuProduct({
    name: "Yabani Mantarlı Trüflü Risotto",
    receiptName: "Mantarlı Risotto",
    description: "Porçini mantarı, parmesan ve siyah trüf yağı ile",
    allergens: "Süt Ürünü",
    dietaryTags: "Vejetaryen, Glutensiz",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 2,
    categoryId: subFirin.id,
    stationId: stationSicak.id,
    modifierGroupIds: [modHazirlama.id],
  });

  const itemSufle = await createMenuProduct({
    name: "Belçika Çikolatalı Sıcak Sufle",
    receiptName: "Çikolatalı Sufle",
    description: "Madagaskar vanilyalı dondurma ile (15 dk pişirme süresi)",
    allergens: "Gluten, Süt Ürünü, Yumurta, Soya",
    dietaryTags: "Sıcak Tatlı",
    productClass: "STANDARD",
    askSeatOnAdd: true,
    isShareable: true,
    displayOrder: 1,
    categoryId: subTatli.id,
    stationId: stationTatli.id,
  });

  const itemKunefe = await createMenuProduct({
    name: "Antep Fıstıklı Hatay Künefesi",
    receiptName: "Hatay Künefesi",
    description: "Manda kaymağı ve toz Antep fıstığı ile sıcak servis",
    allergens: "Gluten, Süt Ürünü, Antep Fıstığı",
    dietaryTags: "Geleneksel, Paylaşımlık",
    productClass: "SHAREABLE",
    askSeatOnAdd: false,
    isShareable: true,
    displayOrder: 2,
    categoryId: subTatli.id,
    stationId: stationTatli.id,
  });

  const itemEvLimonata = await createMenuProduct({
    name: "Taze Naneli Ev Yapımı Limonata",
    receiptName: "Ev Limonata",
    description: "Günlük sıkım limon ve taze bahçe nanesi",
    allergens: "Yok",
    dietaryTags: "Vegan, Glutensiz",
    productClass: "BEVERAGE",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 1,
    categoryId: subSogukIcecek.id,
    stationId: stationTatli.id,
    modifierGroupIds: [modIcecek.id],
  });

  const itemMadenSuyu = await createMenuProduct({
    name: "Doğal Kaynak Maden Suyu",
    receiptName: "Maden Suyu",
    description: "Cam şişe doğal mineralli su (250 ml)",
    allergens: "Yok",
    dietaryTags: "Vegan, Glutensiz",
    productClass: "BEVERAGE",
    askSeatOnAdd: false,
    isShareable: false,
    displayOrder: 2,
    categoryId: subSogukIcecek.id,
    stationId: stationTatli.id,
    modifierGroupIds: [modIcecek.id],
  });

  const itemTurkKahvesi = await createMenuProduct({
    name: "Çifte Kavrulmuş Lokumlu Türk Kahvesi",
    receiptName: "Türk Kahvesi",
    description: "Bakır cezvede ağır ateşte pişirilmiş geleneksel kahve",
    allergens: "Antep Fıstığı (Lokumda)",
    dietaryTags: "Geleneksel",
    productClass: "BEVERAGE",
    askSeatOnAdd: true,
    isShareable: false,
    displayOrder: 1,
    categoryId: subSicakIcecek.id,
    stationId: stationTatli.id,
  });

  // 9. Create active and completed ServiceSession, ServiceRound, OrderItem, CancellationRequest, and PrintJob records

  // 9.A: Historical Completed Session 1 -> Masa 01 (A-2026-000180) with APPROVED CancellationRequest VOID-2026-0039 and KITCHEN_VOID PrintJob K-000388
  const session180 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000180",
      tableId: tablesByNumber[1].id,
      status: "COMPLETED",
      guestCount: 3,
      seatCount: 3,
      serviceType: "MASA_SERVISI",
      version: 5,
      notes: "Öğle servisi tamamlandı",
      openedById: userAyse.id,
      completedById: userManager.id,
      openedAt: minAgo(190),
      lastActivityAt: minAgo(125),
      completedAt: minAgo(125),
    },
  });

  const round180_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session180.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-180-R1",
      sentAt: minAgo(180),
      createdById: userAyse.id,
      sentById: userAyse.id,
      createdAt: minAgo(185),
    },
  });

  const item180_1 = await prisma.orderItem.create({
    data: {
      sessionId: session180.id,
      roundId: round180_1.id,
      menuItemId: itemKuzuPirzola.id,
      productNameSnapshot: itemKuzuPirzola.name,
      receiptNameSnapshot: itemKuzuPirzola.receiptName,
      stationNameSnapshot: stationIzgara.name,
      allergensSnapshot: itemKuzuPirzola.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify(["Orta pişmiş"]),
      status: "SENT",
      sentAt: minAgo(180),
      createdById: userAyse.id,
    },
  });

  const item180_2_cancelled = await prisma.orderItem.create({
    data: {
      sessionId: session180.id,
      roundId: round180_1.id,
      menuItemId: itemKalamarTava.id,
      productNameSnapshot: itemKalamarTava.name,
      receiptNameSnapshot: itemKalamarTava.receiptName,
      stationNameSnapshot: stationSicak.name,
      allergensSnapshot: itemKalamarTava.allergens,
      quantity: 1,
      seatNumber: 2,
      modifiersJson: JSON.stringify(["Sos ayrı"]),
      status: "CANCELLED",
      sentAt: minAgo(180),
      cancelledAt: minAgo(168),
      createdById: userAyse.id,
    },
  });

  const jobK000387 = await prisma.printJob.create({
    data: {
      jobCode: "K-000387",
      jobType: "KITCHEN_ORDER",
      status: "SUBMITTED_TO_OS_QUEUE",
      printerQueueId: kitchenQueue.id,
      stationName: stationIzgara.name,
      sessionId: session180.id,
      roundId: round180_1.id,
      idempotencyKey: "PRINT-K-000387",
      contentSnapshot: formatKitchenOrderChit({
        restaurantName: config.name,
        tableName: tablesByNumber[1].name,
        roundNumber: 1,
        orderReference: session180.referenceCode,
        waiterName: userAyse.name,
        stationName: stationIzgara.name,
        jobCode: "K-000387",
        sentAt: minAgo(180),
        items: [
          {
            quantity: 2,
            receiptName: itemKuzuPirzola.receiptName,
            seatNumber: 1,
            modifiers: ["Orta pişmiş"],
            allergens: itemKuzuPirzola.allergens,
          },
        ],
      }),
      scopeDescription: "Tur 01",
      sessionVersionSnapshot: 2,
      requestedById: userAyse.id,
      actorName: userAyse.name,
      submittedAt: minAgo(180),
      completedAt: minAgo(180),
      createdAt: minAgo(180),
    },
  });

  const jobK000388 = await prisma.printJob.create({
    data: {
      jobCode: "K-000388",
      jobType: "KITCHEN_VOID",
      status: "SUBMITTED_TO_OS_QUEUE",
      printerQueueId: kitchenQueue.id,
      stationName: stationSicak.name,
      sessionId: session180.id,
      roundId: round180_1.id,
      idempotencyKey: "PRINT-K-000388",
      contentSnapshot: formatKitchenVoidChit({
        restaurantName: config.name,
        tableName: tablesByNumber[1].name,
        roundNumber: 1,
        orderReference: session180.referenceCode,
        voidReference: "VOID-2026-0039",
        jobCode: "K-000388",
        stationName: stationSicak.name,
        productName: itemKalamarTava.receiptName,
        quantity: 1,
        seatNumber: 2,
        requestedByName: userAyse.name,
        approvedByName: userManager.name,
        reasonCategory: "Misafir tercihini değiştirdi",
        explanation: "Misafir deniz ürünü yerine sebze başlangıç istedi.",
        approvedAt: minAgo(168),
      }),
      scopeDescription: "VOID-2026-0039 Mutfak İptal Bildirimi",
      sessionVersionSnapshot: 4,
      requestedById: userManager.id,
      actorName: userManager.name,
      submittedAt: minAgo(168),
      completedAt: minAgo(168),
      createdAt: minAgo(168),
    },
  });

  await prisma.cancellationRequest.create({
    data: {
      referenceCode: "VOID-2026-0039",
      sessionId: session180.id,
      roundId: round180_1.id,
      orderItemId: item180_2_cancelled.id,
      requestedQuantity: 1,
      reasonCategory: "Misafir tercihini değiştirdi",
      explanation: "Misafir deniz ürünü yerine sebze başlangıç istedi.",
      status: "APPROVED",
      requestedById: userAyse.id,
      requestedAt: minAgo(172),
      decidedById: userManager.id,
      decisionNote: "Mutfak hazırlığa başlamadan iptal onaylandı, VOID fişi basıldı.",
      decidedAt: minAgo(168),
      voidPrintJobId: jobK000388.id,
    },
  });

  await prisma.printJob.create({
    data: {
      jobCode: "A-000112",
      jobType: "PRICELESS_CHECK",
      status: "SUBMITTED_TO_OS_QUEUE",
      printerQueueId: receiptQueue.id,
      sessionId: session180.id,
      idempotencyKey: "PRINT-A-000112",
      contentSnapshot: formatPricelessCheckSummary({
        restaurantName: config.name,
        tableName: tablesByNumber[1].name,
        orderReference: session180.referenceCode,
        waiterName: userAyse.name,
        guestCount: 3,
        scopeDescription: "Tüm gönderilmiş turlar",
        printedAt: minAgo(128),
        jobCode: "A-000112",
        items: [
          {
            roundNumber: 1,
            sentTimeText: "12:10",
            quantity: item180_1.quantity,
            receiptName: item180_1.receiptNameSnapshot,
            seatNumber: 1,
            modifiers: ["Orta pişmiş"],
          },
          {
            roundNumber: 1,
            sentTimeText: "12:10",
            quantity: 1,
            receiptName: itemKalamarTava.receiptName,
            seatNumber: 2,
            isCancelled: true,
            cancelReason: "Misafir tercihini değiştirdi",
          },
        ],
      }),
      scopeDescription: "Tüm gönderilmiş turlar",
      sessionVersionSnapshot: 5,
      requestedById: userManager.id,
      actorName: userManager.name,
      submittedAt: minAgo(128),
      completedAt: minAgo(128),
      createdAt: minAgo(128),
    },
  });

  // 9.B: Historical Completed Session 2 -> Masa 18 (A-2026-000181) with REJECTED CancellationRequest VOID-2026-0040
  const session181 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000181",
      tableId: tablesByNumber[18].id,
      status: "COMPLETED",
      guestCount: 2,
      seatCount: 2,
      serviceType: "MASA_SERVISI",
      version: 4,
      notes: "Teras servisi tamamlandı",
      openedById: userDeniz.id,
      completedById: userManager.id,
      openedAt: minAgo(155),
      lastActivityAt: minAgo(95),
      completedAt: minAgo(95),
    },
  });

  const round181_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session181.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-181-R1",
      sentAt: minAgo(145),
      createdById: userDeniz.id,
      sentById: userDeniz.id,
      createdAt: minAgo(150),
    },
  });

  const item181_1 = await prisma.orderItem.create({
    data: {
      sessionId: session181.id,
      roundId: round181_1.id,
      menuItemId: itemDenizMahLinguine.id,
      productNameSnapshot: itemDenizMahLinguine.name,
      receiptNameSnapshot: itemDenizMahLinguine.receiptName,
      stationNameSnapshot: stationSicak.name,
      allergensSnapshot: itemDenizMahLinguine.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify([]),
      status: "SENT",
      sentAt: minAgo(145),
      createdById: userDeniz.id,
    },
  });

  await prisma.cancellationRequest.create({
    data: {
      referenceCode: "VOID-2026-0040",
      sessionId: session181.id,
      roundId: round181_1.id,
      orderItemId: item181_1.id,
      requestedQuantity: 1,
      reasonCategory: "Gecikme / Süre aşımı",
      explanation: "Misafir makarnanın geciktiğini belirtti.",
      status: "REJECTED",
      requestedById: userDeniz.id,
      requestedAt: minAgo(132),
      decidedById: userManager.id,
      decisionNote: "Tabak servise çıktığı ve misafir kabul ettiği için iptal reddedildi.",
      decidedAt: minAgo(130),
    },
  });

  // 9.C: Active Session -> Masa 03 (A-2026-000182, IN_SERVICE)
  const session182 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000182",
      tableId: tablesByNumber[3].id,
      status: "OPEN",
      guestCount: 2,
      seatCount: 2,
      serviceType: "MASA_SERVISI",
      version: 2,
      notes: "Pencere kenarı misafirleri",
      openedById: userAyse.id,
      openedAt: minAgo(52),
      lastActivityAt: minAgo(35),
    },
  });

  const round182_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session182.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-182-R1",
      sentAt: minAgo(48),
      createdById: userAyse.id,
      sentById: userAyse.id,
      createdAt: minAgo(50),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session182.id,
      roundId: round182_1.id,
      menuItemId: itemSomonIzgara.id,
      productNameSnapshot: itemSomonIzgara.name,
      receiptNameSnapshot: itemSomonIzgara.receiptName,
      stationNameSnapshot: stationIzgara.name,
      allergensSnapshot: itemSomonIzgara.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify(["Sos ayrı"]),
      status: "SENT",
      sentAt: minAgo(48),
      createdById: userAyse.id,
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session182.id,
      roundId: round182_1.id,
      menuItemId: itemEvLimonata.id,
      productNameSnapshot: itemEvLimonata.name,
      receiptNameSnapshot: itemEvLimonata.receiptName,
      stationNameSnapshot: stationTatli.name,
      quantity: 2,
      seatNumber: 2,
      modifiersJson: JSON.stringify(["Buzlu", "Limon dilimli"]),
      status: "SENT",
      sentAt: minAgo(48),
      createdById: userAyse.id,
    },
  });

  // 9.D: Active Session -> Masa 05 (A-2026-000183, IN_SERVICE)
  const session183 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000183",
      tableId: tablesByNumber[5].id,
      status: "OPEN",
      guestCount: 4,
      seatCount: 4,
      serviceType: "MASA_SERVISI",
      version: 3,
      notes: "Yıldönümü masası",
      openedById: userDeniz.id,
      openedAt: minAgo(64),
      lastActivityAt: minAgo(22),
    },
  });

  const round183_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session183.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-183-R1",
      sentAt: minAgo(60),
      createdById: userDeniz.id,
      sentById: userDeniz.id,
      createdAt: minAgo(62),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session183.id,
      roundId: round183_1.id,
      menuItemId: itemHumusPastirma.id,
      productNameSnapshot: itemHumusPastirma.name,
      receiptNameSnapshot: itemHumusPastirma.receiptName,
      stationNameSnapshot: stationSicak.name,
      allergensSnapshot: itemHumusPastirma.allergens,
      quantity: 1,
      sharedSeatsJson: JSON.stringify([1, 2, 3, 4]),
      modifiersJson: JSON.stringify([]),
      status: "SENT",
      sentAt: minAgo(60),
      createdById: userDeniz.id,
    },
  });

  const round183_2 = await prisma.serviceRound.create({
    data: {
      sessionId: session183.id,
      roundNumber: 2,
      status: "SENT",
      idempotencyKey: "IDEMP-183-R2",
      sentAt: minAgo(22),
      createdById: userDeniz.id,
      sentById: userDeniz.id,
      createdAt: minAgo(25),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session183.id,
      roundId: round183_2.id,
      menuItemId: itemKunefe.id,
      productNameSnapshot: itemKunefe.name,
      receiptNameSnapshot: itemKunefe.receiptName,
      stationNameSnapshot: stationTatli.name,
      allergensSnapshot: itemKunefe.allergens,
      quantity: 2,
      sharedSeatsJson: JSON.stringify([1, 2, 3, 4]),
      modifiersJson: JSON.stringify([]),
      kitchenNote: "Şerbeti hafif olsun",
      status: "SENT",
      sentAt: minAgo(22),
      createdById: userDeniz.id,
    },
  });

  // 9.E: Active Session -> Masa 08 (A-2026-000184, 3 misafir, opened by Ayşe, CANCEL_PENDING)
  // Round 1 (SENT with Mevsim Salata x2 [Koltuk 1], Izgara Levrek x1 [Koltuk 2, Limon ayrı] which has a PENDING CancellationRequest VOID-2026-0041)
  // Round 2 (DRAFT with Mercimek Çorbası x2 [Koltuk 1], Ortaya Meze Seçkisi x1 shared across [1,2,3])
  const session184 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000184",
      tableId: tablesByNumber[8].id,
      status: "OPEN",
      guestCount: 3,
      seatCount: 3,
      serviceType: "MASA_SERVISI",
      version: 4,
      notes: "Koltuk 2 balık alerjisi / tercih değişikliği bildirdi",
      openedById: userAyse.id,
      openedAt: minAgo(38),
      lastActivityAt: minAgo(4),
    },
  });

  const round184_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session184.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-184-R1",
      sentAt: minAgo(30),
      createdById: userAyse.id,
      sentById: userAyse.id,
      createdAt: minAgo(35),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session184.id,
      roundId: round184_1.id,
      menuItemId: itemMevsimSalata.id,
      productNameSnapshot: itemMevsimSalata.name,
      receiptNameSnapshot: itemMevsimSalata.receiptName,
      stationNameSnapshot: stationSoguk.name,
      allergensSnapshot: itemMevsimSalata.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify(["Soğansız"]),
      status: "SENT",
      sentAt: minAgo(30),
      createdById: userAyse.id,
    },
  });

  const item184_Levrek = await prisma.orderItem.create({
    data: {
      sessionId: session184.id,
      roundId: round184_1.id,
      menuItemId: itemIzgaraLevrek.id,
      productNameSnapshot: itemIzgaraLevrek.name,
      receiptNameSnapshot: itemIzgaraLevrek.receiptName,
      stationNameSnapshot: stationIzgara.name,
      allergensSnapshot: itemIzgaraLevrek.allergens,
      quantity: 1,
      seatNumber: 2,
      modifiersJson: JSON.stringify(["Limon ayrı"]),
      kitchenNote: "Kılçıksız fileto hazırlansın",
      status: "CANCEL_REQUESTED",
      sentAt: minAgo(30),
      createdById: userAyse.id,
    },
  });

  await prisma.cancellationRequest.create({
    data: {
      referenceCode: "VOID-2026-0041",
      sessionId: session184.id,
      roundId: round184_1.id,
      orderItemId: item184_Levrek.id,
      requestedQuantity: 1,
      reasonCategory: "Misafir tercihini değiştirdi",
      explanation: "Koltuk 2'deki misafir Izgara Levrek yerine Dana Bonfile siparişi vermek istedi.",
      status: "PENDING",
      requestedById: userAyse.id,
      requestedAt: minAgo(5),
    },
  });

  const round184_2 = await prisma.serviceRound.create({
    data: {
      sessionId: session184.id,
      roundNumber: 2,
      status: "DRAFT",
      createdById: userAyse.id,
      createdAt: minAgo(4),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session184.id,
      roundId: round184_2.id,
      menuItemId: itemMercimekCorba.id,
      productNameSnapshot: itemMercimekCorba.name,
      receiptNameSnapshot: itemMercimekCorba.receiptName,
      stationNameSnapshot: stationSicak.name,
      allergensSnapshot: itemMercimekCorba.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify([]),
      status: "DRAFT",
      createdById: userAyse.id,
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session184.id,
      roundId: round184_2.id,
      menuItemId: itemOrtayaMeze.id,
      productNameSnapshot: itemOrtayaMeze.name,
      receiptNameSnapshot: itemOrtayaMeze.receiptName,
      stationNameSnapshot: stationSoguk.name,
      allergensSnapshot: itemOrtayaMeze.allergens,
      quantity: 1,
      sharedSeatsJson: JSON.stringify([1, 2, 3]),
      modifiersJson: JSON.stringify(["Limon ayrı"]),
      kitchenNote: "Ortaya paylaşım tabağı",
      status: "DRAFT",
      createdById: userAyse.id,
    },
  });

  await prisma.printJob.create({
    data: {
      jobCode: "K-000389",
      jobType: "KITCHEN_ORDER",
      status: "SUBMITTED_TO_OS_QUEUE",
      printerQueueId: kitchenQueue.id,
      stationName: stationIzgara.name,
      sessionId: session184.id,
      roundId: round184_1.id,
      idempotencyKey: "PRINT-K-000389",
      contentSnapshot: formatKitchenOrderChit({
        restaurantName: config.name,
        tableName: tablesByNumber[8].name,
        roundNumber: 1,
        orderReference: session184.referenceCode,
        waiterName: userAyse.name,
        stationName: stationIzgara.name,
        jobCode: "K-000389",
        sentAt: minAgo(30),
        items: [
          {
            quantity: 1,
            receiptName: itemIzgaraLevrek.receiptName,
            seatNumber: 2,
            modifiers: ["Limon ayrı"],
            kitchenNote: "Kılçıksız fileto hazırlansın",
            allergens: itemIzgaraLevrek.allergens,
          },
        ],
      }),
      scopeDescription: "Tur 01 · Izgara İstasyonu",
      sessionVersionSnapshot: 2,
      requestedById: userAyse.id,
      actorName: userAyse.name,
      submittedAt: minAgo(30),
      completedAt: minAgo(30),
      createdAt: minAgo(30),
    },
  });

  // 9.F: Active Session -> Masa 12 (A-2026-000185, 4 misafir, opened by Deniz, DRAFT_PENDING)
  // Round 1 (SENT with Dana Bonfile x2, Izgara Köfte x2), Round 2 (DRAFT with Çikolatalı Sufle x2)
  const session185 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000185",
      tableId: tablesByNumber[12].id,
      status: "OPEN",
      guestCount: 4,
      seatCount: 4,
      serviceType: "MASA_SERVISI",
      version: 3,
      notes: "Tatlı turu taslakta hazır bekliyor",
      openedById: userDeniz.id,
      openedAt: minAgo(45),
      lastActivityAt: minAgo(8),
    },
  });

  const round185_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session185.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-185-R1",
      sentAt: minAgo(40),
      createdById: userDeniz.id,
      sentById: userDeniz.id,
      createdAt: minAgo(44),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session185.id,
      roundId: round185_1.id,
      menuItemId: itemDanaBonfile.id,
      productNameSnapshot: itemDanaBonfile.name,
      receiptNameSnapshot: itemDanaBonfile.receiptName,
      stationNameSnapshot: stationIzgara.name,
      allergensSnapshot: itemDanaBonfile.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify(["Orta pişmiş", "Sos ayrı"]),
      status: "SENT",
      sentAt: minAgo(40),
      createdById: userDeniz.id,
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session185.id,
      roundId: round185_1.id,
      menuItemId: itemIzgaraKofte.id,
      productNameSnapshot: itemIzgaraKofte.name,
      receiptNameSnapshot: itemIzgaraKofte.receiptName,
      stationNameSnapshot: stationIzgara.name,
      allergensSnapshot: itemIzgaraKofte.allergens,
      quantity: 2,
      seatNumber: 3,
      modifiersJson: JSON.stringify(["İyi pişmiş", "Soğansız"]),
      status: "SENT",
      sentAt: minAgo(40),
      createdById: userDeniz.id,
    },
  });

  const round185_2 = await prisma.serviceRound.create({
    data: {
      sessionId: session185.id,
      roundNumber: 2,
      status: "DRAFT",
      createdById: userDeniz.id,
      createdAt: minAgo(8),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session185.id,
      roundId: round185_2.id,
      menuItemId: itemSufle.id,
      productNameSnapshot: itemSufle.name,
      receiptNameSnapshot: itemSufle.receiptName,
      stationNameSnapshot: stationTatli.name,
      allergensSnapshot: itemSufle.allergens,
      quantity: 2,
      seatNumber: 2,
      modifiersJson: JSON.stringify([]),
      kitchenNote: "Dondurması ayrı kasede verilsin",
      status: "DRAFT",
      createdById: userDeniz.id,
    },
  });

  const jobK000390 = await prisma.printJob.create({
    data: {
      jobCode: "K-000390",
      jobType: "KITCHEN_ORDER",
      status: "SUBMITTED_TO_OS_QUEUE",
      printerQueueId: kitchenQueue.id,
      stationName: stationIzgara.name,
      sessionId: session185.id,
      roundId: round185_1.id,
      idempotencyKey: "PRINT-K-000390",
      contentSnapshot: formatKitchenOrderChit({
        restaurantName: config.name,
        tableName: tablesByNumber[12].name,
        roundNumber: 1,
        orderReference: session185.referenceCode,
        waiterName: userDeniz.name,
        stationName: stationIzgara.name,
        jobCode: "K-000390",
        sentAt: minAgo(40),
        items: [
          {
            quantity: 2,
            receiptName: itemDanaBonfile.receiptName,
            seatNumber: 1,
            modifiers: ["Orta pişmiş", "Sos ayrı"],
            allergens: itemDanaBonfile.allergens,
          },
          {
            quantity: 2,
            receiptName: itemIzgaraKofte.receiptName,
            seatNumber: 3,
            modifiers: ["İyi pişmiş", "Soğansız"],
            allergens: itemIzgaraKofte.allergens,
          },
        ],
      }),
      scopeDescription: "Tur 01 · Izgara İstasyonu",
      sessionVersionSnapshot: 2,
      requestedById: userDeniz.id,
      actorName: userDeniz.name,
      submittedAt: minAgo(40),
      completedAt: minAgo(40),
      createdAt: minAgo(40),
    },
  });

  // Also create a REPRINTED job K-000392 referencing K-000390 so Reprint report has data
  await prisma.printJob.create({
    data: {
      jobCode: "K-000392",
      jobType: "KITCHEN_ORDER",
      status: "REPRINTED",
      printerQueueId: kitchenQueue.id,
      stationName: stationIzgara.name,
      sessionId: session185.id,
      roundId: round185_1.id,
      isReprint: true,
      originalJobId: jobK000390.id,
      attemptCount: 2,
      contentSnapshot: formatKitchenOrderChit({
        restaurantName: config.name,
        tableName: tablesByNumber[12].name,
        roundNumber: 1,
        orderReference: session185.referenceCode,
        waiterName: userDeniz.name,
        stationName: stationIzgara.name,
        jobCode: "K-000392",
        sentAt: minAgo(36),
        isReprint: true,
        originalJobCode: "K-000390",
        items: [
          {
            quantity: 2,
            receiptName: itemDanaBonfile.receiptName,
            seatNumber: 1,
            modifiers: ["Orta pişmiş", "Sos ayrı"],
            allergens: itemDanaBonfile.allergens,
          },
          {
            quantity: 2,
            receiptName: itemIzgaraKofte.receiptName,
            seatNumber: 3,
            modifiers: ["İyi pişmiş", "Soğansız"],
            allergens: itemIzgaraKofte.allergens,
          },
        ],
      }),
      scopeDescription: "Tur 01 · TEKRAR BASKI",
      sessionVersionSnapshot: 2,
      requestedById: userManager.id,
      actorName: userManager.name,
      submittedAt: minAgo(36),
      completedAt: minAgo(36),
      createdAt: minAgo(36),
    },
  });

  // 9.G: Active Session -> Masa 16 (A-2026-000186, 2 misafir, opened by Deniz, PRINT_WARNING)
  // Round 1 (SENT, print job P-2045 in UNCERTAIN status)
  const session186 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000186",
      tableId: tablesByNumber[16].id,
      status: "OPEN",
      guestCount: 2,
      seatCount: 2,
      serviceType: "MASA_SERVISI",
      version: 2,
      notes: "Mutfak yazıcısı P-2045 çıktısı kontrol edilmeli",
      openedById: userDeniz.id,
      openedAt: minAgo(18),
      lastActivityAt: minAgo(11),
    },
  });

  const round186_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session186.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-186-R1",
      sentAt: minAgo(12),
      createdById: userDeniz.id,
      sentById: userDeniz.id,
      createdAt: minAgo(15),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session186.id,
      roundId: round186_1.id,
      menuItemId: itemMantarRisotto.id,
      productNameSnapshot: itemMantarRisotto.name,
      receiptNameSnapshot: itemMantarRisotto.receiptName,
      stationNameSnapshot: stationSicak.name,
      allergensSnapshot: itemMantarRisotto.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify(["Tuzsuz"]),
      kitchenNote: "Trüf yağı az kullanılsın",
      status: "SENT",
      sentAt: minAgo(12),
      createdById: userDeniz.id,
    },
  });

  await prisma.printJob.create({
    data: {
      jobCode: "P-2045",
      jobType: "KITCHEN_ORDER",
      status: "UNCERTAIN",
      printerQueueId: kitchenQueue.id,
      stationName: stationSicak.name,
      sessionId: session186.id,
      roundId: round186_1.id,
      idempotencyKey: "PRINT-P-2045",
      attemptCount: 1,
      contentSnapshot: formatKitchenOrderChit({
        restaurantName: config.name,
        tableName: tablesByNumber[16].name,
        roundNumber: 1,
        orderReference: session186.referenceCode,
        waiterName: userDeniz.name,
        stationName: stationSicak.name,
        jobCode: "P-2045",
        sentAt: minAgo(12),
        items: [
          {
            quantity: 2,
            receiptName: itemMantarRisotto.receiptName,
            seatNumber: 1,
            modifiers: ["Tuzsuz"],
            kitchenNote: "Trüf yağı az kullanılsın",
            allergens: itemMantarRisotto.allergens,
          },
        ],
      }),
      scopeDescription: "Tur 01 · Sıcak Mutfak",
      sessionVersionSnapshot: 2,
      requestedById: userDeniz.id,
      actorName: userDeniz.name,
      errorCode: "SPOOL_ACK_TIMEOUT",
      errorMessage:
        "DIGITUS DN-13003-2 Print Server üzerinden gönderim yanıtı zaman aşımına uğradı; fiziksel çıktı durumu belirsiz.",
      submittedAt: minAgo(12),
      createdAt: minAgo(12),
    },
  });

  // 9.H: Active Session -> Masa 20 (A-2026-000187, 4 misafir, opened by Ayşe, SCHEDULED_PENDING)
  // Round 1 (SENT), Round 2 (SCHEDULED timed fire set 25 minutes in the future)
  const session187 = await prisma.serviceSession.create({
    data: {
      referenceCode: "A-2026-000187",
      tableId: tablesByNumber[20].id,
      status: "OPEN",
      guestCount: 4,
      seatCount: 4,
      serviceType: "MASA_SERVISI",
      version: 3,
      notes: "Ana yemek turu 25 dk sonrasına zamanlandı",
      openedById: userAyse.id,
      openedAt: minAgo(28),
      lastActivityAt: minAgo(6),
    },
  });

  const round187_1 = await prisma.serviceRound.create({
    data: {
      sessionId: session187.id,
      roundNumber: 1,
      status: "SENT",
      idempotencyKey: "IDEMP-187-R1",
      sentAt: minAgo(24),
      createdById: userAyse.id,
      sentById: userAyse.id,
      createdAt: minAgo(26),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session187.id,
      roundId: round187_1.id,
      menuItemId: itemDenizBorulcesi.id,
      productNameSnapshot: itemDenizBorulcesi.name,
      receiptNameSnapshot: itemDenizBorulcesi.receiptName,
      stationNameSnapshot: stationSoguk.name,
      allergensSnapshot: itemDenizBorulcesi.allergens,
      quantity: 2,
      sharedSeatsJson: JSON.stringify([1, 2, 3, 4]),
      modifiersJson: JSON.stringify(["Limon ayrı"]),
      status: "SENT",
      sentAt: minAgo(24),
      createdById: userAyse.id,
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session187.id,
      roundId: round187_1.id,
      menuItemId: itemTulumSalata.id,
      productNameSnapshot: itemTulumSalata.name,
      receiptNameSnapshot: itemTulumSalata.receiptName,
      stationNameSnapshot: stationSoguk.name,
      allergensSnapshot: itemTulumSalata.allergens,
      quantity: 1,
      sharedSeatsJson: JSON.stringify([1, 2, 3, 4]),
      modifiersJson: JSON.stringify([]),
      status: "SENT",
      sentAt: minAgo(24),
      createdById: userAyse.id,
    },
  });

  const scheduledFireTime = minAhead(25);
  const round187_2 = await prisma.serviceRound.create({
    data: {
      sessionId: session187.id,
      roundNumber: 2,
      status: "SCHEDULED",
      holdEntireRound: true,
      scheduledAt: scheduledFireTime,
      scheduledById: userAyse.id,
      createdById: userAyse.id,
      createdAt: minAgo(6),
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session187.id,
      roundId: round187_2.id,
      menuItemId: itemDanaBonfile.id,
      productNameSnapshot: itemDanaBonfile.name,
      receiptNameSnapshot: itemDanaBonfile.receiptName,
      stationNameSnapshot: stationIzgara.name,
      allergensSnapshot: itemDanaBonfile.allergens,
      quantity: 2,
      seatNumber: 1,
      modifiersJson: JSON.stringify(["Orta pişmiş"]),
      kitchenNote: "Başlangıçlardan 25 dk sonra sıcak çıkacak",
      status: "SCHEDULED",
      scheduledAt: scheduledFireTime,
      scheduledById: userAyse.id,
      createdById: userAyse.id,
    },
  });

  await prisma.orderItem.create({
    data: {
      sessionId: session187.id,
      roundId: round187_2.id,
      menuItemId: itemKuzuPirzola.id,
      productNameSnapshot: itemKuzuPirzola.name,
      receiptNameSnapshot: itemKuzuPirzola.receiptName,
      stationNameSnapshot: stationIzgara.name,
      allergensSnapshot: itemKuzuPirzola.allergens,
      quantity: 2,
      seatNumber: 3,
      modifiersJson: JSON.stringify(["İyi pişmiş"]),
      status: "SCHEDULED",
      scheduledAt: scheduledFireTime,
      scheduledById: userAyse.id,
      createdById: userAyse.id,
    },
  });

  await prisma.printJob.create({
    data: {
      jobCode: "K-000391",
      jobType: "KITCHEN_ORDER",
      status: "SUBMITTED_TO_OS_QUEUE",
      printerQueueId: kitchenQueue.id,
      stationName: stationSoguk.name,
      sessionId: session187.id,
      roundId: round187_1.id,
      idempotencyKey: "PRINT-K-000391",
      contentSnapshot: formatKitchenOrderChit({
        restaurantName: config.name,
        tableName: tablesByNumber[20].name,
        roundNumber: 1,
        orderReference: session187.referenceCode,
        waiterName: userAyse.name,
        stationName: stationSoguk.name,
        jobCode: "K-000391",
        sentAt: minAgo(24),
        items: [
          {
            quantity: 2,
            receiptName: itemDenizBorulcesi.receiptName,
            sharedSeats: [1, 2, 3, 4],
            modifiers: ["Limon ayrı"],
          },
          {
            quantity: 1,
            receiptName: itemTulumSalata.receiptName,
            sharedSeats: [1, 2, 3, 4],
            allergens: itemTulumSalata.allergens,
          },
        ],
      }),
      scopeDescription: "Tur 01 · Soğuk / Meze",
      sessionVersionSnapshot: 2,
      requestedById: userAyse.id,
      actorName: userAyse.name,
      submittedAt: minAgo(24),
      completedAt: minAgo(24),
      createdAt: minAgo(24),
    },
  });

  // Also add 1 TEST_PRINT job on Adisyon-USB
  await prisma.printJob.create({
    data: {
      jobCode: "T-000019",
      jobType: "TEST_PRINT",
      status: "SUBMITTED_TO_OS_QUEUE",
      printerQueueId: receiptQueue.id,
      idempotencyKey: "PRINT-T-000019",
      contentSnapshot: formatTestDiagnosticChit({
        restaurantName: config.name,
        queueName: receiptQueue.name,
        role: receiptQueue.role,
        deviceModel: receiptQueue.deviceModel,
        actorName: userAdmin.name,
        jobCode: "T-000019",
      }),
      scopeDescription: "Kurulum Doğrulama Test Fişi (GS V Kısmi Kesim)",
      requestedById: userAdmin.id,
      actorName: userAdmin.name,
      submittedAt: minAgo(240),
      completedAt: minAgo(240),
      createdAt: minAgo(240),
    },
  });

  // 10. Create 15 BackupRecord entries for USB (E:\Alacarte\Backups) and 14 for LOCAL_DIR (D:\Alacarte\Backups), plus 1 ROTATED_OUT record
  const recordSummary = JSON.stringify({
    tables: 24,
    users: 5,
    menuItems: 20,
    sessions: 8,
    printJobs: 7,
  });

  const usbBackups = [];
  for (let i = 15; i >= 1; i--) {
    const code = `BKP-USB-2026-${String(100 + (16 - i)).padStart(4, "0")}`;
    const isPreRepair = i === 1;
    const createdAt = isPreRepair ? minAgo(90) : daysAgo(i - 1);
    const hash = crypto
      .createHash("sha256")
      .update(`${code}|USB|${createdAt.toISOString()}`)
      .digest("hex");
    const rec = await prisma.backupRecord.create({
      data: {
        backupCode: code,
        targetType: "USB",
        targetPath: `/mnt/usb/alacarte/backups/${code}.alacarte.enc`,
        triggerType: isPreRepair ? "PRE_REPAIR" : i % 5 === 0 ? "MANUAL" : "AUTO_DAILY",
        appVersion: "1.0.0",
        dbSchemaVersion: "db-19",
        recordCountSummaryJson: recordSummary,
        manifestHash: hash,
        encryptedKeyVersion: "KEY-2026-V1",
        fileSizeBytes: 48234496 + (16 - i) * 131072,
        status: "SUCCESS",
        verified: true,
        verifiedAt: createdAt,
        createdById: isPreRepair || i % 5 === 0 ? userAdmin.id : null,
        actorName: isPreRepair || i % 5 === 0 ? userAdmin.name : "SİSTEM",
        createdAt,
      },
    });
    usbBackups.push(rec);
  }

  // 1 ROTATED_OUT record on USB showing 15-copy FIFO rotation
  await prisma.backupRecord.create({
    data: {
      backupCode: "BKP-USB-2026-0100",
      targetType: "USB",
      targetPath: "/mnt/usb/alacarte/backups/BKP-USB-2026-0100.alacarte.enc",
      triggerType: "AUTO_DAILY",
      appVersion: "1.0.0",
      dbSchemaVersion: "db-19",
      recordCountSummaryJson: recordSummary,
      manifestHash: crypto.createHash("sha256").update("BKP-USB-2026-0100").digest("hex"),
      encryptedKeyVersion: "KEY-2026-V1",
      fileSizeBytes: 47912000,
      status: "ROTATED_OUT",
      verified: true,
      verifiedAt: daysAgo(15),
      rotatedOutAt: minAgo(90),
      actorName: "SİSTEM (15-Kopya FIFO Rotasyonu)",
      createdAt: daysAgo(15),
    },
  });

  const localBackups = [];
  for (let i = 14; i >= 1; i--) {
    const code = `BKP-LOC-2026-${String(200 + (15 - i)).padStart(4, "0")}`;
    const isPreRepair = i === 1;
    const createdAt = isPreRepair ? minAgo(90) : daysAgo(i - 1);
    const hash = crypto
      .createHash("sha256")
      .update(`${code}|LOCAL_DIR|${createdAt.toISOString()}`)
      .digest("hex");
    const rec = await prisma.backupRecord.create({
      data: {
        backupCode: code,
        targetType: "LOCAL_DIR",
        targetPath: `/var/lib/alacarte/backups/${code}.alacarte.enc`,
        triggerType: isPreRepair ? "PRE_REPAIR" : i % 4 === 0 ? "MANUAL" : "AUTO_DAILY",
        appVersion: "1.0.0",
        dbSchemaVersion: "db-19",
        recordCountSummaryJson: recordSummary,
        manifestHash: hash,
        encryptedKeyVersion: "KEY-2026-V1",
        fileSizeBytes: 48234496 + (15 - i) * 131072,
        status: "SUCCESS",
        verified: true,
        verifiedAt: createdAt,
        createdById: isPreRepair || i % 4 === 0 ? userAdmin.id : null,
        actorName: isPreRepair || i % 4 === 0 ? userAdmin.name : "SİSTEM",
        createdAt,
      },
    });
    localBackups.push(rec);
  }

  // 11. Create a complete DiagnosticRun (DIAG-2026-0001) with all 6 sequential DiagnosticCheck steps,
  // 1 DiagnosticFinding (FIND-SPOOL-UNCERTAIN-2045 on Mutfak-Windows queue), and 1 historical completed RepairRun (REP-2026-0001)
  const diagRun = await prisma.diagnosticRun.create({
    data: {
      runCode: "DIAG-2026-0001",
      initiatedById: userAdmin.id,
      actorName: userAdmin.name,
      appVersion: "1.0.0",
      overallStatus: "WARNING",
      stoppedByUser: false,
      summaryText:
        "6 sıralı salt-okunur kontrol tamamlandı: 5 Başarılı, 1 Uyarı (Mutfak-Windows kuyruğunda P-2045 nolu belirsiz iş).",
      startedAt: minAgo(10),
      completedAt: minAgo(9),
      checks: {
        create: [
          {
            stepOrder: 1,
            component: "Sunucu & Veritabanı",
            title: "1. Yerel Sunucu, PostgreSQL, Disk, Bellek ve Saat Kontrolü",
            status: "PASSED",
            severity: "INFO",
            durationMs: 38,
            eventCode: "CHK-SYS-DB-OK",
            lastSuccessAt: minAgo(9),
            maskedEvidence:
              "PostgreSQL 16.x aktif · Disk boş alan: 194 GB / 256 GB SSD · RAM: 5.4 GB / 16 GB · NTP/RTC sapması < 12ms",
            affectedFunction: "Yok (Tüm çekirdek veritabanı işlemleri sağlıklı)",
            nextActionText: "İşlem gerekmiyor.",
          },
          {
            stepOrder: 2,
            component: "Şema & Yedek Bütünlüğü",
            title: "2. Prisma Şema Sürümü, Audit Hash Zinciri ve Çift Hedef Yedek Kontrolü",
            status: "PASSED",
            severity: "INFO",
            durationMs: 64,
            eventCode: "CHK-SCHEMA-BACKUP-OK",
            lastSuccessAt: minAgo(9),
            maskedEvidence:
              "Şema: db-19 · USB Yedek: 15/15 doğrulanmış · Yerel Yedek: 14/15 doğrulanmış · SHA-256 Audit zinciri: Tutarlı",
            affectedFunction: "Yok",
            nextActionText: "Günlük otomatik yedek döngüsü aktif.",
          },
          {
            stepOrder: 3,
            component: "Kapalı LAN & TLS",
            title: "3. Yerel Ağ (Archer AX23 Kapalı LAN), TLS Sertifikası ve Cihaz Heartbeat Kontrolü",
            status: "PASSED",
            severity: "INFO",
            durationMs: 51,
            eventCode: "CHK-LAN-TLS-OK",
            lastSuccessAt: minAgo(9),
            maskedEvidence:
              "Alt ağ: 192.168.10.0/24 · WAN portu: Boş (İzolasyon doğrulandı) · Aktif terminal heartbeat: 4/4 cihaz",
            affectedFunction: "Yok",
            nextActionText: "İşlem gerekmiyor.",
          },
          {
            stepOrder: 4,
            component: "Windows Spooler & Yazıcı Kuyrukları",
            title: "4. Adisyon-USB ve Mutfak-Windows (DN-13003-2 + TL-WA801N Bridge) Kuyruk Kontrolü",
            status: "WARNING",
            severity: "WARNING",
            durationMs: 112,
            eventCode: "CHK-PRINTER-UNCERTAIN-JOB",
            firstErrorAt: minAgo(12),
            lastSuccessAt: minAgo(2),
            maskedEvidence:
              "Adisyon-USB: ONLINE (0 bekleyen) · Mutfak-Windows: ONLINE (1 belirsiz iş: P-2045, DN-13003-2 ACK timeout)",
            affectedFunction: "Masa 16 (A-2026-000186) Tur 01 mutfak fişi durumu belirsiz",
            nextActionText:
              "SCR-10 Yazdırma Kuyruğu ekranından P-2045 için fiziksel fişi kontrol edin veya TEKRAR BASKI tetikleyin.",
          },
          {
            stepOrder: 5,
            component: "Menü & İstasyon Eşleşmesi",
            title: "5. Aktif Menü Sürümü (v3), İstasyon Yönlendirmeleri ve Zorunlu Modifier Tutarlılığı",
            status: "PASSED",
            severity: "INFO",
            durationMs: 29,
            eventCode: "CHK-MENU-STATION-OK",
            lastSuccessAt: minAgo(9),
            maskedEvidence:
              "Menü v3 · 20 aktif ürün · 4 mutfak istasyonu · Yetim ürün veya tanımsız yazıcı kuyruğu bulunmadı",
            affectedFunction: "Yok",
            nextActionText: "İşlem gerekmiyor.",
          },
          {
            stepOrder: 6,
            component: "Açık Servis & Zamanlı Turlar",
            title: "6. Açık Masa Oturumları, Zamanlı Gönderim (Scheduled Fire) ve Askıdaki İptal Talepleri",
            status: "PASSED",
            severity: "INFO",
            durationMs: 34,
            eventCode: "CHK-SESSIONS-TIMERS-OK",
            lastSuccessAt: minAgo(9),
            maskedEvidence:
              "6 açık masa oturumu · 1 zamanlı tur (Masa 20, +25 dk) · 1 bekleyen iptal talebi (VOID-2026-0041)",
            affectedFunction: "Yok",
            nextActionText: "Yönetici SCR-09 ekranından bekleyen VOID-2026-0041 talebini sonuçlandırabilir.",
          },
        ],
      },
    },
  });

  const finding2045 = await prisma.diagnosticFinding.create({
    data: {
      runId: diagRun.id,
      findingCode: "FIND-SPOOL-UNCERTAIN-2045",
      severity: "WARNING",
      component: "Mutfak-Windows (DIGITUS DN-13003-2 + TP-Link TL-WA801N Bridge)",
      title: "Mutfak Yazıcısı Kuyruğunda Sonucu Belirsiz Baskı İşi (P-2045)",
      evidenceText:
        "PrintJob=P-2045 · Masa=Masa 16 · Sipariş=A-2026-000186 · Kuyruk=Mutfak-Windows · Hata=SPOOL_ACK_TIMEOUT",
      probableCause:
        "TP-Link TL-WA801N Client/Bridge ile DIGITUS DN-13003-2 Print Server arasındaki anlık Wi-Fi paket gecikmesi nedeniyle TCP ACK paketi dönmedi.",
      confidenceLevel: "Yüksek (%90)",
      userExplanation:
        "Masa 16 için gönderilen mutfak siparişi Windows yazdırma kuyruğuna iletildi ancak yazıcıdan tamamlandı onayı alınamadı. Fiş fiziksel olarak çıkmış veya çıkmamış olabilir.",
      manualSteps:
        "1. Mutfak yazıcısında P-2045 fişinin fiziksel olarak çıkıp çıkmadığını kontrol edin.\n2. Çıkmadıysa SCR-10 ekranından 'TEKRAR BASKI' butonuna basın.\n3. Kuyruk izleyicisini sıfırlamak için güvenli onarım aksiyonunu çalıştırabilirsiniz.",
      allowlistRepairAction: "REBIND_SPOOLER_MONITOR",
      repairPrerequisites:
        "Çift hedef (USB + Yerel Dizin) güncel doğrulanmış yedek ve aktif baskı gönderimi olmaması",
      repairImpact:
        "Windows Spooler izleyici önbelleği yenilenir; açık masa veya sipariş verisi silinmez.",
      rollbackMethod:
        "Ön yedek manifestosu üzerinden önceki kuyruk izleyici durumuna otomatik geri dönüş",
      status: "OPEN",
      createdAt: minAgo(9),
    },
  });

  const latestUsbBackup = usbBackups[usbBackups.length - 1];
  const latestLocalBackup = localBackups[localBackups.length - 1];

  await prisma.repairRun.create({
    data: {
      repairId: "REP-2026-0001",
      diagnosticRunId: diagRun.id,
      findingId: finding2045.id,
      allowlistAction: "CLEAR_STALE_HEARTBEAT_CACHE",
      approvedById: userAdmin.id,
      approverName: userAdmin.name,
      usbBackupId: latestUsbBackup.id,
      localBackupId: latestLocalBackup.id,
      usbManifestHash: latestUsbBackup.manifestHash,
      localManifestHash: latestLocalBackup.manifestHash,
      status: "COMPLETED",
      beforeStateJson: JSON.stringify({
        staleTerminalSessions: 2,
        spoolerMonitorState: "DEGRADED_CACHE",
      }),
      afterStateJson: JSON.stringify({
        staleTerminalSessions: 0,
        spoolerMonitorState: "HEALTHY",
      }),
      postVerifyPassed: true,
      resultSummary:
        "Ön yedek doğrulaması (USB + Yerel) geçildi; bayat terminal heartbeat önbelleği temizlendi ve son doğrulama başarılı oldu.",
      startedAt: minAgo(88),
      completedAt: minAgo(87),
    },
  });

  // Create sample ReportExecution records
  await prisma.reportExecution.createMany({
    data: [
      {
        reportCode: "RPT-01-DAILY-SUMMARY",
        reportTitle: "1. Günlük / Vardiyalık Servis Özeti",
        reportVersion: "v1.0",
        filtersJson: JSON.stringify({ area: "TÜMÜ", shift: "GÜNDÜZ" }),
        rowCount: 8,
        exportFormat: "VIEW",
        executedById: userManager.id,
        actorName: userManager.name,
        executedAt: minAgo(45),
      },
      {
        reportCode: "RPT-06-CANCELLATIONS",
        reportTitle: "6. İptal / Void Raporu",
        reportVersion: "v1.0",
        filtersJson: JSON.stringify({ status: "TÜMÜ" }),
        rowCount: 3,
        exportFormat: "CSV",
        executedById: userManager.id,
        actorName: userManager.name,
        executedAt: minAgo(20),
      },
    ],
  });

  // 12. Create at least 12 sequential hash-chained AuditLog entries using recordAuditEvent
  await recordAuditEvent({
    actorId: userAdmin.id,
    actorName: userAdmin.name,
    actorRole: userAdmin.role,
    deviceSession: "Sunucu-Kasa Tiwox TP-8610",
    action: "SETUP_COMPLETED",
    entityType: "RestaurantConfig",
    entityId: config.id,
    result: "SUCCESS",
    afterValue: {
      restaurantName: config.name,
      tables: 24,
      queues: ["Adisyon-USB", "Mutfak-Windows"],
      hardwarePackageTotalTl: 61724,
    },
    details:
      "İlk kurulum sihirbazı (SCR-02) tamamlandı; Tiwox TP-8610 + 2x Epson TM-T20III + DIGITUS DN-13003-2 + TP-Link TL-WA801N + Archer AX23 topolojisi doğrulandı.",
  });

  await recordAuditEvent({
    actorId: userAdmin.id,
    actorName: userAdmin.name,
    actorRole: userAdmin.role,
    deviceSession: "Sunucu-Kasa Tiwox TP-8610",
    action: "TEST_PRINT_VERIFIED",
    entityType: "PrintJob",
    entityId: "T-000019",
    result: "SUCCESS",
    afterValue: { queue: "Adisyon-USB", cutCommand: "GS V Partial Cut" },
    details: "Türkçe karakter (Ş İ ı ğ ç ö ü) ve kısmi kesim test fişi doğrulandı.",
  });

  await recordAuditEvent({
    actorId: userManager.id,
    actorName: userManager.name,
    actorRole: userManager.role,
    deviceSession: "Kasa Terminali · Chrome",
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: userManager.id,
    result: "SUCCESS",
    details: "Restoran Yöneticisi Mehmet Kaya kişisel hesabı ile oturum açtı.",
  });

  await recordAuditEvent({
    actorId: userManager.id,
    actorName: userManager.name,
    actorRole: userManager.role,
    deviceSession: "Kasa Terminali · Chrome",
    action: "LEARNING_MODE_TOGGLED",
    entityType: "RestaurantConfig",
    entityId: config.id,
    result: "SUCCESS",
    beforeValue: { learningModeEnabled: false },
    afterValue: { learningModeEnabled: true },
    details: "SCR-07 Yönetici Operasyon Panosundan Garson Öğrenme Modu AÇIK konuma getirildi.",
  });

  await recordAuditEvent({
    actorId: userAyse.id,
    actorName: userAyse.name,
    actorRole: userAyse.role,
    deviceSession: "Garson Telefonu #01 · WLAN",
    action: "SESSION_OPENED",
    entityType: "ServiceSession",
    entityId: session184.id,
    result: "SUCCESS",
    afterValue: {
      referenceCode: session184.referenceCode,
      tableName: "Masa 08",
      guestCount: 3,
    },
    details: "Masa 08 için 3 misafirlik yeni servis oturumu (A-2026-000184) açıldı.",
  });

  await recordAuditEvent({
    actorId: userAyse.id,
    actorName: userAyse.name,
    actorRole: userAyse.role,
    deviceSession: "Garson Telefonu #01 · WLAN",
    action: "ROUND_SENT_TO_KITCHEN",
    entityType: "ServiceRound",
    entityId: round184_1.id,
    result: "SUCCESS",
    afterValue: {
      referenceCode: session184.referenceCode,
      roundNumber: 1,
      jobCode: "K-000389",
    },
    details: "Masa 08 Tur 01 mutfağa gönderildi (Mevsim Salata x2, Izgara Levrek x1).",
  });

  await recordAuditEvent({
    actorId: userAyse.id,
    actorName: userAyse.name,
    actorRole: userAyse.role,
    deviceSession: "Garson Telefonu #01 · WLAN",
    action: "CANCEL_REQUEST_CREATED",
    entityType: "CancellationRequest",
    entityId: "VOID-2026-0041",
    result: "SUCCESS",
    reason: "Misafir tercihini değiştirdi",
    afterValue: {
      voidCode: "VOID-2026-0041",
      product: "Izgara Levrek",
      quantity: 1,
      seatNumber: 2,
    },
    details: "Masa 08 (A-2026-000184) Tur 01 içindeki 1x Izgara Levrek için iptal talebi oluşturuldu.",
  });

  await recordAuditEvent({
    actorId: userManager.id,
    actorName: userManager.name,
    actorRole: userManager.role,
    deviceSession: "Kasa Terminali · Chrome",
    action: "CANCEL_APPROVED",
    entityType: "CancellationRequest",
    entityId: "VOID-2026-0039",
    result: "SUCCESS",
    reason: "Misafir tercihini değiştirdi",
    beforeValue: { status: "PENDING" },
    afterValue: { status: "APPROVED", voidPrintJobCode: "K-000388" },
    details: "VOID-2026-0039 onaylandı ve Mutfak-Windows kuyruğuna K-000388 nolu VOID fişi basıldı.",
  });

  await recordAuditEvent({
    actorId: userDeniz.id,
    actorName: userDeniz.name,
    actorRole: userDeniz.role,
    deviceSession: "Garson Telefonu #02 · WLAN",
    action: "PRINT_JOB_UNCERTAIN",
    entityType: "PrintJob",
    entityId: "P-2045",
    result: "WARNING",
    reason: "SPOOL_ACK_TIMEOUT",
    afterValue: {
      jobCode: "P-2045",
      tableName: "Masa 16",
      status: "UNCERTAIN",
    },
    details:
      "Masa 16 Tur 01 mutfak fişi (P-2045) için DIGITUS DN-13003-2 yanıtı zaman aşımına uğradı; masa durumu PRINT_WARNING olarak işaretlendi.",
  });

  await recordAuditEvent({
    actorId: userAyse.id,
    actorName: userAyse.name,
    actorRole: userAyse.role,
    deviceSession: "Garson Telefonu #01 · WLAN",
    action: "ROUND_SCHEDULED",
    entityType: "ServiceRound",
    entityId: round187_2.id,
    result: "SUCCESS",
    afterValue: {
      tableName: "Masa 20",
      roundNumber: 2,
      scheduledAt: scheduledFireTime.toISOString(),
    },
    details: "Masa 20 (A-2026-000187) Tur 02 ana yemekleri 25 dakika sonrasına zamanlandı.",
  });

  await recordAuditEvent({
    actorId: userManager.id,
    actorName: userManager.name,
    actorRole: userManager.role,
    deviceSession: "Kasa Terminali · Chrome",
    action: "PRICELESS_CHECK_PRINTED",
    entityType: "PrintJob",
    entityId: "A-000112",
    result: "SUCCESS",
    afterValue: {
      jobCode: "A-000112",
      queue: "Adisyon-USB",
      orderReference: "A-2026-000180",
    },
    details: "Masa 01 (A-2026-000180) için Adisyon-USB yazıcısından fiyatsız servis özeti basıldı.",
  });

  await recordAuditEvent({
    actorId: userAdmin.id,
    actorName: userAdmin.name,
    actorRole: userAdmin.role,
    deviceSession: "Sunucu-Kasa Tiwox TP-8610",
    action: "BACKUP_DUAL_TARGET_VERIFIED",
    entityType: "BackupRecord",
    entityId: latestUsbBackup.id,
    result: "SUCCESS",
    afterValue: {
      usbBackupCode: latestUsbBackup.backupCode,
      localBackupCode: latestLocalBackup.backupCode,
      maxCopies: 15,
    },
    details:
      "USB (/mnt/usb/alacarte/backups) ve Yerel Dizin (/var/lib/alacarte/backups) hedeflerinde şifreli yedekler ve SHA-256 manifestoları doğrulandı.",
  });

  await recordAuditEvent({
    actorId: userAdmin.id,
    actorName: userAdmin.name,
    actorRole: userAdmin.role,
    deviceSession: "Sunucu-Kasa Tiwox TP-8610",
    action: "DIAGNOSTIC_AND_REPAIR_COMPLETED",
    entityType: "RepairRun",
    entityId: "REP-2026-0001",
    result: "SUCCESS",
    beforeValue: { diagnosticRun: "DIAG-2026-0001", finding: "FIND-SPOOL-UNCERTAIN-2045" },
    afterValue: { repairId: "REP-2026-0001", postVerifyPassed: true },
    details:
      "6 adımlı tanılama (DIAG-2026-0001) ve ön yedek kapılı güvenli onarım (REP-2026-0001) başarıyla tamamlandı.",
  });

  console.log("Alacarte veritabanı tohumlama işlemi başarıyla tamamlandı!");
}

main()
  .catch((err) => {
    console.error("Seed hatası:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
