import { redirect } from "next/navigation";

/**
 * Tüketim raporları Şef Modülü'ne taşındı.
 * Bu sayfaya doğrudan erişim Şef Modülü'ne yönlendirilir.
 */
export default function AdminReportsRedirect() {
  redirect("/chef");
}
