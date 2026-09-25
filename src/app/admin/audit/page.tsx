import { getAuditLogs } from "@/actions/chef";
import { getRestaurants } from "@/actions/definitions";
import { Shield } from "lucide-react";
import clsx from "clsx";

export default async function AdminAuditPage() {
  const [logsRes, restRes] = await Promise.all([
    getAuditLogs({ limit: 150 }),
    getRestaurants(),
  ]);

  const logs = logsRes.data || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
          GÜVENLİK & DENETİM İZİ
        </span>
        <h2 className="text-2xl font-black text-white">Sistem Denetim Logları</h2>
        <span className="text-xs text-zinc-400">
          Garson siparişleri, mutfak hazırlık onayları, fiş basımları ve kullanıcı girişlerinin tam denetim izi
        </span>
      </div>

      <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="py-2.5 px-3">Zaman</th>
              <th className="py-2.5 px-3">Kullanıcı</th>
              <th className="py-2.5 px-3">Rol</th>
              <th className="py-2.5 px-3">İşlem</th>
              <th className="py-2.5 px-3">Restoran</th>
              <th className="py-2.5 px-3">Açıklama / Detay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-500">
                  Henüz kayıtlı denetim logu bulunmuyor.
                </td>
              </tr>
            ) : (
              logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-zinc-900/40">
                  <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">{log.userName}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        log.userRole === "ADMIN"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : log.userRole === "CHEF"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : log.userRole === "KITCHEN"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      )}
                    >
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-amber-300">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400">
                    {log.restaurant?.name || "-"}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-300">{log.details || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
