// §5.9.1 MICROS referanslı çıktı düzenleri ve Alacarte 80mm fiş şablonları
// KESİN KURAL: Fiyat, ara toplam, toplam, vergi, ödeme/tahsilat, tender veya PMS/oda bilgisi HİÇBİR çıktıda yer almaz.

export interface KitchenChitItemInput {
  quantity: number;
  receiptName: string;
  seatNumber?: number | null;
  sharedSeats?: number[] | null;
  modifiers?: string[];
  kitchenNote?: string | null;
  allergens?: string | null;
  isRush?: boolean;
}

export interface KitchenChitInput {
  restaurantName: string;
  tableName: string;
  roundNumber: number;
  orderReference: string;
  waiterName: string;
  stationName: string;
  jobCode: string;
  sentAt: Date;
  isReprint?: boolean;
  isRush?: boolean;
  originalJobCode?: string | null;
  guestCount?: number | null;
  items: KitchenChitItemInput[];
}

export interface KitchenVoidChitInput {
  restaurantName: string;
  tableName: string;
  roundNumber: number;
  orderReference: string;
  voidReference: string;
  jobCode: string;
  stationName: string;
  productName: string;
  quantity: number;
  seatNumber?: number | null;
  requestedByName: string;
  approvedByName: string;
  reasonCategory: string;
  explanation: string;
  approvedAt: Date;
  isReprint?: boolean;
  originalJobCode?: string | null;
}

export interface PricelessCheckItemInput {
  roundNumber: number;
  sentTimeText: string;
  quantity: number;
  receiptName: string;
  seatNumber?: number | null;
  sharedSeats?: number[] | null;
  modifiers?: string[];
  kitchenNote?: string | null;
  isCancelled?: boolean;
  cancelReason?: string | null;
}

export interface PricelessCheckInput {
  restaurantName: string;
  tableName: string;
  orderReference: string;
  waiterName: string;
  guestCount: number;
  scopeDescription: string;
  printedAt: Date;
  jobCode: string;
  isReprint?: boolean;
  originalJobCode?: string | null;
  items: PricelessCheckItemInput[];
}

