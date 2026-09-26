"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  X,
  Ban,
  BellRing,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Clock,
} from "lucide-react";
import clsx from "clsx";
import { getMyOrdersToday, cancelOrder } from "@/actions/orders";
import { formatInTimeZone } from "@/lib/date-range";

/**
 * GARSON -> "SİPARİŞLERİM" SEKMESİ
 *
 * - Yalnızca garsonun bugün (işletme saat diliminde) girdiği siparişleri listeler.
 * - Her satırda MUTFAK DURUMU rozeti yer alır.
 * - Siparişe tıklayınca detay açılır.
 * - İptal akışı: İptal butonu -> Onay Penceresi -> "Mutfağa bildirilsin mi?" -> Evet/Hayır
 *   Onaylanan iptal için iptal fişi yazdırılır.
 */

export const KITCHEN_STATUS_META: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  PENDING: {
    label: "Bekliyor",
    className: "bg-zinc-700/70 text-zinc-200 border-zinc-600",
    dot: "bg-zinc-300",
  },
  PREPARING: {
    label: "Hazırlanıyor",
    className: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    dot: "bg-amber-400 animate-pulse",
  },
  COMPLETED: {
    label: "Tamamlandı",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  CANCELLED: {
    label: "İptal Edildi",
    className: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    dot: "bg-rose-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = KITCHEN_STATUS_META[status] || {
    label: status,
    className: "bg-zinc-700/70 text-zinc-300 border-zinc-600",
    dot: "bg-zinc-400",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border",
        meta.className
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export default function MyOrdersPanel({
  theme,
  onOpenOrder,
  onCancelled,
}: {
  theme: any;
  onOpenOrder?: (order: any) => void;
  onCancelled?: () => void;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  // İptal akışı
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [askNotify, setAskNotify] = useState(false);
  const [working, setWorking] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [printable, setPrintable] = useState<any | null>(null);

  const load = useCallback(async () => {
    const res = await getMyOrdersToday();
    if (res.success && res.data) setOrders(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Açık sipariş detayı, liste yenilenince güncel kalsın
  const openOrder = openOrderId ? orders.find((o) => o.id === openOrderId) || null : null;
  const cancelOrderObj = printable;

  const startCancel = (order: any) => {
    setCancelTarget(order);
    setCancelReason("");
    setCancelError(null);
    setAskNotify(false);
  };

  const closeCancel = () => {
    setCancelTarget(null);
    setAskNotify(false);
    setCancelError(null);
  };

  const onaylaVeIptalEt = async (notifyKitchen: boolean) => {
    if (!cancelTarget) return;
    setWorking(true);
    setCancelError(null);
    const res = await cancelOrder({
      orderId: cancelTarget.id,
      reason: cancelReason,
      notifyKitchen,
    });
    setWorking(false);
    if (!res.success) {
      setCancelError(res.error || "Sipariş iptal edilemedi.");
      return;
    }
    // Yazıdan çıktı: iptal fişini hazırla ve yazdır penceresini aç
    setPrintable({ order: res.data, notifyKitchen });
    closeCancel();
    await load();
    onCancelled?.();
  };

  // Yazıcıdan çıkış: iptal fişini yazdır, sonra paneli normal moda al
  const printAndClose = () => {
    if (printable) {
      document.documentElement.setAttribute("data-cancel-print", "true");
      const eski = document.getElementById("garson-iptal-fisi");
      if (eski) eski.remove();
      const kutu = document.createElement("div");
      kutu.id = "garson-iptal-fisi";
      const o = printable.order;
      kutu.innerHTML = `
        <div style="font-family:system-ui,sans-serif;padding:24px;color:#000;background:#fff">
          <h1 style="font-size:22px;font-weight:900;margin:0 0 4px">SİPARİŞ İPTAL FİŞİ</h1>
          <p style="font-size:12px;margin:0 0 16px">${o?.restaurant?.name || ""} • ${o?.table?.name || ""}</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tbody>
              <tr><td style="padding:4px 0;border-bottom:1px solid #ddd">Sipariş No</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #ddd">#${o?.orderNumber}</td></tr>
              <tr><td style="padding:4px 0;border-bottom:1px solid #ddd">Sipariş Saati</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #ddd">${o?.createdAt ? new Date(o.createdAt).toLocaleTimeString("tr-TR") : "-"}</td></tr>
              <tr><td style="padding:4px 0;border-bottom:1px solid #ddd">Garson</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #ddd">${o?.waiter?.name || "-"}</td></tr>
              <tr><td style="padding:4px 0;border-bottom:1px solid #ddd">İptal Saati</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #ddd">${o?.cancelledAt ? new Date(o.cancelledAt).toLocaleTimeString("tr-TR") : "-"}</td></tr>
              <tr><td style="padding:4px 0;border-bottom:1px solid #ddd">İptal Sebebi</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #ddd">${o?.cancellationReason || "-"}</td></tr>
              <tr><td style="padding:4px 0">Mutfağa Bildirim</td><td style="text-align:right;font-weight:700">${printable.notifyKitchen ? "GÖNDERİLDİ" : "GÖNDERİLMEDİ"}</td></tr>
            </tbody>
          </table>
          <h2 style="font-size:13px;font-weight:900;margin:18px 0 6px">İptal Edilen Ürünler</h2>
          ${(o?.items || [])
            .map(
              (i: any) =>
                `<div style="font-size:12px;padding:3px 0">${i.quantity}x ${i.menuItem?.name || ""}${
                  i.itemNotes ? ` <em>(${i.itemNotes})</em>` : ""
                }</div>`
            )
            .join("")}
        </div>`;
      document.body.appendChild(kutu);
      window.print();
      setTimeout(() => {
        document.documentElement.removeAttribute("data-cancel-print");
        kutu.remove();
        setPrintable(null);
      }, 800);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-5 space-y-4">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Siparişlerim
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Bugün verdiğiniz siparişler ve mutfak durumları
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
          Yenile
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-500 font-semibold">
          Siparişleriniz yükleniyor...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <Receipt className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-400">Bugün henüz sipariş vermediniz</p>
          <p className="text-xs text-zinc-600 mt-1">
            Sipariş girdikçe burada mutfak durumuyla birlikte görünecek.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-3xl border border-zinc-800 bg-[#0f1422] shadow-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenOrderId(order.id);
                  onOpenOrder?.(order);
                }}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-zinc-800/40 transition"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="shrink-0 w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold">#</span>
                    <span className="text-sm font-black leading-none">
                      {order.orderNumber}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">
                        {order.table?.name}
                      </span>
                      <StatusBadge status={order.status} />
                      {order.isUpdated && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          Revizyon #{order.revision}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatInTimeZone(order.createdAt).split(",").pop()?.trim()}
                      </span>
                      <span>•</span>
                      <span>{order.items?.length || 0} ürün</span>
                      {order.notes && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[180px]">{order.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 shrink-0" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Sipariş detayı ---------------- */}
      {openOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setOpenOrderId(null)}
        >
          <div
            className="bg-[#0f1422] border border-amber-500/40 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Sipariş Detayı
                  </span>
                  <StatusBadge status={openOrder.status} />
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  #{openOrder.orderNumber} • {openOrder.table?.name}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {formatInTimeZone(openOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenOrderId(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              {openOrder.notes && (
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-300">
                  <strong className="text-amber-400/90">Sipariş Notu:</strong> {openOrder.notes}
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">
                  Ürünler
                </span>
                <div className="space-y-1.5">
                  {openOrder.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between text-xs py-2 px-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60"
                    >
                      <div>
                        <span className="font-semibold text-white">
                          {item.menuItem?.name}
                        </span>
                        {item.itemNotes && (
                          <span className="block text-[11px] text-amber-400/90">
                            👉 {item.itemNotes}
                          </span>
                        )}
                      </div>
                      <span className="font-black text-amber-400">{item.quantity}x</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zaman damgaları */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                  <span className="text-zinc-500 block">Sipariş Saati</span>
                  <span className="text-white font-bold">{formatInTimeZone(openOrder.createdAt)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                  <span className="text-zinc-500 block">Hazırlanma</span>
                  <span className="text-white font-bold">
                    {openOrder.preparingStartedAt
                      ? formatInTimeZone(openOrder.preparingStartedAt)
                      : "-"}
                  </span>
                </div>
                {openOrder.status === "CANCELLED" && (
                  <>
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                      <span className="text-rose-300/70 block">İptal Saati</span>
                      <span className="text-rose-200 font-bold">
                        {openOrder.cancelledAt ? formatInTimeZone(openOrder.cancelledAt) : "-"}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                      <span className="text-rose-300/70 block">İptal Sebebi</span>
                      <span className="text-rose-200 font-bold">
                        {openOrder.cancellationReason || "-"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Eylemler */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpenOrderId(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition"
              >
                Kapat
              </button>
              {openOrder.status !== "CANCELLED" && openOrder.status !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={() => startCancel(openOrder)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition flex items-center gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  Siparişi İptal Et
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- İptal onay penceresi ---------------- */}
      {cancelTarget && !askNotify && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-rose-500/40 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Sipariş İptal Onayı</h3>
                <p className="text-[11px] text-zinc-400">
                  #{cancelTarget.orderNumber} • {cancelTarget.table?.name}
                </p>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Bu sipariş iptal edilecek. İptal işlemi geri alınamaz ve
                mutfak akışını etkiler.
              </p>
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-400 block mb-1">
                  İptal Sebebi (opsiyonel)
                </span>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Örn: Müşteri vazgeçti, hatalı sipariş..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </label>
              {cancelError && (
                <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {cancelError}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeCancel}
                disabled={working}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => setAskNotify(true)}
                disabled={working}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition"
              >
                İptali Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- "Mutfağa bildirilsin mi?" ---------------- */}
      {cancelTarget && askNotify && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-amber-500/40 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Mutfağa Bilgi Gönderilsin mi?
                </h3>
                <p className="text-[11px] text-zinc-400">#{cancelTarget.orderNumber} iptal ediliyor</p>
              </div>
            </div>

            <p className="py-4 text-xs text-zinc-300 leading-relaxed">
              Mutfak bu siparişi hazırlamaya başlamış olabilir. Bildirim
              gönderilirse mutfak ekranında düşülmeyen bir iptal uyarısı
              belirir ve iptal fişi bastırılır.
            </p>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onaylaVeIptalEt(false)}
                disabled={working}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition"
              >
                Hayır, Gönderme
              </button>
              <button
                type="button"
                onClick={() => onaylaVeIptalEt(true)}
                disabled={working}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition"
              >
                {working ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                Evet, Mutfağa Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Yazıcıdan çıktı kapısı ---------------- */}
      {printable && (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0f1422] border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-black text-white">Sipariş İptal Edildi</h3>
            <p className="text-xs text-zinc-400 mt-1">
              #{printable.order?.orderNumber} iptal edildi.{" "}
              {printable.notifyKitchen
                ? "Mutfağa iptal bildirimi gönderildi."
                : "Mutfağa bildirim gönderilmedi."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={printAndClose}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition"
              >
                <Printer className="w-4 h-4" />
                İptal Fişini Yazdır
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintable(null);
                  document.getElementById("garson-iptal-fisi")?.remove();
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}