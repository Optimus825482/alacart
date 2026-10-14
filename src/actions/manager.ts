"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import {
  formatKitchenVoidChit,
  formatPricelessCheckSummary,
  type PricelessCheckItemInput,
} from "@/lib/receipt-templates";
import { resolveDateRange } from "@/lib/date-range";
import type { TableOperationalStatus } from "@prisma/client";
import { reprintKitchenChitAction } from "@/actions/pos";

export type OperationalReportCode =
  | "OPERASYON_OZETI"
  | "MASA_HAREKETLERI"
  | "URUN_ADETLERI"
  | "ACIK_SIPARISLER"
  | "TAMAMLANAN_OTURUMLAR"
  | "BEKLETILEN_ZAMANLI"
  | "GARSON_GUNLUGU"
  | "SIPARIS_DENETIM"
  | "IPTAL_ONAYLAR"
  | "YAZDIRMA_GUNLUGU";

export interface ServiceCompletionBlocker {
  code:
    | "DRAFT_ITEMS_EXIST"
    | "HELD_ITEMS_EXIST"
    | "SCHEDULED_OR_OVERDUE_ITEMS_EXIST"
    | "PENDING_CANCEL_REQUESTS_EXIST"
    | "UNRESOLVED_PRINT_JOBS_EXIST";
  title: string;
  count: number;
  description: string;
  resolutionHint: string;
  affectedIds: string[];
}

export interface ReportSummaryCard {
  label: string;
  value: string | number;
  sublabel?: string;
}

export interface ReportColumnDefinition {
  key: string;
  header: string;
}

