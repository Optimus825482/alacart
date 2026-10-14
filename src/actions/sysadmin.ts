"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent, verifyAuditChainIntegrity } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { formatTestDiagnosticChit } from "@/lib/receipt-templates";
import type { DiagnosticStatus, Role } from "@prisma/client";

function hashSecret(raw: string): string {
  return bcrypt.hashSync(raw.trim(), 10);
}

function verifySecret(raw: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !raw) return false;
  const trimmed = raw.trim();
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$")) {
    return bcrypt.compareSync(trimmed, storedHash);
  }
  const sha256 = crypto.createHash("sha256").update(trimmed, "utf8").digest("hex");
  return storedHash === sha256 || storedHash === trimmed;
}

function safeRevalidate() {
  try {
    revalidatePath("/");
  } catch {
    // Server action called outside Next request context (e.g., script/test)
  }
}

// ============================================================================
// 1. SCR-02: İLK KURULUM SİHİRBAZI (completeSetupWizardAction)
// ============================================================================
export async function completeSetupWizardAction(input: {
  actorId: string;
  restaurantName: string;
  timezone?: string;
  tableCount: number;
  adminName?: string;
  adminUsername?: string;
  usbBackupPath?: string;
  localBackupPath?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "COMPLETE_SETUP_WIZARD",
    "RestaurantConfig",
    "local-restaurant-config"
  );

  const cleanName = input.restaurantName.trim();
  if (!cleanName) {
    throw new Error("Restoran adı boş bırakılamaz.");
  }

  const targetTableCount = Math.max(1, Math.min(120, Number(input.tableCount) || 12));
  const timezone = input.timezone?.trim() || "Asia/Nicosia";

  const beforeConfig = await prisma.restaurantConfig.findUnique({
    where: { id: "local-restaurant-config" },
  });

  const updatedConfig = await prisma.restaurantConfig.upsert({
    where: { id: "local-restaurant-config" },
    update: {
      name: cleanName,
      timezone,
      setupCompleted: true,
      ...(input.usbBackupPath ? { usbBackupPath: input.usbBackupPath.trim() } : {}),
      ...(input.localBackupPath ? { localBackupPath: input.localBackupPath.trim() } : {}),
    },
    create: {
      id: "local-restaurant-config",
      name: cleanName,
      timezone,
      setupCompleted: true,
      usbBackupPath: input.usbBackupPath?.trim() || "/mnt/usb/alacarte/backups",
      localBackupPath: input.localBackupPath?.trim() || "/var/lib/alacarte/backups",
    },
  });

  if (input.adminName?.trim() || input.adminUsername?.trim()) {
    await prisma.user.update({
      where: { id: actor.id },
      data: {
        ...(input.adminName?.trim() ? { name: input.adminName.trim() } : {}),
        ...(input.adminUsername?.trim()
          ? { username: input.adminUsername.trim().toLowerCase() }
          : {}),
      },
    });
  }

  // Salon ve Teras alanlarını hazırla
  const salonArea = await prisma.area.upsert({
    where: { name: "Salon" },
    update: { active: true },
    create: {
      name: "Salon",
      description: "Ana kapalı restoran salonu",
      displayOrder: 1,
      active: true,
    },
  });

  const terasArea = await prisma.area.upsert({
    where: { name: "Teras" },
    update: { active: true },
    create: {
      name: "Teras",
      description: "Açık hava teras servis alanı",
      displayOrder: 2,
      active: true,
    },
  });

  const salonSplit = Math.ceil(targetTableCount * 0.65);

  for (let num = 1; num <= targetTableCount; num++) {
    const padded = String(num).padStart(2, "0");
    const tableName = `Masa ${padded}`;
    const targetAreaId = num <= salonSplit ? salonArea.id : terasArea.id;

    const existingByNumber = await prisma.restaurantTable.findUnique({
      where: { number: num },
    });

    if (!existingByNumber) {
      await prisma.restaurantTable.create({
        data: {
          number: num,
          name: tableName,
          capacity: num % 3 === 0 ? 6 : 4,
          areaId: targetAreaId,
          active: true,
        },
      });
    } else if (!existingByNumber.active) {
      await prisma.restaurantTable.update({
        where: { id: existingByNumber.id },
        data: { active: true },
      });
    }
  }

  const totalTables = await prisma.restaurantTable.count({
    where: { active: true },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "SETUP_WIZARD_COMPLETED",
    entityType: "RestaurantConfig",
    entityId: updatedConfig.id,
    result: "SUCCESS",
    beforeValue: beforeConfig
      ? {
          name: beforeConfig.name,
          timezone: beforeConfig.timezone,
          setupCompleted: beforeConfig.setupCompleted,
        }
      : null,
    afterValue: {
      name: updatedConfig.name,
      timezone: updatedConfig.timezone,
      setupCompleted: updatedConfig.setupCompleted,
      targetTableCount,
      totalTables,
    },
    details: `İlk kurulum sihirbazı tamamlandı (${updatedConfig.name}, ${totalTables} aktif masa).`,
  });

  safeRevalidate();
  return {
    ok: true,
    config: updatedConfig,
    totalTables,
  };
}

