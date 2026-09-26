"use server";

import { prisma } from "@/lib/prisma";
import { todayRangeInTimeZone } from "@/lib/date-range";
import { revalidatePath } from "next/cache";
import { OrderStatus, TableStatus } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { authorize, KITCHEN_VIEW_ROLES, KITCHEN_STATUS_ROLES, KITCHEN_ROLES, ORDER_CANCEL_ROLES, ORDER_ENTRY_ROLES, WAITER_ROLES, ADMIN_ONLY } from "@/lib/auth-guard";

// ==========================================
// SIPARIS OLUSTURMA (GARSON + SEF EKRANI)
// Sefer, restoran secerek siparis girisi yapabilir. Siparis bir "tanım" degil,
// canli operasyon kaydidir; bu yuzden Sistem Yonetecisi sinirina girmez.
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
  const auth = await authorize(ORDER_ENTRY_ROLES);
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
// MUTFAK EKRANI İÇİN AKTİF SİPARİŞLER
// ==========================================

export async function getActiveKitchenOrders(restaurantId?: string) {
  const auth = await authorize(KITCHEN_VIEW_ROLES);
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
          {
            // Garson tarafından iptal edilen siparişler de mutfak ekranında listelenir (son 24 saat)
            status: "CANCELLED",
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
// SİPARİŞ DURUMU GÜNCELLEME (MUTFAK EKRANI)
// ==========================================

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  _legacyActor?: { id?: string; name?: string; role?: string }
) {
  // Durum işaretleme yetkisi HEDEF DURUMA göre değişir:
  //   - "Hazırlandı / Hazırlanıyor" ve "Tamamlandı" -> yalnızca MUTFAK (KITCHEN_STATUS_ROLES)
  //   - "İptal" -> amir / şef denetimi (ORDER_CANCEL_ROLES)
  // Böylece Şef canlı akışı izleyip sipariş girebilir, fakat mutfağın
  // hazırlık ve tamamlama işaretlemesini yapamaz.
  const requiredRoles =
    newStatus === "CANCELLED" ? ORDER_CANCEL_ROLES : KITCHEN_STATUS_ROLES;
  const auth = await authorize(requiredRoles);
  if (!auth.ok) {
    return {
      success: false,
      error:
        newStatus === "CANCELLED"
          ? auth.error
          : "Siparişin 'Hazırlandı' ve 'Tamamlandı' işaretlemesi yalnızca mutfak ekranından yapılabilir. Bu işlemi Şef panelinden gerçekleştiremezsiniz.",
      data: null,
    };
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
  const auth = await authorize(KITCHEN_VIEW_ROLES);
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
  const auth = await authorize(ORDER_ENTRY_ROLES);
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
// ==========================================
// GARSON: BUGÜNKÜ SİPARİŞLERİM ("SİPARİŞLERİM" SEKMESİ)
// Garson yalnızca kendi girdiği ve bugüne ait siparişleri görür.
// Mutfak durumları (PENDING / PREPARING / COMPLETED / CANCELLED) yanında döner.
// ==========================================
export async function getMyOrdersToday() {
  const auth = await authorize(WAITER_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const { start, end } = todayRangeInTimeZone();
    const orders = await prisma.order.findMany({
      where: {
        waiterId: auth.session.role === "WAITER" ? auth.session.id : undefined,
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true } },
        waiter: { select: { id: true, name: true } },
        items: {
          include: {
            menuItem: { select: { id: true, name: true, imageUrl: true, allergens: true } },
          },
        },
      },
    });

    return { success: true, data: orders };
  } catch (error: any) {
    console.error("getMyOrdersToday error:", error);
    return { success: false, error: error.message, data: null };
  }
}

// ==========================================
// GARSON: SİPARİŞ İPTALİ
// İptal mutfak akışını derinden etkiler: garson iptal ederse sipariş
// hazırlanmış olabilir. Bu yüzden garson "mutfağa bildirilsin mi?" sorusu
// ile onay ister; onaylanırsa mutfak ekranında düşülmeyen bir uyarı
// olarak belirir ve iptal fişi yazdırılır.
// ==========================================
export async function cancelOrder(params: {
  orderId: string;
  reason?: string;
  notifyKitchen: boolean;
}) {
  const auth = await authorize(WAITER_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { restaurant: true, table: true, waiter: true, items: true },
    });

    if (!order) {
      return { success: false, error: "Sipariş bulunamadı.", data: null };
    }

    // Garson yalnızca kendi siparişini iptal edebilir.
    if (auth.session.role === "WAITER" && order.waiterId !== auth.session.id) {
      return {
        success: false,
        error: "Yalnızca kendi girdiğiniz siparişi iptal edebilirsiniz.",
        data: null,
      };
    }

    if (order.status === "CANCELLED") {
      return {
        success: false,
        error: "Bu sipariş zaten iptal edilmiş.",
        data: null,
      };
    }

    if (order.status === "COMPLETED") {
      return {
        success: false,
        error: "Tamamlanmış sipariş iptal edilemez. Lütfen mutfakla görüşün.",
        data: null,
      };
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason: params.reason?.trim() || "Sebep belirtilmedi",
          ...(params.notifyKitchen
            ? { kitchenNotifiedAt: now, kitchenAckedAt: null }
            : {}),
        },
      });

      await tx.orderItem.updateMany({
        where: { orderId: order.id },
        data: { status: "CANCELLED" },
      });

      // Masanın durumu, iptal edilen siparişten sonra da başka aktif sipariş kalmadıysa boşa alınır.
      const kalanAktif = await tx.order.count({
        where: {
          tableId: order.tableId,
          id: { not: order.id },
          status: { in: ["PENDING", "PREPARING", "COMPLETED"] },
        },
      });
      if (kalanAktif === 0) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "EMPTY" },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { restaurant: true, table: true, waiter: true, items: { include: { menuItem: true } } },
      });
    });

    await logAudit({
      userId: auth.session.id,
      userName: auth.session.name,
      userRole: auth.session.role,
      action: "ORDER_CANCELLED",
      entity: "Order",
      entityId: updated.id,
      details: `${updated.restaurant.name} - Masa ${updated.table.name} (#${updated.orderNumber}) iptal edildi. Sebep: ${updated.cancellationReason}. Mutfağa bildirim: ${params.notifyKitchen ? "GÖNDERİLDİ" : "gönderilmedi"}.`,
      restaurantId: updated.restaurantId,
    });

    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/chef");

    return { success: true, data: updated };
  } catch (error: any) {
    console.error("cancelOrder error:", error);
    return { success: false, error: error.message, data: null };
  }
}

