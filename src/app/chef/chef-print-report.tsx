"use client";

/**
 * Şef Modülü - yazdırılabilir rapor blokları.
 *
 * Ekran arayüzü koyu temalı olduğu için doğrudan window.print() çağrısı
 * koyu ve okunmaz bir sayfa üretir. Bu blok sayfa içinde "hidden" durur ve
 * yalnızca yazdırma sırasında görünür olur (bkz. globals.css @media print).
 * Not: PDF, tarayıcının "Yazdır -> PDF olarak kaydet" menüsüyle alınır; böylece
 * Türkçe karakterler PDF'e bozulmadan geçer.
 */

interface OrderRow {
  orderNumber: number;
  restaurantName: string;
  tableName: string;
  waiterName: string;
  status: string;
  itemCount: number;
  itemsSummary: string;
  createdAt: string;
  completedAt: string | null;
  prepDurationMinutes: number | null;
}

export interface ChefReportView {
  reportData: any | null;
  startDate: string;
  endDate: string;
  restaurantLabel: string;
  currentUser: any;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  PREPARING: "Hazırlanıyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

function ReportHeader({
  title,
  startDate,
  endDate,
  restaurantLabel,
  currentUser,
}: Omit<ChefReportView, "reportData"> & { title: string }) {
  return (
    <header className="mb-5 border-b-2 border-black pb-3">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest">
            MERIT HOTELS &amp; RESORTS &mdash; A LA CARTE
          </p>
          <h1 className="text-xl font-black mt-0.5">{title}</h1>
          <p className="text-xs mt-1">
            <strong>Tarih Aralığı:</strong> {startDate}
            {startDate !== endDate ? ` - ${endDate}` : ""} &nbsp;|&nbsp;{" "}
            <strong>Alakart:</strong> {restaurantLabel}
          </p>
        </div>
        <div className="text-right text-[10px] leading-relaxed">
          <p>
            <strong>Raporu Alan:</strong> {currentUser?.name || "-"} ({currentUser?.role || "-"})
          </p>
          <p>
            <strong>Yazdırma:</strong>{" "}
            {new Intl.DateTimeFormat("tr-TR", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date())}
          </p>
        </div>
      </div>
    </header>
  );
}

function KpiRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <table className="w-full border-collapse mb-5">
      <tbody>
        <tr>
          {items.map((item) => (
            <td
              key={item.label}
              className="border border-zinc-400 px-2 py-1.5 text-center align-top"
            >
              <div className="text-[9px] uppercase tracking-wide">{item.label}</div>
              <div className="text-sm font-black">{item.value}</div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-zinc-200">
          <th className="border border-zinc-400 px-1.5 py-1.5 text-left">Sip. No</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-left">Alakart</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-left">Masa</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-left">Garson</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-left">Saat</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-center">Kalem</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-center">Süre</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-left">Durum</th>
          <th className="border border-zinc-400 px-1.5 py-1.5 text-left">Sipariş İçeriği</th>
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 ? (
          <tr>
            <td colSpan={9} className="border border-zinc-400 px-2 py-4 text-center">
              Seçilen tarih aralığında kayıtlı sipariş bulunamadı.
            </td>
          </tr>
        ) : (
          orders.map((order) => (
            <tr key={order.orderNumber}>
              <td className="border border-zinc-400 px-1.5 py-1">#{order.orderNumber}</td>
              <td className="border border-zinc-400 px-1.5 py-1">{order.restaurantName}</td>
              <td className="border border-zinc-400 px-1.5 py-1">{order.tableName}</td>
              <td className="border border-zinc-400 px-1.5 py-1">{order.waiterName}</td>
              <td className="border border-zinc-400 px-1.5 py-1">
                {new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(
                  new Date(order.createdAt)
                )}
              </td>
              <td className="border border-zinc-400 px-1.5 py-1 text-center">{order.itemCount}</td>
              <td className="border border-zinc-400 px-1.5 py-1 text-center">
                {order.prepDurationMinutes !== null ? `${order.prepDurationMinutes} dk` : "-"}
              </td>
              <td className="border border-zinc-400 px-1.5 py-1">
                {STATUS_LABEL[order.status] || order.status}
              </td>
              <td className="border border-zinc-400 px-1.5 py-1">{order.itemsSummary}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function SimpleListTable({
  head,
  rows,
}: {
  head: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-zinc-200">
          {head.map((label) => (
            <th key={label} className="border border-zinc-400 px-1.5 py-1.5 text-left">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={head.length} className="border border-zinc-400 px-2 py-3 text-center">
              Kayıt bulunamadı.
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-zinc-400 px-1.5 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function ChefAnalyticsPrintReport({
  reportData,
  startDate,
  endDate,
  restaurantLabel,
  currentUser,
}: ChefReportView) {
  // Rapor içeriği yüklenmeden önce yazdırma bloğu hiç oluşturulmaz.
  if (!reportData) return null;

  return (
    <div
      id="printable-chef-report"
      className="hidden text-black bg-white"
      style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
    >
      <ReportHeader
        title="Alakart Servis ve Tüketim Raporu"
        startDate={startDate}
        endDate={endDate}
        restaurantLabel={restaurantLabel}
        currentUser={currentUser}
      />

      <KpiRow
        items={[
          { label: "Toplam Sipariş", value: String(reportData.totalOrders ?? 0) },
          { label: "Tamamlanan", value: String(reportData.completedOrders ?? 0) },
          { label: "İptal", value: String(reportData.cancelledOrders ?? 0) },
          {
            label: "Ort. Hazırlık",
            value:
              reportData.avgPrepMinutes !== null && reportData.avgPrepMinutes !== undefined
                ? `${reportData.avgPrepMinutes} dk`
                : "-",
          },
        ]}
      />

      <h2 className="text-xs font-black uppercase tracking-wide mb-1.5">
        Sipariş Detayı ve Hazırlık Süreleri
      </h2>
      <OrdersTable orders={reportData.orders ?? []} />

      {reportData.topDishes?.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xs font-black uppercase tracking-wide mb-1.5">
            En Çok Tercih Edilen Ürünler
          </h2>
          <SimpleListTable
            head={["Sıra", "Ürün", "Kategori", "Toplam Adet"]}
            rows={reportData.topDishes.map(
              (dish: any, index: number) => [index + 1, dish.name, dish.category, dish.count]
            )}
          />
        </section>
      )}

      {reportData.waiterStats?.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xs font-black uppercase tracking-wide mb-1.5">
            Garson Sipariş Dağılımı
          </h2>
          <SimpleListTable
            head={["Garson", "Açılan Sipariş", "Tamamlanan"]}
            rows={reportData.waiterStats.map(
              (waiter: any) => [waiter.name, waiter.count, waiter.completedCount ?? 0]
            )}
          />
        </section>
      )}

      {reportData.restaurantStats?.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xs font-black uppercase tracking-wide mb-1.5">
            Alakart Restoran Bazlı Özet
          </h2>
          <SimpleListTable
            head={["Alakart", "Sipariş", "Tamamlanan", "İptal"]}
            rows={reportData.restaurantStats.map((restaurant: any) => [
              restaurant.name,
              restaurant.count,
              restaurant.completedCount ?? 0,
              restaurant.cancelledCount ?? 0,
            ])}
          />
        </section>
      )}

      <footer className="mt-6 pt-2 border-t border-zinc-400 text-[9px]">
        ALACARTE &mdash; Bu rapor MERIT HOTELS &amp; RESORTS operasyon kayıtlarından otomatik
        üretilmiştir.
      </footer>
    </div>
  );
}

export function ChefAuditPrintReport({
  auditLogs,
  restaurantLabel,
  currentUser,
}: {
  auditLogs: any[];
  restaurantLabel: string;
  currentUser: any;
}) {
  return (
    <div
      id="printable-chef-audit"
      className="hidden text-black bg-white"
      style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
    >
      <ReportHeader
        title="Sistem Denetim İzleri"
        startDate="-"
        endDate="-"
        restaurantLabel={restaurantLabel}
        currentUser={currentUser}
      />
      <SimpleListTable
        head={["Zaman", "Kullanıcı", "Rol", "İşlem", "Alakart", "Detay"]}
        rows={auditLogs.map((log) => [
          new Intl.DateTimeFormat("tr-TR", {
            dateStyle: "short",
            timeStyle: "medium",
          }).format(new Date(log.createdAt)),
          log.userName,
          log.userRole,
          log.action,
          log.restaurant?.name || "-",
          log.details || "-",
        ])}
      />
    </div>
  );
}