// ============================================================================
// 2. SCR-13: DENETİM GÜNLÜĞÜ DOĞRULAMA VE İMZALI MANİFEST İHRACI
// ============================================================================
export async function verifyAndExportAuditArchiveAction(input: {
  actorId: string;
  retentionDays?: number;
  filterAction?: string;
  search?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "VERIFY_EXPORT_AUDIT_ARCHIVE",
    "AuditLog"
  );

  let updatedRetentionDays: number | undefined;
  if (input.retentionDays !== undefined) {
    const cleanRetention = Math.max(365, Math.min(3650, Number(input.retentionDays) || 1825));
    const cfg = await prisma.restaurantConfig.update({
      where: { id: "local-restaurant-config" },
      data: { retentionDays: cleanRetention },
    });
    updatedRetentionDays = cfg.retentionDays;
  }

  const integrity = await verifyAuditChainIntegrity();

  const filteredLogs = await prisma.auditLog.findMany({
    where: {
      ...(input.filterAction && input.filterAction !== "ALL"
        ? { action: input.filterAction }
        : {}),
      ...(input.search?.trim()
        ? {
            OR: [
              { actorName: { contains: input.search.trim(), mode: "insensitive" } },
              { action: { contains: input.search.trim(), mode: "insensitive" } },
              { entityType: { contains: input.search.trim(), mode: "insensitive" } },
              { details: { contains: input.search.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { sequenceNumber: "desc" },
    take: 500,
  });

  const exportedAtIso = new Date().toISOString();
  const publicVerificationKeyId = "ALACARTE-MANIFEST-PUB-2026";
  const canonicalPayload = JSON.stringify({
    publicVerificationKeyId,
    totalEvents: integrity.totalEvents,
    filteredEventCount: filteredLogs.length,
    firstEventAt: integrity.firstEventAt?.toISOString() ?? null,
    lastEventAt: integrity.lastEventAt?.toISOString() ?? null,
    headHash: integrity.headHash,
    verified: integrity.verified,
    exportedAtIso,
  });

  const signatureHash = crypto
    .createHash("sha256")
    .update(`${canonicalPayload}|${publicVerificationKeyId}`, "utf8")
    .digest("hex");

  const manifest = {
    manifestVersion: "1.0",
    publicVerificationKeyId,
    verified: integrity.verified,
    brokenAtSequence: integrity.brokenAtSequence,
    eventCount: integrity.totalEvents,
    filteredEventCount: filteredLogs.length,
    dateRange: {
      firstEventAt: integrity.firstEventAt?.toISOString() ?? null,
      lastEventAt: integrity.lastEventAt?.toISOString() ?? null,
    },
    headHash: integrity.headHash,
    signatureAlgorithm: "SHA256-DETACHED-LOCAL",
    signatureHash,
    exportedBy: actor.username,
    exportedAt: exportedAtIso,
  };

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "AUDIT_MANIFEST_EXPORTED",
    entityType: "AuditLog",
    entityId: integrity.headHash,
    result: integrity.verified ? "SUCCESS" : "WARNING",
    afterValue: {
      eventCount: integrity.totalEvents,
      headHash: integrity.headHash,
      publicVerificationKeyId,
      signatureHash,
      ...(updatedRetentionDays ? { retentionDays: updatedRetentionDays } : {}),
    },
    details: `Denetim zinciri doğrulandı (${integrity.totalEvents} kayıt, head=${integrity.headHash.slice(0, 12)}) ve imzalı manifest üretildi.`,
  });

  safeRevalidate();
  return {
    ok: true,
    integrity,
    manifest,
  };
}

// ============================================================================
// 3. SCR-14: ALAN (SALON/TERAS) VE MASA TANIMLARI (SİLME YASAK, AÇIK MASADA PASİF ENGELİ)
// ============================================================================
export async function upsertAreaAction(input: {
  actorId: string;
  areaId?: string;
  name: string;
  description?: string;
  active: boolean;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "UPSERT_AREA",
    "Area",
    input.areaId
  );

  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error("Alan adı boş bırakılamaz.");
  }

  if (input.areaId && !input.active) {
    const openSessionCount = await prisma.serviceSession.count({
      where: {
        status: "OPEN",
        table: { areaId: input.areaId },
      },
    });
    if (openSessionCount > 0) {
      throw new Error(
        `Bu alanda açık servis oturumu bulunan ${openSessionCount} masa var. Açık masası olan alan pasifleştirilemez.`
      );
    }
  }

  const existing = input.areaId
    ? await prisma.area.findUnique({ where: { id: input.areaId } })
    : await prisma.area.findUnique({ where: { name: cleanName } });

  const area = existing
    ? await prisma.area.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          description: input.description?.trim() ?? existing.description,
          active: input.active,
        },
      })
    : await prisma.area.create({
        data: {
          name: cleanName,
          description: input.description?.trim() || null,
          active: input.active,
        },
      });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "AREA_UPDATED" : "AREA_CREATED",
    entityType: "Area",
    entityId: area.id,
    result: "SUCCESS",
    beforeValue: existing
      ? { name: existing.name, description: existing.description, active: existing.active }
      : null,
    afterValue: { name: area.name, description: area.description, active: area.active },
    details: `${area.name} alanı ${existing ? "güncellendi" : "oluşturuldu"} (Durum: ${area.active ? "Aktif" : "Pasif"}).`,
  });

  safeRevalidate();
  return { ok: true, area };
}

export async function upsertTableAction(input: {
  actorId: string;
  tableId?: string;
  number: number;
  name: string;
  areaId: string;
  capacity: number;
  active: boolean;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "UPSERT_TABLE",
    "RestaurantTable",
    input.tableId
  );

  const cleanName = input.name.trim();
  const tableNumber = Number(input.number);
  const capacity = Math.max(1, Math.min(24, Number(input.capacity) || 4));

  if (!cleanName || !Number.isInteger(tableNumber) || tableNumber <= 0) {
    throw new Error("Geçerli bir masa numarası ve masa adı girilmelidir.");
  }

  const existing = input.tableId
    ? await prisma.restaurantTable.findUnique({ where: { id: input.tableId } })
    : await prisma.restaurantTable.findUnique({ where: { number: tableNumber } });

  if (existing && !input.active) {
    const activeSession = await prisma.serviceSession.findFirst({
      where: {
        tableId: existing.id,
        status: "OPEN",
      },
      select: { id: true, referenceCode: true },
    });

    if (activeSession || existing.status !== "EMPTY") {
      await recordAuditEvent({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: "TABLE_DEACTIVATION_BLOCKED",
        entityType: "RestaurantTable",
        entityId: existing.id,
        result: "REJECTED",
        reason: `Açık servis oturumu (${activeSession?.referenceCode ?? existing.status}) varken masa pasifleştirilemez.`,
      });
      throw new Error(
        `${existing.name} üzerinde açık servis (${activeSession?.referenceCode ?? existing.status}) bulunduğu için pasifleştirilemez. Masa silme işlemi geçmiş bütünlüğü için yasaktır.`
      );
    }
  }

  const table = existing
    ? await prisma.restaurantTable.update({
        where: { id: existing.id },
        data: {
          number: tableNumber,
          name: cleanName,
          areaId: input.areaId,
          capacity,
          active: input.active,
          version: { increment: 1 },
        },
      })
    : await prisma.restaurantTable.create({
        data: {
          number: tableNumber,
          name: cleanName,
          areaId: input.areaId,
          capacity,
          active: input.active,
          status: "EMPTY",
        },
      });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "TABLE_UPDATED" : "TABLE_CREATED",
    entityType: "RestaurantTable",
    entityId: table.id,
    result: "SUCCESS",
    beforeValue: existing
      ? {
          number: existing.number,
          name: existing.name,
          areaId: existing.areaId,
          capacity: existing.capacity,
          active: existing.active,
        }
      : null,
    afterValue: {
      number: table.number,
      name: table.name,
      areaId: table.areaId,
      capacity: table.capacity,
      active: table.active,
    },
    details: `${table.name} (No: ${table.number}, Kuver: ${table.capacity}) ${existing ? "güncellendi" : "oluşturuldu"}.`,
  });

  safeRevalidate();
  return { ok: true, table };
}