// ==========================================
// MUTFAK: DÜŞÜLMEDEN İPTAL BİLDİRİMLERİ
// Bildirimi gönderilmiş ama mutfak tarafından henüz onaylanmamış iptaller.
// Mutfak ekranı bu listeyi periyodik olarak çeker ve onaylayana kadar uyarıda tutar.
// ==========================================
export async function getKitchenCancellationAlerts(restaurantId?: string) {
  const auth = await authorize(KITCHEN_VIEW_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const alerts = await prisma.order.findMany({
      where: {
        status: "CANCELLED",
        kitchenNotifiedAt: { not: null },
        kitchenAckedAt: null,
        ...(restaurantId && restaurantId !== "ALL" ? { restaurantId } : {}),
      },
      orderBy: { cancelledAt: "desc" },
      include: {
        restaurant: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, name: true } },
        waiter: { select: { id: true, name: true } },
        items: { include: { menuItem: { select: { id: true, name: true } } } },
      },
    });

    return { success: true, data: alerts };
  } catch (error: any) {
    console.error("getKitchenCancellationAlerts error:", error);
    return { success: false, error: error.message, data: null };
  }
}

// ==========================================
// MUTFAK: İPTAL BİLDİRİMİNİ ONAYLA
// Onaylanan bildirim tekrar gösterilmez; denetim izine de yazılır.
// ==========================================
export async function acknowledgeKitchenCancellation(orderId: string) {
  const auth = await authorize(KITCHEN_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: true, table: true },
    });
    if (!order) {
      return { success: false, error: "Sipariş bulunamadı.", data: null };
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { kitchenAckedAt: new Date() },
    });

    await logAudit({
      userId: auth.session.id,
      userName: auth.session.name,
      userRole: auth.session.role,
      action: "ORDER_CANCEL_ACKED",
      entity: "Order",
      entityId: orderId,
      details: `${order.restaurant.name} - Masa ${order.table.name} (#${order.orderNumber}) iptal bildirimi mutfak tarafından onaylandı.`,
      restaurantId: order.restaurantId,
    });

    revalidatePath("/kitchen");
    return { success: true, data: true };
  } catch (error: any) {
    console.error("acknowledgeKitchenCancellation error:", error);
    return { success: false, error: error.message, data: null };
  }
}

// SİPARİŞ GİRİŞİ YAPACAKLAR (ŞEF İÇİN GARSON SEÇİMİ)
// Şef siparişi garson adına girer; Order.waiterId zorunlu olduğu için
// siparişi alan garson açıkça seçilmelidir. Böylece "Garson Sipariş
// Dağılımı" raporu da gerçek veriyi gösterir.
// ==========================================
export async function getRestaurantWaiters(restaurantId: string) {
  const auth = await authorize(ORDER_ENTRY_ROLES);
  if (!auth.ok) {
    return { success: false, error: auth.error, data: null };
  }

  try {
    const waiters = await prisma.user.findMany({
      where: {
        role: "WAITER",
        active: true,
        OR: [
          { assignedTo: { some: { restaurantId } } },
          { assignedTo: { none: {} } }, // Restoran ataması olmayan garsonlar tüm alakartlarda çalışabilir
        ],
      },
      select: { id: true, name: true, username: true },
      orderBy: { name: "asc" },
    });

    return { success: true, data: waiters };
  } catch (error: any) {
    console.error("getRestaurantWaiters error:", error);
    return { success: false, error: error.message, data: null };
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
  const auth = await authorize(ORDER_ENTRY_ROLES);
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
