import { requirePageRole } from "@/lib/auth-guard";
import { ADMIN_ONLY } from "@/lib/auth-guard";
import { AdminSidebar } from "./admin-sidebar";

/**
 * Sistem Yoneticisi modulu: yalnizca Tanimlara (kullanici, alakarta, masa,
 * menu/menu gruplari/menu ogeleri) erisebilir. Rapor ve denetim izleri
 * bu modulde BULUNMAZ; tum isleyis raporlari Sef Modulu'ne aittir.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(ADMIN_ONLY);

  return (
    <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 sm:p-6 gap-6">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
