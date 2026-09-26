"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Role, TableStatus } from "@/lib/types";
import bcrypt from 'bcryptjs';

// ==========================================
// ALAKART RESTORAN TANIMLARI
// ==========================================

export async function getRestaurants() {
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

export async function createRestaurant(data: {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
}) {
  try {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        description: data.description?.trim(),
        active: data.active ?? true,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true, data: restaurant };
  } catch (error: any) {
    console.error("createRestaurant error:", error);
    return { success: false, error: error.message };
  }
}

export async function updateRestaurant(
  id: string,
  data: { name?: string; code?: string; description?: string; active?: boolean }
) {
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
  try {
    await prisma.restaurant.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/waiter");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// MASA TANIMLARI
// ==========================================

export async function getTables(restaurantId?: string) {
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
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
