import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/types";

/**
 * Sunucu tarafı oturum / rol doğrulama katmanı.
 *
 * Modül ayrımının gerçek sınırı burasıdır:
 *   - ADMIN -> yalnızca tanım (kullanıcı, alakart, masa, menü) yönetimi
 *   - CHEF  -> yalnızca canlı işleyiş izleme, rapor ve denetim izleri
 *
 * Arayüzdeki menü/sekme gizlemeyi tek başına yeterli saymıyoruz;
 * server action ve sayfa düzeyinde de aynı kural uygulanır.
 */

export interface ServerSession {
  id: string;
  name: string;
  username: string;
  role: Role;
  activeRestaurantId?: string | null;
  activeRestaurantName?: string | null;
  assignedRestaurantIds?: string[];
}

/** Rol yetki grupları. ADMIN her modülü görebilen süper kullanıcıdır. */
export const ADMIN_ONLY: Role[] = ["ADMIN"];
export const CHEF_REPORT_ROLES: Role[] = ["CHEF", "ADMIN"];
export const KITCHEN_ROLES: Role[] = ["KITCHEN", "CHEF", "ADMIN"];
export const WAITER_ROLES: Role[] = ["WAITER", "ADMIN"];
export const ANY_AUTHENTICATED: Role[] = ["ADMIN", "CHEF", "KITCHEN", "WAITER"];

export async function getServerSession(): Promise<ServerSession | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("alacarte_session")?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServerSession;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type AuthorizeResult =
  | { ok: true; session: ServerSession }
  | { ok: false; error: string };

/** Server action içinde rol doğrulaması. */
export async function authorize(allowed: readonly Role[]): Promise<AuthorizeResult> {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }
  if (!allowed.includes(session.role)) {
    return { ok: false, error: "Bu işlem için yetkiniz bulunmuyor." };
  }
  return { ok: true, session };
}

/** Sayfa düzeyinde rol koruması. Yetkisizse kullanıcının kendi modülüne döner. */
export async function requirePageRole(allowed: readonly Role[]): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!allowed.includes(session.role)) {
    redirect("/");
  }
  return session;
}

/** Server action'lar için standart hata dönüşü. */
export function unauthorized<T>(error: string) {
  return { success: false as const, error, data: null as T | null };
}
