import { redirect } from "next/navigation";

/**
 * Denetim logları Şef Modülü'ne taşındı.
 * Bu sayfaya doğrudan erişim Şef Modülü'ne yönlendirilir.
 */
export default function AdminAuditRedirect() {
  redirect("/chef");
}
