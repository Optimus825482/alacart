"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Role, TableStatus } from "@/lib/types";
import bcrypt from 'bcryptjs';
import { authorize, ADMIN_ONLY, ANY_AUTHENTICATED } from "@/lib/auth-guard";

// ==========================================
// ALAKART RESTORAN TANIMLARI
// ==========================================

export async function getRestaurants() {
  const auth = await authorize(ANY_AUTHENTICATED);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            tables: true,
            orders: { where: { status: { in: ["PENDING", "PREPARING"] } } },
          },
        },
      },
    });

    return {
      success: true,
      data: restaurants.map((r) => ({
        ...r,
        tablesCount: r._count.tables,
        activeOrdersCount: r._count.orders,
      })),
    };
  } catch (error: any) {
    console.error("getRestaurants error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// OTOMATİK MUTFAK HESABI ÜRETIMI
// ==========================================
// İş kuralı: Mutfak genel kullanıma açıktır ve her alakart restoranın kendi
// mutfak hesabı vardır. Yeni bir alakart tanımlandığı anda sistem otomatik
// olarak o restoran için "mutfak.<KOD>" kullanıcı adı, benzersiz bir PIN ve
// varsayılan şifre ile bir MUTFAK (KITCHEN) hesabı üretir; hesap yalnızca
// o alakarta bağlanır. Böylece yeni alakart eklendiğinde mutfak hesabını
// elle oluşturmak unutulmaz.

const MUTFAK_VARSAYILAN_SIFRE = "1234";

/** "ROOF GARDEN" -> "mutfak.roof.garden" */
function mutfakKullaniciAdiUret(code: string): string {
  const govde = code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return govde ? `mutfak.${govde}` : "mutfak.alakart";
}

/** Kullanıcı adı çakışırsa sonuna sayı ekleyerek benzersizleştirir. */
async function benzersizKullaniciAdiUret(base: string): Promise<string> {
  const mevcut = new Set(
    (
      await prisma.user.findMany({
        where: { username: { startsWith: "mutfak" } },
        select: { username: true },
      })
    ).map((u) => u.username)
  );
  if (!mevcut.has(base)) return base;
  let n = 2;
  while (mevcut.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

/** Hiçbir kullanıcıda kullanılmayan 4 haneli PIN üretir. */
async function benzersizPinUret(): Promise<string> {
  const kullanilan = new Set(
    (
      await prisma.user.findMany({
        where: { pin: { not: null } },
        select: { pin: true },
      })
    )
      .map((u) => u.pin)
      .filter((p): p is string => !!p)
  );
  for (let p = 2001; p <= 9999; p++) {
    if (!kullanilan.has(String(p))) return String(p);
  }
  for (let p = 1000; p <= 2000; p++) {
    if (!kullanilan.has(String(p))) return String(p);
  }
  throw new Error("Kullanilabilir PIN kalmadi.");
}

/**
 * Verilen alakart için mutfak hesabini olusturur.
 * Hem normal hem de transaction istemcisiyle calisabilir.
 */
async function mutfakHesabiUret(
  db: { user: { create: (args: any) => Promise<any> } },
  restaurantId: string,
  restaurantName: string,
  restaurantCode: string
) {
  const username = await benzersizKullaniciAdiUret(mutfakKullaniciAdiUret(restaurantCode));
  const pin = await benzersizPinUret();
  const password = MUTFAK_VARSAYILAN_SIFRE;

  await db.user.create({
    data: {
      name: `${restaurantName} Mutfak`,
      username,
      password: await bcrypt.hash(password, 12),
      pin,
      role: "KITCHEN" as any,
      active: true,
      assignedTo: { create: { restaurantId } },
    },
  });

  return { username, pin, password };
}

export async function createRestaurant(data: {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
}) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const name = data.name.trim();
    const code = data.code.trim().toUpperCase();
    // Kullanici adi ve PIN, kayit oncesi hazirlanir; mutfak hesabi
    // restoranla ayni transaction icinde olusturulur.
    const username = await benzersizKullaniciAdiUret(mutfakKullaniciAdiUret(code));
    const pin = await benzersizPinUret();
    const password = MUTFAK_VARSAYILAN_SIFRE;
    const hashedPassword = await bcrypt.hash(password, 12);

    const restaurant = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          name,
          code,
          description: data.description?.trim(),
          active: data.active ?? true,
        },
      });

      await tx.user.create({
        data: {
          name: `${name} Mutfak`,
          username,
          password: hashedPassword,
          pin,
          role: "KITCHEN" as any,
          active: true,
          assignedTo: { create: { restaurantId: created.id } },
        },
      });

      return created;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    return {
      success: true,
      data: restaurant,
      kitchenUser: { username, pin, password },
    };
  } catch (error: any) {
    console.error("createRestaurant error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Mutfak hesabi olmayan alakartlar icin eksik hesaplari tamamlar.
 * (Kuraldan once eklenmis alakartlar icin kurtarma agzi.)
 */
export async function eksikMutfakHesaplariniTamamla() {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const eksikler = await prisma.restaurant.findMany({
      where: { users: { none: { user: { role: "KITCHEN" } } } },
      orderBy: { createdAt: "asc" },
    });

    const olusanlar: {
      restaurant: string;
      username: string;
      pin: string;
      password: string;
    }[] = [];

    for (const restoran of eksikler) {
      const hesap = await mutfakHesabiUret(
        prisma,
        restoran.id,
        restoran.name,
        restoran.code
      );
      olusanlar.push({ restaurant: restoran.name, ...hesap });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/kitchen");
    return {
      success: true,
      data: { eksikSayisi: eksikler.length, olusanlar },
    };
  } catch (error: any) {
    console.error("eksikMutfakHesaplariniTamamla error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateRestaurant(
  id: string,
  data: { name?: string; code?: string; description?: string; active?: boolean }
) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.code && { code: data.code.trim().toUpperCase() }),
        ...(data.description !== undefined && { description: data.description?.trim() }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: restaurant };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteRestaurant(id: string) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const etkilenenMutfakHesaplari = await prisma.user.findMany({
      where: { role: "KITCHEN", assignedTo: { some: { restaurantId: id } } },
      select: { id: true, assignedTo: { select: { restaurantId: true } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.restaurant.delete({ where: { id } });

      // Alakart silinince, yalnizca bu alakarta bagli olan mutfak
      // hesaplari giris yapamaz hale getirilir (hesap silinmez, geri
      // alinabilir); baska alakarta bagli hesaplar etkilenmez.
      for (const hesap of etkilenenMutfakHesaplari) {
        const kalan = hesap.assignedTo.filter((a) => a.restaurantId !== id);
        if (kalan.length === 0) {
          await tx.user.update({ where: { id: hesap.id }, data: { active: false } });
        }
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// MASA TANIMLARI
// ==========================================

export async function getTables(restaurantId?: string) {
  const auth = await authorize(ANY_AUTHENTICATED);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const tables = await prisma.restaurantTable.findMany({
      where: restaurantId ? { restaurantId } : undefined,
      orderBy: { name: "asc" },
      include: {
        restaurant: { select: { id: true, name: true, code: true } },
        orders: {
          where: { status: { in: ["PENDING", "PREPARING", "COMPLETED"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, orderNumber: true, status: true, createdAt: true },
        },
      },
    });
    return { success: true, data: tables };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createTable(data: {
  name: string;
  capacity?: number;
  restaurantId: string;
}) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const table = await prisma.restaurantTable.create({
      data: {
        name: data.name.trim(),
        capacity: data.capacity || 4,
        restaurantId: data.restaurantId,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: table };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateTable(
  id: string,
  data: { name?: string; capacity?: number; status?: TableStatus; restaurantId?: string }
) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const table = await prisma.restaurantTable.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.capacity && { capacity: data.capacity }),
        ...(data.status && { status: data.status as any }),
        ...(data.restaurantId && { restaurantId: data.restaurantId }),
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: table };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteTable(id: string) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    await prisma.restaurantTable.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// HİYERARŞİK KATEGORİ TANIMLARI
// ==========================================

export async function getCategoriesTree(restaurantId?: string) {
  const auth = await authorize(ANY_AUTHENTICATED);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const whereClause: any = { active: true };
    if (restaurantId && restaurantId !== "ALL") {
      whereClause.restaurantId = restaurantId;
    }

    // Kategorileri çekip hiyerarşik ağaç yapısına dönüştüreceğiz
    const allCategories = await prisma.category.findMany({
      where: whereClause,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        restaurant: {
          select: { id: true, name: true, code: true },
        },
        items: {
          where: { active: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        },
        _count: {
          select: { items: true, children: true },
        },
      },
    });

    // Kök kategorileri (parentId === null) bul ve çocuklarını bağla
    const buildTree = (parentId: string | null): any[] => {
      return allCategories
        .filter((c) => c.parentId === parentId)
        .map((c) => ({
          ...c,
          children: buildTree(c.id),
        }));
    };

    const tree = buildTree(null);

    return { success: true, data: tree, allCategories };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCategory(data: {
  name: string;
  description?: string;
  displayOrder?: number;
  parentId?: string | null;
  restaurantId?: string | null;
}) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    let targetRestId = data.restaurantId || null;
    if (!targetRestId && data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: data.parentId },
        select: { restaurantId: true },
      });
      if (parent?.restaurantId) {
        targetRestId = parent.restaurantId;
      }
    }

    const cat = await prisma.category.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim(),
        displayOrder: data.displayOrder ?? 0,
        parentId: data.parentId || null,
        restaurantId: targetRestId,
      },
      include: {
        restaurant: true,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: cat };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    displayOrder?: number;
    parentId?: string | null;
    active?: boolean;
  }
) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const cat = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.parentId !== undefined && { parentId: data.parentId || null }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: cat };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCategory(id: string) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// YEMEK & İÇECEK (MENÜ ÖĞESİ) TANIMLARI
// ==========================================

export async function getMenuItems(categoryId?: string) {
  const auth = await authorize(ANY_AUTHENTICATED);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const items = await prisma.menuItem.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        category: {
          select: { id: true, name: true, parentId: true },
        },
      },
    });
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createMenuItem(data: {
  name: string;
  description?: string;
  allergens?: string;
  imageUrl?: string;
  defaultNotes?: string;
  categoryId: string;
  displayOrder?: number;
}) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const item = await prisma.menuItem.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim(),
        allergens: data.allergens?.trim(),
        imageUrl: data.imageUrl?.trim() || null,
        defaultNotes: data.defaultNotes?.trim() || null,
        categoryId: data.categoryId,
        displayOrder: data.displayOrder ?? 0,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: item };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateMenuItem(
  id: string,
  data: {
    name?: string;
    description?: string;
    allergens?: string;
    imageUrl?: string;
    defaultNotes?: string;
    categoryId?: string;
    displayOrder?: number;
    active?: boolean;
  }
) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() }),
        ...(data.allergens !== undefined && { allergens: data.allergens?.trim() }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl?.trim() || null }),
        ...(data.defaultNotes !== undefined && { defaultNotes: data.defaultNotes?.trim() || null }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: item };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteMenuItem(id: string) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    await prisma.menuItem.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// KULLANICI & GARSON/MUTFAK/ŞEF TANIMLARI
