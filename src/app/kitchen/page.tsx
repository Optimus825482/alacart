"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChefHat,
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Volume2,
  VolumeX,
  Flame,
  Check,
  Filter,
} from "lucide-react";
import { getRestaurants } from "@/actions/definitions";
import { playKitchenChime } from "@/lib/sound";
import clsx from "clsx";

export default function KitchenKDSPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE"); // "ACTIVE", "PENDING", "PREPARING", "ALL"
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<any | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // Önceki sipariş sayısını takip etmek için ref (Yeni sipariş düştüğünde zili çalmak için)
  const previousOrderCountRef = useRef<number>(0);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());

  // Restoranları yükle
  useEffect(() => {
    async function loadRestaurants() {
      const res = await getRestaurants();
      if (res.success && res.data) {
        setRestaurants(res.data);
      }
    }
    loadRestaurants();
  }, []);

  // Siparişleri API üzerinden getir
  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedRestaurantId !== "ALL") {
        params.append("restaurantId", selectedRestaurantId);
      }

      const res = await fetch(`/api/kitchen/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        const newOrders = data.data;

        // Yeni sipariş tespiti (yeni gelen sipariş ID'si var mı?)
        const currentIds = new Set<string>(newOrders.map((o: any) => String(o.id)));
        const hasNewIncoming = newOrders.some(
          (o: any) => !previousOrderIdsRef.current.has(o.id) && o.status === "PENDING"
        );

        if (hasNewIncoming && previousOrderIdsRef.current.size > 0) {
          if (soundEnabled) {
            playKitchenChime();
          }

          // Otomatik yazdırma açıksa ilk yeni siparişi yazdır
          if (autoPrintEnabled) {
            const firstNew = newOrders.find(
              (o: any) => !previousOrderIdsRef.current.has(o.id)
            );
            if (firstNew) {
              handlePrintTicket(firstNew);
            }
          }
        }

        previousOrderIdsRef.current = currentIds;
        previousOrderCountRef.current = newOrders.length;
        setOrders(newOrders);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("fetchOrders error:", err);
    } finally {
      setLoading(false);
    }
  };

  // İlk yükleme ve periyodik canlı polling (3.5 saniyede bir)
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3500);
    return () => clearInterval(interval);
  }, [selectedRestaurantId, soundEnabled, autoPrintEnabled]);

  // Durum Güncelleme (Hazırlanıyor / Tamamlandı)
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/kitchen/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Termal Adisyon / Fiş Yazdırma
  const handlePrintTicket = async (order: any) => {
    setPrintingOrder(order);
    
    // API'ye yazdırıldı olarak işaretle
    fetch("/api/kitchen/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, action: "print" }),
    }).catch(console.error);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Filtrelenmiş siparişler
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "ACTIVE") return o.status === "PENDING" || o.status === "PREPARING";
    if (statusFilter === "PENDING") return o.status === "PENDING";
    if (statusFilter === "PREPARING") return o.status === "PREPARING";
    return true;
  });

  // Geçen süreyi hesapla (dakika cinsinden)
  const getElapsedMinutes = (dateStr: string) => {
    const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return Math.max(0, elapsed);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* KDS Header & Kontrol Paneli */}
      <div className="bg-[#0f1422] border border-zinc-800 rounded-3xl p-4 sm:p-5 mb-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                  CANLI MUTFAK EKRANI (KDS)
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white">
                Sipariş & Yazıcı Takip Terminali
              </h2>
            </div>
          </div>

          {/* Quick Action Toggles */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Restoran Filtresi */}
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-amber-300 text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="ALL">Tüm Alakartlar ({restaurants.length})</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Sesli Uyarı Butonu */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playKitchenChime();
              }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                soundEnabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
              title="Yeni sipariş geldiğinde sesli otel zili çalar"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Ses Açık</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-zinc-500" />
                  <span className="hidden sm:inline">Ses Kapalı</span>
                </>
              )}
            </button>

            {/* Otomatik Yazıcı Toggle */}
            <button
              onClick={() => setAutoPrintEnabled(!autoPrintEnabled)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                autoPrintEnabled
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
              )}
              title="Yeni sipariş düştüğünde yazdırma penceresini otomatik tetikler"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Oto Yazdır:</span>
              <span>{autoPrintEnabled ? "Açık" : "Manuel"}</span>
            </button>

            {/* Manuel Yenileme */}
            <button
              onClick={fetchOrders}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"
              title="Şimdi Yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/80 overflow-x-auto pb-1">
          <span className="text-xs text-zinc-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtre:
          </span>
          {[
            { key: "ACTIVE", label: "Aktif Siparişler", count: orders.filter((o) => o.status === "PENDING" || o.status === "PREPARING").length },
            { key: "PENDING", label: "Bekleyenler (Yeni)", count: orders.filter((o) => o.status === "PENDING").length },
            { key: "PREPARING", label: "Hazırlanıyor", count: orders.filter((o) => o.status === "PREPARING").length },
            { key: "ALL", label: "Tümü", count: orders.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={clsx(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5",
                statusFilter === tab.key
                  ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              )}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-3xl bg-zinc-900/30 border border-zinc-800/60 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800/60 flex items-center justify-center text-zinc-500 mb-3">
            <ChefHat className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            Şu Anda Bekleyen Sipariş Bulunmuyor
          </h3>
          <p className="text-zinc-500 text-xs max-w-sm">
            Garson masadan sipariş gönderdiğinde bu ekranda otomatik olarak belirecek ve sesli uyarı verilecektir.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const elapsed = getElapsedMinutes(order.createdAt);
            const isUrgent = elapsed >= 12; // 12 dakikayı geçen siparişler için kırmızı ikaz
            const isPreparing = order.status === "PREPARING";

            return (
              <div
                key={order.id}
                className={clsx(
                  "rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-lg",
                  isPreparing
                    ? "bg-[#0b1424] border-blue-500/40"
                    : isUrgent
                    ? "bg-[#1f0f12] border-rose-500/60 ring-1 ring-rose-500/40"
                    : "bg-[#111726] border-amber-500/30"
                )}
              >
                {/* Order Card Header */}
                <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 block tracking-wider uppercase">
                      {order.restaurant?.name}
                    </span>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                      <span>{order.table?.name}</span>
                      <span className="text-xs font-mono font-normal text-zinc-500">
                        #{order.orderNumber}
                      </span>
                    </h3>
                  </div>

                  {/* Elapsed Timer & Badge */}
                  <div className="text-right">
                    <div
                      className={clsx(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold font-mono",
                        isUrgent
                          ? "bg-rose-500 text-white animate-pulse"
                          : isPreparing
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      )}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{elapsed} dk</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Garson: {order.waiter?.name}
                    </span>
                  </div>
                </div>

                {/* General Table Note (if present) */}
                {order.notes && (
                  <div className="p-2.5 mx-3 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                    📌 <strong>Masa Notu:</strong> {order.notes}
                  </div>
                )}

                {/* Items List */}
                <div className="p-4 space-y-2.5 flex-1">
                  {order.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-amber-500 text-zinc-950 font-extrabold text-xs flex items-center justify-center">
                            {item.quantity}x
                          </span>
                          <span className="text-sm font-bold text-white">
                            {item.menuItem?.name}
                          </span>
                        </div>

                        {/* Özel İstek / Pişme Notu */}
                        {item.itemNotes && (
                          <div className="mt-1 ml-8">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-400 text-zinc-950 inline-block shadow-sm">
                              👉 {item.itemNotes}
                            </span>
                          </div>
                        )}

                        {item.menuItem?.allergens && (
                          <div className="mt-0.5 ml-8 text-[10px] text-rose-400">
                            Alerjen: {item.menuItem.allergens}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-2">
                  {/* Fiş Yazdır Butonu */}
                  <button
                    onClick={() => handlePrintTicket(order)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all active:scale-95"
                    title="80mm termal mutfak adisyonu yazdır"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Yazdır</span>
                    {order.printedAt && (
                      <Check className="w-3 h-3 text-emerald-400" />
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Hazırlanıyor Butonu */}
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all active:scale-95"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Hazırlanıyor</span>
                      </button>
                    )}

                    {/* Tamamlandı Butonu */}
                    <button
                      onClick={() => handleUpdateStatus(order.id, "COMPLETED")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-extrabold transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tamamlandı</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          80mm TERMAL MUTFAK ADİSYONU (PRINT SLIP COMPONENT)
          Ekran görünümünde gizli, Ctrl+P veya Yazdır'da görünür
          ======================================================== */}
      {printingOrder && (
        <div id="printable-kitchen-ticket" className="hidden">
          <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 2px 0" }}>
              MERİT HOTELS & RESORTS
            </h2>
            <div style={{ fontSize: "12px", fontWeight: "bold" }}>
              {printingOrder.restaurant?.name}
            </div>
            <div style={{ fontSize: "11px" }}>*** MUTFAK SİPARİŞ FİŞİ ***</div>
          </div>

          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "8px", fontSize: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold" }}>
              <span>MASA: {printingOrder.table?.name}</span>
              <span>#{printingOrder.orderNumber}</span>
            </div>
            <div>Garson: {printingOrder.waiter?.name}</div>
            <div>Tarih: {new Date(printingOrder.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</div>
            {printingOrder.notes && (
              <div style={{ marginTop: "4px", fontWeight: "bold", border: "1px solid #000", padding: "2px 4px" }}>
                MASA NOTU: {printingOrder.notes}
              </div>
            )}
          </div>

          {/* Kalemler */}
          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "8px", marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}>
              <span>ADET / ÜRÜN</span>
              <span>DURUM</span>
            </div>
            {printingOrder.items?.map((it: any, idx: number) => (
              <div key={idx} style={{ marginBottom: "6px" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                  {it.quantity}x {it.menuItem?.name}
                </div>
                {it.itemNotes && (
                  <div style={{ fontSize: "12px", fontWeight: "bold", paddingLeft: "10px" }}>
                    &gt;&gt; ÖZEL: {it.itemNotes}
                  </div>
                )}
                {it.menuItem?.allergens && (
                  <div style={{ fontSize: "10px", paddingLeft: "10px" }}>
                    [Alerjen: {it.menuItem.allergens}]
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
            * Ultra All-Inclusive Otel Konsepti - Fiyat Yoktur *
          </div>
        </div>
      )}
    </div>
  );
}
