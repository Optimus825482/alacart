import { requirePageRole } from "@/lib/auth-guard";
import { ORDER_ENTRY_ROLES } from "@/lib/auth-guard";

/**
 * Garson Modulu sayfa korumasi.
 *
 * Siparis girisi / ilave ekleme yetkisi olan roller: WAITER, CHEF, ADMIN.
 * KITCHEN bu ekrana girer; mutfak siparis hazirlar ama garson siparisini girmez.
 */
export default async function WaiterLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(ORDER_ENTRY_ROLES);

  return <>{children}</>;
}