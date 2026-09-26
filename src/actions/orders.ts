"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { OrderStatus, TableStatus } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { authorize, KITCHEN_ROLES, WAITER_ROLES, ADMIN_ONLY } from "@/lib/auth-guard";

// ==========================================
// SİPARİŞ OLUŞTURMA (GARSON EKRANI)
// ==========================================

export async function createOrder(data: {
  restaurantId: string;
  tableId: string;
  waiterId: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    itemNotes?: string;
  }>;
}) {
  const auth = await authorize(WAITER_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    if (!data.items || data.items.length === 0) {
      return { success: false, error: "En az bir ürün seçilmelidir." };
    }

    // Garson kimligi sunucu tarafinda oturumdan alinir; istemciden gelen deger guvenilmez.
    const waiterId = auth.session.role === "WAITER" ? auth.session.id : data.waiterId;

    // Masa, siparisin ait oldugu alakarta ait olmak zorunda (rapor bütünlüğü).
    const targetTable = await prisma.restaurantTable.findUnique({
      where: { id: data.tableId },
      select: { id: true, restaurantId: true },
    });
    if (!targetTable || targetTable.restaurantId !== data.restaurantId) {
      return {
        success: false,
        error: "Masa, secilen alakarta ait degil. Siparis olusturulamadi.",
        data: null,
      };
    }

    // İşlemi transaction içinde gerçekleştir
    const newOrder = await prisma.$transaction(async (tx) => {
      // 1. Masayı DOLU (OCCUPIED) olarak işaretle
      await tx.restaurantTable.update({
        where: { id: data.tableId },
        data: { status: "OCCUPIED" },
      });

      // 2. Siparişi ve kalemlerini oluştur
      const order = await tx.order.create({
        data: {
          restaurantId: data.restaurantId,
          tableId: data.tableId,
          waiterId,
          notes: data.notes?.trim(),
          status: "PENDING",
          items: {
            create: data.items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              itemNotes: item.itemNotes?.trim(),
              status: "PENDING",
            })),
          },
        },
        include: {
          restaurant: { select: { id: true, name: true, code: true } },
          table: { select: { id: true, name: true } },
          waiter: { select: { id: true, name: true } },
          items: {
            include: {
              menuItem: { select: { id: true, name: true, allergens: true } },
            },
          },
        },
      });

      return order;
    });

    await logAudit({
      userId: newOrder.waiterId,
      userName: newOrder.waiter?.name || "Garson",
      userRole: auth.session.role,
      action: "ORDER_CREATED",
      entity: "Order",
      entityId: newOrder.id,
      details: `${newOrder.restaurant.name} - Masa: ${newOrder.table.name} (#${newOrder.orderNumber}) için ${newOrder.items.length} kalem sipariş verildi.`,
      restaurantId: newOrder.restaurantId,
    });

    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    revalidatePath("/chef");

    return { success: true, data: newOrder };
  } catch (error: any) {
    console.error("createOrder error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// MUTFAK EKRANI İÇİN AKTİF SİPARİŞLER (KDS)
// ==========================================

export async function getActiveKitchenOrders(restaurantId?: string) {
  const auth = await authorize(KITCHEN_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        ...(restaurantId ? { restaurantId } : {}),
        OR: [
          { status: { in: ["PENDING", "PREPARING"] } },
          {
            status: "COMPLETED",
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        restaurant: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true } },
        waiter: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return { success: true, data: orders };
  } catch (error: any) {
    console.error("getActiveKitchenOrders error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// SİPARİŞ DURUMU GÜNCELLEME (MUTFAK KDS)
// ==========================================

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  _legacyActor?: { id?: string; name?: string; role?: string }
) {
  const auth = await authorize(KITCHEN_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        include: { restaurant: true, table: true },
      });

      // Valid transitions
      const VALID_TRANSITIONS: Record<string, string[]> = {
        PENDING: ['PREPARING', 'CANCELLED'],
        PREPARING: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [], // Terminal state - no further transitions
        CANCELLED: [], // Terminal state - no further transitions
      };

      const existingStatus = existing?.status;
      if (existingStatus && !VALID_TRANSITIONS[existingStatus]?.includes(newStatus)) {
        throw new Error(`Sipariş durumu '${existingStatus}' -> '${newStatus}' geçişi geçersizdir.`);
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus as any,
          ...(newStatus === "PREPARING" && !existing?.preparingStartedAt
            ? { preparingStartedAt: new Date() }
            : {}),
          ...(newStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
        },
        include: { items: true, restaurant: true, table: true },
      });

      // Kalemlerin durumunu da güncelle
      await tx.orderItem.updateMany({
        where: { orderId },
        data: { status: newStatus as any },
      });

      // Only clear table when ALL orders are cancelled (not completed)
      if (newStatus === "CANCELLED") {
        const remainingActiveOrders = await tx.order.count({
          where: {
            tableId: order.tableId,
            status: { in: ["PENDING", "PREPARING", "COMPLETED"] },
            id: { not: orderId },
          },
        });
        if (remainingActiveOrders === 0) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: { status: "EMPTY" },
          });
        }
      }

      return order;
    });

    await logAudit({
      userId: auth.session.id,
      userName: auth.session.name,
      userRole: auth.session.role,
      action: `STATUS_${newStatus}`,
      entity: "Order",
      entityId: orderId,
      details: `${updatedOrder.restaurant.name} - Masa ${updatedOrder.table.name} (#${updatedOrder.orderNumber}) durumu '${newStatus}' yapıldı.`,
      restaurantId: updatedOrder.restaurantId,
    });

    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    revalidatePath("/chef");

    return { success: true, data: updatedOrder };
  } catch (error: any) {
    console.error("updateOrderStatus error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// YAZICI İÇİN ADİSYON BASILDI İŞARETİ
// ==========================================

export async function markOrderPrinted(
  orderId: string,
  _legacyActor?: { id?: string; name?: string; role?: string }
) {
  const auth = await authorize(KITCHEN_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { printedAt: new Date() },
      include: { restaurant: true, table: true },
    });

    await logAudit({
      userId: auth.session.id,
      userName: auth.session.name,
      userRole: auth.session.role,
      action: "ORDER_PRINTED",
      entity: "Order",
      entityId: orderId,
      details: `${order.restaurant.name} - Masa ${order.table.name} (#${order.orderNumber}) için 80mm mutfak termal fişi basıldı.`,
      restaurantId: order.restaurantId,
    });

    revalidatePath("/kitchen");
    revalidatePath("/chef");
    return { success: true, data: order };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// MASAYA AİT AKTİF VE BUGÜNKÜ SİPARİŞLER (GARSON İÇİN)
// ==========================================

export async function getTableActiveOrders(tableId: string) {
  const auth = await authorize(WAITER_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        tableId,
        status: { in: ["PENDING", "PREPARING", "COMPLETED"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        waiter: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, defaultNotes: true, imageUrl: true } },
          },
        },
      },
    });

    return { success: true, data: orders };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// MEVCUT SİPARİŞİ GÜNCELLEME / İLAVE EKLEME