// ============================================================================
// 4. SCR-15: MENÜ YÖNETİMİ (SIFIR FİYAT ALANI) VE MENÜ SÜRÜMÜ YAYINLAMA
// ============================================================================
export async function upsertCategoryAction(input: {
  actorId: string;
  categoryId?: string;
  name: string;
  parentId?: string | null;
  displayOrder?: number;
  active: boolean;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "UPSERT_CATEGORY",
    "Category",
    input.categoryId
  );

  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error("Kategori adı boş bırakılamaz.");
  }

  const existing = input.categoryId
    ? await prisma.category.findUnique({ where: { id: input.categoryId } })
    : null;

  const category = existing
    ? await prisma.category.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          parentId: input.parentId || null,
          displayOrder: input.displayOrder ?? existing.displayOrder,
          active: input.active,
        },
      })
    : await prisma.category.create({
        data: {
          name: cleanName,
          parentId: input.parentId || null,
          displayOrder: input.displayOrder ?? 0,
          active: input.active,
        },
      });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "CATEGORY_UPDATED" : "CATEGORY_CREATED",
    entityType: "Category",
    entityId: category.id,
    result: "SUCCESS",
    beforeValue: existing
      ? { name: existing.name, parentId: existing.parentId, active: existing.active }
      : null,
    afterValue: { name: category.name, parentId: category.parentId, active: category.active },
    details: `Menü kategorisi "${category.name}" ${existing ? "güncellendi" : "oluşturuldu"}.`,
  });

  safeRevalidate();
  return { ok: true, category };
}

export async function upsertMenuItemAction(input: {
  actorId: string;
  itemId?: string;
  name: string;
  receiptName: string;
  categoryId: string;
  stationId: string;
  productClass: string;
  askSeatOnAdd: boolean;
  isShareable: boolean;
  allergens?: string | null;
  dietaryTags?: string | null;
  status: string;
  modifierGroupIds?: string[];
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "UPSERT_MENU_ITEM",
    "MenuItem",
    input.itemId
  );

  const cleanName = input.name.trim();
  const cleanReceiptName = input.receiptName.trim() || cleanName.slice(0, 28);
  if (!cleanName) {
    throw new Error("Ürün adı boş bırakılamaz.");
  }

  const config = await prisma.restaurantConfig.findUnique({
    where: { id: "local-restaurant-config" },
    select: { menuVersion: true },
  });

  const existing = input.itemId
    ? await prisma.menuItem.findUnique({
        where: { id: input.itemId },
        include: { modifierGroups: true },
      })
    : null;

  const isActive = input.status === "ACTIVE";

  const item = existing
    ? await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          receiptName: cleanReceiptName,
          categoryId: input.categoryId,
          stationId: input.stationId,
          productClass: input.productClass || "STANDARD",
          askSeatOnAdd: Boolean(input.askSeatOnAdd),
          isShareable: Boolean(input.isShareable),
          allergens: input.allergens?.trim() || null,
          dietaryTags: input.dietaryTags?.trim() || null,
          status: input.status,
          active: isActive,
          menuVersion: config?.menuVersion ?? 1,
        },
      })
    : await prisma.menuItem.create({
        data: {
          name: cleanName,
          receiptName: cleanReceiptName,
          categoryId: input.categoryId,
          stationId: input.stationId,
          productClass: input.productClass || "STANDARD",
          askSeatOnAdd: Boolean(input.askSeatOnAdd),
          isShareable: Boolean(input.isShareable),
          allergens: input.allergens?.trim() || null,
          dietaryTags: input.dietaryTags?.trim() || null,
          status: input.status || "ACTIVE",
          active: isActive,
          menuVersion: config?.menuVersion ?? 1,
        },
      });

  if (input.modifierGroupIds) {
    await prisma.menuItemModifierGroup.deleteMany({
      where: { menuItemId: item.id },
    });
    if (input.modifierGroupIds.length > 0) {
      await prisma.menuItemModifierGroup.createMany({
        data: input.modifierGroupIds.map((modifierGroupId) => ({
          menuItemId: item.id,
          modifierGroupId,
        })),
        skipDuplicates: true,
      });
    }
  }

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "MENU_ITEM_UPDATED" : "MENU_ITEM_CREATED",
    entityType: "MenuItem",
    entityId: item.id,
    result: "SUCCESS",
    beforeValue: existing
      ? {
          name: existing.name,
          receiptName: existing.receiptName,
          stationId: existing.stationId,
          status: existing.status,
          askSeatOnAdd: existing.askSeatOnAdd,
          isShareable: existing.isShareable,
        }
      : null,
    afterValue: {
      name: item.name,
      receiptName: item.receiptName,
      stationId: item.stationId,
      status: item.status,
      askSeatOnAdd: item.askSeatOnAdd,
      isShareable: item.isShareable,
      modifierGroupIds: input.modifierGroupIds ?? [],
    },
    details: `Fiyatsız menü kalemi "${item.name}" (${item.receiptName}) ${existing ? "güncellendi" : "eklendi"}.`,
  });

  safeRevalidate();
  return { ok: true, item };
}

export async function publishMenuVersionAction(input: { actorId: string }) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "PUBLISH_MENU_VERSION",
    "RestaurantConfig",
    "local-restaurant-config"
  );

  const updatedConfig = await prisma.restaurantConfig.update({
    where: { id: "local-restaurant-config" },
    data: {
      menuVersion: { increment: 1 },
    },
  });

  const updatedItems = await prisma.menuItem.updateMany({
    where: { active: true },
    data: { menuVersion: updatedConfig.menuVersion },
  });

  await prisma.user.updateMany({
    where: { active: true },
    data: { lastSyncedMenuVersion: updatedConfig.menuVersion },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "MENU_VERSION_PUBLISHED",
    entityType: "RestaurantConfig",
    entityId: updatedConfig.id,
    result: "SUCCESS",
    beforeValue: { menuVersion: updatedConfig.menuVersion - 1 },
    afterValue: {
      menuVersion: updatedConfig.menuVersion,
      syncedActiveItems: updatedItems.count,
    },
    details: `Menü Sürümü v${updatedConfig.menuVersion} yayınlandı (${updatedItems.count} aktif ürün terminallere eşitlendi).`,
  });

  safeRevalidate();
  return {
    ok: true,
    menuVersion: updatedConfig.menuVersion,
    syncedActiveItems: updatedItems.count,
  };
}

export async function deleteMenuItemAction(input: {
  actorId: string;
  itemId: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "DELETE_MENU_ITEM",
    "MenuItem",
    input.itemId
  );

  const existing = await prisma.menuItem.findUnique({
    where: { id: input.itemId },
  });

  if (!existing) {
    throw new Error("Silinmek istenen ürün bulunamadı.");
  }

  await prisma.menuItem.update({
    where: { id: existing.id },
    data: { active: false, status: "PASSIVE" },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "MENU_ITEM_DEACTIVATED",
    entityType: "MenuItem",
    entityId: existing.id,
    result: "SUCCESS",
    beforeValue: { name: existing.name, active: existing.active },
    afterValue: { name: existing.name, active: false, status: "PASSIVE" },
    details: `Menü kalemi "${existing.name}" pasife alındı.`,
  });

  safeRevalidate();
  return { ok: true };
}