function formatDateTimeTR(date: Date | null | undefined): string {
  if (!date) return "-";
  return date.toLocaleString("tr-TR", {
    timeZone: "Asia/Nicosia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeShortTR(date: Date | null | undefined): string {
  if (!date) return "--:--";
  return date.toLocaleTimeString("tr-TR", {
    timeZone: "Asia/Nicosia",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseModifiersList(modifiersJson: string | null | undefined): string[] {
  if (!modifiersJson) return [];
  try {
    const parsed: unknown = JSON.parse(modifiersJson);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "name" in entry) {
          return String((entry as { name: unknown }).name);
        }
        return String(entry);
      });
    }
    return [];
  } catch {
    return [];
  }
}

function parseSharedSeatsList(sharedSeatsJson: string | null | undefined): number[] | null {
  if (!sharedSeatsJson) return null;
  try {
    const parsed: unknown = JSON.parse(sharedSeatsJson);
    if (Array.isArray(parsed)) {
      const nums = parsed
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0);
      return nums.length > 0 ? nums : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function computeTableStatusForSession(
  sessionId: string
): Promise<TableOperationalStatus> {
  const session = await prisma.serviceSession.findUnique({
    where: { id: sessionId },
    include: {
      items: { select: { status: true } },
      cancelRequests: { where: { status: "PENDING" }, select: { id: true } },
      printJobs: {
        where: { status: { in: ["ERROR", "UNCERTAIN", "PENDING", "SENDING"] } },
        select: { status: true },
      },
    },
  });

  if (!session || session.status === "COMPLETED") {
    return "EMPTY";
  }

  if (
    session.printJobs.some(
      (job) => job.status === "ERROR" || job.status === "UNCERTAIN"
    )
  ) {
    return "PRINT_WARNING";
  }

  if (session.cancelRequests.length > 0) {
    return "CANCEL_PENDING";
  }

  if (
    session.printJobs.some(
      (job) => job.status === "PENDING" || job.status === "SENDING"
    )
  ) {
    return "PRINT_PENDING";
  }

  if (
    session.items.some(
      (item) =>
        item.status === "HELD" ||
        item.status === "SCHEDULED" ||
        item.status === "OVERDUE"
    )
  ) {
    return "SCHEDULED_PENDING";
  }

  if (session.items.some((item) => item.status === "DRAFT")) {
    return "DRAFT_PENDING";
  }

  return "IN_SERVICE";
}

function safeRevalidateAll() {
  try {
    revalidatePath("/");
  } catch {
    // Server action invoked outside Next.js request context (e.g., CLI verification)
  }
}

/**
 * 1. SCR-07: Garson Öğrenme Modu Anahtarı
 * KESİN KURAL (§5.17 & §6): Yalnız RESTAURANT_MANAGER değiştirebilir.
 * SYSTEM_ADMIN ve WAITER reddedilir ve AuditLog'a REJECTED olarak kaydedilir.
 */
export async function toggleLearningModeAction(input: {
  actorId: string;
  enabled: boolean;
}) {
  try {
    const actor = await requireRole(
      input.actorId,
      ["RESTAURANT_MANAGER"],
      "LEARNING_MODE_TOGGLED",
      "RestaurantConfig",
      "local-restaurant-config"
    );

    const existing = await prisma.restaurantConfig.findFirst();
    const configId = existing?.id ?? "local-restaurant-config";
    const beforeValue = {
      learningModeEnabled: existing?.learningModeEnabled ?? false,
    };

    const updated = await prisma.restaurantConfig.upsert({
      where: { id: configId },
      update: { learningModeEnabled: input.enabled },
      create: {
        id: configId,
        learningModeEnabled: input.enabled,
      },
    });

    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "LEARNING_MODE_TOGGLED",
      entityType: "RestaurantConfig",
      entityId: updated.id,
      result: "SUCCESS",
      beforeValue,
      afterValue: { learningModeEnabled: updated.learningModeEnabled },
      details: `Garson Öğrenme Modu ${
        updated.learningModeEnabled ? "AÇIK" : "KAPALI"
      } konuma getirildi.`,
    });

    safeRevalidateAll();

    return {
      ok: true as const,
      learningModeEnabled: updated.learningModeEnabled,
      config: updated,
    };
  } catch (err: any) {
    return {
      ok: false as const,
      error: err?.message || "Garson Öğrenme Modu değiştirilemedi.",
    };
  }
}

/**
 * 2. SCR-08: Masa Taşıma (Transfer Table)
 * Aktif servis oturumunu boş ve aktif bir masaya taşır, masa durumlarını ve oturum versiyonunu günceller.
 */
export async function transferTableAction(input: {
  actorId: string;
  sessionId: string;
  targetTableId: string;
  reason?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["RESTAURANT_MANAGER", "SYSTEM_ADMIN"],
    "TABLE_TRANSFERRED",
    "ServiceSession",
    input.sessionId
  );

  const session = await prisma.serviceSession.findUnique({
    where: { id: input.sessionId },
    include: { table: true },
  });

  if (!session || session.status !== "OPEN") {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "TABLE_TRANSFERRED",
      entityType: "ServiceSession",
      entityId: input.sessionId,
      result: "REJECTED",
      reason: "Taşınacak açık servis oturumu bulunamadı.",
    });
    throw new Error("Taşınacak açık servis oturumu bulunamadı.");
  }

  if (session.tableId === input.targetTableId) {
    throw new Error("Kaynak masa ile hedef masa aynı olamaz.");
  }

  const targetTable = await prisma.restaurantTable.findUnique({
    where: { id: input.targetTableId },
    include: {
      sessions: {
        where: { status: "OPEN" },
        select: { id: true, referenceCode: true },
      },
    },
  });

  if (
    !targetTable ||
    !targetTable.active ||
    targetTable.status !== "EMPTY" ||
    targetTable.sessions.length > 0
  ) {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "TABLE_TRANSFERRED",
      entityType: "ServiceSession",
      entityId: session.id,
      result: "REJECTED",
      reason: "Hedef masa aktif değil, boş değil veya üzerinde açık servis oturumu bulunuyor.",
      beforeValue: {
        sourceTableId: session.tableId,
        targetTableId: input.targetTableId,
      },
    });
    throw new Error(
      "Hedef masa transfere uygun değil (aktif, BOŞ ve açık oturumsuz olmalıdır)."
    );
  }

  const now = new Date();
  const transferNote = input.reason?.trim() || "Misafir masa değişimi";

  const updatedSession = await prisma.$transaction(async (tx) => {
    await tx.restaurantTable.update({
      where: { id: session.tableId },
      data: {
        status: "EMPTY",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    await tx.restaurantTable.update({
      where: { id: targetTable.id },
      data: {
        status: "IN_SERVICE",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    return tx.serviceSession.update({
      where: { id: session.id },
      data: {
        tableId: targetTable.id,
        version: { increment: 1 },
        lastActivityAt: now,
        notes: session.notes
          ? `${session.notes} | Masa taşındı: ${session.table.name} -> ${targetTable.name} (${transferNote})`
          : `Masa taşındı: ${session.table.name} -> ${targetTable.name} (${transferNote})`,
      },
      include: {
        table: true,
      },
    });
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "TABLE_TRANSFERRED",
    entityType: "ServiceSession",
    entityId: session.id,
    result: "SUCCESS",
    reason: transferNote,
    beforeValue: {
      tableId: session.table.id,
      tableName: session.table.name,
      version: session.version,
    },
    afterValue: {
      tableId: targetTable.id,
      tableName: targetTable.name,
      version: updatedSession.version,
    },
    details: `${session.referenceCode} oturumu ${session.table.name} masasından ${targetTable.name} masasına taşındı.`,
  });

  safeRevalidateAll();

  return {
    ok: true as const,
    session: updatedSession,
    fromTableName: session.table.name,
    toTableName: targetTable.name,
  };
}

/**
 * 3. SCR-08: Servisi Tamamla / Masayı Boşalt (§5.5.6 & §5.15 & §6)
 * KESİN KURAL: Yalnız RESTAURANT_MANAGER tamamlayabilir.
 * Taslak, bekletilen, zamanlı/gecikmiş kalem, bekleyen iptal talebi veya belirsiz/hatalı baskı işi varsa
 * oturumu kapatmaz, COMPLETE_SERVICE_BLOCKED denetim kaydı düşer ve engel listesini döner.
 */
export async function completeServiceSessionAction(input: {
  actorId: string;
  sessionId: string;
  notes?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["RESTAURANT_MANAGER"],
    "COMPLETE_SERVICE_SESSION",
    "ServiceSession",
    input.sessionId
  );

  const session = await prisma.serviceSession.findUnique({
    where: { id: input.sessionId },
    include: {
      table: true,
      items: true,
      cancelRequests: true,
      printJobs: true,
    },
  });

  if (!session) {
    throw new Error("Servis oturumu bulunamadı.");
  }

  if (session.status === "COMPLETED") {
    return {
      ok: true as const,
      blockers: [] as ServiceCompletionBlocker[],
      session,
    };
  }

  const blockers: ServiceCompletionBlocker[] = [];

  const draftItems = session.items.filter((i) => i.status === "DRAFT");
  if (draftItems.length > 0) {
    blockers.push({
      code: "DRAFT_ITEMS_EXIST",
      title: "Gönderilmemiş Taslak Kalemler Var",
      count: draftItems.length,
      description: `Masada henüz mutfağa gönderilmemiş ${draftItems.length} adet taslak (DRAFT) kalem bulunuyor.`,
      resolutionHint:
        "SCR-04 Sipariş ekranından taslak kalemleri mutfağa gönderin veya taslaktan kaldırın.",
      affectedIds: draftItems.map((i) => i.id),
    });
  }

  const heldItems = session.items.filter((i) => i.status === "HELD");
  if (heldItems.length > 0) {
    blockers.push({
      code: "HELD_ITEMS_EXIST",
      title: "Bekletilen (HELD) Kalemler Var",
      count: heldItems.length,
      description: `Masada bekletmeye alınmış ${heldItems.length} adet kalem bulunuyor.`,
      resolutionHint:
        "SCR-06 Bekletme ve Zamanlı Gönderim ekranından kalemleri şimdi mutfağa gönderin veya taslağa alıp silin.",
      affectedIds: heldItems.map((i) => i.id),
    });
  }

  const scheduledOrOverdueItems = session.items.filter(
    (i) => i.status === "SCHEDULED" || i.status === "OVERDUE"
  );
  if (scheduledOrOverdueItems.length > 0) {
    blockers.push({
      code: "SCHEDULED_OR_OVERDUE_ITEMS_EXIST",
      title: "Zamanlanmış veya Süresi Gelmiş Kalemler Var",
      count: scheduledOrOverdueItems.length,
      description: `Masada ileri saate zamanlanmış veya gönderim zamanı gelmiş ${scheduledOrOverdueItems.length} adet kalem bulunuyor.`,
      resolutionHint:
        "SCR-06 ekranından zamanlanmış kalemleri mutfağa gönderin veya zamanlamayı iptal edip taslaktan silin.",
      affectedIds: scheduledOrOverdueItems.map((i) => i.id),
    });
  }

  const pendingCancels = session.cancelRequests.filter(
    (c) => c.status === "PENDING"
  );
  if (pendingCancels.length > 0) {
    blockers.push({
      code: "PENDING_CANCEL_REQUESTS_EXIST",
      title: "Karar Bekleyen İptal Talebi Var",
      count: pendingCancels.length,
      description: `Masada yönetici onayı/reddi bekleyen ${pendingCancels.length} adet iptal talebi (${pendingCancels
        .map((c) => c.referenceCode)
        .join(", ")}) bulunuyor.`,
      resolutionHint:
        "SCR-09 İptal Talepleri ve Onay ekranından bekleyen talepleri onaylayın veya reddedin.",
      affectedIds: pendingCancels.map((c) => c.id),
    });
  }

  const unresolvedPrintJobs = session.printJobs.filter(
    (p) => p.status === "UNCERTAIN" || p.status === "ERROR"
  );
  if (unresolvedPrintJobs.length > 0) {
    blockers.push({
      code: "UNRESOLVED_PRINT_JOBS_EXIST",
      title: "Belirsiz veya Hatalı Yazdırma İşi Var",
      count: unresolvedPrintJobs.length,
      description: `Masada sonucu belirsiz (UNCERTAIN) veya hatalı (ERROR) ${unresolvedPrintJobs.length} adet yazdırma işi (${unresolvedPrintJobs
        .map((p) => p.jobCode)
        .join(", ")}) bulunuyor.`,
      resolutionHint:
        "SCR-10 Yazıcılar ve Yazdırma Kuyruğu ekranından Kontrollü Tekrar Dene veya TEKRAR BASKI ile yazdırma uyarısını çözün.",
      affectedIds: unresolvedPrintJobs.map((p) => p.id),
    });
  }

  if (blockers.length > 0) {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "COMPLETE_SERVICE_BLOCKED",
      entityType: "ServiceSession",
      entityId: session.id,
      result: "REJECTED",
      reason: blockers.map((b) => `${b.title} (${b.count})`).join("; "),
      beforeValue: {
        sessionStatus: session.status,
        tableStatus: session.table.status,
      },
      afterValue: {
        blockerCodes: blockers.map((b) => b.code),
        blockerCount: blockers.length,
      },
      details: `${session.table.name} (${session.referenceCode}) servis tamamlama işlemi ${blockers.length} önkoşul engeli nedeniyle durduruldu.`,
    });

    return {
      ok: false as const,
      blockers,
      session,
    };
  }

  const now = new Date();
  const completionNotes = input.notes?.trim()
    ? session.notes
      ? `${session.notes} | Kapanış: ${input.notes.trim()}`
      : input.notes.trim()
    : session.notes;

  const updatedSession = await prisma.$transaction(async (tx) => {
    await tx.restaurantTable.update({
      where: { id: session.tableId },
      data: {
        status: "EMPTY",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    return tx.serviceSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        completedById: actor.id,
        lastActivityAt: now,
        version: { increment: 1 },
        notes: completionNotes,
      },
      include: {
        table: true,
      },
    });
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "SERVICE_SESSION_COMPLETED",
    entityType: "ServiceSession",
    entityId: session.id,
    result: "SUCCESS",
    reason: input.notes?.trim() || "Servis tamamlandı ve masa boşaltıldı",
    beforeValue: {
      status: session.status,
      tableStatus: session.table.status,
      version: session.version,
    },
    afterValue: {
      status: updatedSession.status,
      tableStatus: "EMPTY",
      completedAt: now.toISOString(),
      version: updatedSession.version,
    },
    details: `${session.table.name} (${session.referenceCode}) servis oturumu tamamlandı ve masa BOŞ durumuna alındı.`,
  });

  safeRevalidateAll();

  return {
    ok: true as const,
    blockers: [] as ServiceCompletionBlocker[],
    session: updatedSession,
  };
}

/**
 * 4. SCR-09: Gönderilmiş Kalem İçin İptal Talebi Oluşturma
 * Garson, Restoran Yöneticisi veya Sistem Yöneticisi tarafından yalnız SENT durumundaki kalemler için oluşturulur.
 */
export async function createCancellationRequestAction(input: {
  actorId: string;
  orderItemId: string;
  requestedQuantity?: number;
  reasonCategory: string;
  explanation: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["WAITER", "RESTAURANT_MANAGER", "SYSTEM_ADMIN"],
    "CANCEL_REQUEST_CREATED",
    "OrderItem",
    input.orderItemId
  );

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: input.orderItemId },
    include: {
      session: { include: { table: true } },
      round: true,
      cancelRequests: { where: { status: "PENDING" } },
    },
  });

  if (!orderItem) {
    throw new Error("İptal talep edilecek sipariş kalemi bulunamadı.");
  }

  if (orderItem.status !== "SENT") {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "CANCEL_REQUEST_CREATED",
      entityType: "OrderItem",
      entityId: orderItem.id,
      result: "REJECTED",
      reason: `Kalem durumu (${orderItem.status}) iptal talebine uygun değil. Yalnız mutfağa gönderilmiş (SENT) kalemler için iptal talebi açılabilir.`,
    });
    throw new Error(
      "Yalnız mutfağa gönderilmiş (SENT) kalemler için iptal talebi oluşturulabilir. Taslak kalemler SCR-05 ekranından doğrudan kaldırılır."
    );
  }

  if (orderItem.cancelRequests.length > 0) {
    throw new Error("Bu kalem için zaten bekleyen bir iptal talebi bulunuyor.");
  }

  const requestedQuantity = input.requestedQuantity ?? orderItem.quantity;
  if (requestedQuantity < 1 || requestedQuantity > orderItem.quantity) {
    throw new Error(
      `İptal adedi 1 ile ${orderItem.quantity} arasında olmalıdır.`
    );
  }

  const reasonCategory = input.reasonCategory?.trim();
  const explanation = input.explanation?.trim();
  if (!reasonCategory || !explanation) {
    throw new Error("İptal neden kategorisi ve açıklama zorunludur.");
  }

  const totalVoidCount = await prisma.cancellationRequest.count();
  const referenceCode = `VOID-2026-${String(totalVoidCount + 41).padStart(
    4,
    "0"
  )}-${Math.floor(10 + Math.random() * 89)}`;
  const now = new Date();

  const cancelRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.cancellationRequest.create({
      data: {
        referenceCode,
        sessionId: orderItem.sessionId,
        roundId: orderItem.roundId,
        orderItemId: orderItem.id,
        requestedQuantity,
        reasonCategory,
        explanation,
        status: "PENDING",
        requestedById: actor.id,
        requestedAt: now,
      },
    });

    await tx.orderItem.update({
      where: { id: orderItem.id },
      data: { status: "CANCEL_REQUESTED" },
    });

    await tx.restaurantTable.update({
      where: { id: orderItem.session.tableId },
      data: {
        status: "CANCEL_PENDING",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    await tx.serviceSession.update({
      where: { id: orderItem.sessionId },
      data: {
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    return created;
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "CANCEL_REQUEST_CREATED",
    entityType: "CancellationRequest",
    entityId: cancelRequest.id,
    result: "SUCCESS",
    reason: `${reasonCategory}: ${explanation}`,
    beforeValue: {
      orderItemId: orderItem.id,
      itemStatus: "SENT",
      tableStatus: orderItem.session.table.status,
    },
    afterValue: {
      referenceCode: cancelRequest.referenceCode,
      itemStatus: "CANCEL_REQUESTED",
      tableStatus: "CANCEL_PENDING",
      requestedQuantity,
    },
    details: `${orderItem.session.table.name} · Tur ${String(
      orderItem.round.roundNumber
    ).padStart(2, "0")} · ${requestedQuantity}x ${
      orderItem.productNameSnapshot
    } için iptal talebi (${cancelRequest.referenceCode}) oluşturuldu.`,
  });

  safeRevalidateAll();

  return {
    ok: true as const,
    cancelRequest,
  };
}

/**
 * 5. SCR-09: İptal Talebi Onay / Red Kararı (§5.8 & §5.16)
 * KESİN KURAL:
 * - Yalnız RESTAURANT_MANAGER veya (RestaurantConfig.shiftCancelDelegate === true ise) canApproveCancel === true olan kullanıcı karar verebilir.
 * - Talep sahibi kendi iptal talebini onaylayamaz / karara bağlayamaz (request.requestedById === actor.id -> REJECTED audit kaydı).
 * - Onaylandığında ayrı bir KITCHEN_VOID yazdırma işi üretilir (Mutfak-Windows).
 */
export async function decideCancellationRequestAction(input: {
  actorId: string;
  requestId: string;
  decision: "APPROVE" | "REJECT";
  decisionNote?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["RESTAURANT_MANAGER", "WAITER", "SYSTEM_ADMIN"],
    "CANCEL_REQUEST_DECISION",
    "CancellationRequest",
    input.requestId
  );

  const config = await prisma.restaurantConfig.findFirst();
  const isAuthorizedByRoleOrDelegate =
    actor.role === "RESTAURANT_MANAGER" ||
    Boolean(config?.shiftCancelDelegate && actor.canApproveCancel);

  if (!isAuthorizedByRoleOrDelegate) {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "CANCEL_REQUEST_DECISION_FORBIDDEN",
      entityType: "CancellationRequest",
      entityId: input.requestId,
      result: "REJECTED",
      reason:
        "Kullanıcı Restoran Yöneticisi değil ve aktif vardiya iptal yetkilisi iznine sahip değil.",
    });
    throw new Error(
      "Yetki reddedildi: İptal talebi kararı yalnız Restoran Yöneticisi veya yetkilendirilmiş Vardiya İptal Yetkilisi tarafından verilebilir."
    );
  }

  const request = await prisma.cancellationRequest.findUnique({
    where: { id: input.requestId },
    include: {
      orderItem: true,
      round: true,
      session: { include: { table: true } },
      requestedBy: true,
    },
  });

  if (!request) {
    throw new Error("İptal talebi bulunamadı.");
  }

  if (request.status !== "PENDING") {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "CANCEL_REQUEST_DOUBLE_DECISION_BLOCKED",
      entityType: "CancellationRequest",
      entityId: request.id,
      result: "REJECTED",
      reason: `İptal talebi (${request.referenceCode}) zaten ${request.status} durumunda.`,
    });
    throw new Error(
      `Bu iptal talebi (${request.referenceCode}) zaten karara bağlanmış (${request.status}).`
    );
  }

  if (request.requestedById === actor.id) {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "CANCEL_REQUEST_SELF_APPROVAL_BLOCKED",
      entityType: "CancellationRequest",
      entityId: request.id,
      result: "REJECTED",
      reason: "Talep sahibi kendi iptal talebini onaylayamaz",
      beforeValue: {
        referenceCode: request.referenceCode,
        requestedById: request.requestedById,
        actorId: actor.id,
      },
    });
    throw new Error("Talep sahibi kendi iptal talebini onaylayamaz");
  }

  const now = new Date();
  const noteText =
    input.decisionNote?.trim() ||
    (input.decision === "APPROVE"
      ? "Yönetici tarafından onaylandı"
      : "Yönetici tarafından reddedildi");

  if (input.decision === "REJECT") {
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.cancellationRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          decidedById: actor.id,
          decisionNote: noteText,
          decidedAt: now,
        },
      });

      await tx.orderItem.update({
        where: { id: request.orderItemId },
        data: {
          status: "SENT",
        },
      });

      await tx.serviceSession.update({
        where: { id: request.sessionId },
        data: {
          lastActivityAt: now,
          version: { increment: 1 },
        },
      });

      return updated;
    });

    const nextTableStatus = await computeTableStatusForSession(
      request.sessionId
    );
    await prisma.restaurantTable.update({
      where: { id: request.session.tableId },
      data: {
        status: nextTableStatus,
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "CANCEL_REQUEST_REJECTED",
      entityType: "CancellationRequest",
      entityId: request.id,
      result: "SUCCESS",
      reason: noteText,
      beforeValue: {
        status: "PENDING",
        itemStatus: "CANCEL_REQUESTED",
      },
      afterValue: {
        status: "REJECTED",
        itemStatus: "SENT",
        tableStatus: nextTableStatus,
      },
      details: `${request.referenceCode} iptal talebi reddedildi; kalem (${request.orderItem.productNameSnapshot}) SENT durumuna geri döndü.`,
    });

    safeRevalidateAll();

    return {
      ok: true as const,
      cancelRequest: updatedRequest,
      voidPrintJob: null,
    };
  }

  // APPROVE branch:
  let kitchenQueue = await prisma.printerQueue.findUnique({
    where: { name: "Mutfak-Windows" },
  });
  if (!kitchenQueue) {
    kitchenQueue = await prisma.printerQueue.findFirst({
      where: { role: "KITCHEN" },
    });
  }
  if (!kitchenQueue) {
    throw new Error("Mutfak-Windows yazdırma kuyruğu bulunamadı.");
  }

  const jobCount = await prisma.printJob.count();
  const jobCode = `K-${String(jobCount + 400).padStart(6, "0")}`;

  const voidChitText = formatKitchenVoidChit({
    restaurantName: config?.name ?? "Merit Garden · A La Carte",
    tableName: request.session.table.name,
    roundNumber: request.round.roundNumber,
    orderReference: request.session.referenceCode,
    voidReference: request.referenceCode,
    jobCode,
    stationName: request.orderItem.stationNameSnapshot,
    productName: request.orderItem.receiptNameSnapshot,
    quantity: request.requestedQuantity,
    seatNumber: request.orderItem.seatNumber,
    requestedByName: request.requestedBy.name,
    approvedByName: actor.name,
    reasonCategory: request.reasonCategory,
    explanation: request.explanation,
    approvedAt: now,
  });

  const result = await prisma.$transaction(async (tx) => {
    const voidPrintJob = await tx.printJob.create({
      data: {
        jobCode,
        jobType: "KITCHEN_VOID",
        status: "PENDING",
        printerQueueId: kitchenQueue.id,
        stationName: request.orderItem.stationNameSnapshot,
        sessionId: request.sessionId,
        roundId: request.roundId,
        cancelRequestId: request.id,
        idempotencyKey: `void-${request.id}`,
        isReprint: false,
        attemptCount: 1,
        contentSnapshot: voidChitText,
        scopeDescription: `İptal / VOID Bildirimi (${request.referenceCode}) · Tur ${String(
          request.round.roundNumber
        ).padStart(2, "0")}`,
        sessionVersionSnapshot: request.session.version + 1,
        requestedById: actor.id,
        actorName: actor.name,
        submittedAt: null,
        completedAt: null,
      },
    });

    const updatedRequest = await tx.cancellationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedById: actor.id,
        decisionNote: noteText,
        decidedAt: now,
        voidPrintJobId: voidPrintJob.id,
      },
    });

    // §5.8: Kısmi iptal vs Tam iptal kontrolü (K5 çözümü)
    if (request.requestedQuantity < request.orderItem.quantity) {
      const remainingQuantity = request.orderItem.quantity - request.requestedQuantity;
      await tx.orderItem.update({
        where: { id: request.orderItemId },
        data: {
          quantity: remainingQuantity,
          status: "SENT",
        },
      });

      // İptal edilen kısım için CANCELLED kayıt oluştur
      await tx.orderItem.create({
        data: {
          sessionId: request.sessionId,
          roundId: request.roundId,
          menuItemId: request.orderItem.menuItemId,
          productNameSnapshot: request.orderItem.productNameSnapshot,
          receiptNameSnapshot: request.orderItem.receiptNameSnapshot,
          stationNameSnapshot: request.orderItem.stationNameSnapshot,
          allergensSnapshot: request.orderItem.allergensSnapshot,
          quantity: request.requestedQuantity,
          seatNumber: request.orderItem.seatNumber,
          sharedSeatsJson: request.orderItem.sharedSeatsJson,
          modifiersJson: request.orderItem.modifiersJson,
          kitchenNote: request.orderItem.kitchenNote,
          status: "CANCELLED",
          sentAt: request.orderItem.sentAt,
          cancelledAt: now,
          createdById: request.orderItem.createdById,
        },
      });
    } else {
      await tx.orderItem.update({
        where: { id: request.orderItemId },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
        },
      });
    }

    await tx.serviceSession.update({
      where: { id: request.sessionId },
      data: {
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    return { updatedRequest, voidPrintJob };
  });

  const nextTableStatus = await computeTableStatusForSession(request.sessionId);
  await prisma.restaurantTable.update({
    where: { id: request.session.tableId },
    data: {
      status: nextTableStatus,
      lastActivityAt: now,
      version: { increment: 1 },
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "CANCEL_REQUEST_APPROVED",
    entityType: "CancellationRequest",
    entityId: request.id,
    result: "WARNING",
    reason: noteText,
    beforeValue: {
      status: "PENDING",
      itemStatus: "CANCEL_REQUESTED",
    },
    afterValue: {
      status: "APPROVED",
      itemStatus: "CANCELLED",
      voidPrintJobCode: result.voidPrintJob.jobCode,
      tableStatus: nextTableStatus,
    },
    details: `${request.referenceCode} iptal talebi yönetici tarafından onaylandı. ${result.voidPrintJob.jobCode} kodlu KITCHEN_VOID işi uygulama kuyruğunda bekliyor; mutfak yazıcısına teslim edilmedi.`,
  });

  safeRevalidateAll();

  return {
    ok: true as const,
    cancelRequest: result.updatedRequest,
    voidPrintJob: result.voidPrintJob,
  };
}

/**
 * 6. SCR-10: Kontrollü Tekrar Dene (Controlled Retry Print Job)
 * Aynı PrintJob kaydını kullanarak attemptCount'u 1 artırır, SUBMITTED_TO_OS_QUEUE yapar ve masadaki PRINT_WARNING durumunu temizler.
 */
export async function controlledRetryPrintJobAction(input: { actorId: string; printJobId: string }) {
  const actor = await requireRole(input.actorId, ["RESTAURANT_MANAGER", "SYSTEM_ADMIN"], "PRINT_JOB_CONTROLLED_RETRY", "PrintJob", input.printJobId);
  const targetJob = await prisma.printJob.findUnique({
    where: { id: input.printJobId },
    include: { session: true, printerQueue: true },
  });
  if (!targetJob) {
    throw new Error("Yeniden denenecek yazdırma işi bulunamadı.");
  }
  const updatedJob = await prisma.printJob.update({
    where: { id: targetJob.id },
    data: {
      status: targetJob.printerQueue.status === "WARNING" ? "UNCERTAIN" : "PENDING",
      attemptCount: { increment: 1 },
      errorMessage: null,
      submittedAt: new Date(),
    },
  });
  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "PRINT_JOB_CONTROLLED_RETRY",
    entityType: "PrintJob",
    entityId: updatedJob.id,
    result: "SUCCESS",
    details: `${targetJob.jobCode} yazdırma işi kontrollü olarak tekrar denendi (Deneme: ${updatedJob.attemptCount}).`,
  });
  safeRevalidateAll();
  return { ok: true as const, printJob: updatedJob };
}