// ==========================================

export async function updateOrder(data: {
  orderId: string;
  waiterId: string;
  notes?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    itemNotes?: string;
  }>;
}) {
  const auth = await authorize(WAITER_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    if (!data.items || data.items.length === 0) {
      return { success: false, error: "En az bir ürün bulunmalıdır." };
    }

    // Garson kimligi oturumdan alinir; istemciden gelen deger guvenilmez.
    const waiterId = auth.session.role === "WAITER" ? auth.session.id : data.waiterId;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Mevcut siparişi bul
      const existing = await tx.order.findUnique({
        where: { id: data.orderId },
        include: { items: true },
      });

      if (!existing) {
        throw new Error("Güncellenecek sipariş bulunamadı.");
      }

      // 1. Masayı OCCUPIED yap
      await tx.restaurantTable.update({
        where: { id: existing.tableId },
        data: { status: "OCCUPIED" },
      });

      // 2. Kalemleri yeniden yapılandır
      await tx.orderItem.deleteMany({
        where: { orderId: data.orderId },
      });

      // 3. Siparişin genel notlarını, durumunu ve revizyon bilgilerini güncelle
      const order = await tx.order.update({
        where: { id: data.orderId },
        data: {
          notes: data.notes?.trim(),
          waiterId,
          status: "PENDING", // Mutfağın dikkatine tekrar sunulur
          isUpdated: true,
          revision: { increment: 1 },
          lastModifiedAt: new Date(),
          items: {
            create: data.items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              itemNotes: item.itemNotes?.trim(),
              status: "PENDING",
            })),
          },
        },
        include: {
          restaurant: { select: { id: true, name: true, code: true } },
          table: { select: { id: true, name: true } },
          waiter: { select: { id: true, name: true } },
          items: {
            include: {
              menuItem: { select: { id: true, name: true, allergens: true } },
            },
          },
        },
      });

      return order;
    });

    await logAudit({
      userId: waiterId,
      userName: updatedOrder.waiter?.name || "Garson",
      userRole: auth.session.role,
      action: "ORDER_UPDATED",
      entity: "Order",
      entityId: updatedOrder.id,
      details: `${updatedOrder.restaurant.name} - Masa: ${updatedOrder.table.name} (#${updatedOrder.orderNumber}, Revizyon #${updatedOrder.revision}) siparişi güncellendi/ilave yapıldı (${updatedOrder.items.length} kalem).`,
      restaurantId: updatedOrder.restaurantId,
    });

    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");
    revalidatePath("/chef");

    return { success: true, data: updatedOrder };
  } catch (error: any) {
    console.error("updateOrder error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// SİSTEM TANIMLARI ÖZETİ (SİSTEM YÖNETİCİSİ MODÜLÜ)
// Burada yalnızca tanım sayıları döner. Canlı işleyiş, tüketim ve
// denetim verileri Sistem Yöneticisi ekranında BULUNMAZ; Şef Modülü'ne aittir.
// ==========================================
export async function getAdminDefinitionsSummary() {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const [
      totalRestaurants,
      activeRestaurants,
      totalTablesCount,
      totalCategoriesCount,
      totalMenuItemsCount,
      totalUsersCount,
    ] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { active: true } }),
      prisma.restaurantTable.count(),
      prisma.category.count(),
      prisma.menuItem.count(),
      prisma.user.count({ where: { active: true } }),
    ]);

    return {
      success: true,
      data: {
        totalRestaurants,
        activeRestaurants,
        totalTablesCount,
        totalCategoriesCount,
        totalMenuItemsCount,
        totalUsersCount,
      },
    };
  } catch (error: any) {
    console.error("getAdminDefinitionsSummary error:", error);
    return { success: false, error: error.message, data: null };
  }
}
