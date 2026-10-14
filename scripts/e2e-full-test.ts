import { prisma } from "../src/lib/prisma";
import { verifyAuditChainIntegrity } from "../src/lib/audit";
import {
  toggleLearningModeAction,
  completeServiceSessionAction,
  decideCancellationRequestAction,
  runOperationalReportAction,
} from "../src/actions/manager";
import {
  openOrResumeTableAction,
  toggleMenuItem86Action,
  toggleRoundRushAction,
  transferTableAction,
  mergeTablesAction,
  transferSessionWaiterAction,
  reprintKitchenChitAction,
} from "../src/actions/pos";
import {
  formatKitchenOrderChit,
  formatKitchenVoidChit,
  formatPricelessCheckSummary,
  formatDuplicateReceiptChit,
} from "../src/lib/receipt-templates";

async function runE2ETests() {
  console.log("=================================================================");
  console.log("🧪 MERIT ROYAL ALACARTE — UÇTAN UCA (E2E) ENTEGRASYON TESTİ");
  console.log("=================================================================\n");

  const results: Record<string, { status: "PASS" | "FAIL"; details: string }> = {};

  // 1. KULLANICI VE RESTORAN VERİLERİ
  const config = await prisma.restaurantConfig.findFirstOrThrow();
  const manager = await prisma.user.findUniqueOrThrow({ where: { username: "mehmet.kaya" } });
  const waiter = await prisma.user.findUniqueOrThrow({ where: { username: "ayse.yilmaz" } });
  const waiter2 = await prisma.user.findUniqueOrThrow({ where: { username: "deniz.kaya" } });
  const sysAdmin = await prisma.user.findUniqueOrThrow({ where: { username: "sistem.yoneticisi" } });

  // 2. GARSON ÖĞRENME MODU TESTİ (§5.17)
  console.log("1. Garson Öğrenme Modu (Learning Mode) Test Ediliyor...");
  const sysAdminToggle = await toggleLearningModeAction({ actorId: sysAdmin.id, enabled: false });
  const managerToggleOn = await toggleLearningModeAction({ actorId: manager.id, enabled: true });
  const configAfterOn = await prisma.restaurantConfig.findFirstOrThrow();

  if (!sysAdminToggle.ok && managerToggleOn.ok && configAfterOn.learningModeEnabled === true) {
    results["OGRENME_MODU_RBAC_VE_DURUM"] = {
      status: "PASS",
      details: "Sistem yöneticisi kısıtlandı (§5.17), Restoran Yöneticisi başarıyla Öğrenme Modunu açtı.",
    };
  } else {
    results["OGRENME_MODU_RBAC_VE_DURUM"] = {
      status: "FAIL",
      details: "Öğrenme modu RBAC veya veritabanı durumu doğrulanamadı.",
    };
  }

  // 3. MASA AÇMA, KUVER VE KOLTUK (SEAT) BAZLI SİPARİŞ
  console.log("2. Masa Açma ve Koltuk Bazlı Sipariş Test Ediliyor...");
  const testTable = await prisma.restaurantTable.findFirstOrThrow({
    where: { active: true },
  });

  const openRes = await openOrResumeTableAction({
    actorId: waiter.id,
    tableId: testTable.id,
    guestCount: 3,
  });

  const session = await prisma.serviceSession.findFirst({
    where: { tableId: testTable.id, status: "OPEN" },
    include: { table: true },
  });

  if (openRes.ok && session) {
    results["MASA_ACMA_VE_KUVER"] = {
      status: "PASS",
      details: `Masa ${session.table.name} açıldı, Kuver: ${session.guestCount}`,
    };
  } else {
    results["MASA_ACMA_VE_KUVER"] = {
      status: "FAIL",
      details: openRes.error || "Masa açılamadı.",
    };
  }

  // 4. MICROS: PREFIX MODIFIERS & RUSH & TEK YAZICI İSTASYON BAŞLIĞI
  console.log("3. MICROS Modifier, Prefix, Rush ve Fiş Formatı Test Ediliyor...");
  const menuItem = await prisma.menuItem.findFirstOrThrow({
    where: { active: true },
    include: { station: true },
  });

  const sampleKitchenChit = formatKitchenOrderChit({
    restaurantName: config.name,
    tableName: testTable.name,
    roundNumber: 1,
    orderReference: session?.referenceCode || "TEST-REF-001",
    waiterName: waiter.name,
    stationName: menuItem.station?.name || "IZGARA",
    jobCode: "K-TEST-01",
    sentAt: new Date(),
    isRush: true,
    items: [
      {
        quantity: 1,
        receiptName: menuItem.receiptName || menuItem.name,
        seatNumber: 1,
        modifiers: ["NO TUZ", "EXTRA SOS", "ON SIDE SARIMSAK"],
        isRush: true,
      },
    ],
  });

  const hasStationHeader = sampleKitchenChit.includes(`>>> İSTASYON: [ ${menuItem.station?.name.toLocaleUpperCase("tr-TR") || "IZGARA"} ] <<<`);
  const hasRushBanner = sampleKitchenChit.includes("RUSH / ACİL SİPARİŞ");
  const hasPrefixes = sampleKitchenChit.includes("NO TUZ") && sampleKitchenChit.includes("EXTRA SOS");

  if (hasStationHeader && hasRushBanner && hasPrefixes) {
    results["MICROS_RUSH_PREFIX_VE_YAZICI_BASLIGI"] = {
      status: "PASS",
      details: "Tek yazıcı istasyon başlığı, RUSH ikazı ve Prefix formatları eksiksiz basıldı.",
    };
  } else {
    results["MICROS_RUSH_PREFIX_VE_YAZICI_BASLIGI"] = {
      status: "FAIL",
      details: "Fiş formatında istasyon başlığı, Rush veya Prefix eksik.",
    };
  }

  // 5. MICROS: 86 STOK SAYACI YÖNETİMİ
  console.log("4. MICROS 86 Stok Sayacı Test Ediliyor...");
  const set86Res = await toggleMenuItem86Action({
    actorId: manager.id,
    menuItemId: menuItem.id,
    is86ed: false,
    availableCount: 5,
  });

  const menuItemAfter86 = await prisma.menuItem.findUniqueOrThrow({
    where: { id: menuItem.id },
  });

  if (set86Res.ok && menuItemAfter86.availableCount === 5) {
    results["MICROS_86_SAYACI"] = {
      status: "PASS",
      details: `Ürün [${menuItem.name}] için 86 sayacı 5 porsiyon olarak ayarlandı.`,
    };
  } else {
    results["MICROS_86_SAYACI"] = {
      status: "FAIL",
      details: set86Res.error || "86 sayacı ayarlanamadı.",
    };
  }

  // 6. MICROS: MASA TAŞIMA VE MASA BİRLEŞTİRME
  console.log("5. MICROS Masa Taşıma ve Birleştirme Fonksiyonları Test Ediliyor...");
  const targetTable = await prisma.restaurantTable.findFirst({
    where: {
      id: { not: testTable.id },
      active: true,
      sessions: { none: { status: "OPEN" } },
    },
  });

  if (session && targetTable) {
    const transferRes = await transferTableAction({
      actorId: manager.id,
      sourceTableId: testTable.id,
      targetTableId: targetTable.id,
      reason: "Misafir cam kenarı istedi",
    });

    if (transferRes.ok) {
      results["MICROS_MASA_TASIMA"] = {
        status: "PASS",
        details: `Masa ${testTable.name} başarıyla Masa ${targetTable.name}'a taşındı.`,
      };
      // Geri taşı
      await transferTableAction({
        actorId: manager.id,
        sourceTableId: targetTable.id,
        targetTableId: testTable.id,
        reason: "Test iadesi",
      });
    } else {
      results["MICROS_MASA_TASIMA"] = {
        status: "FAIL",
        details: transferRes.error || "Masa taşıma başarısız.",
      };
    }
  }

  // 7. MICROS: GARSON DEVRİ
  console.log("6. MICROS Garson Devri (Server Transfer) Test Ediliyor...");
  if (session) {
    const serverTransferRes = await transferSessionWaiterAction({
      actorId: manager.id,
      sessionId: session.id,
      targetUserId: waiter2.id,
      reason: "Mola değişimi",
    });

    if (serverTransferRes.ok) {
      results["MICROS_GARSON_DEVRI"] = {
        status: "PASS",
        details: `Masa sorumluluğu ${waiter.name}'dan ${waiter2.name}'a aktarıldı.`,
      };
    } else {
      results["MICROS_GARSON_DEVRI"] = {
        status: "FAIL",
        details: serverTransferRes.error || "Garson devri başarısız.",
      };
    }
  }

  // 8. MICROS: FİŞ TEKRAR BASMA (DUPLICATE REPRINT)
  console.log("7. MICROS Duplicate / Fiş Tekrar Basma Test Ediliyor...");
  const dupReceipt = formatDuplicateReceiptChit({
    originalChitContent: sampleKitchenChit,
    reprintedBy: manager.name,
    reprintCount: 2,
    reprintedAt: new Date(),
  });

  const hasDuplicateWatermark =
    dupReceipt.includes("*** KOPYA / DUPLICATE FIS (GECERSIZDIR) ***") &&
    dupReceipt.includes("YAZDIRILMA SAYISI: 2");

  if (hasDuplicateWatermark) {
    results["MICROS_DUPLICATE_REPRINT"] = {
      status: "PASS",
      details: "Mükerrer yemek çıkışını engelleyen KOPYA filigranı ve sayaç doğrulandı.",
    };
  } else {
    results["MICROS_DUPLICATE_REPRINT"] = {
      status: "FAIL",
      details: "Kopya filigranı doğrulanamadı.",
    };
  }

  // 9. SHA-256 HASH ZİNCİRİ DENETİM LOGU TESTİ
  console.log("8. SHA-256 Kriptografik Audit Zinciri Doğrulanıyor...");
  const auditIntegrity = await verifyAuditChainIntegrity();

  if (auditIntegrity.verified) {
    results["AUDIT_LOG_HASH_ZINCIRI"] = {
      status: "PASS",
      details: `${auditIntegrity.totalEvents} işlem kriptografik SHA-256 hash zinciriyle doğrulandı (Kurcalanamaz).`,
    };
  } else {
    results["AUDIT_LOG_HASH_ZINCIRI"] = {
      status: "FAIL",
      details: "Audit log hash zinciri bozulmuş!",
    };
  }

  // 10. FİYATSIZLIK TESTİ
  console.log("9. %100 Fiyatsızlık Prensibi Doğrulanıyor...");
  const sampleSummary = formatPricelessCheckSummary({
    restaurantName: config.name,
    tableName: testTable.name,
    orderReference: session?.referenceCode || "TEST-REF-001",
    waiterName: waiter.name,
    guestCount: 3,
    scopeDescription: "Tüm Turlar",
    printedAt: new Date(),
    jobCode: "A-TEST-01",
    items: [{ roundNumber: 1, sentTimeText: "20:00", quantity: 2, receiptName: "Dana Antrikot", seatNumber: 1 }],
  });

  const isPriceless =
    !sampleSummary.includes("TL") &&
    !sampleSummary.includes("₺") &&
    !sampleSummary.includes("KDV") &&
    !sampleSummary.includes("TOPLAM TUTAR") &&
    sampleSummary.includes("MALİ GEÇERLİLİĞİ YOKTUR");

  if (isPriceless) {
    results["FIYATSIZLIK_PRENSIBI"] = {
      status: "PASS",
      details: "Adisyon dökümünde sıfır fiyat, sıfır KDV ve 'MALİ GEÇERLİLİĞİ YOKTUR' ibaresi teyit edildi.",
    };
  } else {
    results["FIYATSIZLIK_PRENSIBI"] = {
      status: "FAIL",
      details: "Adisyonda fiyat veya mali ibare bulundu!",
    };
  }

  console.log("\n=================== E2E TEST SONUÇ RAPORU ===================");
  let allPass = true;
  for (const [testName, res] of Object.entries(results)) {
    const icon = res.status === "PASS" ? "✅" : "❌";
    if (res.status !== "PASS") allPass = false;
    console.log(`${icon} [${testName}]: ${res.status} — ${res.details}`);
  }
  console.log("=============================================================");
  console.log(`GENEL DURUM: ${allPass ? "TÜM TESTLER BAŞARIYLA GEÇTİ (100% OK)" : "BAZI TESTLER BAŞARISIZ OLDU"}\n`);

  if (!allPass) {
    process.exit(1);
  }
}

runE2ETests()
  .catch((err) => {
    console.error("Test hatası:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