export async function reprintJobAction(input: { actorId: string; printJobId: string; reason?: string }) {
  const res = await reprintKitchenChitAction({
    printJobId: input.printJobId,
    actorId: input.actorId,
    reason: input.reason || "Yönetici tarafından SCR-10 üzerinden tekrar baskı alındı",
  });
  if (!res.ok) {
    throw new Error(res.error);
  }
  safeRevalidateAll();
  return { ok: true as const, printJob: res.printJob };
}

export async function printPricelessCheckAction(input: {
  actorId: string;
  sessionId: string;
  roundScope?: "ALL" | number | string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["RESTAURANT_MANAGER", "SYSTEM_ADMIN"],
    "PRICELESS_CHECK_PRINTED",
    "ServiceSession",
    input.sessionId
  );

  const session = await prisma.serviceSession.findUnique({
    where: { id: input.sessionId },
    include: {
      table: true,
      openedBy: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
      },
      items: {
        include: {
          round: true,
          cancelRequests: {
            orderBy: { requestedAt: "desc" },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!session) {
    throw new Error("Adisyon özeti basılacak servis oturumu bulunamadı.");
  }

  const config = await prisma.restaurantConfig.findFirst();
  let receiptQueue = await prisma.printerQueue.findUnique({
    where: { name: "Adisyon-USB" },
  });
  if (!receiptQueue) {
    receiptQueue = await prisma.printerQueue.findFirst({
      where: { role: "RECEIPT" },
    });
  }
  if (!receiptQueue) {
    throw new Error("Adisyon-USB yazdırma kuyruğu bulunamadı.");
  }

  const targetRoundNumber =
    input.roundScope !== undefined &&
    input.roundScope !== "ALL" &&
    !Number.isNaN(Number(input.roundScope))
      ? Number(input.roundScope)
      : null;

  const scopeDescription =
    targetRoundNumber !== null
      ? `Tur ${String(targetRoundNumber).padStart(2, "0")}`
      : "Tüm gönderilmiş turlar";

  // Yalnız mutfağa gönderilmiş (SENT / CANCEL_REQUESTED) ve onaylı iptal (CANCELLED) kalemler;
  // taslak/bekletilen/zamanlı kalemler fiyatsız adisyon özetine katılmaz.
  const eligibleItems = session.items.filter((item) => {
    if (
      targetRoundNumber !== null &&
      item.round.roundNumber !== targetRoundNumber
    ) {
      return false;
    }
    return (
      item.status === "SENT" ||
      item.status === "CANCEL_REQUESTED" ||
      item.status === "CANCELLED"
    );
  });

  const formattedItems: PricelessCheckItemInput[] = eligibleItems.map(
    (item) => {
      const approvedCancel = item.cancelRequests.find(
        (c) => c.status === "APPROVED"
      );
      return {
        roundNumber: item.round.roundNumber,
        sentTimeText: formatTimeShortTR(item.sentAt ?? item.round.sentAt ?? item.createdAt),
        quantity: item.quantity,
        receiptName: item.receiptNameSnapshot,
        seatNumber: item.seatNumber,
        sharedSeats: parseSharedSeatsList(item.sharedSeatsJson),
        modifiers: parseModifiersList(item.modifiersJson),
        kitchenNote: item.kitchenNote,
        isCancelled: item.status === "CANCELLED",
        cancelReason: approvedCancel?.reasonCategory ?? "Onaylı iptal",
      };
    }
  );

  const now = new Date();
  const totalJobs = await prisma.printJob.count();
  const jobCode = `P-${String(totalJobs + 2050).padStart(4, "0")}`;

  const previewText = formatPricelessCheckSummary({
    restaurantName: config?.name ?? "Merit Garden · A La Carte",
    tableName: session.table.name,
    orderReference: session.referenceCode,
    waiterName: session.openedBy.name,
    guestCount: session.guestCount,
    scopeDescription,
    printedAt: now,
    jobCode,
    isReprint: false,
    items: formattedItems,
  });

  const printJob = await prisma.printJob.create({
    data: {
      jobCode,
      jobType: "PRICELESS_CHECK",
      status: "PENDING",
      printerQueueId: receiptQueue.id,
      stationName: "ADİSYON / SERVİS ÖZETİ",
      sessionId: session.id,
      isReprint: false,
      attemptCount: 1,
      contentSnapshot: previewText,
      scopeDescription,
      sessionVersionSnapshot: session.version,
      requestedById: actor.id,
      actorName: actor.name,
      submittedAt: null,
      completedAt: null,
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "PRICELESS_CHECK_PRINTED",
    entityType: "PrintJob",
    entityId: printJob.id,
    result: "WARNING",
    beforeValue: {
      sessionId: session.id,
      sessionStatus: session.status,
      sessionVersion: session.version,
    },
    afterValue: {
      jobCode: printJob.jobCode,
      printerQueue: receiptQueue.name,
      scopeDescription,
      sessionStatus: session.status,
    },
    details: `${session.table.name} (${session.referenceCode}) için fiyatsız adisyon işi uygulama kuyruğunda bekliyor; Coolify demosunda yazıcıya teslim edilmedi. Masa açık kaldı.`,
  });

  safeRevalidateAll();

  return {
    ok: true as const,
    printJob,
    previewText,
  };
}

/**
 * 9. SCR-12: Operasyonel Rapor Merkezi (§5.12)
 * 10 rapor kategorisinin tamamını sıfır finansal alanla (fiyat, tutar, KDV, ödeme, ciro yok) çalıştırır,
 * ReportExecution ve REPORT_EXECUTED AuditLog kaydı oluşturur.
 */
export async function runOperationalReportAction(input: {
  actorId: string;
  reportCode: OperationalReportCode | string;
  startDate?: string;
  endDate?: string;
  waiterId?: string;
  tableId?: string;
  areaId?: string;
  categoryId?: string;
  statusFilter?: string;
  exportFormat?: "VIEW" | "PRINT" | "CSV" | "PDF";
}) {
  const actor = await requireRole(
    input.actorId,
    ["RESTAURANT_MANAGER", "SYSTEM_ADMIN"],
    "REPORT_EXECUTED",
    "ReportExecution",
    input.reportCode
  );

  let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;
  if (input.startDate || input.endDate) {
    const resolved = resolveDateRange(input.startDate, input.endDate);
    if (resolved.ok) {
      dateFilter = { gte: resolved.start, lte: resolved.end };
    }
  }

  const REPORT_TITLES: Record<string, string> = {
    OPERASYON_OZETI: "01 · Günlük / Dönemsel Operasyon Özeti",
    MASA_HAREKETLERI: "02 · Masa Bazlı Servis Hareketleri",
    URUN_ADETLERI: "03 · Ürün ve Kategori Sipariş Adetleri",
    ACIK_SIPARISLER: "04 · Açık Masa ve Aktif Sipariş Durumu",
    TAMAMLANAN_OTURUMLAR: "05 · Tamamlanan Servis Oturumları",
    BEKLETILEN_ZAMANLI: "06 · Bekletilen ve Zamanlı Gönderim Raporu",
    GARSON_GUNLUGU: "07 · Garson İşlem ve Tur Performans Günlüğü",
    SIPARIS_DENETIM: "08 · Sipariş ve Masa Değişiklik Denetimi",
    IPTAL_ONAYLAR: "09 · İptal Talepleri, Nedenleri ve Onay Kararları",
    YAZDIRMA_GUNLUGU: "10 · Mutfak ve Adisyon Yazdırma Kuyruğu Günlüğü",
  };

  const reportCode = (
    REPORT_TITLES[input.reportCode] ? input.reportCode : "OPERASYON_OZETI"
  ) as OperationalReportCode;
  const reportTitle = REPORT_TITLES[reportCode];

  let summaryCards: ReportSummaryCard[] = [];
  let columns: ReportColumnDefinition[] = [];
  let rows: Record<string, string | number>[] = [];

  if (reportCode === "OPERASYON_OZETI") {
    const [sessions, rounds, items, cancels, printJobs] = await Promise.all([
      prisma.serviceSession.findMany({
        where: {
          ...(dateFilter ? { openedAt: dateFilter } : {}),
          ...(input.tableId ? { tableId: input.tableId } : {}),
          ...(input.waiterId ? { openedById: input.waiterId } : {}),
        },
        include: { table: { include: { area: true } }, openedBy: true },
      }),
      prisma.serviceRound.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.orderItem.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.cancellationRequest.findMany({
        where: dateFilter ? { requestedAt: dateFilter } : undefined,
      }),
      prisma.printJob.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
    ]);

    const openSessions = sessions.filter((s) => s.status === "OPEN").length;
    const completedSessions = sessions.filter(
      (s) => s.status === "COMPLETED"
    ).length;
    const totalGuests = sessions.reduce((acc, s) => acc + s.guestCount, 0);
    const activeItemQty = items
      .filter((i) => i.status === "SENT" || i.status === "CANCEL_REQUESTED")
      .reduce((acc, i) => acc + i.quantity, 0);
    const cancelledQty = items
      .filter((i) => i.status === "CANCELLED")
      .reduce((acc, i) => acc + i.quantity, 0);

    summaryCards = [
      {
        label: "Toplam Servis Oturumu",
        value: sessions.length,
        sublabel: `${openSessions} Açık · ${completedSessions} Tamamlanan`,
      },
      {
        label: "Toplam Misafir / Kuver",
        value: totalGuests,
        sublabel: "Fiyatsız kuver toplamı",
      },
      {
        label: "Etkin Gönderilen Ürün Adedi",
        value: activeItemQty,
        sublabel: `${rounds.filter((r) => r.status === "SENT").length} gönderilmiş tur`,
      },
      {
        label: "Onaylı İptal / Yazdırma İşi",
        value: `${cancelledQty} / ${printJobs.length}`,
        sublabel: `${cancels.filter((c) => c.status === "PENDING").length} bekleyen iptal`,
      },
    ];

    columns = [
      { key: "metric", header: "Operasyon Göstergesi" },
      { key: "count", header: "Adet / Değer" },
      { key: "statusNote", header: "Operasyonel Açıklama (Fiyatsız)" },
    ];

    rows = [
      {
        metric: "Açık Servis Oturumları",
        count: openSessions,
        statusNote: "Şu anda masada devam eden aktif servisler",
      },
      {
        metric: "Tamamlanan Servis Oturumları",
        count: completedSessions,
        statusNote: "Restoran yöneticisi tarafından kapatılan oturumlar",
      },
      {
        metric: "Toplam Misafir (Kuver)",
        count: totalGuests,
        statusNote: "Açılan masalardaki toplam misafir sayısı",
      },
      {
        metric: "Mutfağa Gönderilen Etkin Ürün Adedi",
        count: activeItemQty,
        statusNote: "İptaller hariç mutfağa iletilen net porsiyon/adet",
      },
      {
        metric: "Onaylı İptal Edilen Ürün Adedi",
        count: cancelledQty,
        statusNote: "VOID fişi basılarak iptal edilmiş ürün adedi",
      },
      {
        metric: "Üretilen Termal Fiş / Çıktı İşi",
        count: printJobs.length,
        statusNote: "Mutfak-Windows ve Adisyon-USB toplam iş adedi",
      },
    ];
  } else if (reportCode === "MASA_HAREKETLERI") {
    const sessions = await prisma.serviceSession.findMany({
      where: {
        ...(dateFilter ? { openedAt: dateFilter } : {}),
        ...(input.tableId ? { tableId: input.tableId } : {}),
        ...(input.areaId ? { table: { areaId: input.areaId } } : {}),
        ...(input.waiterId ? { openedById: input.waiterId } : {}),
      },
      include: {
        table: { include: { area: true } },
        openedBy: true,
        rounds: true,
        items: true,
      },
      orderBy: { openedAt: "desc" },
    });

    summaryCards = [
      { label: "İncelenen Oturum", value: sessions.length },
      {
        label: "Toplam Kuver",
        value: sessions.reduce((acc, s) => acc + s.guestCount, 0),
      },
      {
        label: "Toplam Servis Turu",
        value: sessions.reduce((acc, s) => acc + s.rounds.length, 0),
      },
      {
        label: "Etkin Ürün Adedi",
        value: sessions.reduce(
          (acc, s) =>
            acc +
            s.items
              .filter((i) => i.status !== "CANCELLED")
              .reduce((sum, i) => sum + i.quantity, 0),
          0
        ),
      },
    ];

    columns = [
      { key: "referenceCode", header: "Oturum Ref" },
      { key: "tableName", header: "Masa / Alan" },
      { key: "waiterName", header: "Açan Garson" },
      { key: "guestCount", header: "Kuver" },
      { key: "roundCount", header: "Tur Sayısı" },
      { key: "activeItemCount", header: "Etkin Adet" },
      { key: "openedAt", header: "Açılış" },
      { key: "status", header: "Durum" },
    ];

    rows = sessions.map((s) => ({
      referenceCode: s.referenceCode,
      tableName: `${s.table.name} (${s.table.area.name})`,
      waiterName: s.openedBy.name,
      guestCount: s.guestCount,
      roundCount: s.rounds.length,
      activeItemCount: s.items
        .filter((i) => i.status !== "CANCELLED")
        .reduce((sum, i) => sum + i.quantity, 0),
      openedAt: formatDateTimeTR(s.openedAt),
      status: s.status === "OPEN" ? "AÇIK" : "TAMAMLANDI",
    }));
  } else if (reportCode === "URUN_ADETLERI") {
    const items = await prisma.orderItem.findMany({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(input.categoryId
          ? { menuItem: { categoryId: input.categoryId } }
          : {}),
      },
      include: {
        menuItem: { include: { category: true, station: true } },
      },
    });

    const grouped = new Map<
      string,
      {
        productName: string;
        categoryName: string;
        stationName: string;
        sentQty: number;
        cancelledQty: number;
        pendingQty: number;
      }
    >();

    for (const item of items) {
      const key = item.menuItemId;
      const current = grouped.get(key) ?? {
        productName: item.productNameSnapshot,
        categoryName: item.menuItem.category.name,
        stationName: item.stationNameSnapshot,
        sentQty: 0,
        cancelledQty: 0,
        pendingQty: 0,
      };
      if (item.status === "SENT" || item.status === "CANCEL_REQUESTED") {
        current.sentQty += item.quantity;
      } else if (item.status === "CANCELLED") {
        current.cancelledQty += item.quantity;
      } else {
        current.pendingQty += item.quantity;
      }
      grouped.set(key, current);
    }

    const list = Array.from(grouped.values()).sort(
      (a, b) => b.sentQty - a.sentQty
    );

    summaryCards = [
      { label: "Raporlanan Ürün Çeşidi", value: list.length },
      {
        label: "Etkin Gönderilen Adet",
        value: list.reduce((a, b) => a + b.sentQty, 0),
      },
      {
        label: "İptal Edilen Adet",
        value: list.reduce((a, b) => a + b.cancelledQty, 0),
      },
      {
        label: "Taslak / Bekleyen Adet",
        value: list.reduce((a, b) => a + b.pendingQty, 0),
      },
    ];

    columns = [
      { key: "productName", header: "Ürün Adı" },
      { key: "categoryName", header: "Kategori" },
      { key: "stationName", header: "İstasyon" },
      { key: "sentQty", header: "Etkin Gönderilen Adet" },
      { key: "cancelledQty", header: "İptal Adedi" },
      { key: "pendingQty", header: "Taslak / Zamanlı Adet" },
    ];

    rows = list;
  } else if (reportCode === "ACIK_SIPARISLER") {
    const openSessions = await prisma.serviceSession.findMany({
      where: {
        status: "OPEN",
        ...(input.tableId ? { tableId: input.tableId } : {}),
        ...(input.areaId ? { table: { areaId: input.areaId } } : {}),
      },
      include: {
        table: { include: { area: true } },
        openedBy: true,
        items: true,
      },
      orderBy: { openedAt: "asc" },
    });

    summaryCards = [
      { label: "Açık Masa Sayısı", value: openSessions.length },
      {
        label: "Açık Masalardaki Kuver",
        value: openSessions.reduce((a, s) => a + s.guestCount, 0),
      },
      {
        label: "Taslak / Bekleyen Kalem",
        value: openSessions.reduce(
          (a, s) =>
            a +
            s.items.filter(
              (i) =>
                i.status === "DRAFT" ||
                i.status === "HELD" ||
                i.status === "SCHEDULED" ||
                i.status === "OVERDUE"
            ).length,
          0
        ),
      },
      {
        label: "Gönderilmiş Etkin Adet",
        value: openSessions.reduce(
          (a, s) =>
            a +
            s.items
              .filter((i) => i.status === "SENT")
              .reduce((sum, i) => sum + i.quantity, 0),
          0
        ),
      },
    ];

    columns = [
      { key: "tableName", header: "Masa" },
      { key: "areaName", header: "Alan" },
      { key: "referenceCode", header: "Oturum Ref" },
      { key: "tableStatus", header: "Operasyon Durumu" },
      { key: "waiterName", header: "Sorumlu Garson" },
      { key: "guestCount", header: "Kuver" },
      { key: "sentQty", header: "Gönderilen Adet" },
      { key: "openedAt", header: "Açılış Zamanı" },
    ];

    rows = openSessions.map((s) => ({
      tableName: s.table.name,
      areaName: s.table.area.name,
      referenceCode: s.referenceCode,
      tableStatus: s.table.status,
      waiterName: s.openedBy.name,
      guestCount: s.guestCount,
      sentQty: s.items
        .filter((i) => i.status === "SENT")
        .reduce((sum, i) => sum + i.quantity, 0),
      openedAt: formatDateTimeTR(s.openedAt),
    }));
  } else if (reportCode === "TAMAMLANAN_OTURUMLAR") {
    const completed = await prisma.serviceSession.findMany({
      where: {
        status: "COMPLETED",
        ...(dateFilter ? { completedAt: dateFilter } : {}),
        ...(input.tableId ? { tableId: input.tableId } : {}),
      },
      include: {
        table: { include: { area: true } },
        openedBy: true,
        completedBy: true,
        items: true,
      },
      orderBy: { completedAt: "desc" },
    });

    summaryCards = [
      { label: "Tamamlanan Oturum", value: completed.length },
      {
        label: "Ağırlanan Misafir",
        value: completed.reduce((a, s) => a + s.guestCount, 0),
      },
      {
        label: "Servis Edilen Ürün Adedi",
        value: completed.reduce(
          (a, s) =>
            a +
            s.items
              .filter((i) => i.status === "SENT")
              .reduce((sum, i) => sum + i.quantity, 0),
          0
        ),
      },
      {
        label: "İptal Edilen Kalem",
        value: completed.reduce(
          (a, s) =>
            a + s.items.filter((i) => i.status === "CANCELLED").length,
          0
        ),
      },
    ];

    columns = [
      { key: "referenceCode", header: "Oturum Ref" },
      { key: "tableName", header: "Masa" },
      { key: "openedBy", header: "Açan Garson" },
      { key: "completedBy", header: "Kapatan Yönetici" },
      { key: "guestCount", header: "Kuver" },
      { key: "servedQty", header: "Servis Adedi" },
      { key: "openedAt", header: "Açılış" },
      { key: "completedAt", header: "Kapanış" },
    ];

    rows = completed.map((s) => ({
      referenceCode: s.referenceCode,
      tableName: s.table.name,
      openedBy: s.openedBy.name,
      completedBy: s.completedBy?.name ?? "-",
      guestCount: s.guestCount,
      servedQty: s.items
        .filter((i) => i.status === "SENT")
        .reduce((sum, i) => sum + i.quantity, 0),
      openedAt: formatDateTimeTR(s.openedAt),
      completedAt: formatDateTimeTR(s.completedAt),
    }));
  } else if (reportCode === "BEKLETILEN_ZAMANLI") {
    const heldOrScheduled = await prisma.orderItem.findMany({
      where: {
        status: { in: ["HELD", "SCHEDULED", "OVERDUE"] },
        ...(input.tableId ? { session: { tableId: input.tableId } } : {}),
      },
      include: {
        session: { include: { table: true } },
        round: true,
        createdBy: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    summaryCards = [
      { label: "Toplam Bekletilen / Zamanlı", value: heldOrScheduled.length },
      {
        label: "Bekletilen (HELD)",
        value: heldOrScheduled.filter((i) => i.status === "HELD").length,
      },
      {
        label: "Zamanlı (SCHEDULED)",
        value: heldOrScheduled.filter((i) => i.status === "SCHEDULED").length,
      },
      {
        label: "Süresi Gelmiş (OVERDUE)",
        value: heldOrScheduled.filter((i) => i.status === "OVERDUE").length,
      },
    ];

    columns = [
      { key: "tableName", header: "Masa" },
      { key: "roundNumber", header: "Tur" },
      { key: "productName", header: "Ürün" },
      { key: "quantity", header: "Adet" },
      { key: "status", header: "Durum" },
      { key: "scheduledAt", header: "Hedef Gönderim Saati" },
      { key: "waiterName", header: "Kaydeden" },
    ];

    rows = heldOrScheduled.map((i) => ({
      tableName: i.session.table.name,
      roundNumber: `Tur ${String(i.round.roundNumber).padStart(2, "0")}`,
      productName: i.productNameSnapshot,
      quantity: i.quantity,
      status: i.status,
      scheduledAt: formatDateTimeTR(i.scheduledAt),
      waiterName: i.createdBy.name,
    }));
  } else if (reportCode === "GARSON_GUNLUGU") {
    const users = await prisma.user.findMany({
      where: input.waiterId ? { id: input.waiterId } : undefined,
      include: {
        openedSessions: {
          where: dateFilter ? { openedAt: dateFilter } : undefined,
        },
        sentRounds: {
          where: dateFilter ? { sentAt: dateFilter } : undefined,
        },
        createdItems: {
          where: dateFilter ? { createdAt: dateFilter } : undefined,
        },
        cancelRequests: {
          where: dateFilter ? { requestedAt: dateFilter } : undefined,
        },
      },
      orderBy: { name: "asc" },
    });

    summaryCards = [
      { label: "Personel Sayısı", value: users.length },
      {
        label: "Açılan Servis Oturumu",
        value: users.reduce((a, u) => a + u.openedSessions.length, 0),
      },
      {
        label: "Mutfağa Gönderilen Tur",
        value: users.reduce((a, u) => a + u.sentRounds.length, 0),
      },
      {
        label: "Girilen Sipariş Kalemi",
        value: users.reduce(
          (a, u) => a + u.createdItems.reduce((s, i) => s + i.quantity, 0),
          0
        ),
      },
    ];

    columns = [
      { key: "name", header: "Personel Adı" },
      { key: "role", header: "Rol" },
      { key: "openedSessions", header: "Açtığı Masa" },
      { key: "sentRounds", header: "Gönderdiği Tur" },
      { key: "itemQty", header: "Girdiği Ürün Adedi" },
      { key: "cancelRequests", header: "İptal Talebi" },
    ];

    rows = users.map((u) => ({
      name: u.name,
      role: u.role,
      openedSessions: u.openedSessions.length,
      sentRounds: u.sentRounds.length,
      itemQty: u.createdItems.reduce((s, i) => s + i.quantity, 0),
      cancelRequests: u.cancelRequests.length,
    }));
  } else if (reportCode === "SIPARIS_DENETIM") {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(dateFilter ? { serverTimestamp: dateFilter } : {}),
        ...(input.waiterId ? { actorId: input.waiterId } : {}),
        entityType: {
          in: [
            "ServiceSession",
            "ServiceRound",
            "OrderItem",
            "RestaurantTable",
          ],
        },
      },
      orderBy: { sequenceNumber: "desc" },
      take: 150,
    });

    summaryCards = [
      { label: "Denetim Kaydı Sayısı", value: logs.length },
      {
        label: "Başarılı İşlemler",
        value: logs.filter((l) => l.result === "SUCCESS").length,
      },
      {
        label: "Reddedilen / Engellenen",
        value: logs.filter((l) => l.result === "REJECTED").length,
      },
      {
        label: "Masa Taşıma İşlemi",
        value: logs.filter((l) => l.action === "TABLE_TRANSFERRED").length,
      },
    ];

    columns = [
      { key: "sequenceNumber", header: "Sıra" },
      { key: "timestamp", header: "Sunucu Zamanı" },
      { key: "actorName", header: "Kullanıcı" },
      { key: "action", header: "İşlem Kodu" },
      { key: "result", header: "Sonuç" },
      { key: "details", header: "Açıklama" },
    ];

    rows = logs.map((l) => ({
      sequenceNumber: `#${l.sequenceNumber}`,
      timestamp: formatDateTimeTR(l.serverTimestamp),
      actorName: `${l.actorName} (${l.actorRole})`,
      action: l.action,
      result: l.result,
      details: l.details ?? l.reason ?? "-",
    }));
  } else if (reportCode === "IPTAL_ONAYLAR") {
    const cancelRequests = await prisma.cancellationRequest.findMany({
      where: {
        ...(dateFilter ? { requestedAt: dateFilter } : {}),
        ...(input.waiterId ? { requestedById: input.waiterId } : {}),
        ...(input.statusFilter && input.statusFilter !== "ALL"
          ? {
              status: input.statusFilter as
                | "PENDING"
                | "APPROVED"
                | "REJECTED",
            }
          : {}),
      },
      include: {
        session: { include: { table: true } },
        round: true,
        orderItem: true,
        requestedBy: true,
        decidedBy: true,
      },
      orderBy: { requestedAt: "desc" },
    });

    summaryCards = [
      { label: "Toplam İptal Talebi", value: cancelRequests.length },
      {
        label: "Onaylanan (VOID)",
        value: cancelRequests.filter((c) => c.status === "APPROVED").length,
      },
      {
        label: "Reddedilen",
        value: cancelRequests.filter((c) => c.status === "REJECTED").length,
      },
      {
        label: "Karar Bekleyen",
        value: cancelRequests.filter((c) => c.status === "PENDING").length,
      },
    ];

    columns = [
      { key: "referenceCode", header: "İptal Ref" },
      { key: "tableName", header: "Masa / Tur" },
      { key: "productName", header: "Ürün / Adet" },
      { key: "reasonCategory", header: "Neden Kategorisi" },
      { key: "requestedBy", header: "Talep Eden" },
      { key: "decidedBy", header: "Onay / Red Kararı Veren" },
      { key: "status", header: "Durum" },
      { key: "requestedAt", header: "Talep Zamanı" },
    ];

    rows = cancelRequests.map((c) => ({
      referenceCode: c.referenceCode,
      tableName: `${c.session.table.name} · Tur ${String(
        c.round.roundNumber
      ).padStart(2, "0")}`,
      productName: `${c.requestedQuantity}x ${c.orderItem.productNameSnapshot}`,
      reasonCategory: `${c.reasonCategory} (${c.explanation})`,
      requestedBy: c.requestedBy.name,
      decidedBy: c.decidedBy?.name ?? "Bekliyor",
      status: c.status,
      requestedAt: formatDateTimeTR(c.requestedAt),
    }));
  } else {
    // YAZDIRMA_GUNLUGU
    const printJobs = await prisma.printJob.findMany({
      where: {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(input.statusFilter && input.statusFilter !== "ALL"
          ? {
              status: input.statusFilter as
                | "SUBMITTED_TO_OS_QUEUE"
                | "ERROR"
                | "UNCERTAIN"
                | "REPRINTED",
            }
          : {}),
      },
      include: {
        printerQueue: true,
        session: { include: { table: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    summaryCards = [
      { label: "Toplam Yazdırma İşi", value: printJobs.length },
      {
        label: "OS Kuyruğuna İletilen",
        value: printJobs.filter((p) => p.status === "SUBMITTED_TO_OS_QUEUE")
          .length,
      },
      {
        label: "Hatalı / Belirsiz",
        value: printJobs.filter(
          (p) => p.status === "ERROR" || p.status === "UNCERTAIN"
        ).length,
      },
      {
        label: "Tekrar Baskı (Reprint)",
        value: printJobs.filter((p) => p.isReprint).length,
      },
    ];

    columns = [
      { key: "jobCode", header: "İş Kodu" },
      { key: "jobType", header: "Çıktı Türü" },
      { key: "queueName", header: "Yazıcı Kuyruğu" },
      { key: "tableName", header: "Masa" },
      { key: "status", header: "Durum" },
      { key: "attemptCount", header: "Deneme" },
      { key: "isReprint", header: "Tekrar Baskı" },
      { key: "submittedAt", header: "Gönderim Zamanı" },
    ];

    rows = printJobs.map((p) => ({
      jobCode: p.jobCode,
      jobType: p.jobType,
      queueName: p.printerQueue.name,
      tableName: p.session?.table.name ?? "-",
      status: p.status,
      attemptCount: p.attemptCount,
      isReprint: p.isReprint ? "EVET" : "HAYIR",
      submittedAt: formatDateTimeTR(p.submittedAt),
    }));
  }

  const activeFilterSummary = [
    `Rapor: ${reportTitle}`,
    input.startDate ? `Başlangıç: ${input.startDate}` : "Başlangıç: Tümü",
    input.endDate ? `Bitiş: ${input.endDate}` : "Bitiş: Bugün",
    input.areaId ? `Alan Filtresi: ${input.areaId}` : null,
    input.tableId ? `Masa Filtresi: ${input.tableId}` : null,
    input.waiterId ? `Personel Filtresi: ${input.waiterId}` : null,
    input.categoryId ? `Kategori Filtresi: ${input.categoryId}` : null,
    input.statusFilter && input.statusFilter !== "ALL"
      ? `Durum: ${input.statusFilter}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const exportFormat = input.exportFormat ?? "VIEW";
  const filtersJson = JSON.stringify({
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    waiterId: input.waiterId ?? null,
    tableId: input.tableId ?? null,
    areaId: input.areaId ?? null,
    categoryId: input.categoryId ?? null,
    statusFilter: input.statusFilter ?? null,
  });

  const execution = await prisma.reportExecution.create({
    data: {
      reportCode,
      reportTitle,
      reportVersion: "v1.0",
      filtersJson,
      rowCount: rows.length,
      exportFormat,
      executedById: actor.id,
      actorName: actor.name,
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "REPORT_EXECUTED",
    entityType: "ReportExecution",
    entityId: execution.id,
    result: "SUCCESS",
    afterValue: {
      reportCode,
      rowCount: rows.length,
      exportFormat,
    },
    details: `${reportTitle} raporu çalıştırıldı (${rows.length} satır, Biçim: ${exportFormat}).`,
  });

  safeRevalidateAll();

  return {
    ok: true as const,
    reportCode,
    reportTitle,
    summaryCards,
    columns,
    rows,
    activeFilterSummary,
    executionId: execution.id,
  };
}
