import { requirePageRole } from "@/lib/auth-guard";
import { KITCHEN_VIEW_ROLES } from "@/lib/auth-guard";

/**
 * Mutfak Modulu sayfa korumasi.
 *
 * Canli mutfak akisini gormeye yetkili roller: KITCHEN, CHEF, ADMIN.
 * Durum isaretleme ("Hazirlaniyor" / "Tamamlandi") ayrica sunucu tarafinda
 * KITCHEN_STATUS_ROLES ile sinirlandirilir; sef yalnizca izler.
 */
export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(KITCHEN_VIEW_ROLES);

  return <>{children}</>;
}