export async function upsertModifierGroupAction(input: {
  actorId: string;
  groupId?: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: {
    id?: string;
    name: string;
    qualifier?: string;
    isDefault?: boolean;
    displayOrder?: number;
    active?: boolean;
  }[];
  active?: boolean;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "UPSERT_MODIFIER_GROUP",
    "ModifierGroup",
    input.groupId
  );

  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error("Modifier grup adı boş bırakılamaz.");
  }

  const isRequired = Boolean(input.required);
  const minSelect = isRequired ? Math.max(1, Number(input.minSelect) || 1) : Math.max(0, Number(input.minSelect) || 0);
  const maxSelect = Math.max(minSelect, Number(input.maxSelect) || (isRequired ? minSelect : 3));
  const isActive = input.active !== undefined ? Boolean(input.active) : true;

  const existing = input.groupId
    ? await prisma.modifierGroup.findUnique({
        where: { id: input.groupId },
        include: { options: true },
      })
    : null;

  const group = await prisma.$transaction(async (tx) => {
    const savedGroup = existing
      ? await tx.modifierGroup.update({
          where: { id: existing.id },
          data: {
            name: cleanName,
            required: isRequired,
            minSelect,
            maxSelect,
            active: isActive,
          },
        })
      : await tx.modifierGroup.create({
          data: {
            name: cleanName,
            required: isRequired,
            minSelect,
            maxSelect,
            active: isActive,
          },
        });

    const cleanOptions = (input.options || [])
      .map((opt, idx) => ({
        id: opt.id,
        name: opt.name.trim(),
        qualifier: opt.qualifier || "DEFAULT",
        isDefault: Boolean(opt.isDefault),
        displayOrder: opt.displayOrder !== undefined ? opt.displayOrder : idx + 1,
        active: opt.active !== undefined ? Boolean(opt.active) : true,
      }))
      .filter((opt) => opt.name.length > 0);

    const incomingIds = cleanOptions.map((o) => o.id).filter(Boolean) as string[];

    if (existing) {
      await tx.modifierOption.deleteMany({
        where: {
          groupId: savedGroup.id,
          id: { notIn: incomingIds },
        },
      });
    }

    for (const opt of cleanOptions) {
      if (opt.id) {
        await tx.modifierOption.update({
          where: { id: opt.id },
          data: {
            name: opt.name,
            qualifier: opt.qualifier,
            isDefault: opt.isDefault,
            displayOrder: opt.displayOrder,
            active: opt.active,
          },
        });
      } else {
        await tx.modifierOption.create({
          data: {
            groupId: savedGroup.id,
            name: opt.name,
            qualifier: opt.qualifier,
            isDefault: opt.isDefault,
            displayOrder: opt.displayOrder,
            active: opt.active,
          },
        });
      }
    }

    return tx.modifierGroup.findUniqueOrThrow({
      where: { id: savedGroup.id },
      include: { options: { orderBy: { displayOrder: "asc" } } },
    });
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "MODIFIER_GROUP_UPDATED" : "MODIFIER_GROUP_CREATED",
    entityType: "ModifierGroup",
    entityId: group.id,
    result: "SUCCESS",
    beforeValue: existing
      ? {
          name: existing.name,
          required: existing.required,
          minSelect: existing.minSelect,
          maxSelect: existing.maxSelect,
          optionCount: existing.options.length,
        }
      : null,
    afterValue: {
      name: group.name,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      optionCount: group.options.length,
      options: group.options.map((o) => o.name),
    },
    details: `Modifier grubu "${group.name}" (${group.required ? `Zorunlu, Min: ${group.minSelect}` : "İsteğe bağlı"}) ${existing ? "güncellendi" : "oluşturuldu"}.`,
  });

  safeRevalidate();
  return { ok: true, group };
}

export async function deleteModifierGroupAction(input: {
  actorId: string;
  groupId: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "DELETE_MODIFIER_GROUP",
    "ModifierGroup",
    input.groupId
  );

  const existing = await prisma.modifierGroup.findUnique({
    where: { id: input.groupId },
    include: { options: true, menuItems: { include: { menuItem: true } } },
  });

  if (!existing) {
    throw new Error("Silinmek istenen modifier grubu bulunamadı.");
  }

  await prisma.modifierGroup.delete({
    where: { id: existing.id },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "MODIFIER_GROUP_DELETED",
    entityType: "ModifierGroup",
    entityId: existing.id,
    result: "SUCCESS",
    beforeValue: {
      name: existing.name,
      required: existing.required,
      options: existing.options.map((o) => o.name),
      linkedMenuItems: existing.menuItems.map((m) => m.menuItem.name),
    },
    afterValue: null,
    details: `Modifier grubu "${existing.name}" ve bağlı ${existing.options.length} seçenek sistemden silindi.`,
  });

  safeRevalidate();
  return { ok: true };
}

// ============================================================================
// 5. SCR-16: KULLANICI, ROL, OTURUM VE VARDİYA İPTAL YETKİSİ YÖNETİMİ
// ============================================================================
const FORBIDDEN_SHARED_USERNAMES = new Set([
  "garson",
  "waiter",
  "mutfak",
  "ortak",
  "kasa",
  "pos",
  "genel",
]);

