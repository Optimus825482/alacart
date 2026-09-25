"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { OrderStatus, TableStatus } from "@/lib/types";

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
  try {
    if (!data.items || data.items.length === 0) {
      return { success: false, error: "En az bir ürün seçilmelidir." };
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
          waiterId: data.waiterId,
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

    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");

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
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ["PENDING", "PREPARING"] },
        ...(restaurantId ? { restaurantId } : {}),
      },
      orderBy: { createdAt: "asc" }, // En eski sipariş en üstte
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
                allergens: true,
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
  newStatus: OrderStatus
) {
  try {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus as any,
          ...(newStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
        },
        include: { items: true },
      });

      // Kalemlerin durumunu da güncelle
      await tx.orderItem.updateMany({
        where: { orderId },
        data: { status: newStatus as any },
      });

      // Eğer sipariş tamamlandıysa veya iptal edildiyse, bu masada başka aktif sipariş kalıp kalmadığını kontrol et
      if (newStatus === "COMPLETED" || newStatus === "CANCELLED") {
        const remainingActiveOrders = await tx.order.count({
          where: {
            tableId: order.tableId,
            status: { in: ["PENDING", "PREPARING"] },
            id: { not: orderId },
          },
        });

        // Eğer masada başka bekleyen/hazırlanan sipariş kalmadıysa masa boşaltılabilir
        if (remainingActiveOrders === 0) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: { status: "EMPTY" },
          });
        }
      }

      return order;
    });

    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/admin");

    return { success: true, data: updatedOrder };
  } catch (error: any) {
    console.error("updateOrderStatus error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// YAZICI İÇİN ADİSYON BASILDI İŞARETİ
// ==========================================

export async function markOrderPrinted(orderId: string) {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { printedAt: new Date() },
    });
    revalidatePath("/kitchen");
    return { success: true, data: order };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// MASAYA AİT AÇIK SİPARİŞLER (GARSON İÇİN)
// ==========================================

export async function getTableActiveOrders(tableId: string) {
  try {
    const orders = await prisma.order.findMany({
      where: {
        tableId,
        status: { in: ["PENDING", "PREPARING"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        waiter: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true } },
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
// YÖNETİM RAPORLARI VE İSTATİSTİKLERİ
// ==========================================

export async function getAdminDashboardStats() {
  try {
    const [
      totalOrdersToday,
      activePendingOrders,
      activePreparingOrders,
      occupiedTablesCount,
      totalTablesCount,
      topItems,
    ] = await Promise.all([
      // Bugün verilen toplam sipariş
      prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      // Bekleyen siparişler
      prisma.order.count({ where: { status: "PENDING" } }),
      // Hazırlanan siparişler
      prisma.order.count({ where: { status: "PREPARING" } }),
      // Dolu masa sayısı
      prisma.restaurantTable.count({ where: { status: "OCCUPIED" } }),
      // Toplam masa sayısı
      prisma.restaurantTable.count(),
      // En çok tercih edilen yiyecek ve içecekler
      prisma.orderItem.groupBy({
        by: ["menuItemId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      }),
    ]);

    // Ürün isimlerini çek
    const itemIds = topItems.map((ti) => ti.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, category: { select: { name: true } } },
    });

    const itemMap = new Map(menuItems.map((m) => [m.id, m]));

    const popularItems = topItems.map((ti) => ({
      name: itemMap.get(ti.menuItemId)?.name || "Bilinmeyen Ürün",
      categoryName: itemMap.get(ti.menuItemId)?.category.name || "",
      totalCount: ti._sum.quantity || 0,
    }));

    return {
      success: true,
      data: {
        totalOrdersToday,
        activePendingOrders,
        activePreparingOrders,
        occupiedTablesCount,
        totalTablesCount,
        occupancyRate:
          totalTablesCount > 0
            ? Math.round((occupiedTablesCount / totalTablesCount) * 100)
            : 0,
        popularItems,
      },
    };
  } catch (error: any) {
    console.error("getAdminDashboardStats error:", error);
    return { success: false, error: error.message };
  }
}
