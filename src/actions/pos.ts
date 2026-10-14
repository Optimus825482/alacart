"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { formatKitchenOrderChit } from "@/lib/receipt-templates";
import type {
  ItemStatus,
  PrintJobStatus,
  RoundStatus,
  TableOperationalStatus,
} from "@prisma/client";

function safeRevalidate() {
  try {
    revalidatePath("/");
  } catch {
    // Action called outside Next.js request context (CLI, worker, or test)
  }
}

function verifySecret(secret: string, hashOrPlain: string | null | undefined): boolean {
  if (!secret || !hashOrPlain) return false;
  if (hashOrPlain.startsWith("$2")) {
    try {
      return bcrypt.compareSync(secret, hashOrPlain);
    } catch {
      return false;
    }
  }
  return false;
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function generateNextOrderReference(): Promise<string> {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString("hex").toUpperCase();
  const count = await prisma.serviceSession.count();
  return `A-${year}-${String(count + 1).padStart(5, "0")}-${hex}`;
}

async function generateNextKitchenJobCode(): Promise<string> {
  const hex = crypto.randomBytes(2).toString("hex").toUpperCase();
  const count = await prisma.printJob.count();
  return `K-${String(count + 1).padStart(5, "0")}-${hex}`;
}

async function recalculateTableOperationalStatus(
  sessionId: string,
  tableId: string
): Promise<TableOperationalStatus> {
  const [items, pendingCancels, warningJobs] = await Promise.all([
    prisma.orderItem.findMany({
      where: { sessionId },
      select: { status: true },
    }),
    prisma.cancellationRequest.count({
      where: { sessionId, status: "PENDING" },
    }),
    prisma.printJob.count({
      where: {
        sessionId,
        status: { in: ["ERROR", "UNCERTAIN"] },
      },
    }),
  ]);

  let nextStatus: TableOperationalStatus = "IN_SERVICE";

  if (pendingCancels > 0 || items.some((i) => i.status === "CANCEL_REQUESTED")) {
    nextStatus = "CANCEL_PENDING";
  } else if (warningJobs > 0 || items.some((i) => i.status === "OVERDUE")) {
    nextStatus = "PRINT_WARNING";
  } else if (items.some((i) => i.status === "DRAFT")) {
    nextStatus = "DRAFT_PENDING";
  } else if (items.some((i) => i.status === "HELD" || i.status === "SCHEDULED")) {
    nextStatus = "SCHEDULED_PENDING";
  } else {
    nextStatus = "IN_SERVICE";
  }

  await prisma.restaurantTable.update({
    where: { id: tableId },
    data: {
      status: nextStatus,
      lastActivityAt: new Date(),
      version: { increment: 1 },
    },
  });

  return nextStatus;
}

// ============================================================================
// 1. SCR-01: Giriş ve Kimlik Doğrulama (loginAction)
// ============================================================================
export async function loginAction(params: {
  username: string;
  secret: string;
  deviceLabel?: string;
}) {
  const cleanUsername = (params.username ?? "").trim();
  const cleanSecret = (params.secret ?? "").trim();
  const deviceLabel = params.deviceLabel?.trim() || "Restoran Terminali";

  if (!cleanUsername || !cleanSecret) {
    return {
      ok: false as const,
      error: "Kullanıcı adı ve parola/PIN alanları zorunludur.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { username: cleanUsername },
  });

  if (!user) {
    await recordAuditEvent({
      actorName: cleanUsername,
      actorRole: "UNAUTHENTICATED",
      deviceSession: deviceLabel,
      action: "LOGIN_FAILED",
      entityType: "User",
      result: "REJECTED",
      reason: "Kullanıcı adı bulunamadı",
    });
    return {
      ok: false as const,
      error: "Kullanıcı adı veya parola/PIN hatalı.",
    };
  }

  if (!user.active) {
    await recordAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      deviceSession: deviceLabel,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      result: "REJECTED",
      reason: "Pasif kullanıcı hesabı ile giriş denemesi",
    });
    return {
      ok: false as const,
      error: "Bu kullanıcı hesabı devre dışı bırakılmıştır. Sistem yöneticisine başvurun.",
    };
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const remainingMinutes = Math.max(
      1,
      Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000)
    );
    await recordAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      deviceSession: deviceLabel,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      result: "REJECTED",
      reason: `Hesap geçici kilitli (${remainingMinutes} dk kaldı)`,
    });
    return {
      ok: false as const,
      error: `Hesabınız çok sayıda başarısız giriş nedeniyle geçici olarak kilitlenmiştir (${remainingMinutes} dk kaldı). Diğer garson hesapları bu kilitten etkilenmez.`,
    };
  }

  const matchedPassword = verifySecret(cleanSecret, user.passwordHash);
  const matchedPin = verifySecret(cleanSecret, user.pinHash);

  if (!matchedPassword && !matchedPin) {
    const nextFailedCount = user.failedLoginCount + 1;
    const shouldLock = nextFailedCount >= 5;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + 15 * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextFailedCount,
        lockedUntil,
      },
    });

    await recordAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      deviceSession: deviceLabel,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      result: "REJECTED",
      reason: shouldLock
        ? "5 ardışık başarısız deneme sonrası hesap 15 dakika geçici kilitlendi (§5.16)"
        : `Hatalı parola/PIN denemesi (${nextFailedCount}/5)`,
      beforeValue: { failedLoginCount: user.failedLoginCount },
      afterValue: {
        failedLoginCount: nextFailedCount,
        lockedUntil: lockedUntil?.toISOString() ?? null,
      },
    });

    return {
      ok: false as const,
      error: shouldLock
        ? "5 başarısız giriş denemesi! Hesabınız 15 dakika süreyle geçici olarak kilitlendi. Diğer personel kendi hesaplarıyla çalışmaya devam edebilir."
        : `Kullanıcı adı veya parola/PIN hatalı. (Başarısız deneme: ${nextFailedCount}/5)`,
    };
  }

  // §5.16: Yönetici ve Sistem Yöneticisi hesapları PIN ile giriş yapamaz, güçlü parola zorunludur.
  if ((user.role === "SYSTEM_ADMIN" || user.role === "RESTAURANT_MANAGER") && !matchedPassword) {
    await recordAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      deviceSession: deviceLabel,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      result: "REJECTED",
      reason: "Yönetici ve Sistem Yöneticisi hesapları için PIN ile giriş engellendi; parola zorunludur (§5.16)",
    });
    return {
      ok: false as const,
      error: "Yönetici hesapları için PIN ile giriş yapılamaz. Lütfen hesap parolanızla giriş yapın.",
    };
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastHeartbeatAt: now,
      lastDeviceInfo: deviceLabel,
    },
  });

  const headerStore = await headers().catch(() => null);
  const clientIp =
    headerStore?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore?.get("x-real-ip") ||
    "127.0.0.1";

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionRecord = await prisma.userSession.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(sessionToken).digest("hex"),
      userId: user.id,
      deviceLabel,
      ipAddress: clientIp,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
    },
  });

  (await cookies()).set("alacarte_session", sessionToken, {
    httpOnly: true,
    secure: process.env.ALACARTE_COOKIE_SECURE === "false" ? false : process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: sessionRecord.expiresAt,
  });

  await recordAuditEvent({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    deviceSession: deviceLabel,
    action: "LOGIN_SUCCESS",
    entityType: "UserSession",
    entityId: sessionRecord.id,
    result: "SUCCESS",
    details: matchedPassword
      ? "Kişisel parola ile doğrulandı"
      : "Kişisel garson PIN ile doğrulandı",
  });

  safeRevalidate();

  return {
    ok: true as const,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      username: updatedUser.username,
      role: updatedUser.role,
      canApproveCancel: updatedUser.canApproveCancel,
      mustChangePassword: updatedUser.mustChangePassword,
      lastDeviceInfo: updatedUser.lastDeviceInfo,
    },
  };
}

// ============================================================================
// 2. SCR-01: Oturum Kapatma (logoutAction)
// ============================================================================
export async function logoutAction(params: {
  userId?: string;
  deviceLabel?: string;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("alacarte_session")?.value;
  if (!token) return { ok: true as const };
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await prisma.userSession.findUnique({ where: { tokenHash }, include: { user: true } });
  const user = session?.user;

  const now = new Date();
  const revoked = await prisma.userSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: {
      revokedAt: now,
    },
  });

  await recordAuditEvent({
    actorId: user?.id ?? null,
    actorName: user?.name ?? "BİLİNMEYEN",
    actorRole: user?.role ?? "UNKNOWN",
    deviceSession: params.deviceLabel ?? user?.lastDeviceInfo ?? "Restoran Terminali",
    action: "LOGOUT",
    entityType: "UserSession",
    entityId: session?.id ?? null,
    result: "SUCCESS",
    details: `${revoked.count} aktif oturum sonlandırıldı`,
  });

  cookieStore.delete("alacarte_session");

  safeRevalidate();

  return { ok: true as const };
}

