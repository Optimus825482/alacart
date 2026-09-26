"use server";

import { prisma } from "@/lib/prisma";
import { authorize, CHEF_REPORT_ROLES } from "@/lib/auth-guard";
import { resolveDateRange, getBusinessTimezone } from "@/lib/date-range";

// ==========================================
// MASTER KDS (KOORDINATOR SEF CANLI IZLEME)
// ==========================================
export async function getChefMasterKds(restaurantId?: string) {
  const auth = await authorize(CHEF_REPORT_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

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
    return { success: false, error: error.message, data: null };
  }
}

// ==========================================
// CANLI SERVIS ANLIK GORUNTU (SEF EKRANI)
// Admin modulunden tasinan canli sayilarla eslestirilir.
// ==========================================
export async function getLiveServiceSnapshot(restaurantId?: string) {
  const auth = await authorize(CHEF_REPORT_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const range = resolveDateRange();
    if (!range.ok) {
      return { success: false, error: range.error, data: null };
    }

    const scope = restaurantId && restaurantId !== "ALL" ? { restaurantId } : {};

    const [pending, preparing, occupiedTables, totalTables, todayOrders, todayCompleted] =
      await Promise.all([
        prisma.order.count({ where: { ...scope, status: "PENDING" } }),
        prisma.order.count({ where: { ...scope, status: "PREPARING" } }),
        prisma.restaurantTable.count({ where: { ...scope, status: "OCCUPIED" } }),
        prisma.restaurantTable.count({ where: scope }),
        prisma.order.count({
          where: { ...scope, createdAt: { gte: range.start, lte: range.end } },
        }),
        prisma.order.count({
          where: {
            ...scope,
            status: "COMPLETED",
            completedAt: { gte: range.start, lte: range.end },
          },
        }),
      ]);

    return {
      success: true,
      data: {
        pendingOrders: pending,
        preparingOrders: preparing,
        activeOrders: pending + preparing,
        occupiedTables,
        totalTables,
        occupancyRate:
          totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0,
        todayOrders,
        todayCompletedOrders: todayCompleted,
        timeZone: getBusinessTimezone(),
      },
    };
  } catch (error: any) {
    console.error("getLiveServiceSnapshot error:", error);
    return { success: false, error: error.message, data: null };
  }
}

// ==========================================
// SEF TARIH ARALIKLI RAPOR VE HAZIRLIK SURESI ANALITIGI
// ==========================================
export async function getChefAnalyticsAndReport(params: {
  restaurantId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const auth = await authorize(CHEF_REPORT_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const { restaurantId } = params;
    const range = resolveDateRange(params.startDate, params.endDate);
    if (!range.ok) {
      return { success: false, error: range.error, data: null };
    }

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        ...(restaurantId && restaurantId !== "ALL" ? { restaurantId } : {}),
      },
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

    let totalPrepMinutes = 0;
    let completedOrdersWithDuration = 0;
    const dishCounts: Record<string, { name: string; category: string; count: number }> = {};
    const waiterStats: Record<string, { name: string; count: number; completedCount: number }> = {};
    const restaurantStats: Record<
      string,
      { name: string; count: number; completedCount: number; cancelledCount: number }
    > = {};
    const tableStats: Record<string, { name: string; count: number }> = {};

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

      o.items.forEach((item) => {
        const key = item.menuItem.name;
        if (!dishCounts[key]) {
          dishCounts[key] = {
            name: item.menuItem.name,
            category: item.menuItem.category?.name || "Diger",
            count: 0,
          };
        }
        dishCounts[key].count += item.quantity;
      });

      const wName = o.waiter?.name || "Bilinmiyor";
      if (!waiterStats[wName]) waiterStats[wName] = { name: wName, count: 0, completedCount: 0 };
      waiterStats[wName].count++;
      if (o.status === "COMPLETED") waiterStats[wName].completedCount++;

      const rName = o.restaurant.name;
      if (!restaurantStats[rName]) {
        restaurantStats[rName] = {
          name: rName,
          count: 0,
          completedCount: 0,
          cancelledCount: 0,
        };
      }
      restaurantStats[rName].count++;
      if (o.status === "COMPLETED") restaurantStats[rName].completedCount++;
      if (o.status === "CANCELLED") restaurantStats[rName].cancelledCount++;

      const tName = o.table.name;
      if (!tableStats[tName]) tableStats[tName] = { name: tName, count: 0 };
      tableStats[tName].count++;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        restaurantName: o.restaurant.name,
        tableName: o.table.name,
        waiterName: o.waiter.name,
        status: o.status,
        notes: o.notes,
        itemCount: o.items.reduce((acc, i) => acc + i.quantity, 0),
        itemsSummary: o.items
          .map((i) => `${i.quantity}x ${i.menuItem.name}${i.itemNotes ? ` (${i.itemNotes})` : ""}`)
          .join(", "),
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
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        timeZone: range.timeZone,
        dayCount: range.dayCount,
        totalOrders: orders.length,
        completedOrders: orders.filter((o) => o.status === "COMPLETED").length,
        activeOrders: orders.filter((o) => ["PENDING", "PREPARING"].includes(o.status)).length,
        cancelledOrders: orders.filter((o) => o.status === "CANCELLED").length,
        avgPrepMinutes,
        topDishes,
        waiterStats: Object.values(waiterStats).sort((a, b) => b.count - a.count),
        restaurantStats: Object.values(restaurantStats).sort((a, b) => b.count - a.count),
        tableStats: Object.values(tableStats).sort((a, b) => b.count - a.count),
        orders: ordersFormatted,
      },
    };
  } catch (error: any) {
    console.error("getChefAnalyticsAndReport error:", error);
    return { success: false, error: error.message, data: null };
  }
}