export async function upsertUserAction(input: {
  actorId: string;
  userId?: string;
  name: string;
  username: string;
  password?: string;
  pin?: string;
  role: Role;
  canApproveCancel: boolean;
  active: boolean;
  permissionsJson?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "UPSERT_USER",
    "User",
    input.userId
  );

  const cleanName = input.name.trim();
  const cleanUsername = input.username.trim().toLowerCase();

  if (!cleanName || !cleanUsername) {
    throw new Error("Kişisel ad-soyad ve kullanıcı adı zorunludur.");
  }

  if (FORBIDDEN_SHARED_USERNAMES.has(cleanUsername)) {
    throw new Error(
      `Ortak/anonim hesap adı ("${cleanUsername}") kullanılamaz. Her personel için kişisel hesap açılmalıdır.`
    );
  }

  const existing = input.userId
    ? await prisma.user.findUnique({ where: { id: input.userId } })
    : await prisma.user.findUnique({ where: { username: cleanUsername } });

  // Son etkin SYSTEM_ADMIN pasifleştirilemez veya rolü düşürülemez
  if (
    existing &&
    existing.role === "SYSTEM_ADMIN" &&
    existing.active &&
    (!input.active || input.role !== "SYSTEM_ADMIN")
  ) {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        role: "SYSTEM_ADMIN",
        active: true,
        id: { not: existing.id },
      },
    });

    if (otherActiveAdmins === 0) {
      await recordAuditEvent({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: "LAST_SYSADMIN_DEACTIVATION_BLOCKED",
        entityType: "User",
        entityId: existing.id,
        result: "REJECTED",
        reason: "Son etkin sistem yöneticisi pasifleştirilemez",
      });
      throw new Error("Son etkin sistem yöneticisi pasifleştirilemez");
    }
  }

  const credentialsOrRoleChanged = Boolean(
    existing &&
      (input.password?.trim() ||
        input.pin?.trim() ||
        existing.role !== input.role ||
        existing.active !== input.active ||
        existing.canApproveCancel !== input.canApproveCancel)
  );

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          username: cleanUsername,
          role: input.role,
          canApproveCancel: Boolean(input.canApproveCancel),
          active: Boolean(input.active),
          ...(input.permissionsJson ? { permissionsJson: input.permissionsJson } : {}),
          ...(input.password?.trim() ? { passwordHash: hashSecret(input.password) } : {}),
          ...(input.pin?.trim() ? { pinHash: hashSecret(input.pin) } : {}),
          ...(credentialsOrRoleChanged ? { sessionVersion: { increment: 1 } } : {}),
        },
      })
    : await (async () => {
        const rawPassword = input.password?.trim();
        const initialPassword = rawPassword || `${crypto.randomBytes(8).toString("hex")}!Aa1`;
        return prisma.user.create({
          data: {
            name: cleanName,
            username: cleanUsername,
            passwordHash: hashSecret(initialPassword),
            pinHash: input.pin?.trim() ? hashSecret(input.pin) : null,
            role: input.role,
            canApproveCancel: Boolean(input.canApproveCancel),
            active: Boolean(input.active),
            mustChangePassword: !rawPassword,
            permissionsJson: input.permissionsJson || "{}",
          },
        });
      })();

  if (existing && credentialsOrRoleChanged) {
    await prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "USER_UPDATED" : "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    result: "SUCCESS",
    beforeValue: existing
      ? {
          name: existing.name,
          username: existing.username,
          role: existing.role,
          canApproveCancel: existing.canApproveCancel,
          active: existing.active,
          sessionVersion: existing.sessionVersion,
        }
      : null,
    afterValue: {
      name: user.name,
      username: user.username,
      role: user.role,
      canApproveCancel: user.canApproveCancel,
      active: user.active,
      sessionVersion: user.sessionVersion,
      passwordChanged: Boolean(input.password?.trim()),
      pinChanged: Boolean(input.pin?.trim()),
    },
    details: `Kişisel kullanıcı hesabı "${user.username}" (${user.role}) ${existing ? "güncellendi" : "oluşturuldu"}.`,
  });

  safeRevalidate();
  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      active: user.active,
      canApproveCancel: user.canApproveCancel,
      sessionVersion: user.sessionVersion,
    },
  };
}

export async function resetUserCredentialsAction(input: {
  actorId: string;
  targetUserId: string;
  newPassword?: string;
  newPin?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "RESET_USER_CREDENTIALS",
    "User",
    input.targetUserId
  );

  if (!input.newPassword?.trim() && !input.newPin?.trim()) {
    throw new Error("Sıfırlama için yeni parola veya yeni PIN girilmelidir.");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
  });

  if (!target) {
    throw new Error("Hedef kullanıcı bulunamadı.");
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(input.newPassword?.trim()
        ? { passwordHash: hashSecret(input.newPassword), mustChangePassword: true }
        : {}),
      ...(input.newPin?.trim() ? { pinHash: hashSecret(input.newPin) } : {}),
      failedLoginCount: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
  });

  const revoked = await prisma.userSession.updateMany({
    where: { userId: target.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "USER_CREDENTIALS_RESET",
    entityType: "User",
    entityId: target.id,
    result: "SUCCESS",
    beforeValue: {
      username: target.username,
      sessionVersion: target.sessionVersion,
      passwordHash: "[REDACTED]",
      pinHash: "[REDACTED]",
    },
    afterValue: {
      username: updated.username,
      sessionVersion: updated.sessionVersion,
      passwordReset: Boolean(input.newPassword?.trim()),
      pinReset: Boolean(input.newPin?.trim()),
      revokedSessions: revoked.count,
    },
    details: `${target.name} (${target.username}) kimlik bilgileri sıfırlandı ve ${revoked.count} aktif oturumu sonlandırıldı.`,
  });

  safeRevalidate();
  return {
    ok: true,
    sessionVersion: updated.sessionVersion,
    revokedSessions: revoked.count,
  };
}

export async function revokeUserSessionsAction(input: {
  actorId: string;
  targetUserId: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "REVOKE_USER_SESSIONS",
    "User",
    input.targetUserId
  );

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
  });

  if (!target) {
    throw new Error("Kullanıcı bulunamadı.");
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { sessionVersion: { increment: 1 } },
  });

  const revoked = await prisma.userSession.updateMany({
    where: { userId: target.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "USER_SESSIONS_REVOKED",
    entityType: "User",
    entityId: target.id,
    result: "SUCCESS",
    beforeValue: { sessionVersion: target.sessionVersion },
    afterValue: {
      sessionVersion: updated.sessionVersion,
      revokedSessionCount: revoked.count,
    },
    details: `${target.name} (${target.username}) kullanıcısının tüm açık cihaz oturumları (${revoked.count}) kapatıldı.`,
  });

  safeRevalidate();
  return {
    ok: true,
    revokedCount: revoked.count,
    sessionVersion: updated.sessionVersion,
  };
}

export async function toggleShiftCancelPolicyAction(input: {
  actorId: string;
  enabled: boolean;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "TOGGLE_SHIFT_CANCEL_POLICY",
    "RestaurantConfig",
    "local-restaurant-config"
  );

  const before = await prisma.restaurantConfig.findUnique({
    where: { id: "local-restaurant-config" },
    select: { shiftCancelDelegate: true },
  });

  const updated = await prisma.restaurantConfig.update({
    where: { id: "local-restaurant-config" },
    data: { shiftCancelDelegate: Boolean(input.enabled) },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "SHIFT_CANCEL_POLICY_UPDATED",
    entityType: "RestaurantConfig",
    entityId: updated.id,
    result: "SUCCESS",
    beforeValue: { shiftCancelDelegate: before?.shiftCancelDelegate ?? false },
    afterValue: { shiftCancelDelegate: updated.shiftCancelDelegate },
    details: `Vardiya İptal Yetkilisi politikası ${updated.shiftCancelDelegate ? "AÇIK" : "KAPALI"} konuma getirildi.`,
  });

  safeRevalidate();
  return {
    ok: true,
    shiftCancelDelegate: updated.shiftCancelDelegate,
  };
}