// ============================================================================
// 3. İstemci Kalp Atışı ve Menü Sürümü Kontrolü (heartbeatAction)
// ============================================================================
export async function heartbeatAction(params: {
  userId?: string | null;
  deviceLabel?: string;
  clientMenuVersion?: number;
}) {
  const actor = await requireRole(params.userId, ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"], "HEARTBEAT", "UserSession");
  const now = new Date();
  const config = await prisma.restaurantConfig.findFirst();
  const menuVersion = config?.menuVersion ?? 1;
  const learningModeEnabled = config?.learningModeEnabled ?? false;

  {
    await prisma.user
      .update({
        where: { id: actor.id },
        data: {
          lastHeartbeatAt: now,
          ...(params.deviceLabel ? { lastDeviceInfo: params.deviceLabel } : {}),
          ...(params.clientMenuVersion === menuVersion ? { lastSyncedMenuVersion: menuVersion } : {}),
        },
      })
      .catch(() => null);

    await prisma.userSession
      .updateMany({
        where: { userId: actor.id, revokedAt: null },
        data: { lastSeenAt: now },
      })
      .catch(() => null);
  }

  const isMenuStale =
    params.clientMenuVersion !== undefined &&
    params.clientMenuVersion < menuVersion;

  return {
    ok: true as const,
    serverTimeIso: now.toISOString(),
    menuVersion,
    learningModeEnabled,
    isMenuStale,
  };
}

// ============================================================================
// 4. SCR-03 & SCR-04: Masa Açma veya Açık Masaya Devam Etme (openOrResumeTableAction)
// ============================================================================
export async function openOrResumeTableAction(params: {
  actorId: string;
  tableId: string;
  guestCount?: number;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "OPEN_OR_RESUME_TABLE",
    "RestaurantTable",
    params.tableId
  );

  const table = await prisma.restaurantTable.findUnique({
    where: { id: params.tableId },
    include: { area: true },
  });

  if (!table || !table.active) {
    return {
      ok: false as const,
      error: "Seçilen masa bulunamadı veya servis dışı.",
    };
  }

  const existingSession = await prisma.serviceSession.findFirst({
    where: {
      tableId: params.tableId,
      status: "OPEN",
    },
    include: {
      table: { include: { area: true } },
      openedBy: { select: { id: true, name: true, username: true, role: true } },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { items: { orderBy: { createdAt: "asc" } } },
      },
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (existingSession) {
    return {
      ok: true as const,
      mode: "RESUMED" as const,
      session: existingSession,
    };
  }

  const normalizedGuestCount = Math.max(
    1,
    Math.min(30, Math.floor(params.guestCount ?? table.capacity ?? 2))
  );
  const referenceCode = await generateNextOrderReference();
  const now = new Date();

  const txResult = await prisma.$transaction(async (tx) => {
    const concurrentSession = await tx.serviceSession.findFirst({
      where: {
        tableId: params.tableId,
        status: "OPEN",
      },
      include: {
        table: { include: { area: true } },
        openedBy: { select: { id: true, name: true, username: true, role: true } },
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: { items: { orderBy: { createdAt: "asc" } } },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (concurrentSession) {
      return { mode: "RESUMED" as const, session: concurrentSession };
    }

    const createdSession = await tx.serviceSession.create({
      data: {
        referenceCode,
        tableId: params.tableId,
        status: "OPEN",
        guestCount: normalizedGuestCount,
        seatCount: Math.max(1, normalizedGuestCount),
        serviceType: "MASA_SERVISI",
        version: 1,
        openedById: actor.id,
        openedAt: now,
        lastActivityAt: now,
        rounds: {
          create: {
            roundNumber: 1,
            status: "DRAFT",
            createdById: actor.id,
          },
        },
      },
      include: {
        table: { include: { area: true } },
        openedBy: { select: { id: true, name: true, username: true, role: true } },
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: { items: { orderBy: { createdAt: "asc" } } },
        },
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await tx.restaurantTable.update({
      where: { id: params.tableId },
      data: {
        status: "IN_SERVICE",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    return { mode: "OPENED" as const, session: createdSession };
  });

  if (txResult.mode === "OPENED") {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "TABLE_SERVICE_OPENED",
      entityType: "ServiceSession",
      entityId: txResult.session.id,
      result: "SUCCESS",
      afterValue: {
        referenceCode: txResult.session.referenceCode,
        tableName: table.name,
        guestCount: txResult.session.guestCount,
        seatCount: txResult.session.seatCount,
      },
      details: `${table.name} için yeni servis oturumu (${txResult.session.referenceCode}) açıldı`,
    });
  }

  safeRevalidate();

  return {
    ok: true as const,
    mode: txResult.mode,
    session: txResult.session,
  };
}

// ============================================================================
// 5. SCR-04: Misafir / Kuver ve Koltuk Sayısı Güncelleme (updateGuestAndSeatCountAction)
// ============================================================================
export async function updateGuestAndSeatCountAction(params: {
  actorId: string;
  sessionId: string;
  guestCount: number;
  seatCount?: number;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "UPDATE_GUEST_SEAT_COUNT",
    "ServiceSession",
    params.sessionId
  );

  const session = await prisma.serviceSession.findUnique({
    where: { id: params.sessionId },
    include: {
      table: true,
      items: {
        where: { status: { not: "CANCELLED" } },
      },
    },
  });

  if (!session || session.status !== "OPEN") {
    return {
      ok: false as const,
      error: "Güncellenecek açık servis oturumu bulunamadı.",
    };
  }

  const nextGuestCount = Math.max(1, Math.min(50, Math.floor(params.guestCount)));
  const nextSeatCount =
    params.seatCount !== undefined
      ? Math.max(1, Math.min(50, Math.floor(params.seatCount)))
      : nextGuestCount;

  // §5.6: Kuver sayısı düşürülürse yüksek koltuk numaralı mevcut kalemler sessizce değiştirilmez
  const outOfRangeItems = session.items.filter((item) => {
    if (item.seatNumber && item.seatNumber > nextGuestCount) return true;
    const shared = parseJsonArray<number>(item.sharedSeatsJson);
    return shared.some((s) => s > nextGuestCount);
  });

  const updatedSession = await prisma.serviceSession.update({
    where: { id: session.id },
    data: {
      guestCount: nextGuestCount,
      seatCount: nextSeatCount,
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "GUEST_SEAT_UPDATED",
    entityType: "ServiceSession",
    entityId: session.id,
    result: "SUCCESS",
    beforeValue: {
      guestCount: session.guestCount,
      seatCount: session.seatCount,
    },
    afterValue: {
      guestCount: nextGuestCount,
      seatCount: nextSeatCount,
      preservedHighSeatItemCount: outOfRangeItems.length,
    },
    details:
      outOfRangeItems.length > 0
        ? `${session.table.name} kuver/koltuk güncellendi; ${outOfRangeItems.length} kalemdeki mevcut koltuk ataması sessizce silinmeden korundu`
        : `${session.table.name} kuver (${nextGuestCount}) ve koltuk (${nextSeatCount}) güncellendi`,
  });

  safeRevalidate();

  return {
    ok: true as const,
    session: updatedSession,
    outOfRangeSeatWarning:
      outOfRangeItems.length > 0
        ? `${outOfRangeItems.length} kalemde yeni kuver sayısını (${nextGuestCount}) aşan koltuk ataması korunmaktadır. Dilerseniz kalem düzenlemeden koltuk numarasını değiştirebilirsiniz.`
        : null,
  };
}

// ============================================================================
// 6. SCR-04 & SCR-05: Taslak Kalem Ekleme (addDraftItemAction)
// ============================================================================
export async function addDraftItemAction(params: {
  actorId: string;
  sessionId: string;
  menuItemId: string;
  quantity?: number;
  seatNumber?: number | null;
  sharedSeats?: number[] | null;
  modifiers?: string[];
  kitchenNote?: string | null;
  holdItem?: boolean;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "ADD_DRAFT_ITEM",
    "ServiceSession",
    params.sessionId
  );

  const [session, menuItem] = await Promise.all([
    prisma.serviceSession.findUnique({
      where: { id: params.sessionId },
      include: {
        table: true,
        rounds: { orderBy: { roundNumber: "asc" } },
      },
    }),
    prisma.menuItem.findUnique({
      where: { id: params.menuItemId },
      include: {
        station: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { options: { where: { active: true } } },
            },
          },
        },
      },
    }),
  ]);

  if (!session || session.status !== "OPEN") {
    return {
      ok: false as const,
      error: "Açık masa servis oturumu bulunamadı.",
    };
  }

  if (!menuItem || !menuItem.active || menuItem.status !== "ACTIVE") {
    return {
      ok: false as const,
      error: "Seçilen ürün pasif veya menüde aktif değil.",
    };
  }

  // MICROS Item Availability (86 / Tükendi Kontrolü)
  if (menuItem.is86ed || (menuItem.availableCount !== null && menuItem.availableCount <= 0)) {
    return {
      ok: false as const,
      error: `"${menuItem.name}" ürünü mutfakta tükenmiştir (86 / Out of Stock).`,
    };
  }

  const normalizedSharedSeats = Array.from(
    new Set(
      (params.sharedSeats ?? [])
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1)
    )
  ).sort((a, b) => a - b);

  if (normalizedSharedSeats.length > 1 && !menuItem.isShareable) {
    return {
      ok: false as const,
      error: `"${menuItem.name}" ürünü paylaşımlı koltuk atamasına uygun olarak tanımlanmamıştır.`,
    };
  }

  // §5.6 & §11: Paylaşım ürün adedini asla çoğaltmaz
  const normalizedQuantity = Math.max(1, Math.min(99, Math.floor(params.quantity ?? 1)));
  const resolvedSeatNumber =
    params.seatNumber !== undefined && params.seatNumber !== null
      ? Math.max(1, Math.floor(params.seatNumber))
      : normalizedSharedSeats.length === 1
        ? normalizedSharedSeats[0]
        : menuItem.askSeatOnAdd
          ? 1
          : null;

  const cleanModifiers = (params.modifiers ?? [])
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  const cleanKitchenNote = params.kitchenNote?.trim() || null;
  const itemStatus: ItemStatus = params.holdItem ? "HELD" : "DRAFT";

  let targetRound = session.rounds.find(
    (r) => r.status === "DRAFT" || r.status === "HELD"
  );

  if (!targetRound) {
    const maxRoundNumber = session.rounds.reduce(
      (max, r) => (r.roundNumber > max ? r.roundNumber : max),
      0
    );
    targetRound = await prisma.serviceRound.create({
      data: {
        sessionId: session.id,
        roundNumber: maxRoundNumber + 1,
        status: params.holdItem ? "HELD" : "DRAFT",
        createdById: actor.id,
      },
    });
  }

  const createdItem = await prisma.orderItem.create({
    data: {
      sessionId: session.id,
      roundId: targetRound.id,
      menuItemId: menuItem.id,
      productNameSnapshot: menuItem.name,
      receiptNameSnapshot: menuItem.receiptName,
      stationNameSnapshot: menuItem.station.name,
      allergensSnapshot: menuItem.allergens,
      quantity: normalizedQuantity,
      seatNumber: resolvedSeatNumber,
      sharedSeatsJson:
        normalizedSharedSeats.length > 1
          ? JSON.stringify(normalizedSharedSeats)
          : null,
      modifiersJson: JSON.stringify(cleanModifiers),
      kitchenNote: cleanKitchenNote,
      status: itemStatus,
      scheduledById: params.holdItem ? actor.id : null,
      createdById: actor.id,
    },
  });

  await prisma.serviceSession.update({
    where: { id: session.id },
    data: {
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  await recalculateTableOperationalStatus(session.id, session.tableId);

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "ORDER_ITEM_ADDED",
    entityType: "OrderItem",
    entityId: createdItem.id,
    result: "SUCCESS",
    afterValue: {
      tableName: session.table.name,
      roundNumber: targetRound.roundNumber,
      productName: createdItem.productNameSnapshot,
      quantity: createdItem.quantity,
      seatNumber: createdItem.seatNumber,
      sharedSeats: normalizedSharedSeats,
      modifiers: cleanModifiers,
      kitchenNote: cleanKitchenNote,
      status: createdItem.status,
    },
    details: `${session.table.name} · Tur ${targetRound.roundNumber}: ${createdItem.quantity}x ${createdItem.productNameSnapshot} eklendi`,
  });

  safeRevalidate();

  return {
    ok: true as const,
    item: createdItem,
    round: targetRound,
  };
}

// ============================================================================
// 7. SCR-05: Kalem Seçenekleri / Koltuk / Adet Güncelleme (updateDraftItemAction)
// ============================================================================
export async function updateDraftItemAction(params: {
  actorId: string;
  itemId: string;
  quantity?: number;
  seatNumber?: number | null;
  sharedSeats?: number[] | null;
  modifiers?: string[];
  kitchenNote?: string | null;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "UPDATE_ORDER_ITEM",
    "OrderItem",
    params.itemId
  );

  const item = await prisma.orderItem.findUnique({
    where: { id: params.itemId },
    include: {
      menuItem: true,
      session: { include: { table: true } },
      round: true,
    },
  });

  if (!item) {
    return {
      ok: false as const,
      error: "Sipariş kalemi bulunamadı.",
    };
  }

  // §5.16: Garson yalnızca kendi eklediği taslak kalemi düzenleyebilir (Yöneticiler tüm masaları düzenleyebilir)
  if (actor.role === "WAITER" && item.createdById !== actor.id && item.session.openedById !== actor.id) {
    return {
      ok: false as const,
      error: "Yalnızca kendi eklediğiniz taslak kalemleri düzenleyebilirsiniz.",
    };
  }

  if (item.status === "CANCEL_REQUESTED" || item.status === "CANCELLED") {
    return {
      ok: false as const,
      error: "İptal sürecindeki veya iptal edilmiş kalemler düzenlenemez.",
    };
  }

  const normalizedSharedSeats =
    params.sharedSeats !== undefined
      ? Array.from(
          new Set(
            (params.sharedSeats ?? [])
              .map((n) => Math.floor(Number(n)))
              .filter((n) => Number.isFinite(n) && n >= 1)
          )
        ).sort((a, b) => a - b)
      : parseJsonArray<number>(item.sharedSeatsJson);

  if (normalizedSharedSeats.length > 1 && !item.menuItem.isShareable) {
    return {
      ok: false as const,
      error: `"${item.productNameSnapshot}" ürünü birden fazla koltuğa paylaştırılamaz.`,
    };
  }

  // §5.12.1 SCR-05: Gönderilmiş (SENT) kalemlerde yalnız koltuk ataması güncellenebilir;
  // adet, modifier veya mutfak notu değişimi için iptal talebi gerekir.
  if (item.status === "SENT") {
    const isQuantityChanged =
      params.quantity !== undefined && params.quantity !== item.quantity;
    const isModifiersChanged =
      params.modifiers !== undefined &&
      JSON.stringify(params.modifiers) !== item.modifiersJson;
    const isNoteChanged =
      params.kitchenNote !== undefined &&
      (params.kitchenNote?.trim() || null) !== item.kitchenNote;

    if (isQuantityChanged || isModifiersChanged || isNoteChanged) {
      return {
        ok: false as const,
        error:
          "Mutfağa gönderilmiş (SENT) kalemlerin adedi, seçeneği veya mutfak notu doğrudan değiştirilemez. Yalnızca koltuk numarası güncellenebilir veya İptal Talebi (SCR-09) açılabilir.",
      };
    }
  }

  // §5.6 & §11: Paylaşım ürün adedini asla çoğaltmaz
  const nextQuantity =
    item.status === "SENT"
      ? item.quantity
      : params.quantity !== undefined
        ? Math.max(1, Math.min(99, Math.floor(params.quantity)))
        : item.quantity;

  const nextSeatNumber =
    params.seatNumber !== undefined
      ? params.seatNumber !== null
        ? Math.max(1, Math.floor(params.seatNumber))
        : null
      : item.seatNumber;

  const nextSharedSeatsJson =
    normalizedSharedSeats.length > 1
      ? JSON.stringify(normalizedSharedSeats)
      : null;

  const nextModifiersJson =
    item.status === "SENT" || params.modifiers === undefined
      ? item.modifiersJson
      : JSON.stringify(
          params.modifiers.map((m) => m.trim()).filter((m) => m.length > 0)
        );

  const nextKitchenNote =
    item.status === "SENT" || params.kitchenNote === undefined
      ? item.kitchenNote
      : params.kitchenNote?.trim() || null;

  const beforeSnapshot = {
    quantity: item.quantity,
    seatNumber: item.seatNumber,
    sharedSeats: parseJsonArray<number>(item.sharedSeatsJson),
    modifiers: parseJsonArray<string>(item.modifiersJson),
    kitchenNote: item.kitchenNote,
    status: item.status,
  };

  const updatedItem = await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      quantity: nextQuantity,
      seatNumber: nextSeatNumber,
      sharedSeatsJson: nextSharedSeatsJson,
      modifiersJson: nextModifiersJson,
      kitchenNote: nextKitchenNote,
    },
  });

  await prisma.serviceSession.update({
    where: { id: item.sessionId },
    data: {
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  const afterSnapshot = {
    quantity: updatedItem.quantity,
    seatNumber: updatedItem.seatNumber,
    sharedSeats: parseJsonArray<number>(updatedItem.sharedSeatsJson),
    modifiers: parseJsonArray<string>(updatedItem.modifiersJson),
    kitchenNote: updatedItem.kitchenNote,
    status: updatedItem.status,
  };

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "ORDER_ITEM_UPDATED",
    entityType: "OrderItem",
    entityId: item.id,
    result: "SUCCESS",
    beforeValue: beforeSnapshot,
    afterValue: afterSnapshot,
    details: `${item.session.table.name} · ${item.productNameSnapshot} kalemi güncellendi`,
  });

  safeRevalidate();

  return {
    ok: true as const,
    item: updatedItem,
  };
}

// ============================================================================
// 8. SCR-04 & SCR-05: Taslak Kalemi Silme / Çıkarma (removeDraftItemAction)
// ============================================================================
export async function removeDraftItemAction(params: {
  actorId: string;
  itemId: string;
  reason?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "REMOVE_DRAFT_ITEM",
    "OrderItem",
    params.itemId
  );

  const item = await prisma.orderItem.findUnique({
    where: { id: params.itemId },
    include: {
      session: { include: { table: true } },
      round: true,
    },
  });

  if (!item) {
    return {
      ok: false as const,
      error: "Silinecek kalem bulunamadı.",
    };
  }

  // §5.16: Garson yalnızca kendi eklediği taslak kalemi silebilir
  if (actor.role === "WAITER" && item.createdById !== actor.id && item.session.openedById !== actor.id) {
    return {
      ok: false as const,
      error: "Yalnızca kendi eklediğiniz taslak kalemleri silebilirsiniz.",
    };
  }

  if (
    item.status === "SENT" ||
    item.status === "CANCEL_REQUESTED" ||
    item.status === "CANCELLED"
  ) {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "DRAFT_ITEM_REMOVE_REJECTED",
      entityType: "OrderItem",
      entityId: item.id,
      result: "REJECTED",
      reason: "Gönderilmiş (SENT) kalem doğrudan silinemez; iptal talebi zorunludur",
    });

    return {
      ok: false as const,
      error:
        "Mutfağa gönderilmiş kalemler doğrudan silinemez! Lütfen İptal Talebi (SCR-09) oluşturun.",
    };
  }

  const beforeSnapshot = {
    tableName: item.session.table.name,
    roundNumber: item.round.roundNumber,
    productName: item.productNameSnapshot,
    quantity: item.quantity,
    seatNumber: item.seatNumber,
    status: item.status,
  };

  await prisma.orderItem.delete({
    where: { id: item.id },
  });

  await prisma.serviceSession.update({
    where: { id: item.sessionId },
    data: {
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  await recalculateTableOperationalStatus(item.sessionId, item.session.tableId);

  // §5.6.5: Taslak kalemler dahi sessizce yok edilmez; denetim günlüğüne kaydedilir.
  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "DRAFT_ITEM_REMOVED",
    entityType: "OrderItem",
    entityId: item.id,
    result: "SUCCESS",
    reason:
      params.reason?.trim() ||
      "Mutfağa gönderim öncesi taslak/bekletilmiş kalem listeden çıkarıldı",
    beforeValue: beforeSnapshot,
    details: `${item.session.table.name} · Tur ${item.round.roundNumber}: ${item.quantity}x ${item.productNameSnapshot} taslaktan çıkarıldı`,
  });

  safeRevalidate();

  return { ok: true as const };
}

// ============================================================================
// 9. SCR-06: Bekletme ve Zamanlı Gönderim Yönetimi (holdOrScheduleAction)
// ============================================================================
export async function holdOrScheduleAction(params: {
  actorId: string;
  sessionId: string;
  itemIds?: string[];
  roundId?: string;
  mode: "HOLD_ITEMS" | "HOLD_ROUND" | "SCHEDULE" | "CLEAR_SCHEDULE" | "FIRE_NOW";
  scheduledAtIso?: string | null;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "HOLD_OR_SCHEDULE",
    "ServiceSession",
    params.sessionId
  );

  const session = await prisma.serviceSession.findUnique({
    where: { id: params.sessionId },
    include: {
      table: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { items: true },
      },
      items: true,
    },
  });

  if (!session || session.status !== "OPEN") {
    return {
      ok: false as const,
      error: "Açık servis oturumu bulunamadı.",
    };
  }

  const unsentItems = session.items.filter(
    (i) =>
      i.status === "DRAFT" ||
      i.status === "HELD" ||
      i.status === "SCHEDULED" ||
      i.status === "OVERDUE"
  );

  const targetItems = params.itemIds?.length
    ? unsentItems.filter((i) => params.itemIds!.includes(i.id))
    : params.roundId
      ? unsentItems.filter((i) => i.roundId === params.roundId)
      : unsentItems;

  if (targetItems.length === 0) {
    return {
      ok: false as const,
      error: "İşlem yapılacak gönderilmemiş (taslak/bekletilmiş/zamanlanmış) kalem bulunamadı.",
    };
  }

  // §5.7 & §6: Garson kendi bekletilmiş/zamanlanmış kalemlerini yönetebilir;
  // Restoran Yöneticisi ve Sistem Yöneticisi tüm masaların bekletilmiş/zamanlanmış kalemlerini yönetebilir.
  if (actor.role === "WAITER") {
    const hasForeignScheduledItem = targetItems.some(
      (item) =>
        (item.status === "HELD" ||
          item.status === "SCHEDULED" ||
          item.status === "OVERDUE") &&
        item.scheduledById &&
        item.scheduledById !== actor.id &&
        item.createdById !== actor.id &&
        session.openedById !== actor.id
    );

    if (hasForeignScheduledItem) {
      await recordAuditEvent({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: "HOLD_OR_SCHEDULE_FORBIDDEN",
        entityType: "ServiceSession",
        entityId: session.id,
        result: "REJECTED",
        reason: "Garson yalnızca kendi bekletilmiş/zamanlanmış kayıtlarını değiştirebilir",
      });
      return {
        ok: false as const,
        error:
          "Başka bir personel tarafından bekletilmiş/zamanlanmış kalemleri yalnızca ilgili garson veya Restoran Yöneticisi değiştirebilir.",
      };
    }
  }

  const targetItemIds = targetItems.map((i) => i.id);
  const targetRoundId = params.roundId ?? targetItems[0]?.roundId;

  if (params.mode === "FIRE_NOW") {
    await prisma.orderItem.updateMany({
      where: { id: { in: targetItemIds } },
      data: {
        status: "DRAFT",
        scheduledAt: null,
        overdueAt: null,
      },
    });

    if (targetRoundId) {
      await prisma.serviceRound.update({
        where: { id: targetRoundId },
        data: {
          status: "DRAFT",
          holdEntireRound: false,
          scheduledAt: null,
          overdueAt: null,
        },
      });
    }

    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "HOLD_OR_SCHEDULE_UPDATED",
      entityType: "ServiceSession",
      entityId: session.id,
      result: "SUCCESS",
      afterValue: {
        mode: "FIRE_NOW",
        itemCount: targetItemIds.length,
      },
      details: `${session.table.name}: Bekletilen/zamanlanan ${targetItemIds.length} kalem için "Şimdi Gönder" tetiklendi`,
    });

    const fireIdempotencyKey = `FIRE-NOW-${session.id}-${targetRoundId ?? "ALL"}-${session.version}`;
    return sendRoundToKitchenAction({
      actorId: actor.id,
      sessionId: session.id,
      idempotencyKey: fireIdempotencyKey,
      includeHeldItems: true,
    });
  }

  if (params.mode === "HOLD_ITEMS") {
    await prisma.orderItem.updateMany({
      where: { id: { in: targetItemIds } },
      data: {
        status: "HELD",
        scheduledAt: null,
        overdueAt: null,
        scheduledById: actor.id,
      },
    });
  } else if (params.mode === "HOLD_ROUND") {
    if (targetRoundId) {
      await prisma.serviceRound.update({
        where: { id: targetRoundId },
        data: {
          status: "HELD",
          holdEntireRound: true,
          scheduledAt: null,
          overdueAt: null,
          scheduledById: actor.id,
        },
      });
    }
    await prisma.orderItem.updateMany({
      where: { id: { in: targetItemIds } },
      data: {
        status: "HELD",
        scheduledAt: null,
        overdueAt: null,
        scheduledById: actor.id,
      },
    });
  } else if (params.mode === "SCHEDULE") {
    if (!params.scheduledAtIso) {
      return {
        ok: false as const,
        error: "Zamanlı gönderim için geçerli bir saat seçilmelidir.",
      };
    }
    const scheduledDate = new Date(params.scheduledAtIso);
    if (Number.isNaN(scheduledDate.getTime())) {
      return {
        ok: false as const,
        error: "Geçersiz zamanlama saati formatı.",
      };
    }

    if (targetRoundId && !params.itemIds?.length) {
      await prisma.serviceRound.update({
        where: { id: targetRoundId },
        data: {
          status: "SCHEDULED",
          scheduledAt: scheduledDate,
          scheduledById: actor.id,
          overdueAt: null,
        },
      });
    }

    await prisma.orderItem.updateMany({
      where: { id: { in: targetItemIds } },
      data: {
        status: "SCHEDULED",
        scheduledAt: scheduledDate,
        scheduledById: actor.id,
        overdueAt: null,
      },
    });
  } else if (params.mode === "CLEAR_SCHEDULE") {
    if (targetRoundId) {
      await prisma.serviceRound.update({
        where: { id: targetRoundId },
        data: {
          status: "DRAFT",
          holdEntireRound: false,
          scheduledAt: null,
          scheduledById: null,
          overdueAt: null,
        },
      });
    }

    await prisma.orderItem.updateMany({
      where: { id: { in: targetItemIds } },
      data: {
        status: "DRAFT",
        scheduledAt: null,
        scheduledById: null,
        overdueAt: null,
      },
    });
  }

  await prisma.serviceSession.update({
    where: { id: session.id },
    data: {
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  await recalculateTableOperationalStatus(session.id, session.tableId);

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "HOLD_OR_SCHEDULE_UPDATED",
    entityType: "ServiceSession",
    entityId: session.id,
    result: "SUCCESS",
    afterValue: {
      mode: params.mode,
      itemIds: targetItemIds,
      roundId: targetRoundId,
      scheduledAtIso: params.scheduledAtIso ?? null,
    },
    details: `${session.table.name}: ${targetItemIds.length} kalem için bekletme/zamanlama (${params.mode}) güncellendi`,
  });

  safeRevalidate();

  return {
    ok: true as const,
    mode: params.mode,
    affectedCount: targetItemIds.length,
  };
}

// ============================================================================
// 10. SCR-04 & SCR-06: Turu Mutfağa Gönderme (sendRoundToKitchenAction)
// ============================================================================
export async function sendRoundToKitchenAction(params: {
  actorId: string;
  sessionId: string;
  idempotencyKey: string;
  includeHeldItems?: boolean;
  expectedSessionVersion?: number;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "SEND_ROUND_TO_KITCHEN",
    "ServiceSession",
    params.sessionId
  );
  const cleanKey = (params.idempotencyKey ?? "").trim();
  if (!cleanKey) {
    return {
      ok: false as const,
      error: "Gönderim işlemi için tekil işlem anahtarı (idempotencyKey) zorunludur.",
    };
  }

  // §5.17: Idempotency kontrolü — aynı idempotencyKey 10 kez tekrarlansa bile yalnız 1 tur ve 1 baskı işi üretilir.
  const [existingRoundByKey, existingJobByKey] = await Promise.all([
    prisma.serviceRound.findUnique({
      where: { idempotencyKey: cleanKey },
      include: {
        items: true,
        printJobs: true,
      },
    }),
    prisma.printJob.findUnique({
      where: { idempotencyKey: cleanKey },
      include: {
        round: {
          include: {
            items: true,
            printJobs: true,
          },
        },
      },
    }),
  ]);

  if (existingRoundByKey) {
    return {
      ok: true as const,
      idempotentReplay: true,
      round: existingRoundByKey,
      printJobs: existingRoundByKey.printJobs,
    };
  }

  if (existingJobByKey && existingJobByKey.round) {
    return {
      ok: true as const,
      idempotentReplay: true,
      round: existingJobByKey.round,
      printJobs: existingJobByKey.round.printJobs,
    };
  }

  const [config, session, fallbackKitchenQueue] = await Promise.all([
    prisma.restaurantConfig.findFirst(),
    prisma.serviceSession.findUnique({
      where: { id: params.sessionId },
      include: {
        table: true,
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: {
            items: {
              include: {
                menuItem: {
                  include: {
                    station: { include: { printerQueue: true } },
                    modifierGroups: {
                      include: {
                        modifierGroup: {
                          include: { options: { where: { active: true } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.printerQueue.findFirst({
      where: {
        OR: [{ name: "Mutfak-Windows" }, { role: "KITCHEN" }],
      },
    }),
  ]);

  if (!session || session.status !== "OPEN") {
    return {
      ok: false as const,
      error: "Açık masa servis oturumu bulunamadı.",
    };
  }

  if (
    params.expectedSessionVersion !== undefined &&
    session.version !== params.expectedSessionVersion
  ) {
    return {
      ok: false as const,
      error: `Masa oturumu başka bir cihazdan güncellendi (Beklenen sürüm: v${params.expectedSessionVersion}, Güncel: v${session.version}). Lütfen ekranı yenileyip tekrar deneyin.`,
    };
  }

  const eligibleStatuses: ItemStatus[] = params.includeHeldItems
    ? ["DRAFT", "HELD", "SCHEDULED", "OVERDUE"]
    : ["DRAFT"];

  const candidateRound = session.rounds.find(
    (r) =>
      r.status !== "SENT" &&
      r.status !== "CANCELLED" &&
      (!r.holdEntireRound || Boolean(params.includeHeldItems)) &&
      r.items.some((i) => eligibleStatuses.includes(i.status))
  );

  if (!candidateRound) {
    return {
      ok: false as const,
      error: "Mutfağa gönderilecek uygun taslak kalem bulunamadı.",
    };
  }

  const itemsToSend = candidateRound.items.filter((i) =>
    eligibleStatuses.includes(i.status)
  );
  const itemsToKeepHeld = candidateRound.items.filter(
    (i) => !eligibleStatuses.includes(i.status)
  );

  // Zorunlu modifier doğrulaması
  for (const item of itemsToSend) {
    const chosenModifiers = parseJsonArray<string>(item.modifiersJson);
    for (const link of item.menuItem.modifierGroups) {
      const group = link.modifierGroup;
      if (!group.active || !group.required || group.minSelect <= 0) continue;

      const groupOptionNames = group.options.map((o) =>
        o.name.toLocaleLowerCase("tr-TR")
      );
      const matchedCount = chosenModifiers.filter((mod) => {
        const lowerMod = mod.toLocaleLowerCase("tr-TR");
        return groupOptionNames.some((optName) => lowerMod.includes(optName));
      }).length;

      if (matchedCount < group.minSelect && chosenModifiers.length < group.minSelect) {
        return {
          ok: false as const,
          error: `"${item.productNameSnapshot}" kalemi için zorunlu "${group.name}" seçimi eksik (En az ${group.minSelect} seçim yapılmalıdır).`,
        };
      }
    }
  }

  const now = new Date();
  const restaurantName = config?.name ?? "Merit Garden · A La Carte";

  // Atomik Prisma Transaction ile tüm gönderim adımlarını yürüt (§5.2 & §5.7)
  const txResult = await prisma.$transaction(async (tx) => {
    // Eğer aynı turda bekletilen/zamanlanan kalemler kalıyorsa onları yeni bir taslak/bekletilmiş tura taşı
    if (itemsToKeepHeld.length > 0) {
      const maxRoundNo = session.rounds.reduce(
        (max, r) => (r.roundNumber > max ? r.roundNumber : max),
        candidateRound.roundNumber
      );
      const heldRoundStatus: RoundStatus = itemsToKeepHeld.some(
        (i) => i.status === "SCHEDULED"
      )
        ? "SCHEDULED"
        : "HELD";

      const nextRound = await tx.serviceRound.create({
        data: {
          sessionId: session.id,
          roundNumber: maxRoundNo + 1,
          status: heldRoundStatus,
          scheduledAt:
            itemsToKeepHeld.find((i) => i.scheduledAt)?.scheduledAt ?? null,
          scheduledById:
            itemsToKeepHeld.find((i) => i.scheduledById)?.scheduledById ?? actor.id,
          createdById: actor.id,
        },
      });

      await tx.orderItem.updateMany({
        where: { id: { in: itemsToKeepHeld.map((i) => i.id) } },
        data: { roundId: nextRound.id },
      });
    }

    await tx.orderItem.updateMany({
      where: { id: { in: itemsToSend.map((i) => i.id) } },
      data: {
        status: "SENT",
        sentAt: now,
        scheduledAt: null,
        overdueAt: null,
      },
    });

    const updatedRound = await tx.serviceRound.update({
      where: { id: candidateRound.id },
      data: {
        status: "SENT",
        idempotencyKey: cleanKey,
        holdEntireRound: false,
        sentAt: now,
        sentById: actor.id,
        scheduledAt: null,
        overdueAt: null,
      },
      include: { items: true },
    });

    // İstasyon bazlı gruplama ve PrintJob üretimi
    const stationGroups = new Map<
      string,
      {
        stationName: string;
        stationCode: string;
        printerQueueId: string;
        queueStatus: string;
        items: typeof itemsToSend;
      }
    >();

    for (const item of itemsToSend) {
      const station = item.menuItem.station;
      const queue = station?.printerQueue ?? fallbackKitchenQueue;
      if (!queue) continue;

      const groupKey = station?.id ?? queue.id;
      const existingGroup = stationGroups.get(groupKey);
      if (existingGroup) {
        existingGroup.items.push(item);
      } else {
        stationGroups.set(groupKey, {
          stationName: item.stationNameSnapshot || station?.name || "SICAK MUTFAK",
          stationCode: station?.code || "MUTFAK",
          printerQueueId: queue.id,
          queueStatus: queue.status,
          items: [item],
        });
      }
    }

    const createdPrintJobs = [];
    let stationIndex = 0;

    for (const group of stationGroups.values()) {
      const jobCode = await generateNextKitchenJobCode();
      const jobKey =
        stationIndex === 0 ? cleanKey : `${cleanKey}-${group.stationCode}`;
      stationIndex += 1;

      const isOfflineOrError =
        group.queueStatus === "OFFLINE" || group.queueStatus === "ERROR";
      const isWarning = group.queueStatus === "WARNING";

      const jobStatus: PrintJobStatus = isOfflineOrError
        ? "ERROR"
        : isWarning
          ? "UNCERTAIN"
          : "PENDING";

      const contentSnapshot = formatKitchenOrderChit({
        restaurantName,
        tableName: session.table.name,
        roundNumber: updatedRound.roundNumber,
        orderReference: session.referenceCode,
        waiterName: actor.name,
        stationName: group.stationName,
        jobCode,
        sentAt: now,
        isReprint: false,
        isRush: Boolean(candidateRound.isRush || group.items.some((i) => i.isRush)),
        guestCount: session.guestCount,
        items: group.items.map((i) => ({
          quantity: i.quantity,
          receiptName: i.receiptNameSnapshot,
          seatNumber: i.seatNumber,
          sharedSeats: parseJsonArray<number>(i.sharedSeatsJson),
          modifiers: parseJsonArray<string>(i.modifiersJson),
          kitchenNote: i.kitchenNote,
          allergens: i.allergensSnapshot,
          isRush: Boolean(i.isRush || candidateRound.isRush),
        })),
      });

      const printJob = await tx.printJob.create({
        data: {
          jobCode,
          jobType: "KITCHEN_ORDER",
          status: jobStatus,
          printerQueueId: group.printerQueueId,
          stationName: group.stationName,
          sessionId: session.id,
          roundId: updatedRound.id,
          idempotencyKey: jobKey,
          isReprint: false,
          attemptCount: 1,
          contentSnapshot,
          scopeDescription: `Tur ${String(updatedRound.roundNumber).padStart(2, "0")} · ${group.stationName}`,
          sessionVersionSnapshot: session.version + 1,
          requestedById: actor.id,
          actorName: actor.name,
          errorCode: isOfflineOrError
            ? "QUEUE_OFFLINE"
            : isWarning
              ? "LATENCY_WARNING"
              : null,
          errorMessage: isOfflineOrError
            ? "Mutfak yazdırma kuyruğu çevrimdışı veya erişilemiyor"
            : isWarning
              ? "Yazıcı hattında gecikme uyarısı; fiziksel çıktıyı kontrol edin"
              : null,
          submittedAt: null,
          completedAt: null,
        },
      });

      createdPrintJobs.push(printJob);
    }

    await tx.serviceSession.update({
      where: { id: session.id },
      data: {
        version: { increment: 1 },
        lastActivityAt: now,
      },
    });

    return { updatedRound, createdPrintJobs };
  });

  const { updatedRound, createdPrintJobs } = txResult;
  await recalculateTableOperationalStatus(session.id, session.tableId);

  const hasPrintWarning = createdPrintJobs.some(
    (j) => j.status !== "SUBMITTED_TO_OS_QUEUE"
  );

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "ROUND_SENT_TO_KITCHEN",
    entityType: "ServiceRound",
    entityId: updatedRound.id,
    result: hasPrintWarning ? "WARNING" : "SUCCESS",
    afterValue: {
      tableName: session.table.name,
      roundNumber: updatedRound.roundNumber,
      sentItemCount: itemsToSend.length,
      idempotencyKey: cleanKey,
      printJobCodes: createdPrintJobs.map((j) => j.jobCode),
      printStatuses: createdPrintJobs.map((j) => j.status),
    },
    details: `${session.table.name} · Tur ${updatedRound.roundNumber} (${itemsToSend.length} kalem) uygulama kuyruğuna kaydedildi; OS spooler/fiziksel çıktı teslimi doğrulanmadı.`,
  });

  safeRevalidate();

  return {
    ok: true as const,
    idempotentReplay: false,
    round: updatedRound,
    printJobs: createdPrintJobs,
  };
}

// ============================================================================
// 11. SCR-06: Zamanı Gelen Kalem ve Turları Değerlendirme (evaluateScheduledItemsAction)
// ============================================================================
export async function evaluateScheduledItemsAction(
  params: { actorId?: string; internalSchedulerToken?: string } = {}
) {
  const expectedToken = process.env.SCHEDULER_SECRET;
  const tokenBytes = Buffer.from(params.internalSchedulerToken ?? "");
  const expectedBytes = Buffer.from(expectedToken ?? "");
  const isInternalScheduler = expectedBytes.length >= 32 && tokenBytes.length === expectedBytes.length && crypto.timingSafeEqual(tokenBytes, expectedBytes);
  const actor = isInternalScheduler
    ? null
    : await requireRole(
        params.actorId,
        ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
        "EVALUATE_SCHEDULED_ITEMS",
        "ServiceRound"
      );
  const actorId = actor?.id ?? null;
  const actorName = actor?.name ?? "SİSTEM";
  const actorRole = actor?.role ?? "SİSTEM";
  const now = new Date();

  const [dueItems, dueRounds, kitchenQueue, config] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      include: {
        session: { include: { table: true } },
        round: true,
        menuItem: {
          include: {
            station: { include: { printerQueue: true } },
          },
        },
      },
    }),
    prisma.serviceRound.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      include: {
        session: { include: { table: true } },
        items: true,
      },
    }),
    prisma.printerQueue.findFirst({
      where: {
        OR: [{ name: "Mutfak-Windows" }, { role: "KITCHEN" }],
      },
    }),
    prisma.restaurantConfig.findFirst(),
  ]);

  if (dueItems.length === 0 && dueRounds.length === 0) {
    return {
      ok: true as const,
      status: "IDLE" as const,
      affectedSessions: 0,
      affectedItems: 0,
    };
  }

  const affectedSessionIds = Array.from(
    new Set([
      ...dueItems.map((i) => i.sessionId),
      ...dueRounds.map((r) => r.sessionId),
    ])
  );
  const dueItemIds = dueItems.map((i) => i.id);
  const dueRoundIds = dueRounds.map((r) => r.id);

  const isQueueOfflineOrError =
    !kitchenQueue ||
    kitchenQueue.status === "OFFLINE" ||
    kitchenQueue.status === "ERROR";

  // §5.7.7: Yazıcı veya kuyruk çevrimdışı/hatalıysa zamanı gelen kalemler OVERDUE ("Zamanında yürütülemedi") olur.
  if (isQueueOfflineOrError) {
    if (dueItemIds.length > 0) {
      await prisma.orderItem.updateMany({
        where: { id: { in: dueItemIds } },
        data: {
          status: "OVERDUE",
          overdueAt: now,
        },
      });
    }

    if (dueRoundIds.length > 0) {
      await prisma.serviceRound.updateMany({
        where: { id: { in: dueRoundIds } },
        data: {
          status: "OVERDUE",
          overdueAt: now,
        },
      });
    }

    for (const sessionId of affectedSessionIds) {
      const sessionObj =
        dueItems.find((i) => i.sessionId === sessionId)?.session ??
        dueRounds.find((r) => r.sessionId === sessionId)?.session;

      if (sessionObj) {
        await recalculateTableOperationalStatus(sessionId, sessionObj.tableId);
      }
    }

    await recordAuditEvent({
      actorId,
      actorName,
      actorRole,
      action: "SCHEDULED_FIRE_OVERDUE",
      entityType: "ServiceSession",
      entityId: affectedSessionIds[0] ?? null,
      result: "WARNING",
      reason:
        "Mutfak-Windows kuyruğu çevrimdışı veya hatalı olduğu için zamanlı gönderim OVERDUE (Zamanında yürütülemedi) durumuna alındı",
      afterValue: {
        affectedSessionIds,
        overdueItemCount: dueItemIds.length,
        overdueRoundCount: dueRoundIds.length,
        queueStatus: kitchenQueue?.status ?? "MISSING",
      },
      details: `${dueItemIds.length} zamanlı kalem "Zamanında yürütülemedi (OVERDUE)" durumuna geçirildi`,
    });

    try { safeRevalidate(); } catch { /* Worker context has no UI cache to refresh. */ }

    return {
      ok: true as const,
      status: "OVERDUE" as const,
      affectedSessions: affectedSessionIds.length,
      affectedItems: dueItemIds.length,
    };
  }

  // Kuyruk çalışır durumda: Zamanı gelen kalemleri mutfağa gönder ve aktörü "SİSTEM" olarak kaydet
  const restaurantName = config?.name ?? "Merit Garden · A La Carte";
  let executedItemCount = 0;

  for (const sessionId of affectedSessionIds) {
    const sessionItems = dueItems.filter((i) => i.sessionId === sessionId);
    if (sessionItems.length === 0) continue;

    const roundMap = new Map<string, typeof sessionItems>();
    for (const item of sessionItems) {
      const list = roundMap.get(item.roundId) || [];
      list.push(item);
      roundMap.set(item.roundId, list);
    }

    for (const [roundId, itemsInRound] of roundMap.entries()) {
      const round = itemsInRound[0].round;
      const sessionObj = itemsInRound[0].session;

      await prisma.orderItem.updateMany({
        where: { id: { in: itemsInRound.map((i) => i.id) } },
        data: {
          status: "SENT",
          sentAt: now,
          scheduledAt: null,
          overdueAt: null,
        },
      });

      // Turda başka bekleyen/zamanlanmış kalem kalıp kalmadığını kontrol et
      const remainingUnsent = await prisma.orderItem.count({
        where: {
          roundId,
          status: { in: ["DRAFT", "HELD", "SCHEDULED"] },
        },
      });

      if (remainingUnsent === 0) {
        await prisma.serviceRound.update({
          where: { id: roundId },
          data: {
            status: "SENT",
            holdEntireRound: false,
            sentAt: now,
            scheduledAt: null,
            overdueAt: null,
          },
        });
      }

      // İstasyon bazlı grupla
      const stationMap = new Map<string, typeof itemsInRound>();
      for (const it of itemsInRound) {
        const stName = it.stationNameSnapshot || it.menuItem.station?.name || "SICAK MUTFAK";
        const list = stationMap.get(stName) || [];
        list.push(it);
        stationMap.set(stName, list);
      }

      for (const [stName, stItems] of stationMap.entries()) {
        const jobCode = await generateNextKitchenJobCode();
        const scheduledJobKey = `SCHED-ITEM-ROUND-${roundId}-${stName}-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;

        const contentSnapshot = formatKitchenOrderChit({
          restaurantName,
          tableName: sessionObj.table.name,
          roundNumber: round.roundNumber,
          orderReference: sessionObj.referenceCode,
          waiterName: "SİSTEM (Zamanlı Gönderim)",
          stationName: stName,
          jobCode,
          sentAt: now,
          isReprint: false,
          guestCount: sessionObj.guestCount,
          items: stItems.map((i) => ({
            quantity: i.quantity,
            receiptName: i.receiptNameSnapshot,
            seatNumber: i.seatNumber,
            sharedSeats: parseJsonArray<number>(i.sharedSeatsJson),
            modifiers: parseJsonArray<string>(i.modifiersJson),
            kitchenNote: i.kitchenNote,
            allergens: i.allergensSnapshot,
          })),
        });

        await prisma.printJob.create({
          data: {
            jobCode,
            jobType: "KITCHEN_ORDER",
            status: kitchenQueue.status === "WARNING" ? "UNCERTAIN" : "PENDING",
            printerQueueId: kitchenQueue.id,
            stationName: stName,
            sessionId,
            roundId,
            idempotencyKey: scheduledJobKey,
            isReprint: false,
            attemptCount: 1,
            contentSnapshot,
            scopeDescription: `Zamanlı Tur ${String(round.roundNumber).padStart(2, "0")} · ${stName}`,
            sessionVersionSnapshot: sessionObj.version + 1,
            requestedById: actorId,
            actorName: "SİSTEM",
            submittedAt: null,
            completedAt: null,
          },
        });
      }

      executedItemCount += itemsInRound.length;

      await recordAuditEvent({
        actorId,
        actorName,
        actorRole,
        action: "SCHEDULED_FIRE_EXECUTED",
        entityType: "ServiceRound",
        entityId: roundId,
        result: "SUCCESS",
        afterValue: {
          tableName: sessionObj.table.name,
          roundNumber: round.roundNumber,
          sentItemCount: itemsInRound.length,
        },
        details: `${sessionObj.table.name} · Tur ${round.roundNumber}: Zamanı gelen ${itemsInRound.length} kalem mutfak kuyruğuna alındı.`,
      });
    }

    await prisma.serviceSession.update({
      where: { id: sessionId },
      data: {
        version: { increment: 1 },
        lastActivityAt: now,
      },
    });

    const firstItem = sessionItems[0];
    await recalculateTableOperationalStatus(sessionId, firstItem.session.tableId);
  }

  try { safeRevalidate(); } catch { /* Worker context has no UI cache to refresh. */ }

  return {
    ok: true as const,
    status: "EXECUTED" as const,
    affectedSessions: affectedSessionIds.length,
    affectedItems: executedItemCount,
  };
}

// ============================================================================
// 14. MICROS TSR: 86 / Menü Ürün Mevcudiyeti & Porsiyon Sayacı (toggleMenuItem86Action)
// ============================================================================
export async function toggleMenuItem86Action(params: {
  menuItemId: string;
  is86ed?: boolean;
  availableCount?: number | null;
  actorId?: string;
  reason?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "TOGGLE_MENU_ITEM_86",
    "MenuItem",
    params.menuItemId
  );

  const item = await prisma.menuItem.findUnique({
    where: { id: params.menuItemId },
  });

  if (!item) {
    return { ok: false as const, error: "Menü kalemi bulunamadı." };
  }

  const next86 = params.is86ed !== undefined ? params.is86ed : !item.is86ed;
  const nextCount = params.availableCount !== undefined ? params.availableCount : null;

  const updated = await prisma.menuItem.update({
    where: { id: params.menuItemId },
    data: {
      is86ed: next86,
      availableCount: nextCount,
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "MENU_ITEM_86_TOGGLED",
    entityType: "MenuItem",
    entityId: item.id,
    result: "SUCCESS",
    beforeValue: { is86ed: item.is86ed, availableCount: item.availableCount },
    afterValue: { is86ed: updated.is86ed, availableCount: updated.availableCount },
    details: `${item.name}: ${next86 ? "86 (TÜKENDİ)" : "MEVCUT"}${nextCount !== null ? ` (Kalan: ${nextCount})` : ""} olarak güncellendi`,
  });

  safeRevalidate();
  return { ok: true as const, item: updated };
}

// ============================================================================
// 15. MICROS TSR: Masa Taşıma / Table Transfer (transferTableAction)
// ============================================================================
export async function transferTableAction(params: {
  sourceTableId: string;
  targetTableId: string;
  actorId?: string;
  reason?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "TRANSFER_TABLE",
    "RestaurantTable",
    params.sourceTableId
  );

  if (params.sourceTableId === params.targetTableId) {
    return { ok: false as const, error: "Kaynak ve hedef masa aynı olamaz." };
  }

  const [sourceTable, targetTable] = await Promise.all([
    prisma.restaurantTable.findUnique({
      where: { id: params.sourceTableId },
      include: {
        sessions: {
          where: { status: "OPEN" },
          orderBy: { openedAt: "desc" },
        },
      },
    }),
    prisma.restaurantTable.findUnique({
      where: { id: params.targetTableId },
      include: {
        sessions: {
          where: { status: "OPEN" },
        },
      },
    }),
  ]);

  if (!sourceTable || sourceTable.sessions.length === 0) {
    return { ok: false as const, error: "Kaynak masada açık servis oturumu bulunamadı." };
  }

  if (!targetTable) {
    return { ok: false as const, error: "Hedef masa bulunamadı." };
  }

  if (targetTable.status !== "EMPTY" || targetTable.sessions.length > 0) {
    return { ok: false as const, error: `Hedef masa (${targetTable.name}) boş değil. Taşıma için hedef masanın boş olması gerekir.` };
  }

  const session = sourceTable.sessions[0];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Oturumu yeni masaya bağla
    await tx.serviceSession.update({
      where: { id: session.id },
      data: {
        tableId: targetTable.id,
        version: { increment: 1 },
        lastActivityAt: now,
      },
    });

    // 2. Kaynak masayı boşalt
    await tx.restaurantTable.update({
      where: { id: sourceTable.id },
      data: {
        status: "EMPTY",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });

    // 3. Hedef masayı servise al
    await tx.restaurantTable.update({
      where: { id: targetTable.id },
      data: {
        status: "IN_SERVICE",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });
  });

  await recalculateTableOperationalStatus(session.id, targetTable.id);

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "TABLE_TRANSFERRED",
    entityType: "ServiceSession",
    entityId: session.id,
    result: "SUCCESS",
    beforeValue: { tableId: sourceTable.id, tableName: sourceTable.name },
    afterValue: { tableId: targetTable.id, tableName: targetTable.name },
    details: `${session.referenceCode}: Servis ${sourceTable.name} masasından ${targetTable.name} masasına taşındı.${params.reason ? ` Neden: ${params.reason}` : ""}`,
  });

  safeRevalidate();
  return { ok: true as const, targetTableId: targetTable.id, sourceTableId: sourceTable.id };
}

// ============================================================================
// 16. MICROS TSR: Masa Birleştirme / Table Merge (mergeTablesAction)
// ============================================================================
export async function mergeTablesAction(params: {
  sourceTableId: string;
  targetTableId: string;
  actorId?: string;
  reason?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "MERGE_TABLES",
    "RestaurantTable",
    params.sourceTableId
  );

  if (params.sourceTableId === params.targetTableId) {
    return { ok: false as const, error: "Kaynak ve hedef masa aynı olamaz." };
  }

  const [sourceTable, targetTable] = await Promise.all([
    prisma.restaurantTable.findUnique({
      where: { id: params.sourceTableId },
      include: {
        sessions: {
          where: { status: "OPEN" },
          include: {
            rounds: { include: { items: true } },
            items: true,
          },
        },
      },
    }),
    prisma.restaurantTable.findUnique({
      where: { id: params.targetTableId },
      include: {
        sessions: {
          where: { status: "OPEN" },
          include: {
            rounds: { orderBy: { roundNumber: "asc" } },
          },
        },
      },
    }),
  ]);

  if (!sourceTable || sourceTable.sessions.length === 0) {
    return { ok: false as const, error: "Kaynak masada açık servis oturumu bulunamadı." };
  }

  if (!targetTable || targetTable.sessions.length === 0) {
    return { ok: false as const, error: "Hedef masada açık servis oturumu bulunamadı." };
  }

  const sourceSession = sourceTable.sessions[0];
  const targetSession = targetTable.sessions[0];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Hedef masadaki en yüksek tur numarasını bul
    const maxTargetRoundNo = targetSession.rounds.reduce(
      (max, r) => (r.roundNumber > max ? r.roundNumber : max),
      0
    );

    // 2. Kaynak oturumdaki turları ve kalemleri hedef oturuma aktar
    let addedRounds = 1;
    for (const round of sourceSession.rounds) {
      const nextRoundNo = maxTargetRoundNo + addedRounds;
      addedRounds++;

      await tx.serviceRound.update({
        where: { id: round.id },
        data: {
          sessionId: targetSession.id,
          roundNumber: nextRoundNo,
        },
      });

      await tx.orderItem.updateMany({
        where: { roundId: round.id },
        data: {
          sessionId: targetSession.id,
        },
      });
    }

    // 3. Hedef oturumun kuver ve koltuk sayısını güncelle
    const combinedGuests = Math.min(50, targetSession.guestCount + sourceSession.guestCount);
    const combinedSeats = Math.min(50, targetSession.seatCount + sourceSession.seatCount);

    await tx.serviceSession.update({
      where: { id: targetSession.id },
      data: {
        guestCount: combinedGuests,
        seatCount: combinedSeats,
        notes: [targetSession.notes, `[${sourceTable.name} masasından ${sourceSession.referenceCode} birleştirildi]`].filter(Boolean).join(" · "),
        version: { increment: 1 },
        lastActivityAt: now,
      },
    });

    // 4. Kaynak oturumu kapat ve masayı boşalt
    await tx.serviceSession.update({
      where: { id: sourceSession.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        notes: `Masa ${targetTable.name} (${targetSession.referenceCode}) ile birleştirildi`,
      },
    });

    await tx.restaurantTable.update({
      where: { id: sourceTable.id },
      data: {
        status: "EMPTY",
        lastActivityAt: now,
        version: { increment: 1 },
      },
    });
  });

  await recalculateTableOperationalStatus(targetSession.id, targetTable.id);

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "TABLES_MERGED",
    entityType: "ServiceSession",
    entityId: targetSession.id,
    result: "SUCCESS",
    beforeValue: { sourceSessionId: sourceSession.id, sourceTable: sourceTable.name },
    afterValue: { targetSessionId: targetSession.id, targetTable: targetTable.name },
    details: `${sourceTable.name} (${sourceSession.referenceCode}) masası ${targetTable.name} (${targetSession.referenceCode}) ile birleştirildi.`,
  });

  safeRevalidate();
  return { ok: true as const, targetTableId: targetTable.id };
}

// ============================================================================
// 17. MICROS TSR: Acil / Öncelikli Fiş (toggleRoundRushAction & toggleItemRushAction)
// ============================================================================
export async function toggleRoundRushAction(params: {
  roundId: string;
  isRush?: boolean;
  actorId?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "TOGGLE_ROUND_RUSH",
    "ServiceRound",
    params.roundId
  );

  const round = await prisma.serviceRound.findUnique({
    where: { id: params.roundId },
    include: { session: { include: { table: true } } },
  });

  if (!round) {
    return { ok: false as const, error: "Tur bulunamadı." };
  }

  const nextRush = params.isRush !== undefined ? params.isRush : !round.isRush;

  await prisma.$transaction([
    prisma.serviceRound.update({
      where: { id: round.id },
      data: { isRush: nextRush },
    }),
    prisma.orderItem.updateMany({
      where: { roundId: round.id, status: { in: ["DRAFT", "HELD", "SCHEDULED"] } },
      data: { isRush: nextRush },
    }),
  ]);

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "ROUND_RUSH_TOGGLED",
    entityType: "ServiceRound",
    entityId: round.id,
    result: "SUCCESS",
    afterValue: { isRush: nextRush, roundNumber: round.roundNumber },
    details: `${round.session.table.name} · Tur ${round.roundNumber}: Acil/Öncelikli (RUSH) bayrağı ${nextRush ? "AÇILDI" : "KAPATILDI"}`,
  });

  safeRevalidate();
  return { ok: true as const, isRush: nextRush };
}

export async function toggleItemRushAction(params: {
  itemId: string;
  isRush?: boolean;
  actorId?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "TOGGLE_ITEM_RUSH",
    "OrderItem",
    params.itemId
  );

  const item = await prisma.orderItem.findUnique({
    where: { id: params.itemId },
    include: { session: { include: { table: true } } },
  });

  if (!item) {
    return { ok: false as const, error: "Kalem bulunamadı." };
  }

  const nextRush = params.isRush !== undefined ? params.isRush : !item.isRush;

  const updated = await prisma.orderItem.update({
    where: { id: item.id },
    data: { isRush: nextRush },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "ITEM_RUSH_TOGGLED",
    entityType: "OrderItem",
    entityId: item.id,
    result: "SUCCESS",
    afterValue: { isRush: nextRush, productName: item.productNameSnapshot },
    details: `${item.session.table.name} · ${item.productNameSnapshot}: Acil/Öncelikli (RUSH) bayrağı ${nextRush ? "AÇILDI" : "KAPATILDI"}`,
  });

  safeRevalidate();
  return { ok: true as const, isRush: nextRush };
}

// ============================================================================
// 18. MICROS TSR: Turu Tekrarla / Re-Order Items (reorderRoundAction)
// ============================================================================
export async function reorderRoundAction(params: {
  sessionId: string;
  sourceRoundId?: string;
  actorId?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "REORDER_ROUND",
    "ServiceSession",
    params.sessionId
  );

  const session = await prisma.serviceSession.findUnique({
    where: { id: params.sessionId },
    include: {
      table: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          items: {
            where: { status: { not: "CANCELLED" } },
            include: { menuItem: true },
          },
        },
      },
    },
  });

  if (!session || session.status !== "OPEN") {
    return { ok: false as const, error: "Açık masa servis oturumu bulunamadı." };
  }

  // Kaynak tur seçimi (belirtilmemişse son gönderilen SENT tur)
  const sentRounds = session.rounds.filter((r) => r.status === "SENT");
  const sourceRound = params.sourceRoundId
    ? session.rounds.find((r) => r.id === params.sourceRoundId)
    : sentRounds[sentRounds.length - 1];

  if (!sourceRound || sourceRound.items.length === 0) {
    return { ok: false as const, error: "Tekrarlanacak gönderilmiş tur veya kalem bulunamadı." };
  }

  // Tükenmiş (86) kalem kontrolü
  const outOfStockItems = sourceRound.items.filter(
    (i) => i.menuItem.is86ed || (i.menuItem.availableCount !== null && i.menuItem.availableCount <= 0)
  );
  const itemsToClone = sourceRound.items.filter(
    (i) => !i.menuItem.is86ed && (i.menuItem.availableCount === null || i.menuItem.availableCount > 0)
  );

  if (itemsToClone.length === 0) {
    return { ok: false as const, error: "Tekrarlanacak kalemlerin tümü şu an mutfakta tükenmiştir (86)." };
  }

  // Mevcut DRAFT tur bul veya yeni tur aç
  let targetRoundId = session.rounds.find((r) => r.status === "DRAFT")?.id;
  if (!targetRoundId) {
    const maxRoundNo = session.rounds.reduce(
      (max, r) => (r.roundNumber > max ? r.roundNumber : max),
      0
    );
    const newRound = await prisma.serviceRound.create({
      data: {
        sessionId: session.id,
        roundNumber: maxRoundNo + 1,
        status: "DRAFT",
        createdById: actor.id,
      },
    });
    targetRoundId = newRound.id;
  }

  // Kalemleri taslak tura kopyala
  for (const item of itemsToClone) {
    await prisma.orderItem.create({
      data: {
        sessionId: session.id,
        roundId: targetRoundId,
        menuItemId: item.menuItemId,
        productNameSnapshot: item.productNameSnapshot,
        receiptNameSnapshot: item.receiptNameSnapshot,
        stationNameSnapshot: item.stationNameSnapshot,
        allergensSnapshot: item.allergensSnapshot,
        quantity: item.quantity,
        seatNumber: item.seatNumber,
        sharedSeatsJson: item.sharedSeatsJson,
        modifiersJson: item.modifiersJson,
        kitchenNote: item.kitchenNote,
        status: "DRAFT",
        createdById: actor.id,
      },
    });
  }

  await prisma.serviceSession.update({
    where: { id: session.id },
    data: {
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  await recalculateTableOperationalStatus(session.id, session.tableId);

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "ROUND_REORDERED",
    entityType: "ServiceSession",
    entityId: session.id,
    result: "SUCCESS",
    afterValue: {
      sourceRoundNumber: sourceRound.roundNumber,
      clonedItemCount: itemsToClone.length,
      outOfStockItemCount: outOfStockItems.length,
    },
    details: `${session.table.name}: Tur ${sourceRound.roundNumber}'den ${itemsToClone.length} kalem yeni tura tekrarlandı (Re-Order).${outOfStockItems.length > 0 ? ` (${outOfStockItems.length} tükenen kalem atlandı)` : ""}`,
  });

  safeRevalidate();
  return {
    ok: true as const,
    clonedCount: itemsToClone.length,
    skipped86Count: outOfStockItems.length,
  };
}

// ============================================================================
// 19. MICROS TSR: Garson / Vardiya Devri (transferSessionWaiterAction)
// ============================================================================
export async function transferSessionWaiterAction(params: {
  sessionId: string;
  targetUserId: string;
  actorId?: string;
  reason?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "TRANSFER_SESSION_WAITER",
    "ServiceSession",
    params.sessionId
  );

  const [session, targetUser] = await Promise.all([
    prisma.serviceSession.findUnique({
      where: { id: params.sessionId },
      include: { table: true, openedBy: true },
    }),
    prisma.user.findUnique({
      where: { id: params.targetUserId },
    }),
  ]);

  if (!session || session.status !== "OPEN") {
    return { ok: false as const, error: "Açık masa servis oturumu bulunamadı." };
  }

  if (!targetUser || !targetUser.active) {
    return { ok: false as const, error: "Hedef garson bulunamadı veya hesabı pasif." };
  }

  const prevWaiter = session.openedBy;

  await prisma.serviceSession.update({
    where: { id: session.id },
    data: {
      openedById: targetUser.id,
      version: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "SESSION_WAITER_TRANSFERRED",
    entityType: "ServiceSession",
    entityId: session.id,
    result: "SUCCESS",
    beforeValue: { openedById: prevWaiter.id, waiterName: prevWaiter.name },
    afterValue: { openedById: targetUser.id, waiterName: targetUser.name },
    details: `${session.table.name} (${session.referenceCode}): Masa sorumlusu ${prevWaiter.name} personeli yerine ${targetUser.name} olarak devredildi.${params.reason ? ` Neden: ${params.reason}` : ""}`,
  });

  safeRevalidate();
  return { ok: true as const, newWaiterName: targetUser.name };
}

// ============================================================================
// 20. MICROS TSR: Mutfak Fişini Tekrar Basma / Reprint Chit (reprintKitchenChitAction)
// ============================================================================
export async function reprintKitchenChitAction(params: {
  printJobId: string;
  actorId?: string;
  reason?: string;
}) {
  const actor = await requireRole(
    params.actorId,
    ["SYSTEM_ADMIN", "RESTAURANT_MANAGER", "WAITER"],
    "REPRINT_KITCHEN_CHIT",
    "PrintJob",
    params.printJobId
  );

  const originalJob = await prisma.printJob.findUnique({
    where: { id: params.printJobId },
    include: {
      printerQueue: true,
      session: { include: { table: true } },
      round: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!originalJob) {
    return { ok: false as const, error: "Tekrar basılacak mutfak fişi bulunamadı." };
  }

  const nextJobCode = await generateNextKitchenJobCode();
  const reprintKey = `REPRINT-${originalJob.id}-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;

  // Orijinal içerik üzerine belirgin DUPLICATE başlığı ekle
  let reprintContent = originalJob.contentSnapshot;
  if (!reprintContent.includes("*** TEKRAR BASKI")) {
    const lines = reprintContent.split("\n");
    lines.splice(2, 0,
      "************************************************",
      "***    TEKRAR BASKI / DUPLICATE KOPYA        ***",
      "***   YENİ SİPARİŞ DEĞİLDİR - BİLGİ İÇİN     ***",
      "************************************************",
      `          İlk Fiş Kodu: ${originalJob.jobCode}`
    );
    reprintContent = lines.join("\n");
  }

  const reprintJob = await prisma.printJob.create({
    data: {
      jobCode: nextJobCode,
      jobType: originalJob.jobType,
      status: originalJob.printerQueue.status === "WARNING" ? "UNCERTAIN" : "PENDING",
      printerQueueId: originalJob.printerQueueId,
      stationName: originalJob.stationName,
      sessionId: originalJob.sessionId,
      roundId: originalJob.roundId,
      idempotencyKey: reprintKey,
      isReprint: true,
      originalJobId: originalJob.id,
      attemptCount: 1,
      contentSnapshot: reprintContent,
      scopeDescription: `Tekrar Basım (Kopya) · ${originalJob.scopeDescription || originalJob.jobCode}`,
      sessionVersionSnapshot: originalJob.sessionVersionSnapshot,
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
    action: "KITCHEN_CHIT_REPRINTED",
    entityType: "PrintJob",
    entityId: reprintJob.id,
    result: "SUCCESS",
    beforeValue: { originalJobCode: originalJob.jobCode },
    afterValue: { reprintJobCode: reprintJob.jobCode, printerQueue: originalJob.printerQueue.name },
    details: `${originalJob.session?.table?.name || "Masa"} için ${originalJob.jobCode} mutfak fişi tekrar basım kuyruğuna alındı (Yeni Fiş: ${reprintJob.jobCode}).${params.reason ? ` Neden: ${params.reason}` : ""}`,
  });

  safeRevalidate();
  return { ok: true as const, printJob: reprintJob };
}
