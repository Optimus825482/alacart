"use client";

import { useState, useEffect, useTransition } from "react";
import {
  ChefHat,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  Utensils,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layers,
  Search,
  ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";
import clsx from "clsx";
import { getRestaurants } from "@/actions/definitions";
import { getChefMasterKds, getChefAnalyticsAndReport, getAuditLogs } from "@/actions/chef";
import { updateOrderStatus, markOrderPrinted } from "@/actions/orders";
import { getSessionUser } from "@/actions/auth";
import { RESTAURANT_THEMES } from "@/lib/themes";

export default function ChefModulePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"kds" | "analytics" | "audit">("kds");
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("ALL");

  // Master KDS state
  const [kdsOrders, setKdsOrders] = useState<any[]>([]);
  const [loadingKds, setLoadingKds] = useState(true);
  const [autoRefreshKds, setAutoRefreshKds] = useState(true);

  // Date range reporting state
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedAuditAction, setSelectedAuditAction] = useState<string>("ALL");
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Load Initial User & Restaurants
  useEffect(() => {
    getSessionUser().then((u) => {
      setCurrentUser(u);
    });
    getRestaurants().then((res) => {
      if (res.success && res.data) {
        setRestaurants(res.data);
      }
    });
  }, []);

  // Fetch KDS orders
  const loadKds = async () => {
    const res = await getChefMasterKds(selectedRestaurantId);
    if (res.success && res.data) {
      setKdsOrders(res.data);
    }
    setLoadingKds(false);
  };

  // Fetch Analytics
  const loadReport = async () => {
    setLoadingReport(true);
    const res = await getChefAnalyticsAndReport({
      restaurantId: selectedRestaurantId,
      startDate,
      endDate,
    });
    if (res.success && res.data) {
      setReportData(res.data);
    }
    setLoadingReport(false);
  };

  // Fetch Audit Logs
  const loadAudit = async () => {
    setLoadingAudit(true);
    const res = await getAuditLogs({
      restaurantId: selectedRestaurantId,
      action: selectedAuditAction,
      limit: 150,
    });
    if (res.success && res.data) {
      setAuditLogs(res.data);
    }
    setLoadingAudit(false);
  };

  // Reload data on tab or restaurant filter change
  useEffect(() => {
    if (activeTab === "kds") {
      loadKds();
    } else if (activeTab === "analytics") {
      loadReport();
    } else if (activeTab === "audit") {
      loadAudit();
    }
  }, [activeTab, selectedRestaurantId]);

  // Auto-refresh for KDS tab
  useEffect(() => {
    if (activeTab !== "kds" || !autoRefreshKds) return;
    const interval = setInterval(() => {
      loadKds();
    }, 7000);
    return () => clearInterval(interval);
  }, [activeTab, autoRefreshKds, selectedRestaurantId]);

  // Order status update handler
  const handleStatusChange = async (orderId: string, newStatus: any) => {
    await updateOrderStatus(orderId, newStatus, {
      id: currentUser?.id,
      name: currentUser?.name || "Koordinatör Şef",
      role: "CHEF",
    });
    loadKds();
  };

  const handlePrint = async (orderId: string) => {
    await markOrderPrinted(orderId, {
      id: currentUser?.id,
      name: currentUser?.name || "Koordinatör Şef",
      role: "CHEF",
    });
    window.print();
    loadKds();
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!reportData || !reportData.orders || reportData.orders.length === 0) {
      alert("Dışa aktarılacak sipariş verisi bulunamadı.");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Sipariş Detayları ve Süreler
    const ordersSheetData = reportData.orders.map((o: any) => ({
      "Sipariş No": `#${o.orderNumber}`,
      "Alakart Restoran": o.restaurantName,
      "Masa": o.tableName,
      "Garson": o.waiterName,
      "Durum": o.status === "COMPLETED" ? "Tamamlandı" : o.status === "PREPARING" ? "Hazırlanıyor" : o.status === "PENDING" ? "Bekliyor" : "İptal",
      "Ürün Sayısı": o.itemCount,
      "Sipariş İçeriği": o.itemsSummary,
      "Sipariş Saati": new Date(o.createdAt).toLocaleTimeString("tr-TR"),
      "Mutfak Başlama": o.preparingStartedAt ? new Date(o.preparingStartedAt).toLocaleTimeString("tr-TR") : "-",
      "Tamamlanma Saati": o.completedAt ? new Date(o.completedAt).toLocaleTimeString("tr-TR") : "-",
      "Hazırlık Süresi (Dk)": o.prepDurationMinutes !== null ? `${o.prepDurationMinutes} dk` : "-",
      "Özel Notlar": o.notes || "-",
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersSheetData);
    XLSX.utils.book_append_sheet(wb, wsOrders, "Siparişler & Süreler");

    // Sheet 2: Popüler Ürünler
    if (reportData.topDishes && reportData.topDishes.length > 0) {
      const topDishesSheet = reportData.topDishes.map((d: any, idx: number) => ({
        "Sıra": idx + 1,
        "Ürün Adı": d.name,
        "Kategori": d.category,
        "Toplam Tüketim Adedi": d.count,
      }));
      const wsDishes = XLSX.utils.json_to_sheet(topDishesSheet);
      XLSX.utils.book_append_sheet(wb, wsDishes, "Popüler Lezzetler");
    }

    // Sheet 3: Garson Performansı
    if (reportData.waiterStats && reportData.waiterStats.length > 0) {
      const waiterSheet = reportData.waiterStats.map((w: any) => ({
        "Garson Adı": w.name,
        "Açılan Sipariş Sayısı": w.count,
      }));
      const wsWaiters = XLSX.utils.json_to_sheet(waiterSheet);
      XLSX.utils.book_append_sheet(wb, wsWaiters, "Garson Performansı");
    }

    const filename = `Merit_Alacarte_Rapor_${startDate}_${endDate}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <ChefHat className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                MERIT HOTELS & RESORTS
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                Ultra Her Şey Dahil A La Carte Koordinasyonu
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
              Baş Aşçı / Koordinatör Şef Portalı
            </h1>
          </div>
        </div>

        {/* Restaurant Selector Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0f1422] border border-zinc-800 rounded-2xl p-1.5 shadow-md">
            <span className="text-xs text-zinc-400 pl-2 font-semibold flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              Restoran:
            </span>
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">🌐 Tüm Alakart Restoranlar (Merit Geneli)</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (activeTab === "kds") loadKds();
              if (activeTab === "analytics") loadReport();
              if (activeTab === "audit") loadAudit();
            }}
            className="p-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all shadow-md"
            title="Verileri Yenile"
          >
            <RefreshCw className={clsx("w-4 h-4", isPending && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("kds")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "kds"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Canlı Master KDS</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-zinc-950/40 text-current ml-1">
            {kdsOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "analytics"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Tarih Aralıklı Raporlama & Hazırlık Süreleri</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={clsx(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm",
            activeTab === "audit"
              ? "bg-amber-500 text-zinc-950 shadow-amber-500/20"
              : "bg-[#0f1422] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
          )}
        >
          <Shield className="w-4 h-4" />
          <span>Sistem Denetim Logları (Audit)</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MASTER KDS (CANLI OPERASYON) */}
      {/* ======================================================== */}
      {activeTab === "kds" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-zinc-300">
                Canlı Mutfak Akışı ({kdsOrders.length} Bekleyen / Hazırlanan Sipariş)
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 hover:text-zinc-200">
              <input
                type="checkbox"
                checked={autoRefreshKds}
                onChange={(e) => setAutoRefreshKds(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
              />
              <span>Otomatik Canlı Güncelleme (7 sn)</span>
            </label>
          </div>

          {loadingKds ? (
            <div className="p-16 text-center text-zinc-500">Master KDS yükleniyor...</div>
          ) : kdsOrders.length === 0 ? (
            <div className="p-16 rounded-3xl bg-[#0f1422] border border-zinc-800 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-white">Tüm Alakart Mutfakları Sakin</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Şu anda seçilen alakart restoranda bekleyen veya hazırlanan sipariş bulunmamaktadır.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {kdsOrders.map((order) => {
                const diffMs = new Date().getTime() - new Date(order.createdAt).getTime();
                const elapsedMins = Math.floor(diffMs / 60000);
                const isUrgent = elapsedMins >= 15;
                const isPreparing = order.status === "PREPARING";

                return (
                  <div
                    key={order.id}
                    className={clsx(
                      "rounded-3xl border p-5 flex flex-col justify-between transition-all bg-[#0f1422]",
                      isUrgent
                        ? "border-rose-500/50 shadow-lg shadow-rose-500/10"
                        : isPreparing
                        ? "border-amber-500/40"
                        : "border-zinc-800"
                    )}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800/80 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {order.restaurant?.name}
                            </span>
                            <span className="text-xs font-mono font-bold text-zinc-400">
                              #{order.orderNumber}
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-white mt-1">
                            {order.table?.name}
                          </h3>
                          <span className="text-[11px] text-zinc-400">
                            Garson: <strong className="text-zinc-200">{order.waiter?.name}</strong>
                          </span>
                        </div>

                        {/* Elapsed Timer */}
                        <div
                          className={clsx(
                            "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border",
                            isUrgent
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                              : "bg-zinc-800/80 text-zinc-300 border-zinc-700"
                          )}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{elapsedMins} dk</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                          <strong>Not:</strong> {order.notes}
                        </div>
                      )}

                      {/* Items */}
                      <div className="space-y-2 mb-4">
                        {order.items.map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60"
                          >
                            <div className="flex items-center gap-2.5">
                              {item.menuItem.imageUrl && (
                                <img
                                  src={item.menuItem.imageUrl}
                                  alt={item.menuItem.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-zinc-800"
                                />
                              )}
                              <div>
                                <div className="text-xs font-bold text-white">
                                  {item.menuItem.name}
                                </div>
                                {item.itemNotes && (
                                  <span className="text-[10px] text-amber-300 block">
                                    ★ {item.itemNotes}
                                  </span>
                                )}
                                {item.menuItem.allergens && (
                                  <span className="text-[9px] text-rose-400">
                                    Alerjen: {item.menuItem.allergens}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-black text-amber-400 px-2 py-0.5 rounded-lg bg-zinc-800">
                              {item.quantity}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handlePrint(order.id)}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5"
                        title="Fiş Bas"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">80mm Fiş</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {order.status === "PENDING" && (
                          <button
                            onClick={() => handleStatusChange(order.id, "PREPARING")}
                            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20"
                          >
                            Hazırlanıyor
                          </button>
                        )}
                        <button
                          onClick={() => handleStatusChange(order.id, "COMPLETED")}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                        >
                          Tamamlandı
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TARİH ARALIKLI RAPORLAMA & SÜRE ANALİTİĞİ */}
      {/* ======================================================== */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-400">Başlangıç:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400">Bitiş:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={loadReport}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Raporu Getir</span>
              </button>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel'e Aktar (.xlsx)</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Yazdır / PDF</span>
              </button>
            </div>
          </div>

          {loadingReport ? (
            <div className="p-16 text-center text-zinc-500">Rapor ve analitik hesaplanıyor...</div>
          ) : reportData ? (
            <>
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">Toplam Servis / Sipariş</span>
                  <div className="text-3xl font-black text-white mt-1">
                    {reportData.totalOrders} Adet
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Belirtilen tarih aralığında
                  </span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">Tamamlanan Siparişler</span>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {reportData.completedOrders} Adet
                  </div>
                  <span className="text-[10px] text-emerald-500/80 mt-1 block">
                    Başarıyla masaya servis edildi
                  </span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">
                    Ortalama Mutfak Hazırlık Süresi
                  </span>
                  <div className="text-3xl font-black text-amber-400 mt-1">
                    {reportData.avgPrepMinutes !== null ? `~${reportData.avgPrepMinutes} dk` : "-"}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Garson siparişinden mutfak çıkışına
                  </span>
                </div>

                <div className="p-5 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <span className="text-xs text-zinc-400 font-medium">Aktif Bekleyen Sipariş</span>
                  <div className="text-3xl font-black text-cyan-400 mt-1">
                    {reportData.activeOrders} Adet
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Şu an mutfakta işlemde</span>
                </div>
              </div>

              {/* Grid: Top Dishes & Waiter Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* En Çok Tercih Edilen Lezzetler */}
                <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-amber-400" />
                      En Çok Tercih Edilen Lezzetler
                    </h3>
                    <span className="text-xs text-zinc-500">Top 15</span>
                  </div>

                  <div className="space-y-2">
                    {reportData.topDishes.map((dish: any, idx: number) => (
                      <div
                        key={dish.name}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-amber-400">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white">{dish.name}</div>
                            <span className="text-[10px] text-zinc-400">{dish.category}</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-white px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          {dish.count} Porsiyon
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Garson Sipariş Performansı */}
                <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Garson Sipariş Hacimleri
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {reportData.waiterStats.map((w: any) => (
                      <div
                        key={w.name}
                        className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80"
                      >
                        <span className="text-xs font-bold text-white">{w.name}</span>
                        <span className="text-xs font-black px-3 py-1 rounded-xl bg-zinc-800 text-emerald-400">
                          {w.count} Sipariş
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sipariş & Hazırlık Süresi Detay Tablosu */}
              <div className="p-6 rounded-3xl bg-[#0f1422] border border-zinc-800 shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
                  <div>
                    <h3 className="text-sm font-black text-white">
                      Detaylı Sipariş & Hazırlık Süresi Dökümü
                    </h3>
                    <span className="text-xs text-zinc-500">
                      Tüm aşamalar: Sipariş, Hazırlanma, Fiş ve Tamamlanma Zamanları
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="py-2.5 px-3">Sipariş</th>
                        <th className="py-2.5 px-3">Restoran</th>
                        <th className="py-2.5 px-3">Masa</th>
                        <th className="py-2.5 px-3">Garson</th>
                        <th className="py-2.5 px-3">Sipariş Saati</th>
                        <th className="py-2.5 px-3">Mutfak Başlama</th>
                        <th className="py-2.5 px-3">Tamamlanma</th>
                        <th className="py-2.5 px-3">Süre</th>
                        <th className="py-2.5 px-3">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {reportData.orders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-zinc-900/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                            #{o.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {o.restaurantName}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-zinc-200">{o.tableName}</td>
                          <td className="py-2.5 px-3 text-zinc-400">{o.waiterName}</td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400">
                            {new Date(o.createdAt).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400">
                            {o.preparingStartedAt
                              ? new Date(o.preparingStartedAt).toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-400">
                            {o.completedAt
                              ? new Date(o.completedAt).toLocaleTimeString("tr-TR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                            {o.prepDurationMinutes !== null ? `${o.prepDurationMinutes} dk` : "-"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={clsx(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                o.status === "COMPLETED"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : o.status === "PREPARING"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
                              )}
                            >
                              {o.status === "COMPLETED"
                                ? "Tamamlandı"
                                : o.status === "PREPARING"
                                ? "Hazırlanıyor"
                                : "Bekliyor"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AUDIT LOGS (DENETİM İZLERİ) */}
      {/* ======================================================== */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-[#0f1422] border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white">Sistem İşlem & Denetim Logları</h3>
              <span className="text-xs text-zinc-500">
                Garson, Mutfak ve Yönetici hareketlerinin saniye saniye kayıtları
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-semibold">İşlem Türü:</span>
              <select
                value={selectedAuditAction}
                onChange={(e) => setSelectedAuditAction(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Tüm Hareketler</option>
                <option value="LOGIN">Giriş Yapıldı (LOGIN)</option>
                <option value="ORDER_CREATED">Sipariş Oluşturuldu (ORDER_CREATED)</option>
                <option value="STATUS_PREPARING">Hazırlanmaya Başlandı (STATUS_PREPARING)</option>
                <option value="STATUS_COMPLETED">Tamamlandı (STATUS_COMPLETED)</option>
                <option value="ORDER_PRINTED">Fiş Basıldı (ORDER_PRINTED)</option>
              </select>
            </div>
          </div>

          {loadingAudit ? (
            <div className="p-16 text-center text-zinc-500">Denetim logları yükleniyor...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-16 rounded-3xl bg-[#0f1422] border border-zinc-800 text-center text-zinc-500">
              Kayıtlı denetim izi bulunamadı.
            </div>
          ) : (
            <div className="p-4 rounded-3xl bg-[#0f1422] border border-zinc-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2.5 px-3">Zaman</th>
                    <th className="py-2.5 px-3">Kullanıcı</th>
                    <th className="py-2.5 px-3">Rol</th>
                    <th className="py-2.5 px-3">İşlem</th>
                    <th className="py-2.5 px-3">Restoran</th>
                    <th className="py-2.5 px-3">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {auditLogs.map((log) => (
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
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-amber-300">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {log.restaurant?.name || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300">{log.details || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