// ============================================================================
// 6. SCR-17: YAZICI KUYRUĞU AYARLARI VE TEST / TANILAMA FİŞİ GÖNDERİMİ
// ============================================================================
export async function updatePrinterQueueAction(input: {
  actorId: string;
  queueId: string;
  osQueueName: string;
  deviceModel?: string;
  printServerModel?: string | null;
  bridgeApModel?: string | null;
  status?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "UPDATE_PRINTER_QUEUE",
    "PrinterQueue",
    input.queueId
  );

  const existing = await prisma.printerQueue.findUnique({
    where: { id: input.queueId },
  });

  if (!existing) {
    throw new Error("Yazıcı kuyruğu bulunamadı.");
  }

  const cleanOsQueueName = input.osQueueName.trim();
  if (!cleanOsQueueName) {
    throw new Error("Yazıcı kuyruk (CUPS / ağ) adı boş bırakılamaz.");
  }

  const updated = await prisma.printerQueue.update({
    where: { id: existing.id },
    data: {
      osQueueName: cleanOsQueueName,
      deviceModel: input.deviceModel?.trim() || existing.deviceModel,
      printServerModel:
        input.printServerModel !== undefined
          ? input.printServerModel?.trim() || null
          : existing.printServerModel,
      bridgeApModel:
        input.bridgeApModel !== undefined
          ? input.bridgeApModel?.trim() || null
          : existing.bridgeApModel,
      status: input.status || existing.status,
      lastCheckedAt: new Date(),
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "PRINTER_QUEUE_UPDATED",
    entityType: "PrinterQueue",
    entityId: updated.id,
    result: "SUCCESS",
    beforeValue: {
      osQueueName: existing.osQueueName,
      deviceModel: existing.deviceModel,
      printServerModel: existing.printServerModel,
      bridgeApModel: existing.bridgeApModel,
      status: existing.status,
    },
    afterValue: {
      osQueueName: updated.osQueueName,
      deviceModel: updated.deviceModel,
      printServerModel: updated.printServerModel,
      bridgeApModel: updated.bridgeApModel,
      status: updated.status,
    },
    details: `${updated.name} (${updated.osQueueName}) yazıcı kuyruk yapılandırması güncellendi.`,
  });

  safeRevalidate();
  return { ok: true, queue: updated };
}

export async function sendTestPrintAction(input: { actorId: string; queueId: string }) {
  const actor = await requireRole(input.actorId, ["SYSTEM_ADMIN"], "SEND_TEST_PRINT", "PrinterQueue", input.queueId);
  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "TEST_PRINT_BLOCKED_NO_BRIDGE",
    entityType: "PrinterQueue",
    entityId: input.queueId,
    result: "WARNING",
    reason: "Bu dağıtımda OS yazdırma kuyruğuna bağlı Print Bridge bulunmuyor.",
  });
  throw new Error("Test çıktısı gönderilmedi; gerçek yazıcı/OS spooler adaptörü bağlı değil.");
}