// ==========================================
// SISTEM DENETIM IZLERI (AUDIT LOGS)
// ==========================================
export async function getAuditLogs(params?: {
  restaurantId?: string;
  action?: string;
  limit?: number;
}) {
  const auth = await authorize(CHEF_REPORT_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

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
    return { success: false, error: error.message, data: null };
  }
}

// ==========================================
// GARSON GIRIS & ALAKART TAKIBI (SEF MODULU ICIN)
// ==========================================
export async function getWaiterSessionsAndLogins(params?: { restaurantId?: string }) {
  const auth = await authorize(CHEF_REPORT_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const range = resolveDateRange();
    if (!range.ok) {
      return { success: false, error: range.error, data: null };
    }
    const todayStart = range.start;

    const waiters = await prisma.user.findMany({
      where: { role: "WAITER", active: true },
      select: {
        id: true,
        name: true,
        username: true,
        assignedTo: {
          include: { restaurant: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        userRole: "WAITER",
        action: { in: ["LOGIN", "SELECT_RESTAURANT", "SWITCH_RESTAURANT", "LOGOUT"] },
        ...(params?.restaurantId && params.restaurantId !== "ALL"
          ? { restaurantId: params.restaurantId }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        restaurant: { select: { id: true, name: true, code: true } },
      },
    });

    const todayOrders = await prisma.order.findMany({
      where: { createdAt: { gte: todayStart } },
      select: {
        waiterId: true,
        restaurantId: true,
      },
    });

    const waiterCards = waiters.map((waiter) => {
      const userLogs = logs.filter((l) => l.userId === waiter.id || l.userName === waiter.name);

      const latestLogin = userLogs.find((l) => l.action === "LOGIN");
      const latestSelect = userLogs.find((l) => l.action === "SELECT_RESTAURANT");
      const latestSwitchOrLogout = userLogs.find((l) =>
        ["SWITCH_RESTAURANT", "LOGOUT"].includes(l.action)
      );

      let isActiveInRestaurant = false;
      let activeRestaurant: { id: string; name: string; code: string } | null = null;
      let restaurantEntryTime: Date | null = null;

      if (latestSelect) {
        if (
          !latestSwitchOrLogout ||
          new Date(latestSelect.createdAt) > new Date(latestSwitchOrLogout.createdAt)
        ) {
          isActiveInRestaurant = true;
          activeRestaurant = latestSelect.restaurant;
          restaurantEntryTime = latestSelect.createdAt;
        }
      }

      const systemLoginTime = latestLogin?.createdAt || (latestSelect?.createdAt ?? null);
      const waiterTodayOrders = todayOrders.filter((o) => o.waiterId === waiter.id);

      return {
        id: waiter.id,
        name: waiter.name,
        username: waiter.username,
        assignedRestaurants: waiter.assignedTo.map((a) => a.restaurant),
        isActiveInRestaurant,
        activeRestaurant,
        restaurantEntryTime: restaurantEntryTime ? restaurantEntryTime.toISOString() : null,
        systemLoginTime: systemLoginTime ? new Date(systemLoginTime).toISOString() : null,
        todayOrderCount: waiterTodayOrders.length,
        lastAction: userLogs[0]?.action || "GIRIS YOK",
        lastActionTime: userLogs[0]?.createdAt ? new Date(userLogs[0].createdAt).toISOString() : null,
      };
    });

    let filteredCards = waiterCards;
    if (params?.restaurantId && params.restaurantId !== "ALL") {
      filteredCards = waiterCards.filter(
        (w) =>
          w.activeRestaurant?.id === params.restaurantId ||
          w.assignedRestaurants.some((r) => r.id === params.restaurantId)
      );
    }

    return {
      success: true,
      data: {
        waiters: filteredCards,
        history: logs.map((l) => ({
          id: l.id,
          waiterName: l.userName,
          action: l.action,
          restaurantName: l.restaurant?.name || "-",
          restaurantCode: l.restaurant?.code || "-",
          details: l.details,
          createdAt: l.createdAt.toISOString(),
        })),
      },
    };
  } catch (error: any) {
    console.error("getWaiterSessionsAndLogins error:", error);
    return { success: false, error: error.message, data: null };
  }
}