// ==========================================

export async function getUsers() {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        assignedTo: {
          include: { restaurant: true },
        },
      },
    });
    return { success: true, data: users.map(u => ({ ...u, password: undefined })) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createUser(data: {
  name: string;
  username: string;
  password?: string;
  pin: string;
  role: Role;
  restaurantIds?: string[];
}) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const hashedPassword = await bcrypt.hash((data.password?.trim() || data.pin.trim()), 12);
    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        username: data.username.trim().toLowerCase(),
        password: hashedPassword,
        pin: data.pin.trim(),
        role: data.role as any,
        ...(data.restaurantIds && data.restaurantIds.length > 0 && {
          assignedTo: {
            create: data.restaurantIds.map((rid) => ({
              restaurantId: rid,
            })),
          },
        }),
      },
    });
    revalidatePath("/admin");
    return { success: true, data: user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    username?: string;
    password?: string;
    pin?: string;
    role?: Role;
    active?: boolean;
    restaurantIds?: string[];
  }
) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.username && { username: data.username.trim().toLowerCase() }),
        ...(data.password !== undefined && data.password.trim() !== '' && { password: await bcrypt.hash(data.password.trim(), 12) }),
        ...(data.pin && { pin: data.pin.trim() }),
        ...(data.role && { role: data.role as any }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });

    if (data.restaurantIds !== undefined) {
      await prisma.restaurantUser.deleteMany({ where: { userId: id } });
      if (data.restaurantIds.length > 0) {
        await prisma.restaurantUser.createMany({
          data: data.restaurantIds.map((rid) => ({
            userId: id,
            restaurantId: rid,
          })),
        });
      }
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteUser(id: string) {
  const auth = await authorize(ADMIN_ONLY);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