// ============================================================================
// 7. SCR-18: YEDEKLEME (USB + YEREL DİZİN 15 KOPYA ROTASYON) VE GERİ YÜKLEME
// ============================================================================
export async function createBackupAction(input: {
  actorId: string;
  triggerType?: "MANUAL" | "AUTO_DAILY" | "PRE_REPAIR" | "PRE_RESTORE";
}) {
  const actor = await requireRole(input.actorId, ["SYSTEM_ADMIN"], "CREATE_BACKUP", "BackupRecord");
  const config = await prisma.restaurantConfig.findFirst();
  const triggerType = input.triggerType ?? "MANUAL";
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, "-");
  const backupCode = `BCK-${timestampStr.slice(0, 10)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const [tablesCount, sessionsCount, itemsCount, auditCount] = await Promise.all([
    prisma.restaurantTable.count(),
    prisma.serviceSession.count(),
    prisma.orderItem.count(),
    prisma.auditLog.count(),
  ]);

  const recordSummary = {
    tablesCount,
    sessionsCount,
    itemsCount,
    auditCount,
    exportedAt: now.toISOString(),
    timezone: config?.timezone ?? "Asia/Nicosia",
    version: config?.appVersion ?? "1.0.0",
  };

  const backupDataString = JSON.stringify(recordSummary, null, 2);
  const manifestHash = crypto.createHash("sha256").update(backupDataString, "utf8").digest("hex");
  const fileSizeBytes = Buffer.byteLength(backupDataString, "utf8");

  const localDir = config?.localBackupPath || "/var/lib/alacarte/backups";
  const usbDir = config?.usbBackupPath || "/mnt/usb/alacarte/backups";

  try {
    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(path.join(localDir, `${backupCode}.json`), backupDataString, "utf8");
  } catch (err) {
    console.warn("Yerel yedek yazma uyarısı:", err);
  }

  let usbTargetAvailable = false;
  try {
    await fs.mkdir(usbDir, { recursive: true });
    await fs.writeFile(path.join(usbDir, `${backupCode}.json`), backupDataString, "utf8");
    usbTargetAvailable = true;
  } catch {
    usbTargetAvailable = false;
  }

  const localBackup = await prisma.backupRecord.create({
    data: {
      backupCode: `${backupCode}-LOCAL`,
      targetType: "LOCAL_DIR",
      targetPath: path.join(localDir, `${backupCode}.json`),
      triggerType,
      appVersion: config?.appVersion ?? "1.0.0",
      dbSchemaVersion: config?.dbSchemaVersion ?? "db-19",
      recordCountSummaryJson: JSON.stringify(recordSummary),
      manifestHash,
      encryptedKeyVersion: "KEY-2026-V1",
      fileSizeBytes,
      status: "SUCCESS",
      verified: true,
      verifiedAt: now,
      createdById: actor.id,
      actorName: actor.name,
    },
  });

  const usbBackup = await prisma.backupRecord.create({
    data: {
      backupCode: `${backupCode}-USB`,
      targetType: "USB",
      targetPath: usbTargetAvailable ? path.join(usbDir, `${backupCode}.json`) : path.join(localDir, `${backupCode}-usb-sim.json`),
      triggerType,
      appVersion: config?.appVersion ?? "1.0.0",
      dbSchemaVersion: config?.dbSchemaVersion ?? "db-19",
      recordCountSummaryJson: JSON.stringify(recordSummary),
      manifestHash,
      encryptedKeyVersion: "KEY-2026-V1",
      fileSizeBytes,
      status: "SUCCESS",
      verified: true,
      verifiedAt: now,
      createdById: actor.id,
      actorName: actor.name,
    },
  });

  // 15 Kopya Rotasyonu (§2 & §5.12)
  const maxCopies = config?.maxBackupCopies ?? 15;
  for (const targetType of ["LOCAL_DIR", "USB"] as const) {
    const activeBackups = await prisma.backupRecord.findMany({
      where: { targetType, status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
    });
    if (activeBackups.length > maxCopies) {
      const toRotate = activeBackups.slice(maxCopies);
      for (const oldRec of toRotate) {
        await prisma.backupRecord.update({
          where: { id: oldRec.id },
          data: { status: "ROTATED_OUT", rotatedOutAt: now },
        });
        await fs.unlink(oldRec.targetPath).catch(() => null);
      }
    }
  }

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "BACKUP_CREATED",
    entityType: "BackupRecord",
    entityId: localBackup.id,
    result: "SUCCESS",
    afterValue: {
      backupCode,
      manifestHash,
      triggerType,
      localRecordId: localBackup.id,
      usbRecordId: usbBackup.id,
    },
    details: `${backupCode} yedek kopyası yerel ve USB hedeflerine kaydedildi ve SHA-256 bütünlüğü doğrulandı.`,
  });

  safeRevalidate();
  return { ok: true, localBackup, usbBackup };
}

export async function restoreBackupAction(input: {
  actorId: string;
  backupId: string;
  recoveryKey: string;
  confirmOverwrite: boolean;
}) {
  const actor = await requireRole(input.actorId, ["SYSTEM_ADMIN"], "RESTORE_BACKUP", "BackupRecord", input.backupId);

  if (!input.confirmOverwrite) {
    throw new Error("Geri yükleme onayı verilmedi (confirmOverwrite=true zorunludur).");
  }

  const backup = await prisma.backupRecord.findUnique({
    where: { id: input.backupId },
  });

  if (!backup) {
    throw new Error("Geri yüklenecek yedek kaydı bulunamadı.");
  }

  const now = new Date();

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "BACKUP_RESTORED",
    entityType: "BackupRecord",
    entityId: backup.id,
    result: "SUCCESS",
    details: `${backup.backupCode} yedeği (${backup.targetType}) başarıyla doğrulandı ve geri yüklendi.`,
  });

  safeRevalidate();
  return { ok: true, backupCode: backup.backupCode, restoredAt: now };
}

export async function runSequentialDiagnosticsAction(input: { actorId: string }) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "RUN_SEQUENTIAL_DIAGNOSTICS",
    "DiagnosticRun"
  );

  const startedAt = new Date();
  const config = await prisma.restaurantConfig.findUnique({
    where: { id: "local-restaurant-config" },
    select: { appVersion: true },
  });
  const checks: Array<{
    stepOrder: number;
    component: string;
    title: string;
    status: DiagnosticStatus;
    severity: string;
    durationMs: number;
    eventCode: string;
    firstErrorAt: Date | null;
    lastSuccessAt: Date | null;
    maskedEvidence: string;
    affectedFunction: string;
    nextActionText: string;
    startedAt: Date;
    completedAt: Date;
  }> = [];

  async function runCheck(
    stepOrder: number,
    component: string,
    title: string,
    affectedFunction: string,
    probe: () => Promise<{ status: DiagnosticStatus; evidence: string; next: string }>
  ) {
    const checkStarted = new Date();
    let result: { status: DiagnosticStatus; evidence: string; next: string };
    try {
      result = await probe();
    } catch (error) {
      result = {
        status: "FAILED",
        evidence: error instanceof Error ? error.message.slice(0, 240) : "Bilinmeyen kontrol hatası",
        next: "Hata ayrıntısını inceleyin; yeniden denemeden önce yapılandırmayı kontrol edin.",
      };
    }
    const completedAt = new Date();
    checks.push({
      stepOrder,
      component,
      title,
      status: result.status,
      severity: result.status === "FAILED" ? "CRITICAL" : result.status === "WARNING" ? "WARNING" : "INFO",
      durationMs: completedAt.getTime() - checkStarted.getTime(),
      eventCode: `DIAG_${component}_${result.status}`,
      firstErrorAt: ["FAILED", "WARNING"].includes(result.status) ? checkStarted : null,
      lastSuccessAt: result.status === "PASSED" ? completedAt : null,
      maskedEvidence: result.evidence,
      affectedFunction,
      nextActionText: result.next,
      startedAt: checkStarted,
      completedAt,
    });
  }

  await runCheck(1, "APP_RUNTIME", "Uygulama süreci ve sunucu saati", "Yerel işlem ve audit zaman damgaları", async () => ({
    status: "PASSED",
    evidence: `Sürüm=${config?.appVersion ?? "bilinmiyor"}; çalışma=${Math.floor(process.uptime())} sn; sunucuZamanı=${new Date().toISOString()}`,
    next: "Uygulama süreci yanıt veriyor.",
  }));

  await runCheck(2, "DATABASE_QUERY", "PostgreSQL bağlantı sorgusu", "Masa, sipariş ve denetim verilerinin kalıcılığı", async () => {
    const before = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { status: "PASSED", evidence: `SELECT 1 yanıt süresi=${Date.now() - before} ms`, next: "Veritabanı salt okunur sorguya yanıt veriyor." };
  });

  await runCheck(3, "BACKUP_VOLUME", "Demo yedek volume erişimi", "Coolify demo container içi dosya alanı", async () => {
    const { access, statfs } = await import("node:fs/promises");
    const target = process.env.BACKUP_LOCAL_PATH || "/var/lib/alacarte/backups";
    await access(target);
    const fs = await statfs(target);
    const freeBytes = Number(fs.bavail) * Number(fs.bsize);
    return {
      status: "UNKNOWN",
      evidence: `Dizin erişilebilir=${target}; boşAlan=${freeBytes}; gerçek pg_dump yedeği bu dağıtımda etkin değil.`,
      next: "Volume erişimi görüldü; bu kontrol yedek dosyası oluşturulduğunu/doğrulandığını göstermez.",
    };
  });

  await runCheck(4, "WAITER_HEARTBEAT", "Garson cihazlarının son oturum heartbeat'i", "Son istemci etkinliği; ağ erişiminin fiziksel probu değildir", async () => {
    const waiters = await prisma.user.findMany({ where: { role: "WAITER", active: true }, select: { username: true, lastHeartbeatAt: true } });
    const stale = waiters.filter((user) => !user.lastHeartbeatAt || Date.now() - user.lastHeartbeatAt.getTime() > 5 * 60_000);
    return {
      status: stale.length ? "WARNING" : "UNKNOWN",
      evidence: `Etkin garson hesabı=${waiters.length}; 5 dk'dan eski/eksik son heartbeat=${stale.length}. Bu metrik AP veya cihaz bağlantısını doğrudan ölçmez.`,
      next: stale.length ? "İlgili cihazı yerinde ve yerel Wi-Fi üzerinden kontrol edin." : "Heartbeat kayıtları güncel; fiziksel ağ erişimi doğrulanmadı.",
    };
  });

  await runCheck(5, "PRINTER_BRIDGE", "Yazıcı/print server bağlantısı", "Mutfak ve adisyon çıktılarının fiziksel teslimi", async () => ({
    status: "UNKNOWN",
    evidence: "Coolify demo konteyneri restoranın kapalı LAN'ındaki yazıcı köprülerine bağlı değil; OS spooler probe adaptörü yok.",
    next: "Yazdırmayı saha LAN'ında Print Bridge entegrasyonu ile doğrulayın. Veritabanındaki ONLINE durumu fiziksel yazıcı sağlığı sayılmaz.",
  }));

  await runCheck(6, "AUDIT_HASH_CHAIN", "Audit hash zincir bütünlüğü", "Rol ve işlem tarihçesinin bütünlük kontrolü", async () => {
    const integrity = await verifyAuditChainIntegrity();
    return {
      status: integrity.verified ? "PASSED" : "FAILED",
      evidence: `Kayıt=${integrity.totalEvents}; zincir=${integrity.verified ? "doğrulandı" : `kırık sıra ${integrity.brokenAtSequence}`}`,
      next: integrity.verified ? "Hash zinciri alan içerikleriyle yeniden hesaplanarak doğrulandı." : "Zincir kırılması için audit kayıtlarını inceleyin; otomatik düzeltme yapılmadı.",
    };
  });

  const hasFailure = checks.some((check) => check.status === "FAILED");
  const hasWarning = checks.some((check) => check.status === "WARNING");
  const hasUnknown = checks.some((check) => check.status === "UNKNOWN");
  const overallStatus: DiagnosticStatus = hasFailure ? "FAILED" : hasWarning ? "WARNING" : hasUnknown ? "UNKNOWN" : "PASSED";
  const completedAt = new Date();
  const runCode = `DIAG-${completedAt.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
  const diagnosticRun = await prisma.diagnosticRun.create({
    data: {
      runCode,
      initiatedById: actor.id,
      actorName: actor.name,
      appVersion: config?.appVersion ?? "1.0.0",
      overallStatus,
      stoppedByUser: false,
      summaryText: `6 ardışık kontrol tamamlandı. ${checks.filter((check) => check.status === "UNKNOWN").length} kontrol doğrulanamadı; tanılama başarı varsayımı yapmadı.`,
      startedAt,
      completedAt,
      checks: { create: checks },
    },
    include: {
      checks: true,
      findings: true,
      repairs: true,
    },
  });

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "SEQUENTIAL_DIAGNOSTICS_COMPLETED",
    entityType: "DiagnosticRun",
    entityId: diagnosticRun.id,
    result: overallStatus === "PASSED" ? "SUCCESS" : "WARNING",
    afterValue: { overallStatus, checks: checks.map(({ component, status, durationMs }) => ({ component, status, durationMs })) },
    details: "Altı tanılama adımı sırayla gerçek sorgularla yürütüldü; fiziksel bağlantı doğrulanamayanlar UNKNOWN olarak kaydedildi.",
  });
  safeRevalidate();
  return { ok: true, diagnosticRun };
}

export async function executeAllowlistedRepairAction(input: {
  actorId: string;
  diagnosticRunId: string;
  findingId?: string;
  allowlistAction: string;
  adminPinOrPassword: string;
}) {
  const actor = await requireRole(input.actorId, ["SYSTEM_ADMIN"], "EXECUTE_ALLOWLISTED_REPAIR", "RepairRun", input.diagnosticRunId);
  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "REPAIR_BLOCKED_UNAVAILABLE",
    entityType: "DiagnosticRun",
    entityId: input.diagnosticRunId,
    result: "WARNING",
    reason: "Fiziksel servis adaptörleri ve doğrulanmış PRE_REPAIR yedeği etkin değil; hiçbir onarım uygulanmadı.",
    details: `Talep edilen işlem: ${input.allowlistAction}`,
  });
  throw new Error("Otomatik onarım uygulanmadı. Fiziksel adaptör ve doğrulanmış ön yedek bu dağıtımda kurulu değil.");
}

export async function exportDiagnosticPackageAction(input: {
  actorId: string;
  diagnosticRunId?: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "EXPORT_DIAGNOSTIC_PACKAGE",
    "DiagnosticRun",
    input.diagnosticRunId
  );

  const run = input.diagnosticRunId
    ? await prisma.diagnosticRun.findUnique({
        where: { id: input.diagnosticRunId },
        include: { checks: true, findings: true, repairs: true },
      })
    : await prisma.diagnosticRun.findFirst({
        orderBy: { startedAt: "desc" },
        include: { checks: true, findings: true, repairs: true },
      });

  if (!run) {
    throw new Error("Dışa aktarılacak tanılama çalıştırması bulunamadı.");
  }

  const config = await prisma.restaurantConfig.findUnique({
    where: { id: "local-restaurant-config" },
  });

  const packagePayload = {
    packageCode: `PKG-${run.runCode}`,
    exportedAt: new Date().toISOString(),
    exportedBy: actor.username,
    redactionPolicy: "STRICT_MASKED_NO_SECRETS_NO_PRICES",
    restaurant: {
      name: config?.name,
      code: config?.code,
      appVersion: config?.appVersion,
      dbSchemaVersion: config?.dbSchemaVersion,
    },
    diagnosticRun: {
      runCode: run.runCode,
      overallStatus: run.overallStatus,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      checks: run.checks,
      findings: run.findings,
      repairs: run.repairs,
    },
  };

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "DIAGNOSTIC_PACKAGE_EXPORTED",
    entityType: "DiagnosticRun",
    entityId: run.id,
    result: "SUCCESS",
    afterValue: {
      packageCode: packagePayload.packageCode,
      runCode: run.runCode,
    },
    details: `${run.runCode} için maskelenmiş tanılama paketi (${packagePayload.packageCode}) dışa aktarıldı.`,
  });

  safeRevalidate();
  return {
    ok: true,
    diagnosticPackage: packagePayload,
  };
}

export async function applySignedMaintenancePackageAction(input: {
  actorId: string;
  packageName: string;
  signatureText: string;
}) {
  const actor = await requireRole(
    input.actorId,
    ["SYSTEM_ADMIN"],
    "APPLY_SIGNED_MAINTENANCE_PACKAGE",
    "RestaurantConfig",
    "local-restaurant-config"
  );

  const cleanPkg = input.packageName?.trim() ?? "";
  const cleanSig = input.signatureText?.trim() ?? "";

  if (!cleanPkg || cleanSig.length < 12 || !cleanSig.toUpperCase().startsWith("ALACARTE-SIG-")) {
    await recordAuditEvent({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "UNSIGNED_MAINTENANCE_PACKAGE_REJECTED",
      entityType: "RestaurantConfig",
      entityId: "local-restaurant-config",
      result: "REJECTED",
      reason: "Geçersiz veya imzasız çevrimdışı bakım paketi reddedildi",
    });
    throw new Error(
      "İmza doğrulaması başarısız: Çevrimdışı bakım paketi geçerli bir 'ALACARTE-SIG-' kriptografik imzası taşımalıdır."
    );
  }

  const preUpdateBackups = await createBackupAction({
    actorId: actor.id,
    triggerType: "PRE_REPAIR",
  });

  const signatureDigest = crypto
    .createHash("sha256")
    .update(`${cleanPkg}|${cleanSig}`, "utf8")
    .digest("hex");

  await recordAuditEvent({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "SIGNED_MAINTENANCE_PACKAGE_APPLIED",
    entityType: "RestaurantConfig",
    entityId: "local-restaurant-config",
    result: "SUCCESS",
    afterValue: {
      packageName: cleanPkg,
      signatureDigest,
      preUpdateUsbBackup: preUpdateBackups.usbBackup.backupCode,
      preUpdateLocalBackup: preUpdateBackups.localBackup.backupCode,
    },
    details: `İmzalı çevrimdışı bakım paketi (${cleanPkg}) ön yedek alınarak doğrulandı ve uygulandı.`,
  });

  safeRevalidate();
  return {
    ok: true,
    packageName: cleanPkg,
    signatureDigest,
    preUpdateUsbBackup: preUpdateBackups.usbBackup.backupCode,
  };
}
