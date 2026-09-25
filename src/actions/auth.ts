"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";

export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "CHEF" | "KITCHEN" | "WAITER";
  activeRestaurantId?: string | null;
  activeRestaurantName?: string | null;
  assignedRestaurantIds?: string[];
}

// ==========================================
// KULLANICI GİRİŞİ (LOGIN)
// ==========================================
export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { success: false, error: "Kullanıcı adı ve şifre gereklidir." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      include: {
        assignedTo: {
          include: { restaurant: true },
        },
      },
    });

    if (!user || !user.active) {
      return { success: false, error: "Geçersiz kullanıcı adı veya kullanıcı pasif durumda." };
    }

    // Şifre kontrolü
    if (user.password !== password.trim()) {
      return { success: false, error: "Hatalı şifre girdiniz." };
    }

    const assignedIds = user.assignedTo.map((a) => a.restaurantId);
    // Garson ve Mutfak kullanıcıları sisteme giriş yaptığında her zaman önce alakart seçimi yapacak
    const defaultRestaurantId: string | null = null;
    const defaultRestaurantName: string | null = null;

    const session: SessionUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role as any,
      activeRestaurantId: defaultRestaurantId,
      activeRestaurantName: defaultRestaurantName,
      assignedRestaurantIds: assignedIds,
    };

    const cookieStore = await cookies();
    cookieStore.set("alacarte_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 gün
      path: "/",
    });

    // Audit kaydı oluştur
    await logAudit({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      details: `${user.name} sisteme giriş yaptı (${user.role}).`,
    });

    // Role göre hedef rota
    let redirectUrl = "/";
    switch (user.role) {
      case "ADMIN":
        redirectUrl = "/admin";
        break;
      case "CHEF":
        redirectUrl = "/chef";
        break;
      case "KITCHEN":
        redirectUrl = "/kitchen";
        break;
      case "WAITER":
        redirectUrl = "/waiter";
        break;
    }

    return { success: true, redirectUrl, user: session };
  } catch (error: any) {
    console.error("Login error:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// AKTİF OTURUM BİLGİSİNİ AL (GET SESSION)
// ==========================================
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("alacarte_session");
    if (!sessionCookie?.value) return null;
    return JSON.parse(sessionCookie.value) as SessionUser;
  } catch {
    return null;
  }
}

// ==========================================
// ALAKART RESTORAN SEÇİMİ VE KİLİTLEME
// ==========================================
export async function selectRestaurantAction(restaurantIdOrCode: string) {
  try {
    const cookieStore = await cookies();
    let session = await getSessionUser();

    if (!restaurantIdOrCode) {
      return { success: false, error: "Restoran bilgisi eksik." };
    }

    const cleanParam = restaurantIdOrCode.trim();

    // ID, KOD veya İSME göre restoranı esnek şekilde bul
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { id: cleanParam },
          { code: cleanParam.toUpperCase() },
          { name: { equals: cleanParam, mode: "insensitive" } },
        ],
      },
    });

    if (!restaurant) {
      return { success: false, error: `Restoran bulunamadı (${cleanParam}).` };
    }

    // Eğer oturum çerezi yoksa veritabanından varsayılan kullanıcı ile oturum oluştur
    if (!session) {
      const fallbackUser = await prisma.user.findFirst({
        where: { role: { in: ["WAITER", "ADMIN"] }, active: true },
      });

      session = {
        id: fallbackUser?.id || "waiter-guest",
        name: fallbackUser?.name || "Garson",
        username: fallbackUser?.username || "garson",
        role: (fallbackUser?.role as any) || "WAITER",
        activeRestaurantId: restaurant.id,
        activeRestaurantName: restaurant.name,
        assignedRestaurantIds: [restaurant.id],
      };
    } else {
      session.activeRestaurantId = restaurant.id;
      session.activeRestaurantName = restaurant.name;
    }

    cookieStore.set("alacarte_session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    try {
      await logAudit({
        userId: session.id,
        userName: session.name,
        userRole: session.role,
        action: "SELECT_RESTAURANT",
        entity: "Restaurant",
        entityId: restaurant.id,
        details: `${session.name} ${restaurant.name} alakartını seçti ve kilitlendi.`,
        restaurantId: restaurant.id,
      });
    } catch (auditErr) {
      console.warn("Audit log notice:", auditErr);
    }

    return { success: true, restaurant };
  } catch (error: any) {
    console.error("selectRestaurantAction error:", error);
    return { success: false, error: error.message || "Restoran seçilirken bir hata oluştu." };
  }
}

// ==========================================
// RESTORAN KİLİDİNİ KALDIR (RESTORAN DEĞİŞTİR)
// ==========================================
export async function clearActiveRestaurantAction() {
  try {
    const cookieStore = await cookies();
    const session = await getSessionUser();
    if (session) {
      session.activeRestaurantId = null;
      session.activeRestaurantName = null;
      cookieStore.set("alacarte_session", JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==========================================
// ÇIKIŞ YAP (LOGOUT)
// ==========================================
export async function logoutAction() {
  const session = await getSessionUser();
  if (session) {
    await logAudit({
      userId: session.id,
      userName: session.name,
      userRole: session.role,
      action: "LOGOUT",
      entity: "User",
      entityId: session.id,
      details: `${session.name} sistemden çıkış yaptı.`,
      restaurantId: session.activeRestaurantId || undefined,
    });
  }

  const cookieStore = await cookies();
  cookieStore.delete("alacarte_session");
  redirect("/login");
}