function formatTimeTR(date: Date, withSeconds = false): string {
  return date.toLocaleTimeString("tr-TR", {
    timeZone: "Asia/Nicosia",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

function formatDateTR(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    timeZone: "Asia/Nicosia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatKitchenOrderChit(input: KitchenChitInput): string {
  const lines: string[] = [];
  const headerTitle = `ALACARTE / ${input.restaurantName.toLocaleUpperCase("tr-TR")}`;
  lines.push(headerTitle.padStart(Math.floor((48 + headerTitle.length) / 2), " "));

  // ==========================================================================
  // TEK YAZICI İÇİN DEVASA İSTASYON BAŞLIĞI (MICROS SINGLE-PRINTER EXPEDITOR ROUTING)
  // ==========================================================================
  const stationBanner = `>>> İSTASYON: [ ${input.stationName.toLocaleUpperCase("tr-TR")} ] <<<`;
  lines.push("================================================");
  lines.push(stationBanner.padStart(Math.floor((48 + stationBanner.length) / 2), " "));
  lines.push("================================================");

  if (input.isRush) {
    lines.push("************************************************");
    lines.push("***   >>> RUSH / ACİL SİPARİŞ - ÖNCELİKLİ <<< ***");
    lines.push("************************************************");
  }

  lines.push("                 MUTFAK SİPARİŞİ");
  if (input.isReprint) {
    lines.push("************************************************");
    lines.push("***    TEKRAR BASKI / DUPLICATE KOPYA        ***");
    lines.push("***   YENİ SİPARİŞ DEĞİLDİR - BİLGİ İÇİN     ***");
    lines.push("************************************************");
    if (input.originalJobCode) {
      lines.push(`          İlk İş Ref: ${input.originalJobCode}`);
    }
  } else {
    lines.push("                    YENİ TUR");
  }

  const kuverText = input.guestCount ? `KUVER: ${input.guestCount}` : "";
  lines.push(
    `${`MASA: ${input.tableName}`.padEnd(22, " ")}${`TUR: ${String(input.roundNumber).padStart(2, "0")}`.padEnd(14, " ")}${kuverText}`
  );
  lines.push(
    `${`Sipariş: ${input.orderReference}`.padEnd(28, " ")}Saat: ${formatTimeTR(input.sentAt, false)}`
  );
  lines.push(
    `${`Garson: ${input.waiterName}`.padEnd(28, " ")}İstasyon: ${input.stationName}`
  );
  lines.push("------------------------------------------------");

  let totalQty = 0;
  for (const item of input.items) {
    totalQty += item.quantity;
    let seatSuffix = "";
    if (item.sharedSeats && item.sharedSeats.length > 1) {
      seatSuffix = ` [Paylaşım Koltuk: ${item.sharedSeats.join(",")}]`;
    } else if (item.seatNumber) {
      seatSuffix = ` [Koltuk ${item.seatNumber}]`;
    }
    const rushPrefix = item.isRush ? "[RUSH/ACİL] " : "";
    lines.push(`${rushPrefix}${item.quantity} x ${item.receiptName}${seatSuffix}`);
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        lines.push(`   - ${mod}`);
      }
    }
    if (item.kitchenNote && item.kitchenNote.trim().length > 0) {
      lines.push(`   NOT: ${item.kitchenNote.trim()}`);
    }
    if (item.allergens && item.allergens.trim().length > 0) {
      lines.push(`   ALERJEN: ${item.allergens.trim()}`);
    }
  }

  lines.push("------------------------------------------------");
  lines.push(
    `${`TOPLAM: ${totalQty} Kalem`.padEnd(26, " ")}Fiş: ${input.jobCode}`
  );
  lines.push(
    `${`Gönderim: ${formatTimeTR(input.sentAt, true)}`.padEnd(26, " ")}İstasyon: ${input.stationName}`
  );
  lines.push("================================================");
  return lines.join("\n");
}

export function formatKitchenVoidChit(input: KitchenVoidChitInput): string {
  const lines: string[] = [];
  const headerTitle = `ALACARTE / ${input.restaurantName.toLocaleUpperCase("tr-TR")}`;
  lines.push(headerTitle.padStart(Math.floor((48 + headerTitle.length) / 2), " "));

  const voidStationBanner = `>>> İPTAL - İSTASYON: [ ${input.stationName.toLocaleUpperCase("tr-TR")} ] <<<`;
  lines.push("================================================");
  lines.push(voidStationBanner.padStart(Math.floor((48 + voidStationBanner.length) / 2), " "));
  lines.push("================================================");

  lines.push("            *** İPTAL / VOID BİLDİRİMİ ***");
  if (input.isReprint) {
    lines.push(`          TEKRAR BASKI (İlk İş: ${input.originalJobCode ?? "-"})`);
  }
  lines.push("------------------------------------------------");
  lines.push(
    `${`MASA: ${input.tableName}`.padEnd(32, " ")}TUR: ${String(input.roundNumber).padStart(2, "0")}`
  );
  lines.push(`Sipariş: ${input.orderReference}      İptal Ref: ${input.voidReference}`);
  lines.push(`İstasyon: ${input.stationName}`);
  lines.push("------------------------------------------------");
  const seatText = input.seatNumber ? ` [Koltuk ${input.seatNumber}]` : "";
  lines.push(`İPTAL: ${input.quantity} x ${input.productName}${seatText}`);
  lines.push(`Neden: ${input.reasonCategory}`);
  if (input.explanation) {
    lines.push(`Açıklama: ${input.explanation}`);
  }
  lines.push(`Talep Eden: ${input.requestedByName}`);
  lines.push(`Onaylayan Yönetici: ${input.approvedByName}`);
  lines.push("------------------------------------------------");
  lines.push(
    `${`Onay: ${formatTimeTR(input.approvedAt, true)}`.padEnd(25, " ")}Fiş: ${input.jobCode}`
  );
  lines.push("================================================");
  return lines.join("\n");
}

export function formatPricelessCheckSummary(input: PricelessCheckInput): string {
  const lines: string[] = [];
  const headerTitle = `ALACARTE / ${input.restaurantName.toLocaleUpperCase("tr-TR")}`;
  lines.push(headerTitle.padStart(Math.floor((48 + headerTitle.length) / 2), " "));
  lines.push("              ADİSYON / SERVİS ÖZETİ");
  if (input.isReprint) {
    lines.push(`          *** TEKRAR BASKI (İlk: ${input.originalJobCode ?? "-"}) ***`);
  }
  lines.push("================================================");
  lines.push(
    `${`Masa: ${input.tableName}`.padEnd(24, " ")}Kuver / Misafir: ${input.guestCount}`
  );
  lines.push(
    `${`Sipariş: ${input.orderReference}`.padEnd(26, " ")}Tarih: ${formatDateTR(input.printedAt)}`
  );
  lines.push(
    `${`Garson: ${input.waiterName}`.padEnd(26, " ")}Saat: ${formatTimeTR(input.printedAt, false)}`
  );
  lines.push(`Kapsam: ${input.scopeDescription}`);
  lines.push("------------------------------------------------");

  const activeItems = input.items.filter((i) => !i.isCancelled);
  const cancelledItems = input.items.filter((i) => i.isCancelled);
  let activeQuantityTotal = 0;

  for (const item of activeItems) {
    activeQuantityTotal += item.quantity;
    let seatSuffix = "";
    if (item.sharedSeats && item.sharedSeats.length > 1) {
      seatSuffix = ` [Paylaşım Koltuk ${item.sharedSeats.join(",")}]`;
    } else if (item.seatNumber) {
      seatSuffix = ` [Koltuk ${item.seatNumber}]`;
    }
    lines.push(
      `Tur ${String(item.roundNumber).padStart(2, "0")}  ${item.sentTimeText}  ${item.quantity} x ${item.receiptName}${seatSuffix}`
    );
    const details: string[] = [];
    if (item.modifiers && item.modifiers.length > 0) {
      details.push(item.modifiers.join("; "));
    }
    if (item.kitchenNote) {
      details.push(item.kitchenNote);
    }
    if (details.length > 0) {
      lines.push(`                 ${details.join(" · ")}`);
    }
  }

  if (cancelledItems.length > 0) {
    lines.push("------------------------------------------------");
    lines.push("İPTAL EDİLEN KALEMLER (Etkin adede katılmaz):");
    for (const cItem of cancelledItems) {
      lines.push(
        `[İPTAL] Tur ${String(cItem.roundNumber).padStart(2, "0")} · ${cItem.quantity} x ${cItem.receiptName} (${cItem.cancelReason ?? "Onaylı iptal"})`
      );
    }
  }

  lines.push("------------------------------------------------");
  lines.push(
    `${`TOPLAM SERVİS KALEMİ: ${activeQuantityTotal}`.padEnd(31, " ")}Sayfa 1/1`
  );
  lines.push("================================================");
  return lines.join("\n");
}

export function formatTestDiagnosticChit(params: {
  restaurantName: string;
  queueName: string;
  role: string;
  deviceModel: string;
  actorName: string;
  jobCode: string;
}): string {
  const now = new Date();
  return [
    `              ALACARTE / ${params.restaurantName.toLocaleUpperCase("tr-TR")}`,
    "          *** TEST / TANILAMA ÇIKTISI ***",
    "            GERÇEK SİPARİŞ DEĞİLDİR",
    "------------------------------------------------",
    `Hedef Kuyruk : ${params.queueName} (${params.role})`,
    `Yazıcı Modeli: ${params.deviceModel}`,
    `Türkçe Testi : Ş İ ı ğ ç ö ü — ÇAĞLA ŞEFTALİ IZGARA`,
    `Kesici Komutu: GS V (Kısmi Kesim / Partial Cut)`,
    `Tetikleyen   : ${params.actorName}`,
    `Tarih / Saat : ${formatDateTR(now)} ${formatTimeTR(now, true)}`,
    `İş Kimliği   : ${params.jobCode}`,
    "------------------------------------------------",
    "Fiyat, toplam, vergi veya ödeme alanı bulunmaz.",
  ].join("\n");
}

export function formatDuplicateReceiptChit(params: {
  originalChitContent: string;
  reprintedBy: string;
  reprintCount: number;
  reprintedAt?: Date;
}): string {
  const date = params.reprintedAt || new Date();
  const dateText = `${formatDateTR(date)} ${formatTimeTR(date, true)}`;
  const lines = params.originalChitContent.split("\n");
  lines.splice(
    0,
    0,
    "================================================",
    "*** KOPYA / DUPLICATE FIS (GECERSIZDIR) ***",
    `YAZDIRILMA SAYISI: ${params.reprintCount}`,
    `YAZDIRAN: ${params.reprintedBy}`,
    `ZAMAN: ${dateText}`,
    "================================================"
  );
  return lines.join("\n");
}

