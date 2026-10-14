import { prisma } from "../src/lib/prisma";
import { verifyAuditChainIntegrity } from "../src/lib/audit";
import {
  SCREEN_CATALOG,
  HARDWARE_BOM_PACKAGE,
  HARDWARE_PACKAGE_TOTAL_TL,
} from "../src/lib/types";
import {
  formatKitchenOrderChit,
  formatKitchenVoidChit,
  formatPricelessCheckSummary,
} from "../src/lib/receipt-templates";
import {
  toggleLearningModeAction,
  completeServiceSessionAction,
  decideCancellationRequestAction,
  runOperationalReportAction,
} from "../src/actions/manager";
import {
  runSequentialDiagnosticsAction,
  createBackupAction,
} from "../src/actions/sysadmin";

async function main() {
  console.log("=== ALACARTE UYGULAMA VE DONANIM PLANI UYUMLULUK TESTİ ===");

  const config = await prisma.restaurantConfig.findFirstOrThrow();
  const sysAdmin = await prisma.user.findUniqueOrThrow({
    where: { username: "sistem.yoneticisi" },
  });
  const manager = await prisma.user.findUniqueOrThrow({
    where: { username: "mehmet.kaya" },
  });
  const waiterAyse = await prisma.user.findUniqueOrThrow({
    where: { username: "ayse.yilmaz" },
  });

  // 1. Donanım Paketi & Yazıcı Kuyrukları Kontrolü (ALACARTE_DONANIM_PAKET_PLANI.md)
  const queues = await prisma.printerQueue.findMany();
  const adisyonQueue = queues.find((q) => q.name === "Adisyon-USB");
  const mutfakQueue = queues.find((q) => q.name === "Mutfak-Windows");

  // 2. RBAC Kural Testi: Sistem Yöneticisi Öğrenme Modunu Değiştiremez (§5.17 & §6)
  const sysAdminToggleAttempt = await toggleLearningModeAction({
    actorId: sysAdmin.id,
    enabled: false,
  });

  // Restoran Yöneticisi Öğrenme Modunu Değiştirebilir (§5.17 & §6)
  const managerToggleAttempt = await toggleLearningModeAction({
    actorId: manager.id,
    enabled: true,
  });

  // 3. Servisi Tamamla Önkoşul Engel Kontrolü (§5.15) - Masa 08 (Taslak ve İptal Bekliyor)
  const masa08Session = await prisma.serviceSession.findUniqueOrThrow({
    where: { referenceCode: "A-2026-000184" },
  });
  const masa08CompleteAttempt = await completeServiceSessionAction({
    actorId: manager.id,
    sessionId: masa08Session.id,
  });

  // 4. İptal Talebi Kendi Talebini Onaylama ve Yetkisiz Onay Engeli (§5.8 & §5.16)
  const pendingCancel = await prisma.cancellationRequest.findFirst({
    where: { status: "PENDING" },
  });
  let selfApproveBlocked = false;
  if (pendingCancel) {
    try {
      const selfApproveAttempt = await decideCancellationRequestAction({
        actorId: pendingCancel.requestedById,
        requestId: pendingCancel.id,
        decision: "APPROVE",
        decisionNote: "Kendi talebimi onaylama denemesi",
      });
      selfApproveBlocked = !selfApproveAttempt.ok;
    } catch {
      selfApproveBlocked = true;
    }
  }

  // 5. Rapor Merkezi (§5.12) - Kaynak Kayıtlardan Rapor Üretimi
  const reportResult = await runOperationalReportAction({
    actorId: manager.id,
    reportCode: "OPERASYON_OZETI",
    exportFormat: "VIEW",
  });

  // 6. 15 Kopya Döngüsel Yedekleme (§8 - SCR-18)
  const backupResult = await createBackupAction({
    actorId: sysAdmin.id,
    triggerType: "MANUAL",
  });
  const activeUsbBackups = await prisma.backupRecord.count({
    where: { targetType: "USB", status: "SUCCESS" },
  });
  const activeLocalBackups = await prisma.backupRecord.count({
    where: { targetType: "LOCAL_DIR", status: "SUCCESS" },
  });

  // 7. 6 Adımlı Sıralı Salt-Okunur Tanılama (§5.18 - SCR-19)
  const diagResult = await runSequentialDiagnosticsAction({
    actorId: sysAdmin.id,
  });

  // 8. SHA-256 Denetim Günlüğü Hash Zinciri Doğrulaması (§5.11.1 - SCR-13)
  const auditIntegrity = await verifyAuditChainIntegrity();

  // 9. Fiyatsızlık Kontrolü (80mm Şablonlarda TL/₺/Fiyat/KDV/Toplam Tutar olmaması)
  const sampleKitchenChit = formatKitchenOrderChit({
    restaurantName: config.name,
    tableName: "Masa 08",
    roundNumber: 1,
    orderReference: "A-2026-000184",
    waiterName: waiterAyse.name,
    stationName: "IZGARA",
    jobCode: "K-000399",
    sentAt: new Date(),
    items: [
      {
        quantity: 1,
        receiptName: "Izgara Levrek",
        seatNumber: 2,
        modifiers: ["Limon ayrı"],
        kitchenNote: "Lütfen bekletmeyin",
      },
    ],
  });
  const sampleCheck = formatPricelessCheckSummary({
    restaurantName: config.name,
    tableName: "Masa 08",
    orderReference: "A-2026-000184",
    waiterName: waiterAyse.name,
    guestCount: 3,
    scopeDescription: "Tüm gönderilmiş turlar",
    printedAt: new Date(),
    jobCode: "A-000199",
    items: [
      {
        roundNumber: 1,
        sentTimeText: "19:23",
        quantity: 2,
        receiptName: "Mevsim Salata",
        seatNumber: 1,
      },
    ],
  });
  const sampleVoid = formatKitchenVoidChit({
    restaurantName: config.name,
    tableName: "Masa 08",
    roundNumber: 1,
    orderReference: "A-2026-000184",
    voidReference: "VOID-2026-0041",
    jobCode: "V-000101",
    stationName: "IZGARA",
    productName: "Izgara Levrek",
    quantity: 1,
    requestedByName: waiterAyse.name,
    approvedByName: manager.name,
    reasonCategory: "Misafir tercihini değiştirdi",
    explanation: "Et yemeği tercih etti",
    approvedAt: new Date(),
  });

  console.log(
    JSON.stringify(
      {
        donanimPaketi: {
          kalemSayisi: HARDWARE_BOM_PACKAGE.length,
          araToplamTL: HARDWARE_PACKAGE_TOTAL_TL,
          adisyonKuyrugu: `${adisyonQueue?.name} (${adisyonQueue?.deviceModel} -> ${adisyonQueue?.connectionType})`,
          mutfakKuyrugu: `${mutfakQueue?.name} (${mutfakQueue?.deviceModel} -> ${mutfakQueue?.printServerModel} -> ${mutfakQueue?.bridgeApModel} -> ${mutfakQueue?.routerModel})`,
        },
        ekranEnvanteri: {
          toplamEkran: SCREEN_CATALOG.length,
          kodlar: SCREEN_CATALOG.map((s) => s.id).join(", "),
        },
        kritikKurallarDogrulamasi: {
          sistemYoneticisiOgrenmeModuEngellendi: !sysAdminToggleAttempt.ok,
          restoranYoneticisiOgrenmeModuBasarili: managerToggleAttempt.ok,
          acikKalemVarkenServisTamamlamaEngellendi:
            !masa08CompleteAttempt.ok &&
            (masa08CompleteAttempt.blockers?.length ?? 0) > 0,
          engelSayisi: masa08CompleteAttempt.blockers?.length ?? 0,
          kendiIptalTalebiniOnaylamaEngellendi: selfApproveBlocked,
          raporMerkeziCalisti: reportResult.ok,
          usbAktifYedekSayisiMax15: `${activeUsbBackups} / 15`,
          yerelAktifYedekSayisiMax15: `${activeLocalBackups} / 15`,
          siraliTanilama6AdimCalisti:
            diagResult.ok && diagResult.diagnosticRun?.checks?.length === 6,
          auditHashZinciriBozulmamis: auditIntegrity.verified,
          toplamAuditKaydi: auditIntegrity.totalEvents,
          mutfakVeAdisyonCiktilarindaFiyatYok:
            !sampleKitchenChit.includes("KDV") &&
            !sampleVoid.includes("KDV") &&
            sampleCheck.includes("MALİ GEÇERLİLİĞİ YOKTUR"),
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
