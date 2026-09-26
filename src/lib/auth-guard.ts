import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/types";

/**
 * Sunucu tarafı oturum / rol doğrulama katmanı.
 *
 * Modül ayrımının gerçek sınırı burasıdır:
 *   - ADMIN -> yalnızca tanım (kullanıcı, alakart, masa, menü) yönetimi
 *   - CHEF  -> canlı işleyiş izleme, rapor/denetim ve sipariş girişi
 *
 * Şef'in sipariş girebilmesi, "Tanım yönetimi" sınırını ihlal etmez: sipariş
 * bir tanım değil, canlı operasyon kaydıdır. Buna karşılık mutfağın durum
 * işaretlemesi (Hazırlandı / Tamamlandı) yalnızca KITCHEN ve ADMIN'e açıktır.
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

/**
 * Rol yetki grupları. ADMIN her modülü görebilen süper kullanıcıdır.
 *
 * Kritik ayrım: "mutfağı GÖRMEK" ile "mutfağın durumunu GÜNCELLEMEK" farklı yetkilerdir.
 * Şef canlı akışı izler ve sipariş girebilir, ancak "Hazırlandı / Tamamlandı"
 * işaretlemesi mutfağın işidir. Bu yüzden tek bir KITCHEN_ROLES yerine
 * görüntüleme, durum işaretleme ve iptal için ayrı gruplar tanımlanır.
 */
export const ADMIN_ONLY: Role[] = ["ADMIN"];
export const CHEF_REPORT_ROLES: Role[] = ["CHEF", "ADMIN"];

/** KDS / mutfak akışını GÖRME ve takip etme yetkisi (durum değiştirme hariç). */
export const KITCHEN_VIEW_ROLES: Role[] = ["KITCHEN", "CHEF", "ADMIN"];

/** "Hazırlanıyor" ve "Tamamlandı" işaretleme yetkisi — yalnızca mutfak. */
export const KITCHEN_STATUS_ROLES: Role[] = ["KITCHEN", "ADMIN"];

/** "İptal" işaretleme yetkisi — amir/şef denetimi. */
export const ORDER_CANCEL_ROLES: Role[] = ["KITCHEN", "CHEF", "ADMIN"];

/** Sipariş girişi / ilave ekleme yetkisi: garson, şef (restoran seçerek) ve admin. */
export const ORDER_ENTRY_ROLES: Role[] = ["WAITER", "CHEF", "ADMIN"];

/** @deprecated Görüntüleme için KITCHEN_VIEW_ROLES kullanın. */
export const KITCHEN_ROLES: Role[] = KITCHEN_VIEW_ROLES;
export const WAITER_ROLES: Role[] = ORDER_ENTRY_ROLES;
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
