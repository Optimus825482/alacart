import { requirePageRole } from "@/lib/auth-guard";
import { CHEF_REPORT_ROLES } from "@/lib/auth-guard";

/**
 * Sef Modulu sayfa korumasi.
 *
 * Bu modul yalnizca "isleyis, rapor ve denetim izi" alanidir; sistem yoneticisi
 * tanim ekranlarindan ayridir. ADMIN (sistem yoneticisi) super kullanici olarak
 * bu modulu gorebilir, ancak tanim ekranlarinda rapor bulunmaz.
 */
export default async function ChefLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(CHEF_REPORT_ROLES);

  return <>{children}</>;
}
