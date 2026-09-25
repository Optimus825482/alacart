"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/lib/types";

// ==========================================
// MASTER KDS (KOORDİNATÖR ŞEF CANLI İZLEME)
// ==========================================
export async function getChefMasterKds(restaurantId?: string) {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ["PENDING", "PREPARING"] },
        ...(restaurantId && restaurantId !== "ALL" ? { restaurantId } : {}),
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
                allergens: true,
                imageUrl: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return { success: true, data: orders };
  } catch (error: any) {
    console.error("getChefMasterKds error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// ŞEF TARİH ARALIKLI RAPOR VE HAZIRLIK SÜRESİ ANALİTİĞİ
// ==========================================
export async function getChefAnalyticsAndReport(params: {
  restaurantId?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const { restaurantId, startDate, endDate } = params;

    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(`${startDate}T00:00:00.000Z`);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    }

    if (endDate) {
      end = new Date(`${endDate}T23:59:59.999Z`);
    } else {
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const whereClause: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
      ...(restaurantId && restaurantId !== "ALL" ? { restaurantId } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
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

    // İstatistik ve süre hesaplamaları
    let totalPrepMinutes = 0;
    let completedOrdersWithDuration = 0;
    const dishCounts: Record<string, { name: string; category: string; count: number }> = {};
    const waiterStats: Record<string, { name: string; count: number }> = {};
    const restaurantStats: Record<string, { name: string; count: number; completedCount: number }> = {};

    const ordersFormatted = orders.map((o) => {
      let prepDurationMinutes: number | null = null;

      if (o.completedAt) {
        const diffMs = new Date(o.completedAt).getTime() - new Date(o.createdAt).getTime();
        prepDurationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
        totalPrepMinutes += prepDurationMinutes;
        completedOrdersWithDuration++;
      } else if (o.preparingStartedAt) {
        const diffMs = new Date().getTime() - new Date(o.preparingStartedAt).getTime();
        prepDurationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
      }

      // Dish aggregation
      o.items.forEach((item) => {
        const key = item.menuItem.name;
        if (!dishCounts[key]) {
          dishCounts[key] = {
            name: item.menuItem.name,
            category: item.menuItem.category?.name || "Diğer",
            count: 0,
          };
        }
        dishCounts[key].count += item.quantity;
      });

      // Waiter stats
      const wName = o.waiter?.name || "Bilinmiyor";
      if (!waiterStats[wName]) waiterStats[wName] = { name: wName, count: 0 };
      waiterStats[wName].count++;

      // Restaurant stats
      const rName = o.restaurant.name;
      if (!restaurantStats[rName]) {
        restaurantStats[rName] = { name: rName, count: 0, completedCount: 0 };
      }
      restaurantStats[rName].count++;
      if (o.status === "COMPLETED") restaurantStats[rName].completedCount++;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        restaurantName: o.restaurant.name,
        tableName: o.table.name,
        waiterName: o.waiter.name,
        status: o.status,
        notes: o.notes,
        itemCount: o.items.reduce((acc, i) => acc + i.quantity, 0),
        itemsSummary: o.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(", "),
        createdAt: o.createdAt.toISOString(),
        preparingStartedAt: o.preparingStartedAt ? o.preparingStartedAt.toISOString() : null,
        printedAt: o.printedAt ? o.printedAt.toISOString() : null,
        completedAt: o.completedAt ? o.completedAt.toISOString() : null,
        prepDurationMinutes,
      };
    });

    const avgPrepMinutes =
      completedOrdersWithDuration > 0
        ? Math.round((totalPrepMinutes / completedOrdersWithDuration) * 10) / 10
        : null;

    const topDishes = Object.values(dishCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return {
      success: true,
      data: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalOrders: orders.length,
        completedOrders: orders.filter((o) => o.status === "COMPLETED").length,
        activeOrders: orders.filter((o) => ["PENDING", "PREPARING"].includes(o.status)).length,
        cancelledOrders: orders.filter((o) => o.status === "CANCELLED").length,
        avgPrepMinutes,
        topDishes,
        waiterStats: Object.values(waiterStats).sort((a, b) => b.count - a.count),
        restaurantStats: Object.values(restaurantStats),
        orders: ordersFormatted,
      },
    };
  } catch (error: any) {
    console.error("getChefAnalyticsAndReport error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// SİSTEM DENETİM İZLERİ (AUDIT LOGS)
// ==========================================
export async function getAuditLogs(params?: {
  restaurantId?: string;
  action?: string;
  limit?: number;
}) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(params?.restaurantId && params.restaurantId !== "ALL"
          ? { restaurantId: params.restaurantId }
          : {}),
        ...(params?.action && params.action !== "ALL" ? { action: params.action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params?.limit || 100,
      include: {
        restaurant: { select: { id: true, name: true } },
      },
    });

    return { success: true, data: logs };
  } catch (error: any) {
    console.error("getAuditLogs error:", error);
    return { success: false, error: error.message };
  }
}
