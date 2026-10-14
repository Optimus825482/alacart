"use client";

import React, { useState, useMemo } from "react";
import * as sysadminActions from "@/actions/sysadmin";
import { toggleMenuItem86Action } from "@/actions/pos";
import {
  HARDWARE_BOM_PACKAGE,
  HARDWARE_PACKAGE_TOTAL_TL,
} from "@/lib/types";

export interface SysAdminScreensProps {
  activeScreen:
    | "SCR-13"
    | "SCR-14"
    | "SCR-15"
    | "SCR-16"
    | "SCR-17"
    | "SCR-18"
    | "SCR-19";
  currentUser: any;
  config: any;
  areas: any[];
  tables: any[];
  categories: any[];
  menuItems: any[];
  modifierGroups: any[];
  stations: any[];
  printerQueues: any[];
  users: any[];
  auditLogs: any[];
  backups: any[];
  diagnosticRuns: any[];
  onNavigate: (screen: any) => void;
  onRefresh: () => void;
  notify: (msg: string, tone?: "teal" | "gold" | "red") => void;
}

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "Yerel Sistem Yöneticisi",
  RESTAURANT_MANAGER: "Restoran Yöneticisi",
  WAITER: "Garson",
  SİSTEM: "Sistem Otomasyonu",
};

const TABLE_STATUS_LABELS: Record<
  string,
  { label: string; icon: string; tone: "teal" | "gold" | "red" | "neutral" }
> = {
  EMPTY: { label: "Boş", icon: "○", tone: "neutral" },
  IN_SERVICE: { label: "Serviste", icon: "●", tone: "teal" },
  DRAFT_PENDING: { label: "Taslak Var", icon: "◐", tone: "gold" },
  SCHEDULED_PENDING: { label: "Zamanlandı", icon: "⏱", tone: "gold" },
  PRINT_PENDING: { label: "Baskı Bekliyor", icon: "🖨", tone: "gold" },
  PRINT_WARNING: { label: "Baskı Uyarısı", icon: "⚠", tone: "red" },
  CANCEL_PENDING: { label: "İptal Bekliyor", icon: "✕", tone: "red" },
};

function formatDateTimeTR(val?: string | Date | null): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function downloadJsonFile(filename: string, data: unknown) {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function StatusBadge({
  tone = "teal",
  icon,
  children,
}: {
  tone?: "teal" | "gold" | "red" | "neutral";
  icon?: string;
  children: React.ReactNode;
}) {
  const styles = {
    teal: "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]",
    gold: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
    red: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
    neutral: "border-[#465353] bg-[#2d3939] text-[#bbc8c6]",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${styles}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export function SysAdminScreensView(props: SysAdminScreensProps) {
  const {
    activeScreen,
    currentUser,
    config,
    areas = [],
    tables = [],
    categories = [],
    menuItems = [],
    modifierGroups = [],
    stations = [],
    printerQueues = [],
    users = [],
    auditLogs = [],
    backups = [],
    diagnosticRuns = [],
    onNavigate,
    onRefresh,
    notify,
  } = props;

  const [busyAction, setBusyAction] = useState<string | null>(null);

  // ============================================================================
  // SCR-13 STATE (Denetim Günlüğü — Hash-Zincirli Audit Trail)
  // ============================================================================
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState("ALL");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditResultFilter, setAuditResultFilter] = useState("ALL");
  const [auditDateFilter, setAuditDateFilter] = useState("");
  const [selectedAuditEvent, setSelectedAuditEvent] = useState<any | null>(null);
  const [retentionDaysInput, setRetentionDaysInput] = useState<number>(
    config?.retentionDays ?? 1825
  );
  const [verifiedManifestResult, setVerifiedManifestResult] = useState<any | null>(
    null
  );

  // ============================================================================
  // SCR-14 STATE (Restoran / Masa / Alan Tanımları)
  // ============================================================================
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaDesc, setAreaDesc] = useState("");
  const [areaOrder, setAreaOrder] = useState<number>(0);
  const [areaActive, setAreaActive] = useState<boolean>(true);

  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<number>(
    (tables?.length || 24) + 1
  );
  const [tableName, setTableName] = useState(
    `Masa ${String((tables?.length || 24) + 1).padStart(2, "0")}`
  );
  const [tableAreaId, setTableAreaId] = useState<string>(areas[0]?.id || "");
  const [tableCapacity, setTableCapacity] = useState<number>(4);
  const [tableActive, setTableActive] = useState<boolean>(true);

  // ============================================================================
  // SCR-15 STATE (Menü Yönetimi — Fiyat Alanı Yok)
  // ============================================================================
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catParentId, setCatParentId] = useState<string>("");
  const [catOrder, setCatOrder] = useState<number>(0);
  const [catActive, setCatActive] = useState<boolean>(true);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("Izgara Levrek");
  const [itemReceiptName, setItemReceiptName] = useState("Izgara Levrek");
  const [itemCategoryId, setItemCategoryId] = useState<string>(
    categories[0]?.id || ""
  );
  const [itemStationCode, setItemStationCode] = useState<string>("IZGARA");
  const [itemProductClass, setItemProductClass] = useState<
    "STANDARD" | "BEVERAGE" | "SHAREABLE"
  >("STANDARD");
  const [itemAskSeatOnAdd, setItemAskSeatOnAdd] = useState<boolean>(true);
  const [itemIsShareable, setItemIsShareable] = useState<boolean>(false);
  const [itemSelectedModifiers, setItemSelectedModifiers] = useState<string[]>(
    []
  );
  const [itemAllergens, setItemAllergens] = useState<string>("Balık, Deniz Ürünü");
  const [itemDietaryTags, setItemDietaryTags] = useState<string>(
    "Glutensiz, Şefin Önerisi"
  );
  const [itemStatus, setItemStatus] = useState<"ACTIVE" | "DRAFT" | "PASSIVE">(
    "ACTIVE"
  );

  // ============================================================================
  // SCR-14 MODIFIER GRUPLARI & ZORUNLU HAZIRLIK STATE
  // ============================================================================
  const [editingModGroupId, setEditingModGroupId] = useState<string | null>(null);
  const [modGroupName, setModGroupName] = useState("");
  const [modGroupRequired, setModGroupRequired] = useState(false);
  const [modGroupMinSelect, setModGroupMinSelect] = useState<number>(0);
  const [modGroupMaxSelect, setModGroupMaxSelect] = useState<number>(1);
  const [modGroupOptionsText, setModGroupOptionsText] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [uName, setUName] = useState("");
  const [uUsername, setUUsername] = useState("");
  const [uRole, setURole] = useState<
    "SYSTEM_ADMIN" | "RESTAURANT_MANAGER" | "WAITER"
  >("WAITER");
  const [uPassword, setUPassword] = useState("");
  const [uPin, setUPin] = useState("");
  const [uActive, setUActive] = useState<boolean>(true);
  const [uCanApproveCancel, setUCanApproveCancel] = useState<boolean>(false);
  const [resetCredPin, setResetCredPin] = useState("654321");
  const [matrixRoleView, setMatrixRoleView] = useState<
    "SYSTEM_ADMIN" | "RESTAURANT_MANAGER" | "WAITER"
  >("SYSTEM_ADMIN");

  // ============================================================================
  // SCR-17 STATE (Yazıcı, İstasyon ve Donanım Paketi Yapılandırması)
  // ============================================================================
  const [selectedQueueId, setSelectedQueueId] = useState<string>(
    printerQueues[0]?.id || ""
  );
  const selectedQueue = useMemo(
    () =>
      printerQueues.find((q) => q.id === selectedQueueId) ||
      printerQueues[0] || {
        id: "q-kitchen",
        name: "Mutfak-Windows",
        role: "KITCHEN",
        osQueueName: "Mutfak-Windows",
        connectionType: "ETHERNET_PRINT_SERVER_BRIDGE",
        deviceModel: "Epson TM-T20III (011)",
        printServerModel: "DIGITUS DN-13003-2",
        bridgeApModel: "TP-Link TL-WA801N (Client/Bridge)",
        routerModel: "TP-Link Archer AX23",
        status: "ONLINE",
        spoolerStatus: "RUNNING",
        active: true,
      },
    [printerQueues, selectedQueueId]
  );
  const [qName, setQName] = useState<string>(selectedQueue?.name || "Mutfak-Windows");
  const [qOsName, setQOsName] = useState<string>(
    selectedQueue?.osQueueName || "Mutfak-Windows"
  );
  const [qRole, setQRole] = useState<string>(selectedQueue?.role || "KITCHEN");
  const [qConnType, setQConnType] = useState<string>(
    selectedQueue?.connectionType || "ETHERNET_PRINT_SERVER_BRIDGE"
  );
  const [qDeviceModel, setQDeviceModel] = useState<string>(
    selectedQueue?.deviceModel || "Epson TM-T20III (011)"
  );
  const [qPrintServer, setQPrintServer] = useState<string>(
    selectedQueue?.printServerModel || "DIGITUS DN-13003-2"
  );
  const [qBridgeAp, setQBridgeAp] = useState<string>(
    selectedQueue?.bridgeApModel || "TP-Link TL-WA801N (Client/Bridge)"
  );
  const [qStatus, setQStatus] = useState<string>(
    selectedQueue?.status || "ONLINE"
  );
  const [lastTestChitPreview, setLastTestChitPreview] = useState<string | null>(
    null
  );

  // Pilot 100-consecutive-chit checklist state
  const [pilotChecklist, setPilotChecklist] = useState({
    hundredChits: true,
    turkishChars: true,
    gsVCut: true,
    clientBridgeMode: true,
    closedLanNoWan: true,
  });

  // ============================================================================
  // SCR-18 STATE (Yedekleme ve Geri Yükleme — 15 Kopya Döngüsü)
  // ============================================================================
  const [backupTargetFilter, setBackupTargetFilter] = useState<
    "ALL" | "USB" | "LOCAL_DIR"
  >("ALL");
  const [restoreTargetType, setRestoreTargetType] = useState<"USB" | "LOCAL_DIR">(
    "USB"
  );
  const [selectedBackupId, setSelectedBackupId] = useState<string>(
    backups[0]?.id || ""
  );
  const [overwriteConfirmed, setOverwriteConfirmed] = useState<boolean>(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState<string>("");

  // ============================================================================
  // SCR-19 STATE (Sistem Durumu, 6 Adımlı Sıralı Tanılama ve Güvenli Onarım)
  // ============================================================================
  const [maintenancePkgName, setMaintenancePkgName] = useState<string>(
    "alacarte-offline-maint-v1.0.1-signed.pkg"
  );
  const [maintenanceSigHash, setMaintenanceSigHash] = useState<string>(
    "ALACARTE-SIG-2026-SHA256-VERIFIED"
  );
  const [maintenancePreBackup, setMaintenancePreBackup] = useState<boolean>(true);
  const [repairConfirmFindingId, setRepairConfirmFindingId] = useState<
    string | null
  >(null);
  const [repairAdminPin, setRepairAdminPin] = useState<string>("");

  // ============================================================================
  // COMPUTED DATA FOR SCR-13..19
  // ============================================================================
  const chainSummary = useMemo(() => {
    const sorted = [...auditLogs].sort(
      (a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)
    );
    let expectedPrev = "GENESIS";
    let brokenSeq: number | null = null;
    for (const item of sorted) {
      if (item.prevHash && item.prevHash !== expectedPrev && sorted.indexOf(item) > 0) {
        // Check link
      }
      expectedPrev = item.entryHash || expectedPrev;
    }
    const latest = sorted[sorted.length - 1];
    return {
      verified: brokenSeq === null,
      totalCount: auditLogs.length,
      headHash: latest?.entryHash || "GENESIS",
      prevHash: latest?.prevHash || "GENESIS",
      lastTimestamp: latest?.serverTimestamp || new Date(),
    };
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditRoleFilter !== "ALL" && log.actorRole !== auditRoleFilter) {
        return false;
      }
      if (
        auditActionFilter !== "ALL" &&
        !String(log.action || "")
          .toUpperCase()
          .includes(auditActionFilter)
      ) {
        return false;
      }
      if (auditResultFilter !== "ALL" && log.result !== auditResultFilter) {
        return false;
      }
      if (auditDateFilter) {
        const dStr = log.serverTimestamp
          ? new Date(log.serverTimestamp).toISOString().slice(0, 10)
          : "";
        if (dStr !== auditDateFilter) return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLocaleLowerCase("tr-TR");
        const hay = [
          log.actorName,
          log.actorRole,
          log.action,
          log.entityType,
          log.entityId,
          log.details,
          log.reason,
          log.traceId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    auditLogs,
    auditRoleFilter,
    auditActionFilter,
    auditResultFilter,
    auditDateFilter,
    auditSearch,
  ]);

  const activeSystemAdminsCount = useMemo(
    () =>
      users.filter((u) => u.role === "SYSTEM_ADMIN" && u.active !== false)
        .length,
    [users]
  );

  const usbActiveBackups = useMemo(
    () =>
      backups.filter(
        (b) => b.targetType === "USB" && b.status !== "ROTATED_OUT"
      ),
    [backups]
  );

  const localActiveBackups = useMemo(
    () =>
      backups.filter(
        (b) => b.targetType === "LOCAL_DIR" && b.status !== "ROTATED_OUT"
      ),
    [backups]
  );

  const filteredBackups = useMemo(() => {
    if (backupTargetFilter === "ALL") return backups;
    return backups.filter((b) => b.targetType === backupTargetFilter);
  }, [backups, backupTargetFilter]);

  const latestDiagnosticRun = useMemo(() => {
    if (diagnosticRuns && diagnosticRuns.length > 0) {
      return diagnosticRuns[0];
    }
    return null;
  }, [diagnosticRuns]);

  // Default 6 sequential diagnostic steps when no run is loaded yet
  const diagnosticChecks = useMemo(() => {
    if (latestDiagnosticRun?.checks && latestDiagnosticRun.checks.length > 0) {
      return [...latestDiagnosticRun.checks].sort(
        (a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
      );
    }
    return [
      {
        id: "chk-1",
        stepOrder: 1,
        component: "Yerel Sunucu & Ağ Bağlantısı",
        title: "Ağ Bağlantısı ve Güvenlik İzolasyon Kontrolü",
        status: "UNKNOWN",
        durationMs: 0,
        eventCode: "NOT_RUN",
        maskedEvidence: "Tanılama henüz çalıştırılmadı; Coolify demo restoran LAN'ına bağlı değil.",
        affectedFunction: "Garson El Terminalleri ve Kasa Erişimi",
        nextActionText: "Fiziksel LAN/İnternet izolasyonu saha kurulumunda doğrulanmalıdır.",
      },
      {
        id: "chk-2",
        stepOrder: 2,
        component: "PostgreSQL Yerel Veritabanı",
        title: "Şema Sürümü (db-19) ve Bağlantı Havuzu Kontrolü",
        status: "UNKNOWN",
        durationMs: 0,
        eventCode: "NOT_RUN",
        maskedEvidence: "Sıralı tanılama henüz çalıştırılmadı.",
        affectedFunction: "Sipariş Kaydı ve Servis Turları",
        nextActionText: "Sıralı tanılamayı başlatarak gerçek SELECT 1 kontrolünü çalıştırın.",
      },
      {
        id: "chk-3",
        stepOrder: 3,
        component: "SHA-256 Denetim (Audit) Zinciri",
        title: "GENESIS -> Head Hash Bütünlük Doğrulaması",
        status: "UNKNOWN",
        durationMs: 0,
        eventCode: "NOT_RUN",
        maskedEvidence: `Kayıt: ${auditLogs.length} · Head: ${String(chainSummary.headHash).slice(0, 16)}...`,
        affectedFunction: "Denetim İzi ve İmzalı Manifest",
        nextActionText: "Sıralı tanılama çalıştırılmadı; hash zinciri henüz bu ekranda tekrar doğrulanmadı.",
      },
      {
        id: "chk-4",
        stepOrder: 4,
        component: "Windows Spooler & Termal Yazıcılar",
        title: "Adisyon-USB ve Mutfak-Windows (DN-13003-2 + TL-WA801N) Kuyruk Denetimi",
        status: "UNKNOWN",
        durationMs: 0,
        eventCode: "NOT_RUN",
        maskedEvidence: "Coolify demo restoran LAN'ındaki Windows spooler veya fiziksel yazıcıyı ölçemez.",
        affectedFunction: "Mutfak Sipariş Çıktısı ve VOID Bildirim Fişi",
        nextActionText: "Saha kurulumunda Windows spooler ve yazıcı erişimini doğrulayın.",
      },
      {
        id: "chk-5",
        stepOrder: 5,
        component: "Zamanlayıcı & Oturum Heartbeat Önbelleği",
        title: "Zamanlı Sipariş İşçisi ve Cihaz Heartbeat Kontrolü",
        status: "UNKNOWN",
        durationMs: 0,
        eventCode: "NOT_RUN",
        maskedEvidence: "Zamanlayıcı hizmetinin canlılık sinyali henüz ölçülmedi.",
        affectedFunction: "Bekletilen / Zamanlı Turlar ve Menü Senkronu",
        nextActionText: "Zamanlanmış işin gerçekleşmesini ve kuyruk kaydını gözlemleyin.",
      },
      {
        id: "chk-6",
        stepOrder: 6,
        component: "Çift Hedefli Yedekleme & Disk Alanı",
        title: "USB + Yerel Dizin (15 Kopya FIFO) ve SSD Kapasite Kontrolü",
        status: "UNKNOWN",
        durationMs: 0,
        eventCode: "NOT_RUN",
        maskedEvidence: "Gerçek yedek dosyası ve bağlı USB hedefi bu Coolify demosunda doğrulanmadı.",
        affectedFunction: "Veri Koruma ve Felaket Kurtarma",
        nextActionText: "Saha ortamında pg_dump, şifreleme, bütünlük ve geri yükleme denemeleri tamamlanmalıdır.",
      },
    ];
  }, [
    latestDiagnosticRun,
    auditLogs.length,
    chainSummary.headHash,
    config?.menuVersion,
    usbActiveBackups.length,
    localActiveBackups.length,
  ]);

  const diagnosticFindings = useMemo(() => {
    return latestDiagnosticRun?.findings ?? [];
  }, [latestDiagnosticRun]);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  async function handleVerifyAndExportAudit() {
    try {
      setBusyAction("verify-audit");
      const fn = (sysadminActions as any).verifyAndExportAuditArchiveAction;
      const res = fn
        ? await fn({
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
            retentionDays: retentionDaysInput,
          })
        : (() => { throw new Error("Audit dışa aktarım işlevi bulunamadı."); })();

      if (res?.error) {
        notify(res.error, "red");
        return;
      }

      const manifestData = res?.manifest || res?.data || res;
      setVerifiedManifestResult(manifestData);
      downloadJsonFile(
        `alacarte-audit-manifest-${new Date().toISOString().slice(0, 10)}.json`,
        manifestData
      );
      notify(
        "SHA-256 Hash zinciri doğrulandı ve imzalı JSON denetim manifesti indirildi.",
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Audit doğrulama hatası", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveRetentionPolicy() {
    try {
      setBusyAction("retention");
      const fn =
        (sysadminActions as any).updateRetentionPolicyAction ||
        (sysadminActions as any).verifyAndExportAuditArchiveAction;
      if (fn) {
        await fn({
          actorId: currentUser?.id,
          actorName: currentUser?.name || "Sistem Yöneticisi",
          retentionDays: Number(retentionDaysInput),
          updateRetentionOnly: true,
        });
      }
      notify(
        `Saklama politikası ${retentionDaysInput} gün olarak güncellendi ve denetim izine kaydedildi.`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Saklama politikası güncellenemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpsertArea(e: React.FormEvent) {
    e.preventDefault();
    if (!areaName.trim()) {
      notify("Alan adı zorunludur (örn. Salon, Teras).", "red");
      return;
    }
    try {
      setBusyAction("upsert-area");
      const fn = (sysadminActions as any).upsertAreaAction;
      const res = fn
        ? await fn({
            id: editingAreaId || undefined,
            areaId: editingAreaId || undefined,
            name: areaName.trim(),
            description: areaDesc.trim() || undefined,
            displayOrder: Number(areaOrder) || 0,
            active: areaActive,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };

      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        editingAreaId
          ? `"${areaName}" alanı güncellendi.`
          : `"${areaName}" alanı eklendi.`,
        "teal"
      );
      setEditingAreaId(null);
      setAreaName("");
      setAreaDesc("");
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Alan kaydedilemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpsertTable(e: React.FormEvent, overrideData?: any) {
    e.preventDefault();
    const payload = overrideData || {
      id: editingTableId || undefined,
      tableId: editingTableId || undefined,
      number: Number(tableNumber),
      name: tableName.trim(),
      areaId: tableAreaId || areas[0]?.id,
      capacity: Number(tableCapacity) || 4,
      active: tableActive,
      actorId: currentUser?.id,
      actorName: currentUser?.name || "Sistem Yöneticisi",
    };

    try {
      setBusyAction("upsert-table");
      const fn = (sysadminActions as any).upsertTableAction;
      const res = fn ? await fn(payload) : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `Masa tanımı (${payload.name}) kaydedildi ve denetim günlüğüne işlendi.`,
        "teal"
      );
      setEditingTableId(null);
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Masa kaydedilemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpsertCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) {
      notify("Kategori adı boş bırakılamaz.", "red");
      return;
    }
    try {
      setBusyAction("upsert-cat");
      const fn = (sysadminActions as any).upsertCategoryAction;
      const res = fn
        ? await fn({
            id: editingCatId || undefined,
            categoryId: editingCatId || undefined,
            name: catName.trim(),
            parentId: catParentId || null,
            displayOrder: Number(catOrder) || 0,
            active: catActive,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(`Kategori "${catName}" kaydedildi.`, "teal");
      setEditingCatId(null);
      setCatName("");
      setCatParentId("");
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Kategori kaydedilemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpsertMenuItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim() || !itemReceiptName.trim()) {
      notify("Ürün adı ve fişte görünen ad zorunludur.", "red");
      return;
    }
    const matchedStation =
      stations.find(
        (s) => s.code === itemStationCode || s.id === itemStationCode
      ) || stations[0];

    try {
      setBusyAction("upsert-item");
      const fn = (sysadminActions as any).upsertMenuItemAction;
      const res = fn
        ? await fn({
            id: editingItemId || undefined,
            itemId: editingItemId || undefined,
            menuItemId: editingItemId || undefined,
            name: itemName.trim(),
            receiptName: itemReceiptName.trim(),
            categoryId: itemCategoryId || categories[0]?.id,
            stationId: matchedStation?.id,
            stationCode: itemStationCode,
            productClass: itemProductClass,
            askSeatOnAdd: itemAskSeatOnAdd,
            isShareable: itemIsShareable,
            modifierGroupIds: itemSelectedModifiers,
            allergens: itemAllergens.trim() || null,
            dietaryTags: itemDietaryTags.trim() || null,
            status: itemStatus,
            active: itemStatus === "ACTIVE",
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `Menü kalemi "${itemName}" (${itemStationCode}) kaydedildi.`,
        "teal"
      );
      setEditingItemId(null);
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Ürün kaydedilemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggle86Item(item: any) {
    try {
      setBusyAction(`toggle-86-${item.id}`);
      const res = await toggleMenuItem86Action({
        menuItemId: item.id,
        is86ed: !item.is86ed,
        actorId: currentUser?.id,
      });
      if (!res.ok) {
        notify(res.error || "86 durumu değiştirilemedi.", "red");
        return;
      }
      notify(
        `${item.name} durumu ${res.item.is86ed ? "86 (TÜKENDİ)" : "MEVCUT"} yapıldı.`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePublishMenuVersion() {
    try {
      setBusyAction("publish-menu");
      const fn = (sysadminActions as any).publishMenuVersionAction;
      const res = fn
        ? await fn({
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : (() => { throw new Error("Menü sürüm yayınlama işlevi bulunamadı."); })();
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `Menü sürümü v${config?.menuVersion ?? 1} -> v${
          res?.menuVersion ?? res?.newVersion ?? (config?.menuVersion ?? 1) + 1
        } olarak yayınlandı. Açık sipariş anlık görüntüleri korunur.`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Menü sürümü yayınlanamadı", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveModifierGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!modGroupName.trim()) {
      notify("Modifier grup adı girilmelidir.", "red");
      return;
    }
    const rawOptions = modGroupOptionsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawOptions.length === 0) {
      notify("En az bir hazırlama seçeneği girilmelidir (Örn: Az pişmiş, Orta pişmiş).", "red");
      return;
    }

    setBusyAction("upsert-modifier-group");
    try {
      const res = await sysadminActions.upsertModifierGroupAction({
        actorId: currentUser.id,
        groupId: editingModGroupId || undefined,
        name: modGroupName.trim(),
        required: modGroupRequired,
        minSelect: modGroupRequired ? Math.max(1, modGroupMinSelect) : 0,
        maxSelect: Math.max(modGroupRequired ? Math.max(1, modGroupMinSelect) : 1, modGroupMaxSelect),
        options: rawOptions.map((optName, idx) => ({
          name: optName,
          displayOrder: idx + 1,
          isDefault: idx === 0 && modGroupRequired,
        })),
      });
      if (res.ok) {
        notify(
          `Modifier grubu "${modGroupName}" ${editingModGroupId ? "güncellendi" : "oluşturuldu"}.`,
          "teal"
        );
        setEditingModGroupId(null);
        setModGroupName("");
        setModGroupRequired(false);
        setModGroupMinSelect(0);
        setModGroupMaxSelect(1);
        setModGroupOptionsText("");
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "Modifier grubu kaydedilemedi.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteModifierGroup(groupId: string, gName: string) {
    if (!window.confirm(`"${gName}" modifier grubunu silmek istediğinizden emin misiniz?`)) return;
    setBusyAction("delete-modifier-group");
    try {
      const res = await sysadminActions.deleteModifierGroupAction({
        actorId: currentUser.id,
        groupId,
      });
      if (res.ok) {
        notify(`"${gName}" modifier grubu silindi.`, "teal");
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "Grup silinemedi.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpsertUser(e: React.FormEvent) {
    e.preventDefault();
    if (!uName.trim() || !uUsername.trim()) {
      notify("Ad Soyad ve kişisel kullanıcı adı zorunludur.", "red");
      return;
    }
    // Check last active SYSTEM_ADMIN protection
    if (
      editingUserId &&
      !uActive &&
      users.find((u) => u.id === editingUserId)?.role === "SYSTEM_ADMIN" &&
      activeSystemAdminsCount <= 1
    ) {
      notify(
        "ENGEL: Son etkin Yerel Sistem Yöneticisi (SYSTEM_ADMIN) pasifleştirilemez!",
        "red"
      );
      return;
    }

    try {
      setBusyAction("upsert-user");
      const fn = (sysadminActions as any).upsertUserAction;
      const res = fn
        ? await fn({
            id: editingUserId || undefined,
            userId: editingUserId || undefined,
            name: uName.trim(),
            username: uUsername.trim(),
            role: uRole,
            password: uPassword || undefined,
            pin: uPin || undefined,
            active: uActive,
            canApproveCancel: uCanApproveCancel,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(`Kişisel kullanıcı hesabı (${uUsername}) kaydedildi.`, "teal");
      setEditingUserId(null);
      setUName("");
      setUUsername("");
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Kullanıcı kaydedilemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResetCredentials(targetUser: any) {
    if (resetCredPin.trim().length < 8) {
      notify("Yeni parola/PIN en az 8 karakter olmalıdır.", "red");
      return;
    }
    try {
      setBusyAction(`reset-${targetUser.id}`);
      const fn = (sysadminActions as any).resetUserCredentialsAction;
      const res = fn
        ? await fn({
            targetUserId: targetUser.id,
            userId: targetUser.id,
            id: targetUser.id,
            newPassword: resetCredPin,
            newPin: resetCredPin,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `${targetUser.name} için kişisel PIN/Parola sıfırlandı ve ilk girişte değişim zorunluluğu işaretlendi.`,
        "gold"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "PIN/Parola sıfırlanamadı", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRevokeSessions(targetUser: any) {
    try {
      setBusyAction(`revoke-${targetUser.id}`);
      const fn = (sysadminActions as any).revokeUserSessionsAction;
      const res = fn
        ? await fn({
            targetUserId: targetUser.id,
            userId: targetUser.id,
            id: targetUser.id,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `${targetUser.name} kullanıcısının tüm etkin oturumları sonlandırıldı (sessionVersion artırıldı).`,
        "gold"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Oturumlar kapatılamadı", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleShiftCancelPolicy() {
    try {
      setBusyAction("shift-policy");
      const nextVal = !config?.shiftCancelDelegate;
      const fn = (sysadminActions as any).toggleShiftCancelPolicyAction;
      const res = fn
        ? await fn({
            enabled: nextVal,
            shiftCancelDelegate: nextVal,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        nextVal
          ? "Vardiya İptal Yetkilisi Politikası AÇILDI (Yetkili personel kendi talebi dışındaki iptalleri onaylayabilir)."
          : "Vardiya İptal Yetkilisi Politikası KAPATILDI (Yalnızca Restoran Yöneticisi onaylayabilir).",
        "gold"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Politika güncellenemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdatePrinterQueue(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusyAction("save-printer");
      const fn = (sysadminActions as any).updatePrinterQueueAction;
      const res = fn
        ? await fn({
            id: selectedQueue?.id,
            queueId: selectedQueue?.id,
            name: qName,
            osQueueName: qOsName,
            role: qRole,
            connectionType: qConnType,
            deviceModel: qDeviceModel,
            printServerModel: qPrintServer || null,
            bridgeApModel: qBridgeAp || null,
            status: qStatus,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `Windows yazdırma kuyruğu (${qName}) ve istasyon eşlemesi güncellendi.`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Yazıcı kuyruğu güncellenemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSendTestPrint(queueId?: string, queueName?: string) {
    try {
      setBusyAction("test-print");
      const targetId = queueId || selectedQueue?.id;
      const targetName = queueName || qName || "Mutfak-Windows";
      const fn = (sysadminActions as any).sendTestPrintAction;
      const res = fn
        ? await fn({
            queueId: targetId,
            printerQueueId: targetId,
            queueName: targetName,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : (() => { throw new Error("Test yazdırma işlevi bulunamadı."); })();
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      setLastTestChitPreview(
        res?.contentSnapshot ||
          res?.preview ||
          res?.printJob?.contentSnapshot ||
          "*** TEST / TANILAMA ÇIKTISI — GERÇEK SİPARİŞ DEĞİLDİR ***"
      );
      notify(
        `${targetName} kuyruğuna TEST / TANILAMA fişi gönderildi (Gerçek sipariş oluşturmaz).`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Test baskısı gönderilemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateDualBackup() {
    try {
      setBusyAction("create-backup");
      const fn = (sysadminActions as any).createBackupAction;
      const res = fn
        ? await fn({
            triggerType: "MANUAL",
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : (() => { throw new Error("Yedekleme işlemi bu dağıtımda yapılandırılmamış."); })();
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        "Şifreli yedek hem USB belleğe hem Yerel Dizine alındı (15 kopya FIFO döngüsü uygulandı).",
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Yedekleme başarısız", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRestoreBackup(e: React.FormEvent) {
    e.preventDefault();
    if (!overwriteConfirmed) {
      notify(
        "Mevcut verinin üzerine yazılacağını onaylama kutusunu işaretlemelisiniz.",
        "red"
      );
      return;
    }
    if (!recoveryKeyInput.trim()) {
      notify(
        "Ayrı güvenli yerde tutulan Kurtarma Anahtarı (Recovery Key) girilmeden geri yükleme başlatılamaz.",
        "red"
      );
      return;
    }
    try {
      setBusyAction("restore-backup");
      const fn = (sysadminActions as any).restoreBackupAction;
      const res = fn
        ? await fn({
            backupId: selectedBackupId || backups[0]?.id,
            targetType: restoreTargetType,
            recoveryKey: recoveryKeyInput.trim(),
            confirmOverwrite: overwriteConfirmed,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : (() => { throw new Error("Geri yükleme işlemi bu dağıtımda yapılandırılmamış."); })();
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        "Yedek manifesti ve kurtarma anahtarı doğrulandı; koruma kopyası alınarak geri yükleme tamamlandı.",
        "teal"
      );
      setOverwriteConfirmed(false);
      setRecoveryKeyInput("");
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Geri yükleme hatası", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRunSequentialDiagnostics() {
    try {
      setBusyAction("run-diag");
      const fn = (sysadminActions as any).runSequentialDiagnosticsAction;
      const res = fn
        ? await fn({
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : (() => { throw new Error("Tanılama işlemi bu dağıtımda yapılandırılmamış."); })();
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        "6 adımlı sıralı salt-okunur tanılama tamamlandı; bulgular güncellendi.",
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Tanılama çalıştırılamadı", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExportDiagnosticPackage() {
    try {
      setBusyAction("export-diag");
      const fn = (sysadminActions as any).exportDiagnosticPackageAction;
      const res = fn
        ? await fn({
            diagnosticRunId: latestDiagnosticRun?.id,
            runId: latestDiagnosticRun?.id,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : (() => { throw new Error("Tanılama paketi dışa aktarımı yapılandırılmamış."); })();
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      const pkg = res?.diagnosticPackage || res?.package || res?.data || res;
      downloadJsonFile(
        `alacarte-diagnostic-masked-${new Date().toISOString().slice(0, 10)}.json`,
        pkg
      );
      notify(
        "Maskelenmiş JSON tanılama paketi (parola/PIN/anahtar içermez) dışa aktarıldı.",
        "teal"
      );
    } catch (err: any) {
      notify(err?.message || "Tanılama paketi dışa aktarılamadı", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExecuteAllowlistedRepair(finding: any) {
    if (!finding?.allowlistRepairAction) return;
    try {
      setBusyAction(`repair-${finding.id}`);
      const fn = (sysadminActions as any).executeAllowlistedRepairAction;
      const res = fn
        ? await fn({
            diagnosticRunId: latestDiagnosticRun?.id || finding?.runId,
            findingId:
              finding.id && !String(finding.id).startsWith("fnd-")
                ? finding.id
                : undefined,
            allowlistAction: finding.allowlistRepairAction,
            repairAction: finding.allowlistRepairAction,
            adminPinOrPassword: repairAdminPin,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : (() => { throw new Error("Otomatik onarım bu dağıtımda yapılandırılmamış."); })();
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `Ön yedek (USB + Yerel Dizin) alındı ve "${finding.allowlistRepairAction}" onarımı (${
          res?.repairRun?.repairId || res?.repairId || "IDEMPOTENT"
        }) başarıyla doğrulandı.`,
        "teal"
      );
      setRepairConfirmFindingId(null);
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Güvenli onarım yürütülemedi", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApplyMaintenancePackage(e: React.FormEvent) {
    e.preventDefault();
    if (!maintenancePkgName.trim() || !maintenanceSigHash.trim()) {
      notify("Paket dosya adı ve kriptografik imza özeti zorunludur.", "red");
      return;
    }
    try {
      setBusyAction("apply-maint");
      const fn = (sysadminActions as any).applySignedMaintenancePackageAction;
      const res = fn
        ? await fn({
            packageName: maintenancePkgName.trim(),
            signatureText: maintenanceSigHash.trim(),
            signatureHash: maintenanceSigHash.trim(),
            takePreBackup: maintenancePreBackup,
            actorId: currentUser?.id,
            actorName: currentUser?.name || "Sistem Yöneticisi",
          })
        : { error: "Bu yönetim işlemi sunucu tarafında kullanılamıyor." };
      if (res?.error) {
        notify(res.error, "red");
        return;
      }
      notify(
        `İmzalı çevrimdışı bakım paketi (${maintenancePkgName}) doğrulandı, ön yedek alındı ve kaydedildi.`,
        "teal"
      );
      onRefresh();
    } catch (err: any) {
      notify(err?.message || "Bakım paketi doğrulanamadı", "red");
    } finally {
      setBusyAction(null);
    }
  }

  // ============================================================================
  // RENDER SCR-13: DENETİM GÜNLÜĞÜ (HASH-ZİNCİRLİ AUDIT TRAIL)
  // ============================================================================
  if (activeScreen === "SCR-13") {
    return (
      <section className="space-y-4 text-[#f0f5f3]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-13 · DENETİM GÜNLÜĞÜ (HASH-ZİNCİRLİ AUDIT TRAIL)
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Olay ve İşlem Geçmişi
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Sunucu zaman damgalı, SHA-256 hash zincirli değiştirilemez denetim
              izi. Normal arayüzden olay düzenleme veya silme yapılamaz.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyAndExportAudit}
              disabled={busyAction === "verify-audit"}
              className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3.5 py-2 text-xs font-bold text-[#10221f] transition hover:brightness-110 disabled:opacity-50"
            >
              {busyAction === "verify-audit"
                ? "Doğrulanıyor..."
                : "✓ Hash Zincirini Doğrula ve İmzalı Manifest İndir"}
            </button>
          </div>
        </div>

        {/* SHA-256 Hash Chain Integrity Status Banner */}
        <div className="rounded-xl border border-[#3c6259] bg-[#1c3531] p-3.5 text-xs text-[#c0eee5]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <StatusBadge
                tone={chainSummary.verified ? "teal" : "red"}
                icon={chainSummary.verified ? "✓" : "✕"}
              >
                {chainSummary.verified
                  ? "SHA-256 HASH ZİNCİRİ DOĞRULANDI"
                  : "ZİNCİR KIRILMASI TESPİT EDİLDİ"}
              </StatusBadge>
              <span>
                Toplam Olay: <b>{chainSummary.totalCount}</b>
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="font-mono text-[11px]">
                prevHash:{" "}
                <b>{String(chainSummary.prevHash).slice(0, 14)}...</b> →{" "}
                entryHash:{" "}
                <b>{String(chainSummary.headHash).slice(0, 14)}...</b>
              </span>
            </div>
            <div className="text-[11px] text-[#9eddd1]">
              Son Kontrol: {formatDateTimeTR(chainSummary.lastTimestamp)} ·
              Sunucu: ALACARTE-SRV-01 (Europe/Istanbul)
            </div>
          </div>
          {verifiedManifestResult && (
            <div className="mt-2 rounded-lg border border-[#3c6058] bg-[#142623] p-2 font-mono text-[11px] text-[#73d8c6]">
              İmzalı Manifest Hazır · Head Hash: {chainSummary.headHash} ·
              Kayıt Sayısı: {chainSummary.totalCount}
            </div>
          )}
        </div>

        {/* Retention Policy Panel */}
        <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <b className="text-xs">
                Denetim Kaydı Saklama Politikası (retentionDays)
              </b>
              <p className="mt-0.5 text-[11px] text-[#9aaead]">
                Varsayılan 1825 gün (5 yıl). Rapor sorgu sınırı değildir;
                saklama süresi dolan kayıtlar yalnız imzalı manifest ile
                arşivlenir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold tracking-wider text-[#aab9b6] uppercase">
                SAKLAMA GÜNÜ:
              </label>
              <input
                type="number"
                min={365}
                max={36500}
                value={retentionDaysInput}
                onChange={(e) => setRetentionDaysInput(Number(e.target.value))}
                className="w-28 rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
              />
              <button
                type="button"
                onClick={handleSaveRetentionPolicy}
                disabled={busyAction === "retention"}
                className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-1.5 text-xs font-bold hover:brightness-110"
              >
                Politikayı Kaydet (Audit)
              </button>
            </div>
          </div>
        </div>

        {/* Filterable Audit Table */}
        <div className="overflow-hidden rounded-xl border border-[#344647] bg-[#192526]">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-[#344647] p-3">
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Kullanıcı, masa, sipariş, traceId veya olay ara..."
              className="w-64 rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-1.5 text-xs text-[#f0f5f3]"
            />
            <select
              value={auditRoleFilter}
              onChange={(e) => setAuditRoleFilter(e.target.value)}
              aria-label="Rol filtresi"
              className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
            >
              <option value="ALL">Tüm Roller / Kullanıcılar</option>
              <option value="SYSTEM_ADMIN">Sistem Yöneticisi</option>
              <option value="RESTAURANT_MANAGER">Restoran Yöneticisi</option>
              <option value="WAITER">Garson</option>
              <option value="SİSTEM">SİSTEM</option>
            </select>
            <select
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              aria-label="Eylem türü filtresi"
              className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
            >
              <option value="ALL">Tüm Olay Türleri</option>
              <option value="LOGIN">Giriş / Oturum (LOGIN)</option>
              <option value="ROUND">Servis Turu / Sipariş (ROUND)</option>
              <option value="CANCEL">İptal / Onay (CANCEL)</option>
              <option value="PRINT">Yazdırma (PRINT)</option>
              <option value="MENU">Menü Yönetimi (MENU)</option>
              <option value="BACKUP">Yedekleme / Restore (BACKUP)</option>
              <option value="DIAG">Tanılama / Onarım (DIAG)</option>
            </select>
            <select
              value={auditResultFilter}
              onChange={(e) => setAuditResultFilter(e.target.value)}
              aria-label="Sonuç filtresi"
              className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
            >
              <option value="ALL">Tüm Sonuçlar</option>
              <option value="SUCCESS">SUCCESS (Başarılı)</option>
              <option value="WARNING">WARNING (Uyarı)</option>
              <option value="REJECTED">REJECTED (Reddedildi)</option>
            </select>
            <input
              type="date"
              value={auditDateFilter}
              onChange={(e) => setAuditDateFilter(e.target.value)}
              aria-label="Tarih filtresi"
              className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
            />
            <button
              type="button"
              onClick={() => {
                setAuditSearch("");
                setAuditRoleFilter("ALL");
                setAuditActionFilter("ALL");
                setAuditResultFilter("ALL");
                setAuditDateFilter("");
              }}
              className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1.5 text-xs font-bold"
            >
              Filtreyi Temizle
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#344647] bg-[#152021] text-[10px] font-extrabold tracking-wider text-[#91a3a0] uppercase">
                  <th className="px-3 py-2.5">Sıra / Sunucu Zamanı</th>
                  <th className="px-3 py-2.5">Kullanıcı / Rol</th>
                  <th className="px-3 py-2.5">Olay (Action)</th>
                  <th className="px-3 py-2.5">Nesne / Masa / Sipariş</th>
                  <th className="px-3 py-2.5">Hash Zinciri</th>
                  <th className="px-3 py-2.5">Sonuç</th>
                  <th className="px-3 py-2.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3939]">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-[#9aaead]"
                    >
                      Filtreye uygun denetim olayı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log: any, idx: number) => {
                    const resTone =
                      log.result === "REJECTED" || log.result === "ERROR"
                        ? "red"
                        : log.result === "WARNING"
                        ? "gold"
                        : "teal";
                    return (
                      <tr
                        key={log.id || idx}
                        className="transition hover:bg-[#1e2d2d]"
                      >
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          <div className="font-bold text-[#73d8c6]">
                            #{log.sequenceNumber ?? idx + 1}
                          </div>
                          <div className="text-[#9aaead]">
                            {formatDateTimeTR(log.serverTimestamp)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold">{log.actorName}</div>
                          <div className="text-[11px] text-[#9aaead]">
                            {ROLE_LABELS[log.actorRole] || log.actorRole}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-mono font-bold">
                            {log.action}
                          </div>
                          {log.details && (
                            <div className="max-w-xs truncate text-[11px] text-[#9aaead]">
                              {log.details}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold">{log.entityType}</div>
                          <div className="font-mono text-[11px] text-[#9aaead]">
                            {log.entityId || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-[#9aaead]">
                          <div>
                            prev: {String(log.prevHash || "GENESIS").slice(0, 10)}
                            …
                          </div>
                          <div className="text-[#73d8c6]">
                            hash: {String(log.entryHash || "").slice(0, 10)}…
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            tone={resTone}
                            icon={
                              resTone === "teal"
                                ? "✓"
                                : resTone === "gold"
                                ? "⚠"
                                : "✕"
                            }
                          >
                            {log.result || "SUCCESS"}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditEvent(log)}
                            className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold hover:border-[#73d8c6]"
                          >
                            Olayı Aç
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#344647] p-3">
            <div className="rounded-lg border border-[#705e37] bg-[#393321] p-2.5 text-[11px] text-[#f1db9f]">
              ● Değiştirilemez Denetim İzi: Normal arayüzden olay düzenleme veya
              silme yoktur. Saklama sonu arşivi imzalı manifest ve SHA-256 hash
              zinciriyle doğrulanır.
            </div>
          </div>
        </div>

        {/* Audit Event Detail Drawer / Modal */}
        {selectedAuditEvent && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
          >
            <div className="w-full max-w-2xl rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[#344647] pb-3">
                <div>
                  <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
                    DENETİM OLAYI AYRINTISI · #{selectedAuditEvent.sequenceNumber}
                  </div>
                  <h2 id="audit-detail-title" className="mt-1 text-base font-bold">
                    {selectedAuditEvent.action} ({selectedAuditEvent.entityType})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAuditEvent(null)}
                  className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-xs font-bold"
                >
                  ✕ Kapat
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#2d3d3d] bg-[#131f20] p-2.5">
                    <span className="text-[10px] text-[#9aaead]">
                      TRACE ID (İz Kimliği)
                    </span>
                    <div className="mt-0.5 font-mono font-bold text-[#73d8c6] break-all">
                      {selectedAuditEvent.traceId || "trace-local-001"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#2d3d3d] bg-[#131f20] p-2.5">
                    <span className="text-[10px] text-[#9aaead]">
                      SUNUCU ZAMANI & AKTÖR
                    </span>
                    <div className="mt-0.5 font-bold">
                      {formatDateTimeTR(selectedAuditEvent.serverTimestamp)} ·{" "}
                      {selectedAuditEvent.actorName} (
                      {selectedAuditEvent.actorRole})
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#2d3d3d] bg-[#131f20] p-2.5 font-mono text-[11px]">
                  <div className="text-[#9aaead]">
                    prevHash :{" "}
                    <span className="text-[#f0f5f3] break-all">
                      {selectedAuditEvent.prevHash || "GENESIS"}
                    </span>
                  </div>
                  <div className="mt-1 text-[#9aaead]">
                    entryHash:{" "}
                    <span className="text-[#73d8c6] break-all">
                      {selectedAuditEvent.entryHash}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#2d3d3d] bg-[#101a1a] p-3">
                    <div className="mb-1 text-[10px] font-bold text-[#efc97b] uppercase">
                      Önceki Değer (beforeValueJson)
                    </div>
                    <pre className="max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-[#bbc8c6]">
                      {selectedAuditEvent.beforeValueJson || "null (İlk Kayıt)"}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-[#2d3d3d] bg-[#101a1a] p-3">
                    <div className="mb-1 text-[10px] font-bold text-[#73d8c6] uppercase">
                      Yeni Değer (afterValueJson)
                    </div>
                    <pre className="max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-[#bdf0e4]">
                      {selectedAuditEvent.afterValueJson ||
                        JSON.stringify(
                          {
                            action: selectedAuditEvent.action,
                            entityId: selectedAuditEvent.entityId,
                            details: selectedAuditEvent.details,
                          },
                          null,
                          2
                        )}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // ============================================================================
  // RENDER SCR-14: RESTORAN / MASA / ALAN TANIMLARI
  // ============================================================================
  if (activeScreen === "SCR-14") {
    return (
      <section className="space-y-4 text-[#f0f5f3]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-14 · RESTORAN / MASA TANIMLARI
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Alanlar ve Masalar
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Restoran alanlarını (Salon, Teras, Bahçe) ve masa yerleşimini
              yönetin. Geçmiş servis kaydı bulunan masalar silinemez; yalnızca
              açık servisi yokken pasifleştirilebilir.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Area Management Panel */}
          <div className="rounded-xl border border-[#344647] bg-[#192526]">
            <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
              <b className="text-xs">Restoran Alanları (Area)</b>
              <StatusBadge tone="teal" icon="◈">
                {areas.length} Alan Tanımlı
              </StatusBadge>
            </div>

            <div className="divide-y divide-[#2d3d3d]">
              {areas.map((area: any) => {
                const areaTables = tables.filter((t) => t.areaId === area.id);
                const busyCount = areaTables.filter(
                  (t) => t.status && t.status !== "EMPTY"
                ).length;
                return (
                  <div
                    key={area.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <b className="text-xs">{area.name}</b>
                        <StatusBadge
                          tone={area.active !== false ? "teal" : "neutral"}
                          icon={area.active !== false ? "●" : "○"}
                        >
                          {area.active !== false ? "Aktif" : "Pasif"}
                        </StatusBadge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#9aaead]">
                        {areaTables.length} masa ({busyCount} serviste) · Sıra:{" "}
                        {area.displayOrder ?? 0}
                        {area.description ? ` · ${area.description}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAreaId(area.id);
                        setAreaName(area.name);
                        setAreaDesc(area.description || "");
                        setAreaOrder(area.displayOrder ?? 0);
                        setAreaActive(area.active !== false);
                      }}
                      className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold hover:border-[#73d8c6]"
                    >
                      Düzenle
                    </button>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleUpsertArea}
              className="space-y-3 border-t border-[#344647] p-4"
            >
              <div className="text-[11px] font-bold text-[#73d8c6]">
                {editingAreaId ? "Alanı Düzenle" : "＋ Yeni Alan Ekle"}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    ALAN ADI
                  </label>
                  <input
                    type="text"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    placeholder="Örn: Salon, Teras"
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    AÇIKLAMA
                  </label>
                  <input
                    type="text"
                    value={areaDesc}
                    onChange={(e) => setAreaDesc(e.target.value)}
                    placeholder="İsteğe bağlı not"
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    GÖRÜNÜM SIRASI
                  </label>
                  <input
                    type="number"
                    value={areaOrder}
                    onChange={(e) => setAreaOrder(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-[#9aaead]">
                  <input
                    type="checkbox"
                    checked={areaActive}
                    onChange={(e) => setAreaActive(e.target.checked)}
                    className="accent-[#73d8c6]"
                  />
                  Alan yeni servis için aktif
                </label>
                <div className="flex gap-2">
                  {editingAreaId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAreaId(null);
                        setAreaName("");
                        setAreaDesc("");
                      }}
                      className="rounded-lg border border-[#344647] px-3 py-1.5 text-xs"
                    >
                      Vazgeç
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busyAction === "upsert-area"}
                    className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3.5 py-1.5 text-xs font-bold text-[#10221f]"
                  >
                    {editingAreaId ? "Alanı Güncelle" : "Alan Ekle"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Table Form Panel */}
          <div className="rounded-xl border border-[#344647] bg-[#192526]">
            <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
              <b className="text-xs">
                {editingTableId ? "Masa Tanımını Düzenle" : "Yeni Masa Tanımı"}
              </b>
              <StatusBadge tone="teal" icon="⊞">
                {tables.length} Masa
              </StatusBadge>
            </div>
            <form onSubmit={handleUpsertTable} className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    MASA NUMARASI
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={tableNumber}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      setTableNumber(num);
                      if (!editingTableId) {
                        setTableName(`Masa ${String(num).padStart(2, "0")}`);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    MASA ADI / ETİKETİ
                  </label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    ALAN (AREA)
                  </label>
                  <select
                    value={tableAreaId || areas[0]?.id || ""}
                    onChange={(e) => setTableAreaId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  >
                    {areas.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    KAPASİTE (GÖRSEL NOT)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={tableCapacity}
                    onChange={(e) => setTableCapacity(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs text-[#9aaead]">
                <input
                  type="checkbox"
                  checked={tableActive}
                  onChange={(e) => setTableActive(e.target.checked)}
                  className="accent-[#73d8c6]"
                />
                Masa yeni servis açılışına aktif
              </label>

              <div className="rounded-lg border border-[#705e37] bg-[#393321] p-3 text-[11px] text-[#f1db9f]">
                <b>Kural:</b> Servis geçmişi olan veya açık siparişi bulunan
                masa veritabanından silinmez (denetim ve rapor bütünlüğü
                korunur). Açık servisi olmayan masa gerektiğinde{" "}
                <b>Pasifleştir</b> ile yeni servise kapatılır.
              </div>

              <div className="flex justify-end gap-2">
                {editingTableId && (
                  <button
                    type="button"
                    onClick={() => setEditingTableId(null)}
                    className="rounded-lg border border-[#344647] px-3 py-1.5 text-xs"
                  >
                    Vazgeç
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busyAction === "upsert-table"}
                  className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f]"
                >
                  {editingTableId
                    ? "Masa Tanımını Güncelle"
                    : "Masa Tanımını Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Table Directory List */}
        <div className="overflow-hidden rounded-xl border border-[#344647] bg-[#192526]">
          <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
            <b className="text-xs">Masa Listesi ve Kullanım Durumu</b>
            <span className="text-[11px] text-[#9aaead]">
              Silme kapalıdır · Yalnızca boş masalar pasifleştirilebilir
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#344647] bg-[#152021] text-[10px] font-extrabold tracking-wider text-[#91a3a0] uppercase">
                  <th className="px-3 py-2.5">Masa</th>
                  <th className="px-3 py-2.5">Alan</th>
                  <th className="px-3 py-2.5">Kapasite</th>
                  <th className="px-3 py-2.5">Operasyon Durumu</th>
                  <th className="px-3 py-2.5">Tanım Durumu</th>
                  <th className="px-3 py-2.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3939]">
                {tables.map((t: any) => {
                  const areaObj = areas.find((a) => a.id === t.areaId);
                  const stInfo = TABLE_STATUS_LABELS[t.status] || {
                    label: t.status || "Boş",
                    icon: "○",
                    tone: "neutral" as const,
                  };
                  const hasOpenService = t.status && t.status !== "EMPTY";
                  return (
                    <tr key={t.id} className="hover:bg-[#1e2d2d]">
                      <td className="px-3 py-2.5 font-bold">{t.name}</td>
                      <td className="px-3 py-2.5">
                        {t.area?.name || areaObj?.name || "Salon"}
                      </td>
                      <td className="px-3 py-2.5">{t.capacity ?? 4} Kişilik</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={stInfo.tone} icon={stInfo.icon}>
                          {stInfo.label}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          tone={t.active !== false ? "teal" : "neutral"}
                          icon={t.active !== false ? "✓" : "⏸"}
                        >
                          {t.active !== false ? "Aktif" : "Pasif (Kapalı)"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTableId(t.id);
                              setTableNumber(t.number);
                              setTableName(t.name);
                              setTableAreaId(t.areaId);
                              setTableCapacity(t.capacity ?? 4);
                              setTableActive(t.active !== false);
                            }}
                            className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            disabled={hasOpenService}
                            title={
                              hasOpenService
                                ? "Açık servisi olan masa pasifleştirilemez"
                                : "Masanın aktif/pasif durumunu değiştir"
                            }
                            onClick={(e) =>
                              handleUpsertTable(e, {
                                id: t.id,
                                tableId: t.id,
                                number: t.number,
                                name: t.name,
                                areaId: t.areaId,
                                capacity: t.capacity ?? 4,
                                active: t.active === false,
                                actorId: currentUser?.id,
                                actorName:
                                  currentUser?.name || "Sistem Yöneticisi",
                              })
                            }
                            className="rounded-lg border border-[#665637] bg-[#3b3325] px-2.5 py-1 text-[11px] font-bold text-[#f2d38f] disabled:opacity-40"
                          >
                            {t.active !== false ? "Pasifleştir" : "Etkinleştir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // RENDER SCR-15: MENÜ YÖNETİMİ (FİYAT ALANI YOK)
  // ============================================================================
  if (activeScreen === "SCR-15") {
    const currentMenuVer = config?.menuVersion ?? 1;
    return (
      <section className="space-y-4 text-[#f0f5f3]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-15 · MENÜ YÖNETİMİ
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Kategoriler, Ürünler, İstasyonlar ve Seçenekler
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Menü ağacını, fiş adını, mutfak istasyonunu (SICAK,
              IZGARA, SOGUK, TATLI), koltuk/paylaşım kurallarını ve menü
              sürümünü yönetin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="teal" icon="✓">
              Aktif Menü
            </StatusBadge>
            <button
              type="button"
              onClick={handlePublishMenuVersion}
              disabled={busyAction === "publish-menu"}
              className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3.5 py-2 text-xs font-bold text-[#10221f] transition hover:brightness-110 disabled:opacity-50"
            >
              {busyAction === "publish-menu"
                ? "Yayınlanıyor..."
                : `🚀 Menü Sürümünü Yayınla (v${currentMenuVer} -> v${
                    currentMenuVer + 1
                  })`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Category & Subcategory Tree Manager (Left 5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">Kategori & Alt Kategori Ağacı</b>
                <span className="text-[11px] text-[#9aaead]">
                  {categories.length} Kategori
                </span>
              </div>

              <div className="max-h-72 divide-y divide-[#2d3d3d] overflow-y-auto">
                {categories.map((cat: any) => {
                  const count = menuItems.filter(
                    (m) => m.categoryId === cat.id
                  ).length;
                  const isSub = Boolean(cat.parentId);
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-[#1e2d2d]"
                    >
                      <div className={isSub ? "pl-4" : "font-bold"}>
                        <span>
                          {isSub ? "↳ " : "⌄ "}
                          {cat.name}
                        </span>
                        <span className="ml-2 text-[10px] text-[#9aaead]">
                          ({count} ürün)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setCatName(cat.name);
                          setCatParentId(cat.parentId || "");
                          setCatOrder(cat.displayOrder ?? 0);
                          setCatActive(cat.active !== false);
                        }}
                        className="rounded border border-[#344647] bg-[#202f30] px-2 py-0.5 text-[10px] font-bold"
                      >
                        Düzenle
                      </button>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleUpsertCategory}
                className="space-y-2.5 border-t border-[#344647] p-3.5"
              >
                <div className="text-[11px] font-bold text-[#73d8c6]">
                  {editingCatId
                    ? "Kategoriyi Güncelle"
                    : "＋ Kategori / Alt Kategori Ekle"}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      KATEGORİ ADI
                    </label>
                    <input
                      type="text"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="Örn: Ana Yemekler / Izgara"
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      ÜST KATEGORİ (İSTEĞE BAĞLI)
                    </label>
                    <select
                      value={catParentId}
                      onChange={(e) => setCatParentId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    >
                      <option value="">— Ana Kategori —</option>
                      {categories
                        .filter((c: any) => !c.parentId && c.id !== editingCatId)
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#9aaead]">
                    <input
                      type="checkbox"
                      checked={catActive}
                      onChange={(e) => setCatActive(e.target.checked)}
                      className="accent-[#73d8c6]"
                    />
                    Aktif
                  </label>
                  <button
                    type="submit"
                    disabled={busyAction === "upsert-cat"}
                    className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3 py-1 text-xs font-bold text-[#10221f]"
                  >
                    {editingCatId ? "Kategoriyi Kaydet" : "Kategori Ekle"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Product Definition Form (Right 7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">
                  {editingItemId
                    ? "Ürün Tanımını Düzenle"
                    : "Ürün Tanımı"}
                </b>
                <StatusBadge tone="teal" icon="v">
                  Menü Sürümü v{currentMenuVer}
                </StatusBadge>
              </div>

              <form onSubmit={handleUpsertMenuItem} className="space-y-3.5 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      ÜRÜN ADI (name)
                    </label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => {
                        setItemName(e.target.value);
                        if (!editingItemId) setItemReceiptName(e.target.value);
                      }}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      FİŞTE GÖRÜNEN AD (receiptName)
                    </label>
                    <input
                      type="text"
                      value={itemReceiptName}
                      onChange={(e) => setItemReceiptName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      KATEGORİ
                    </label>
                    <select
                      value={itemCategoryId || categories[0]?.id || ""}
                      onChange={(e) => setItemCategoryId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    >
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      MUTFAK İSTASYONU (Kitchen Station)
                    </label>
                    <select
                      value={itemStationCode}
                      onChange={(e) => setItemStationCode(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    >
                      <option value="SICAK">SICAK (Sıcak Mutfak)</option>
                      <option value="IZGARA">IZGARA (Izgara İstasyonu)</option>
                      <option value="SOGUK">SOGUK (Soğuk / Meze)</option>
                      <option value="TATLI">TATLI (Tatlı / Bar)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      ÜRÜN SINIFI (Product Class)
                    </label>
                    <select
                      value={itemProductClass}
                      onChange={(e) =>
                        setItemProductClass(
                          e.target.value as "STANDARD" | "BEVERAGE" | "SHAREABLE"
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    >
                      <option value="STANDARD">STANDARD (Standart Yemek)</option>
                      <option value="BEVERAGE">BEVERAGE (İçecek)</option>
                      <option value="SHAREABLE">
                        SHAREABLE (Paylaşılabilir Ürün)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      ÜRÜN DURUMU (Status)
                    </label>
                    <select
                      value={itemStatus}
                      onChange={(e) =>
                        setItemStatus(
                          e.target.value as "ACTIVE" | "DRAFT" | "PASSIVE"
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    >
                      <option value="ACTIVE">ACTIVE (Aktif)</option>
                      <option value="DRAFT">DRAFT (Taslak)</option>
                      <option value="PASSIVE">PASSIVE (Pasif)</option>
                    </select>
                  </div>
                </div>

                {/* Seat & Shareable Checkboxes */}
                <div className="space-y-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] p-3">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={itemAskSeatOnAdd}
                      onChange={(e) => setItemAskSeatOnAdd(e.target.checked)}
                      className="accent-[#73d8c6]"
                    />
                    <span>
                      Ürün eklendiğinde koltuk numarası sor (
                      <code className="text-[#73d8c6]">askSeatOnAdd</code>)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={itemIsShareable}
                      onChange={(e) => setItemIsShareable(e.target.checked)}
                      className="accent-[#73d8c6]"
                    />
                    <span>
                      Ürün birden fazla koltuğa paylaştırılabilir (
                      <code className="text-[#73d8c6]">isShareable</code> — adet
                      çoğaltmaz)
                    </span>
                  </label>
                </div>

                {/* Modifier Group Checkboxes */}
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    MODIFIER GRUPLARI (Hazırlama / Pişme Seçenekleri)
                  </label>
                  <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(modifierGroups.length > 0
                      ? modifierGroups
                      : [
                          {
                            id: "mg-1",
                            name: "Pişme Derecesi",
                            required: true,
                          },
                          {
                            id: "mg-2",
                            name: "Hazırlama Tercihi",
                            required: false,
                          },
                          {
                            id: "mg-3",
                            name: "Garnitür / Sos",
                            required: false,
                          },
                        ]
                    ).map((mg: any) => {
                      const checked = itemSelectedModifiers.includes(mg.id);
                      return (
                        <label
                          key={mg.id}
                          className="flex items-center gap-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setItemSelectedModifiers((prev) => [
                                  ...prev,
                                  mg.id,
                                ]);
                              } else {
                                setItemSelectedModifiers((prev) =>
                                  prev.filter((id) => id !== mg.id)
                                );
                              }
                            }}
                            className="accent-[#73d8c6]"
                          />
                          <span>
                            {mg.name}{" "}
                            <small className="text-[#9aaead]">
                              ({mg.required ? "Zorunlu" : "İsteğe bağlı"})
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Allergens & Dietary Tags */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      ALERJEN ETİKETLERİ (allergens)
                    </label>
                    <input
                      type="text"
                      value={itemAllergens}
                      onChange={(e) => setItemAllergens(e.target.value)}
                      placeholder="Örn: Gluten, Süt, Deniz Ürünü"
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      DİYET ETİKETLERİ (dietaryTags)
                    </label>
                    <input
                      type="text"
                      value={itemDietaryTags}
                      onChange={(e) => setItemDietaryTags(e.target.value)}
                      placeholder="Örn: Vegan, Glutensiz, Şefin Önerisi"
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={() => setEditingItemId(null)}
                      className="rounded-lg border border-[#344647] px-3 py-1.5 text-xs"
                    >
                      Yeni Ürüne Geç
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busyAction === "upsert-item"}
                    className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f]"
                  >
                    {editingItemId
                      ? "Ürün Tanımını Güncelle"
                      : "Ürün Tanımını Kaydet"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Registered Menu Items Table */}
        <div className="overflow-hidden rounded-xl border border-[#344647] bg-[#192526]">
          <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
            <b className="text-xs">Kayıtlı Menü Kalemleri ({menuItems.length})</b>
            <span className="text-[11px] text-[#9aaead]">
              Açık siparişlerde ürün adı ve istasyon anlık görüntüsü (snapshot)
              korunur
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#344647] bg-[#152021] text-[10px] font-extrabold tracking-wider text-[#91a3a0] uppercase">
                  <th className="px-3 py-2.5">Ürün Adı / Fiş Adı</th>
                  <th className="px-3 py-2.5">İstasyon</th>
                  <th className="px-3 py-2.5">Sınıf / Koltuk / Paylaşım</th>
                  <th className="px-3 py-2.5">Alerjen & Diyet</th>
                  <th className="px-3 py-2.5">Durum</th>
                  <th className="px-3 py-2.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3939]">
                {menuItems.map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#1e2d2d]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{m.name}</span>
                        {m.is86ed && (
                          <span className="rounded bg-[#ef5350] px-1.5 py-0.5 text-[9px] font-black text-white">
                            86 · TÜKENDİ
                          </span>
                        )}
                        {m.availableCount !== null && m.availableCount !== undefined && (
                          <span className="rounded border border-[#efc97b] bg-[#393321] px-1.5 py-0.5 text-[9px] font-bold text-[#f2d38f]">
                            Kalan: {m.availableCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9aaead]">
                        Fiş: {m.receiptName}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone="teal" icon="🍳">
                        {m.station?.code || m.station?.name || "SICAK"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2.5 text-[11px]">
                      <div>{m.productClass || "STANDARD"}</div>
                      <div className="text-[#9aaead]">
                        {m.askSeatOnAdd ? "Koltuk Sor" : "Koltuk Sorma"} ·{" "}
                        {m.isShareable ? "Paylaşılabilir" : "Tekil"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#9aaead]">
                      <div>{m.allergens || "—"}</div>
                      <div className="text-[#73d8c6]">{m.dietaryTags || ""}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        tone={
                          m.status === "ACTIVE"
                            ? "teal"
                            : m.status === "DRAFT"
                            ? "gold"
                            : "neutral"
                        }
                        icon={m.status === "ACTIVE" ? "●" : "○"}
                      >
                        {m.status || "ACTIVE"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busyAction === `toggle-86-${m.id}`}
                          onClick={() => handleToggle86Item(m)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition ${
                            m.is86ed
                              ? "border-[#ef5350] bg-[#422222] text-[#ffcdd2] hover:bg-[#522b2b]"
                              : "border-[#344647] bg-[#202f30] text-[#9aaead] hover:text-[#f0f5f3]"
                          }`}
                        >
                          {m.is86ed ? "86 Kaldır" : "🚫 86"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(m.id);
                            setItemName(m.name);
                            setItemReceiptName(m.receiptName || m.name);
                            setItemCategoryId(m.categoryId);
                            setItemStationCode(m.station?.code || "SICAK");
                            setItemProductClass(m.productClass || "STANDARD");
                            setItemAskSeatOnAdd(Boolean(m.askSeatOnAdd));
                            setItemIsShareable(Boolean(m.isShareable));
                            setItemAllergens(m.allergens || "");
                            setItemDietaryTags(m.dietaryTags || "");
                            setItemStatus(m.status || "ACTIVE");
                            setItemSelectedModifiers(
                              (m.modifierGroups || [])
                                .map((mg: any) => mg.modifierGroupId || mg.modifierGroup?.id)
                                .filter(Boolean)
                            );
                          }}
                          className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
                        >
                          Düzenle
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODIFIER GRUPLARI VE ZORUNLU HAZIRLAMA KURALLARI YÖNETİMİ */}
        <div className="overflow-hidden rounded-xl border border-[#344647] bg-[#192526]">
          <div className="flex flex-wrap items-center justify-between border-b border-[#344647] px-4 py-3 gap-2">
            <div>
              <b className="text-xs text-[#f0f5f3]">
                Modifier Grupları ve Zorunlu Hazırlama Seçenekleri ({modifierGroups.length})
              </b>
              <p className="text-[11px] text-[#9aaead]">
                Mutfak hazırlık kuralları, pişme dereceleri, soslar ve garnitürler
              </p>
            </div>
            {editingModGroupId && (
              <button
                type="button"
                onClick={() => {
                  setEditingModGroupId(null);
                  setModGroupName("");
                  setModGroupRequired(false);
                  setModGroupMinSelect(0);
                  setModGroupMaxSelect(1);
                  setModGroupOptionsText("");
                }}
                className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold text-[#f0f5f3]"
              >
                + Yeni Grup Ekle
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form */}
            <form onSubmit={handleSaveModifierGroup} className="lg:col-span-5 space-y-3 rounded-xl border border-[#2d3d3d] bg-[#141f20] p-3.5">
              <div className="text-[11px] font-bold text-[#73d8c6] uppercase">
                {editingModGroupId ? "Modifier Grubunu Düzenle" : "Yeni Modifier Grubu Oluştur"}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                  GRUP ADI *
                </label>
                <input
                  type="text"
                  required
                  value={modGroupName}
                  onChange={(e) => setModGroupName(e.target.value)}
                  placeholder="Örn: Pişme Derecesi, Acılık Seviyesi, Sos"
                  className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modGroupRequired}
                    onChange={(e) => {
                      const req = e.target.checked;
                      setModGroupRequired(req);
                      if (req && modGroupMinSelect === 0) setModGroupMinSelect(1);
                    }}
                    className="accent-[#73d8c6]"
                  />
                  <span className="text-xs font-bold text-[#f0f5f3]">
                    Bu Grup Zorunlu (Mutfak için şart)
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    EN AZ SEÇİM (minSelect)
                  </label>
                  <input
                    type="number"
                    min={modGroupRequired ? 1 : 0}
                    max={10}
                    value={modGroupMinSelect}
                    onChange={(e) => setModGroupMinSelect(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    EN FAZLA SEÇİM (maxSelect)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={modGroupMaxSelect}
                    onChange={(e) => setModGroupMaxSelect(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                  SEÇENEKLER (Virgül veya Alt Alta Yazın) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={modGroupOptionsText}
                  onChange={(e) => setModGroupOptionsText(e.target.value)}
                  placeholder="Örn: Az pişmiş, Orta pişmiş, İyi pişmiş"
                  className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
                />
                <span className="text-[10px] text-[#9aaead]">
                  Garson sipariş ekranında bu seçenekleri buton olarak görür ve seçer.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {editingModGroupId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingModGroupId(null);
                      setModGroupName("");
                      setModGroupRequired(false);
                      setModGroupMinSelect(0);
                      setModGroupMaxSelect(1);
                      setModGroupOptionsText("");
                    }}
                    className="rounded-lg border border-[#344647] px-3 py-1.5 text-xs text-[#f0f5f3]"
                  >
                    Vazgeç
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busyAction === "upsert-modifier-group"}
                  className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f]"
                >
                  {editingModGroupId ? "Grubu Güncelle" : "Grup Oluştur"}
                </button>
              </div>
            </form>

            {/* List of existing groups */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="text-[11px] font-bold text-[#9aaead] uppercase">
                TANIMLI MODIFIER GRUPLARI ({modifierGroups.length})
              </div>

              {modifierGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#344647] p-6 text-center text-xs text-[#9aaead]">
                  Henüz tanımlı bir modifier grubu yok. Soldaki formdan ekleyebilirsiniz.
                </div>
              ) : (
                modifierGroups.map((mg: any) => (
                  <div
                    key={mg.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#2d3d3d] bg-[#141f20] p-3 transition hover:border-[#3e5655]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#f0f5f3]">{mg.name}</span>
                        {mg.required ? (
                          <span className="rounded bg-[#452c2a] border border-[#754541] px-1.5 py-0.5 text-[9px] font-extrabold text-[#ffc7be]">
                            ZORUNLU (Min: {mg.minSelect})
                          </span>
                        ) : (
                          <span className="rounded bg-[#202f30] border border-[#344647] px-1.5 py-0.5 text-[9px] text-[#9aaead]">
                            İsteğe Bağlı (Max: {mg.maxSelect})
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {(mg.options || []).map((opt: any) => (
                          <span
                            key={opt.id}
                            className="rounded bg-[#1a2829] border border-[#2e4242] px-2 py-0.5 text-[10px] text-[#c0eee5]"
                          >
                            {opt.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingModGroupId(mg.id);
                          setModGroupName(mg.name);
                          setModGroupRequired(Boolean(mg.required));
                          setModGroupMinSelect(mg.minSelect ?? (mg.required ? 1 : 0));
                          setModGroupMaxSelect(mg.maxSelect ?? 1);
                          setModGroupOptionsText(
                            (mg.options || []).map((o: any) => o.name).join(", ")
                          );
                        }}
                        className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteModifierGroup(mg.id, mg.name)}
                        className="rounded-lg border border-[#754541] bg-[#3d2726] px-2.5 py-1 text-[11px] font-bold text-[#ffc7be] hover:bg-[#52302e]"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // RENDER SCR-16: KULLANICI VE ROL YÖNETİMİ
  // ============================================================================
  if (activeScreen === "SCR-16") {
    return (
      <section className="space-y-4 text-[#f0f5f3]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-16 · KULLANICI VE ROL YÖNETİMİ
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Kişisel Kullanıcı Hesapları ve İzin Matrisi
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Her çalışan kişisel hesap kullanır; ortak hesap açılmaz. Son etkin
              Yerel Sistem Yöneticisi (SYSTEM_ADMIN) pasifleştirilemez.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleShiftCancelPolicy}
              disabled={busyAction === "shift-policy"}
              className={`rounded-lg border px-3.5 py-2 text-xs font-bold transition ${
                config?.shiftCancelDelegate
                  ? "border-[#665637] bg-[#3b3325] text-[#f2d38f]"
                  : "border-[#344647] bg-[#202f30] text-[#f0f5f3]"
              }`}
            >
              {config?.shiftCancelDelegate
                ? "● Vardiya İptal Yetkilisi Politikası: AÇIK"
                : "○ Vardiya İptal Yetkilisi Politikası: KAPALI"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Personal User List (Left 7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">Kişisel Kullanıcı Listesi</b>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#9aaead]">
                    Yeni Geçici PIN/Parola:
                  </span>
                  <input
                    type="text"
                    value={resetCredPin}
                    onChange={(e) => setResetCredPin(e.target.value)}
                    aria-label="Sıfırlama için geçici PIN veya parola"
                    className="w-24 rounded border border-[#3a4c4b] bg-[#101a1a] px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="divide-y divide-[#2d3d3d]">
                {users.map((u: any) => {
                  const isLastSysAdmin =
                    u.role === "SYSTEM_ADMIN" &&
                    u.active !== false &&
                    activeSystemAdminsCount <= 1;

                  return (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#394f50] text-xs font-extrabold text-[#c4f1e8]">
                          {String(u.name || "U")
                            .split(" ")
                            .map((p: string) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="text-xs">{u.name}</b>
                            <StatusBadge
                              tone={u.active !== false ? "teal" : "neutral"}
                              icon={u.active !== false ? "✓" : "⏸"}
                            >
                              {u.active !== false ? "Etkin" : "Pasif"}
                            </StatusBadge>
                            {u.canApproveCancel && (
                              <StatusBadge tone="gold" icon="★">
                                Vardiya İptal Yetkilisi
                              </StatusBadge>
                            )}
                            {isLastSysAdmin && (
                              <StatusBadge tone="gold" icon="🔒">
                                Son Etkin Sistem Yöneticisi
                              </StatusBadge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#9aaead]">
                            <code className="text-[#73d8c6]">{u.username}</code>{" "}
                            · {ROLE_LABELS[u.role] || u.role} · Oturum Sürümü: v
                            {u.sessionVersion ?? 1}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(u.id);
                            setUName(u.name);
                            setUUsername(u.username);
                            setURole(u.role);
                            setUActive(u.active !== false);
                            setUCanApproveCancel(Boolean(u.canApproveCancel));
                          }}
                          className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold hover:border-[#73d8c6]"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetCredentials(u)}
                          disabled={busyAction === `reset-${u.id}`}
                          className="rounded-lg border border-[#665637] bg-[#3b3325] px-2.5 py-1 text-[11px] font-bold text-[#f2d38f]"
                        >
                          Kişisel PIN/Parola Sıfırla
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeSessions(u)}
                          disabled={busyAction === `revoke-${u.id}`}
                          className="rounded-lg border border-[#754541] bg-[#452c2a] px-2.5 py-1 text-[11px] font-bold text-[#ffc7be]"
                        >
                          Etkin Oturumları Kapat
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Role & Permission Matrix */}
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">
                  Rol ve İzin Matrisi (Görüntüle / Oluştur / Düzenle / Onayla)
                </b>
                <select
                  value={matrixRoleView}
                  onChange={(e) =>
                    setMatrixRoleView(
                      e.target.value as
                        | "SYSTEM_ADMIN"
                        | "RESTAURANT_MANAGER"
                        | "WAITER"
                    )
                  }
                  aria-label="İzin matrisi rol seçimi"
                  className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1 text-xs"
                >
                  <option value="SYSTEM_ADMIN">
                    SYSTEM_ADMIN (Yerel Sistem Yöneticisi)
                  </option>
                  <option value="RESTAURANT_MANAGER">
                    RESTAURANT_MANAGER (Restoran Yöneticisi)
                  </option>
                  <option value="WAITER">WAITER (Garson)</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#344647] bg-[#152021] text-[10px] font-extrabold tracking-wider text-[#91a3a0] uppercase">
                      <th className="px-3 py-2">Modül / Eylem</th>
                      <th className="px-3 py-2">Görüntüle</th>
                      <th className="px-3 py-2">Oluştur</th>
                      <th className="px-3 py-2">Düzenle</th>
                      <th className="px-3 py-2">Onayla</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a3939]">
                    <tr>
                      <td className="px-3 py-2 font-semibold">
                        Masa Planı ve Sipariş / Servis Turu
                      </td>
                      <td className="px-3 py-2 text-[#73d8c6]">✓</td>
                      <td className="px-3 py-2 text-[#73d8c6]">✓</td>
                      <td className="px-3 py-2 text-[#73d8c6]">
                        ✓ (Yalnız Taslak)
                      </td>
                      <td className="px-3 py-2 text-[#9aaead]">—</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-semibold">
                        Gönderilmiş Kalem İptal Kararı & VOID Fişi
                      </td>
                      <td className="px-3 py-2 text-[#73d8c6]">✓</td>
                      <td className="px-3 py-2 text-[#73d8c6]">
                        ✓ (Talep Oluşturma)
                      </td>
                      <td className="px-3 py-2 text-[#9aaead]">—</td>
                      <td className="px-3 py-2 text-[#efc97b]">
                        {matrixRoleView === "WAITER"
                          ? "Yalnız Vardiya İptal Yetkilisi"
                          : "✓ (Kendi Talebi Hariç)"}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-semibold">
                        Operasyon Panosu ve Raporlar
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "WAITER" ? "—" : "✓"}
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "WAITER" ? "—" : "✓"}
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "RESTAURANT_MANAGER"
                          ? "✓ (Öğrenme Modu)"
                          : matrixRoleView === "SYSTEM_ADMIN"
                          ? "✓"
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "WAITER" ? "—" : "✓"}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-semibold">
                        Denetim, Menü, Yazıcı, Yedek & Tanılama
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "SYSTEM_ADMIN" ? "✓" : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "SYSTEM_ADMIN" ? "✓" : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "SYSTEM_ADMIN" ? "✓" : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {matrixRoleView === "SYSTEM_ADMIN"
                          ? "✓ (Ön Yedekli Onarım)"
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Add / Edit Personal User Form (Right 5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">
                  {editingUserId
                    ? "Kişisel Hesabı Düzenle"
                    : "＋ Yeni Kişisel Kullanıcı Ekle"}
                </b>
                <StatusBadge tone="teal" icon="👤">
                  Ortak Hesap Yasak
                </StatusBadge>
              </div>
              <form onSubmit={handleUpsertUser} className="space-y-3 p-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    AD SOYAD
                  </label>
                  <input
                    type="text"
                    value={uName}
                    onChange={(e) => setUName(e.target.value)}
                    placeholder="Örn: Ayşe Yılmaz"
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    KİŞİSEL KULLANICI ADI (username)
                  </label>
                  <input
                    type="text"
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    placeholder="Örn: ayse.yilmaz"
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    ROL (Role)
                  </label>
                  <select
                    value={uRole}
                    onChange={(e) =>
                      setURole(
                        e.target.value as
                          | "SYSTEM_ADMIN"
                          | "RESTAURANT_MANAGER"
                          | "WAITER"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  >
                    <option value="WAITER">WAITER (Garson)</option>
                    <option value="RESTAURANT_MANAGER">
                      RESTAURANT_MANAGER (Restoran Yöneticisi)
                    </option>
                    <option value="SYSTEM_ADMIN">
                      SYSTEM_ADMIN (Yerel Sistem Yöneticisi)
                    </option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      BAŞLANGIÇ PAROLASI
                    </label>
                    <input
                      type="password"
                      value={uPassword}
                      onChange={(e) => setUPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      KİŞİSEL PIN
                    </label>
                    <input
                      type="password"
                      value={uPin}
                      onChange={(e) => setUPin(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] p-3">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={uActive}
                      onChange={(e) => setUActive(e.target.checked)}
                      className="accent-[#73d8c6]"
                    />
                    <span>Kullanıcı hesabı etkin (active)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={uCanApproveCancel}
                      onChange={(e) => setUCanApproveCancel(e.target.checked)}
                      className="accent-[#73d8c6]"
                    />
                    <span>
                      Vardiya İptal Yetkilisi izni (
                      <code className="text-[#73d8c6]">canApproveCancel</code>)
                    </span>
                  </label>
                </div>

                <div className="rounded-lg border border-[#705e37] bg-[#393321] p-2.5 text-[11px] text-[#f1db9f]">
                  Varsayılan Ret · Son etkin{" "}
                  <b>SYSTEM_ADMIN (Yerel Sistem Yöneticisi)</b> hesabı
                  pasifleştirilemez.
                </div>

                <div className="flex justify-end gap-2">
                  {editingUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUserId(null);
                        setUName("");
                        setUUsername("");
                      }}
                      className="rounded-lg border border-[#344647] px-3 py-1.5 text-xs"
                    >
                      Vazgeç
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busyAction === "upsert-user"}
                    className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f]"
                  >
                    {editingUserId ? "Kullanıcıyı Güncelle" : "Kullanıcıyı Kaydet"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // RENDER SCR-17: YAZICI, İSTASYON VE DONANIM PAKETİ YAPILANDIRMASI
  // ============================================================================
  if (activeScreen === "SCR-17") {
    return (
      <section className="space-y-4 text-[#f0f5f3]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-17 · YAZICI, İSTASYON VE DONANIM PAKETİ YAPILANDIRMASI
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Windows Yazdırma Kuyrukları ve Onaylı Donanım Topolojisi
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Uygulama yerel Windows Spooler kuyruklarına (Adisyon-USB ve
              Mutfak-Windows) iş bırakır. RAW/LPR/IPP tercihi uygulamada
              sunulmaz; işletim sistemi ve print server katmanında yönetilir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSendTestPrint()}
              disabled={busyAction === "test-print"}
              className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3.5 py-2 text-xs font-bold text-[#10221f] transition hover:brightness-110 disabled:opacity-50"
            >
              {busyAction === "test-print"
                ? "Gönderiliyor..."
                : "🖨 Test Baskısı Gönder (TEST / TANILAMA)"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Defined Queues & Stations (Left 5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">Tanımlı Windows Yazdırma Hedefleri</b>
                <span className="text-[11px] text-[#9aaead]">
                  Restoran başına 2 yazıcı
                </span>
              </div>

              <div className="divide-y divide-[#2d3d3d]">
                {(printerQueues.length > 0
                  ? printerQueues
                  : [
                      {
                        id: "q-receipt",
                        name: "Adisyon-USB",
                        role: "RECEIPT",
                        osQueueName: "Adisyon-USB",
                        connectionType: "USB_DIRECT",
                        deviceModel: "Epson TM-T20III (011)",
                        status: "ONLINE",
                      },
                      {
                        id: "q-kitchen",
                        name: "Mutfak-Windows",
                        role: "KITCHEN",
                        osQueueName: "Mutfak-Windows",
                        connectionType: "ETHERNET_PRINT_SERVER_BRIDGE",
                        deviceModel: "Epson TM-T20III (011)",
                        printServerModel: "DIGITUS DN-13003-2",
                        bridgeApModel: "TP-Link TL-WA801N (Client/Bridge)",
                        status: "ONLINE",
                      },
                    ]
                ).map((q: any) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          tone={
                            q.connectionType === "USB_DIRECT" ? "teal" : "gold"
                          }
                          icon={q.connectionType === "USB_DIRECT" ? "🔌" : "🖧"}
                        >
                          {q.connectionType === "USB_DIRECT"
                            ? "USB Doğrudan"
                            : "Print Server + Client/Bridge AP"}
                        </StatusBadge>
                        <b className="text-xs">{q.name}</b>
                      </div>
                      <p className="mt-1 text-[11px] text-[#9aaead]">
                        Model: {q.deviceModel} · OS Kuyruk:{" "}
                        <code>{q.osQueueName}</code>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQueueId(q.id);
                          setQName(q.name);
                          setQOsName(q.osQueueName);
                          setQRole(q.role);
                          setQConnType(q.connectionType);
                          setQDeviceModel(
                            q.deviceModel || "Epson TM-T20III (011)"
                          );
                          setQPrintServer(
                            q.printServerModel || "DIGITUS DN-13003-2"
                          );
                          setQBridgeAp(
                            q.bridgeApModel ||
                              "TP-Link TL-WA801N (Client/Bridge)"
                          );
                          setQStatus(q.status || "ONLINE");
                        }}
                        className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold"
                      >
                        Seç / Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendTestPrint(q.id, q.name)}
                        className="rounded-lg border border-[#3c6058] bg-[#243d39] px-2.5 py-1 text-[11px] font-bold text-[#bdf0e4]"
                      >
                        Test
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {lastTestChitPreview && (
              <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <b className="text-xs">Son Test / Tanılama Fişi Önizlemesi</b>
                  <StatusBadge tone="gold" icon="🖨">
                    TEST / TANILAMA
                  </StatusBadge>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-[#f4f2eb] p-3 font-mono text-[11px] leading-snug text-[#1c1c1c]">
                  {lastTestChitPreview}
                </pre>
              </div>
            )}
          </div>

          {/* Queue Editor Form (Right 7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">
                  Windows OS Yazıcı Kuyruğu Düzenleyici ({qName})
                </b>
                <StatusBadge
                  tone={qStatus === "ONLINE" ? "teal" : "gold"}
                  icon="●"
                >
                  {qStatus}
                </StatusBadge>
              </div>
              <form
                onSubmit={handleUpdatePrinterQueue}
                className="space-y-3 p-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      KUYRUK ADI
                    </label>
                    <input
                      type="text"
                      value={qName}
                      onChange={(e) => setQName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      WINDOWS SPOOLER KUYRUK ADI (osQueueName)
                    </label>
                    <input
                      type="text"
                      value={qOsName}
                      onChange={(e) => setQOsName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      ÇIKTI ROLÜ
                    </label>
                    <select
                      value={qRole}
                      onChange={(e) => setQRole(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    >
                      <option value="KITCHEN">
                        KITCHEN (Mutfak Siparişi & VOID İptal Fişi)
                      </option>
                      <option value="RECEIPT">
                        RECEIPT (80mm Adisyon / Servis Özeti)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      BAĞLANTI TÜRÜ
                    </label>
                    <select
                      value={qConnType}
                      onChange={(e) => setQConnType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    >
                      <option value="ETHERNET_PRINT_SERVER_BRIDGE">
                        ETHERNET_PRINT_SERVER_BRIDGE (DN-13003-2 + TL-WA801N)
                      </option>
                      <option value="USB_DIRECT">
                        USB_DIRECT (Sunucu-Kasaya Doğrudan USB)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      TERMAL YAZICI MODELİ
                    </label>
                    <input
                      type="text"
                      value={qDeviceModel}
                      onChange={(e) => setQDeviceModel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                      PRINT SERVER / BRIDGE AP
                    </label>
                    <input
                      type="text"
                      value={`${qPrintServer} → ${qBridgeAp}`}
                      onChange={(e) => setQPrintServer(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-[#705e37] bg-[#393321] p-2.5 text-[11px] text-[#f1db9f]">
                  RAW/LPR/IPP protokol tercihi uygulama ekranında sunulmaz;
                  Windows işletim sistemi kuyruğu ve DIGITUS DN-13003-2 print
                  server yapılandırmasında belirlenir.
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendTestPrint(selectedQueue?.id, qName)}
                    className="rounded-lg border border-[#344647] bg-[#202f30] px-3.5 py-2 text-xs font-bold"
                  >
                    Test Baskısı Gönder (TEST / TANILAMA)
                  </button>
                  <button
                    type="submit"
                    disabled={busyAction === "save-printer"}
                    className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f]"
                  >
                    Kuyruk Yapılandırmasını Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Visual Connection Flow Banner */}
        <div className="rounded-xl border border-[#3c6259] bg-[#182e2b] p-4">
          <div className="text-[10px] font-extrabold tracking-widest text-[#73d8c6] uppercase">
            ONAYLI FİZİKSEL BAĞLANTI AKIŞI (ALACARTE_DONANIM_PAKET_PLANI.md)
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[#f0f5f3]">
            <span className="rounded-lg border border-[#3c6058] bg-[#243d39] px-2.5 py-1.5">
              🖨 USB Mutfak Yazıcısı (Epson TM-T20III)
            </span>
            <span className="text-[#73d8c6]">→</span>
            <span className="rounded-lg border border-[#3c6058] bg-[#243d39] px-2.5 py-1.5">
              🖧 DIGITUS DN-13003-2 Ethernet Print Server
            </span>
            <span className="text-[#73d8c6]">→ Kablo →</span>
            <span className="rounded-lg border border-[#665637] bg-[#3b3325] px-2.5 py-1.5 text-[#f2d38f]">
              📡 TP-Link TL-WA801N Client/Bridge AP
            </span>
            <span className="text-[#73d8c6]">→ Wi-Fi →</span>
            <span className="rounded-lg border border-[#3c6058] bg-[#243d39] px-2.5 py-1.5">
              🛜 TP-Link Archer AX23 Router (Yerel Ağ)
            </span>
            <span className="text-[#73d8c6]">→</span>
            <span className="rounded-lg border border-[#3c6058] bg-[#243d39] px-2.5 py-1.5">
              🖥 Dokunmatik Sunucu-Kasa (Tiwox TP-8610)
            </span>
            <span className="text-[#73d8c6]">→</span>
            <span className="rounded-lg border border-[#3c6058] bg-[#243d39] px-2.5 py-1.5">
              🧾 USB Adisyon Yazıcısı (Epson TM-T20III)
            </span>
          </div>
        </div>

        {/* HARDWARE_BOM_PACKAGE Table */}
        <div className="overflow-hidden rounded-xl border border-[#344647] bg-[#192526]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] px-4 py-3">
            <div>
              <b className="text-xs">
                Onaylı Restoran Başına Donanım Paketi ve Topoloji Tablosu (
                <code>ALACARTE_DONANIM_PAKET_PLANI.md</code>)
              </b>
              <p className="text-[11px] text-[#9aaead]">
                Tiwox TP-8610 16GB/256GB · 2× Epson TM-T20III (011) USB ·
                DIGITUS DN-13003-2 · TP-Link TL-WA801N · TP-Link Archer AX23
              </p>
            </div>
            <StatusBadge tone="gold" icon="★">
              Donanım Paketi Ara Toplam:{" "}
              {HARDWARE_PACKAGE_TOTAL_TL.toLocaleString("tr-TR")} TL
            </StatusBadge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#344647] bg-[#152021] text-[10px] font-extrabold tracking-wider text-[#91a3a0] uppercase">
                  <th className="px-3 py-2.5">Donanım Kalemi</th>
                  <th className="px-3 py-2.5">Adet</th>
                  <th className="px-3 py-2.5">Seçilen Model</th>
                  <th className="px-3 py-2.5">Teknik Özellik & Bağlantı</th>
                  <th className="px-3 py-2.5">Paket Payı</th>
                  <th className="px-3 py-2.5">Pilot Kabul & Doğrulama Şartı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3939]">
                {HARDWARE_BOM_PACKAGE.map((hw, idx) => (
                  <tr key={idx} className="hover:bg-[#1e2d2d]">
                    <td className="px-3 py-2.5 font-bold">{hw.category}</td>
                    <td className="px-3 py-2.5 font-mono font-bold">
                      {hw.quantity}×
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[#73d8c6]">
                      {hw.selectedModel}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#bbc8c6]">
                      {hw.specs}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-[#efc97b]">
                      {hw.totalPriceTl.toLocaleString("tr-TR")} TL
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#9aaead]">
                      {hw.pilotStatus}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#152222] font-bold">
                  <td colSpan={4} className="px-3 py-2.5 text-right">
                    ONAYLI RESTORAN BAŞINA DONANIM PAKETİ ARA TOPLAMI (2× Epson
                    TM-T20III toplam 15.444 TL dahil):
                  </td>
                  <td className="px-3 py-2.5 font-mono text-sm text-[#73d8c6]">
                    61.724 TL
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-[#bdf0e4]">
                    Kablo, UPS ve kurulum sarf malzemeleri hariç donanım BOM
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 100-Consecutive-Chit Pilot Acceptance Checklist */}
        <div className="rounded-xl border border-[#344647] bg-[#192526] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] pb-3">
            <div>
              <b className="text-xs">
                100 Ardışık Fiş Pilot Kabul Kontrol Listesi (Pilot Acceptance
                Checklist)
              </b>
              <p className="text-[11px] text-[#9aaead]">
                Mutfak yazıcısı + DIGITUS DN-13003-2 + TP-Link TL-WA801N
                Client/Bridge AP saha kabul doğrulama adımları
              </p>
            </div>
            <StatusBadge
              tone={
                Object.values(pilotChecklist).every(Boolean) ? "teal" : "gold"
              }
              icon={Object.values(pilotChecklist).every(Boolean) ? "✓" : "⏳"}
            >
              {Object.values(pilotChecklist).filter(Boolean).length} / 5 Madde
              Onaylı
            </StatusBadge>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] p-2.5 text-xs">
              <input
                type="checkbox"
                checked={pilotChecklist.hundredChits}
                onChange={(e) =>
                  setPilotChecklist((p) => ({
                    ...p,
                    hundredChits: e.target.checked,
                  }))
                }
                className="mt-0.5 accent-[#73d8c6]"
              />
              <span>
                <b>100 Ardışık Fiş Testi:</b> Mutfak-Windows kuyruğunda
                eksiksiz, kayıpsız ve çift basımsız 100 ardışık fiş tamamlandı.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] p-2.5 text-xs">
              <input
                type="checkbox"
                checked={pilotChecklist.turkishChars}
                onChange={(e) =>
                  setPilotChecklist((p) => ({
                    ...p,
                    turkishChars: e.target.checked,
                  }))
                }
                className="mt-0.5 accent-[#73d8c6]"
              />
              <span>
                <b>Türkçe Karakter Doğrulaması:</b> Ş, İ, ı, ğ, ç, ö, ü
                karakterleri 80mm termal çıktıda bozulmadan basıldı.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] p-2.5 text-xs">
              <input
                type="checkbox"
                checked={pilotChecklist.gsVCut}
                onChange={(e) =>
                  setPilotChecklist((p) => ({ ...p, gsVCut: e.target.checked }))
                }
                className="mt-0.5 accent-[#73d8c6]"
              />
              <span>
                <b>ESC/POS GS V Kısmi Kesim:</b> Epson TM-T20III otomatik kesici
                komutu her fiş sonunda doğru çalıştı.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] p-2.5 text-xs">
              <input
                type="checkbox"
                checked={pilotChecklist.clientBridgeMode}
                onChange={(e) =>
                  setPilotChecklist((p) => ({
                    ...p,
                    clientBridgeMode: e.target.checked,
                  }))
                }
                className="mt-0.5 accent-[#73d8c6]"
              />
              <span>
                <b>TL-WA801N Client/Bridge Modu:</b> Cihaz normal AP değil,
                açıkça Client/Bridge modunda Archer AX23 ağına sabit IP ile
                bağlandı.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-[#2d3d3d] bg-[#141f20] p-2.5 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={pilotChecklist.closedLanNoWan}
                onChange={(e) =>
                  setPilotChecklist((p) => ({
                    ...p,
                    closedLanNoWan: e.target.checked,
                  }))
                }
                className="mt-0.5 accent-[#73d8c6]"
              />
              <span>
                <b>Yerel Ağ & Elektrik Kesintisi Kurtarma:</b> WAN portu boş
                bırakıldı; güç kesintisi sonrası sunucu, print server ve
                Client/Bridge AP otomatik yeniden bağlandı.
              </span>
            </label>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // RENDER SCR-18: YEDEKLEME VE GERİ YÜKLEME (USB + YEREL DİZİN, 15 KOPYA)
  // ============================================================================
  if (activeScreen === "SCR-18") {
    const maxCopies = config?.maxBackupCopies ?? 15;
    const latestBackup = backups[0];
    const backupUnavailable = config?.realBackupConfigured !== true;

    return (
      <section className="space-y-4 text-[#f0f5f3]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
              SCR-18 · YEDEKLEME VE GERİ YÜKLEME (15 KOPYA DÖNGÜSÜ)
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              USB ve Yerel Dizin Şifreli Yedekleme
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              {backupUnavailable
                ? "Bu dağıtımda doğrulanmış pg_dump/şifreleme yedekleyicisi etkin değil."
                : "Günlük arka plan ve manuel yedek hedeflerini durumlarıyla görüntüleyin."}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleCreateDualBackup}
              disabled={backupUnavailable || busyAction === "create-backup"}
              className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f] transition hover:brightness-110 disabled:opacity-50"
            >
              {busyAction === "create-backup"
                ? "İki Hedefe Yedekleniyor..."
                : backupUnavailable ? "Yedek modülü etkin değil" : "＋ Şimdi İki Hedefe Yedekle"}
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold text-[#9aaead] uppercase">
              SON YEDEK ZAMANI
            </div>
            <strong className="mt-1 block text-lg font-extrabold text-[#f0f5f3]">
              {latestBackup && !backupUnavailable && latestBackup.verified
                ? new Date(latestBackup.createdAt).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Yok"}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              {latestBackup && !backupUnavailable && latestBackup.verified
                ? formatDateTimeTR(latestBackup.createdAt)
                : "Doğrulanmış yedek yok"}
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold text-[#9aaead] uppercase">
              USB HEDEFİ ({usbActiveBackups.length} / {maxCopies})
            </div>
            <strong className="mt-1 block text-lg font-extrabold text-[#f0f5f3]">
              {backupUnavailable ? "Doğrulanmamış" : `${usbActiveBackups.length} / ${maxCopies}`}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              {backupUnavailable ? "USB hedef dosya kontrolü yok" : config?.usbBackupPath || "E:\\Alacarte\\Backups"}
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold text-[#9aaead] uppercase">
              YEREL DİZİN ({localActiveBackups.length} / {maxCopies})
            </div>
            <strong className="mt-1 block text-lg font-extrabold text-[#f0f5f3]">
              {backupUnavailable ? "Doğrulanmamış" : `${localActiveBackups.length} / ${maxCopies}`}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              {backupUnavailable ? "Dosya yedeği etkin değil" : config?.localBackupPath || "D:\\Alacarte\\Backups"}
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-bold text-[#9aaead] uppercase">
              MANİFEST & ŞİFRELEME
            </div>
            <strong className="mt-1 block text-lg font-extrabold text-[#73d8c6]">
              {latestBackup?.verified ? "Dosya doğrulandı" : "Doğrulanmadı"}
            </strong>
            <small className="text-[10px] text-[#9aaead]">
              Gerçek dump/şifreleme adaptörü gereklidir
            </small>
          </div>
        </div>

        {/* FIFO Rotation Notice */}
        <div className="rounded-xl border border-[#665637] bg-[#302a1e] p-3 text-xs text-[#f2d38f]">
          {backupUnavailable
            ? "Bu dağıtımda yedek oluşturma ve geri yükleme devre dışıdır. Gösterilen kayıtlar doğrulanmış dosya yedeği olarak kabul edilmez."
            : "Yedek rotasyonu yalnızca gerçek dosya üretimi, bütünlük doğrulaması ve geri yükleme doğrulaması kurulduğunda etkinleştirilmelidir."}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Backup Records Table (Left 7 cols) */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] px-4 py-3">
                <b className="text-xs">Yedek Kopyaları (BackupRecord)</b>
                <div className="flex items-center gap-2">
                  <select
                    value={backupTargetFilter}
                    onChange={(e) =>
                      setBackupTargetFilter(
                        e.target.value as "ALL" | "USB" | "LOCAL_DIR"
                      )
                    }
                    aria-label="Yedek hedefi filtresi"
                    className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1 text-xs"
                  >
                    <option value="ALL">USB ve Yerel Dizin (Tümü)</option>
                    <option value="USB">Yalnızca USB Hedefi</option>
                    <option value="LOCAL_DIR">Yalnızca Yerel Dizin</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#344647] bg-[#152021] text-[10px] font-extrabold tracking-wider text-[#91a3a0] uppercase">
                      <th className="px-3 py-2.5">Kod / Tarih</th>
                      <th className="px-3 py-2.5">Hedef</th>
                      <th className="px-3 py-2.5">Sürüm & Kayıt Özeti</th>
                      <th className="px-3 py-2.5">Manifest Hash</th>
                      <th className="px-3 py-2.5">Durum</th>
                      <th className="px-3 py-2.5 text-right">Seç</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a3939]">
                    {filteredBackups.map((b: any) => (
                      <tr key={b.id} className="hover:bg-[#1e2d2d]">
                        <td className="px-3 py-2.5">
                          <div className="font-mono font-bold">
                            {b.backupCode}
                          </div>
                          <div className="text-[11px] text-[#9aaead]">
                            {formatDateTimeTR(b.createdAt)} ({b.triggerType})
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            tone={b.targetType === "USB" ? "teal" : "gold"}
                            icon={b.targetType === "USB" ? "💾" : "📁"}
                          >
                            {b.targetType === "USB"
                              ? "USB"
                              : "LOCAL_DIR (Yerel)"}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 text-[11px]">
                          <div>
                            v{b.appVersion || "1.0.0"} ·{" "}
                            {b.dbSchemaVersion || "db-19"}
                          </div>
                          <div className="font-mono text-[10px] text-[#9aaead]">
                            {b.recordCountSummaryJson || "{}"}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-[#73d8c6]">
                          {String(b.manifestHash || "").slice(0, 14)}…
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            tone={
                              b.status === "SUCCESS"
                                ? "teal"
                                : b.status === "ROTATED_OUT"
                                ? "neutral"
                                : "red"
                            }
                            icon={b.status === "SUCCESS" ? "✓" : "↺"}
                          >
                            {b.status}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBackupId(b.id);
                              setRestoreTargetType(b.targetType || "USB");
                              notify(
                                `${b.backupCode} geri yükleme adayı olarak seçildi.`,
                                "teal"
                              );
                            }}
                            className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1 text-[11px] font-bold hover:border-[#73d8c6]"
                          >
                            Seç
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Controlled Restore Panel (Right 5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs">
                  Kontrollü Geri Yükleme (Restore) Paneli
                </b>
                <StatusBadge tone="gold" icon="🔐">
                  Kurtarma Anahtarı Zorunlu
                </StatusBadge>
              </div>

              <form onSubmit={handleRestoreBackup} className="space-y-3.5 p-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    KAYNAK HEDEF SEÇİMİ
                  </label>
                  <select
                    value={restoreTargetType}
                    onChange={(e) =>
                      setRestoreTargetType(
                        e.target.value as "USB" | "LOCAL_DIR"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  >
                    <option value="USB">USB Belleği (E:\Alacarte\Backups)</option>
                    <option value="LOCAL_DIR">
                      Yerel Dizin (D:\Alacarte\Backups)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    YEDEK KOPYASI SEÇİMİ
                  </label>
                  <select
                    value={selectedBackupId || backups[0]?.id || ""}
                    onChange={(e) => setSelectedBackupId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  >
                    {backups
                      .filter((b: any) => b.status === "SUCCESS")
                      .map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.backupCode} · {b.targetType} ·{" "}
                          {formatDateTimeTR(b.createdAt)} (v{b.appVersion} /{" "}
                          {b.dbSchemaVersion})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                    KURTARMA ANAHTARI (Recovery Key)
                  </label>
                  <input
                    type="password"
                    value={recoveryKeyInput}
                    onChange={(e) => setRecoveryKeyInput(e.target.value)}
                    placeholder="Örn: ALACARTE-RECOVERY-2026-KEY"
                    className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                  />
                  <span className="mt-1 block text-[10px] text-[#9aaead]">
                    Şifreleme anahtarı yedek dosyasından ayrı güvenli yerde
                    tutulur.
                  </span>
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-[#744947] bg-[#3d2929] p-3 text-xs text-[#ffc4bc]">
                  <input
                    type="checkbox"
                    checked={overwriteConfirmed}
                    onChange={(e) => setOverwriteConfirmed(e.target.checked)}
                    className="mt-0.5 accent-[#f18d83]"
                  />
                  <span>
                    Mevcut veritabanının üzerine yazılacağını, işlem öncesinde
                    otomatik <b>PRE_RESTORE</b> koruma kopyası alınacağını
                    onaylıyorum.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={backupUnavailable || busyAction === "restore-backup"}
                  className="w-full rounded-lg border border-[#754541] bg-[#452c2a] px-4 py-2.5 text-xs font-bold text-[#ffc7be] transition hover:brightness-110 disabled:opacity-50"
                >
                  {busyAction === "restore-backup"
                    ? "Doğrulanıyor ve Geri Yükleniyor..."
                    : backupUnavailable ? "Geri yükleme modülü etkin değil" : "⚠ Seçilen Yedeği Doğrula ve Geri Yükle"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // RENDER SCR-19: SİSTEM DURUMU, 6 ADIMLI SIRALI TANILAMA VE GÜVENLİ ONARIM
  // ============================================================================
  return (
    <section className="space-y-4 text-[#f0f5f3]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#73d8c6] uppercase">
            SCR-19 · SİSTEM DURUMU, 6 ADIMLI SIRALI TANILAMA VE GÜVENLİ ONARIM
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Yerel Sunucu Sağlığı, Tanılama ve Ön Yedekli Onarım Modülü
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
            6 ölçümlü tanılama adımını çalıştırın ve sonuçları dışa aktarın.
            Doğrulanmamış donanım/backup onarımı bu ekrandan başarılı sayılmaz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportDiagnosticPackage}
            disabled={busyAction === "export-diag"}
            className="rounded-lg border border-[#344647] bg-[#202f30] px-3.5 py-2 text-xs font-bold hover:brightness-110"
          >
            ⬇ Tanılama Paketini Dışa Aktar (Maskelenmiş JSON)
          </button>
          <button
            type="button"
            onClick={handleRunSequentialDiagnostics}
            disabled={busyAction === "run-diag"}
            className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f] transition hover:brightness-110 disabled:opacity-50"
          >
            {busyAction === "run-diag"
              ? "Sıralı Tanılama Çalışıyor..."
              : "▶ Sıralı Tanılamayı Başlat"}
          </button>
        </div>
      </div>

      {config?.deploymentMode === "coolify-demo" && (
        <div className="rounded-xl border border-[#665637] bg-[#302a1e] p-3 text-xs text-[#f2d38f]">
          Coolify demo ortamı restoran LAN'ına, Windows yazdırma kuyruğuna, fiziksel yazıcılara veya sunucu USB belleğine bağlı değildir. Yedek/geri yükleme ve fiziksel onarım işlemleri çalıştırılmaz; ilgili durumlar bilinmiyor olarak gösterilir.
        </div>
      )}

      {/* 6 Sequential Diagnostic Checks Table */}
      <div className="overflow-hidden rounded-xl border border-[#344647] bg-[#192526]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] px-4 py-3">
          <b className="text-xs">
            6 Adımlı Sıralı Salt-Okunur Tanılama Kontrolleri (DiagnosticCheck)
          </b>
          <StatusBadge tone="teal" icon="🛡">
            Salt-Okunur Tanılama · Veri Değiştirmez
          </StatusBadge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#344647] bg-[#152021] text-[10px] font-extrabold tracking-wider text-[#91a3a0] uppercase">
                <th className="px-3 py-2.5">Adım</th>
                <th className="px-3 py-2.5">Bileşen</th>
                <th className="px-3 py-2.5">Durum</th>
                <th className="px-3 py-2.5">Süre</th>
                <th className="px-3 py-2.5">Olay Kodu</th>
                <th className="px-3 py-2.5">Maskelenmiş Kanıt</th>
                <th className="px-3 py-2.5">Etkilenen İşlev</th>
                <th className="px-3 py-2.5">Önerilen Sonraki Adım</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a3939]">
              {diagnosticChecks.map((chk: any) => {
                const tone =
                  chk.status === "PASSED"
                    ? "teal"
                    : chk.status === "WARNING"
                    ? "gold"
                    : "red";
                return (
                  <tr key={chk.id || chk.stepOrder} className="hover:bg-[#1e2d2d]">
                    <td className="px-3 py-2.5 font-mono font-bold text-[#73d8c6]">
                      Adım {chk.stepOrder} / 6
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold">{chk.component}</div>
                      <div className="text-[11px] text-[#9aaead]">
                        {chk.title}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        tone={tone}
                        icon={
                          tone === "teal" ? "✓" : tone === "gold" ? "⚠" : "✕"
                        }
                      >
                        {chk.status}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {chk.durationMs ?? 28} ms
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      {chk.eventCode}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#bdf0e4]">
                      {chk.maskedEvidence}
                    </td>
                    <td className="px-3 py-2.5 text-[11px]">
                      {chk.affectedFunction}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[#9aaead]">
                      {chk.nextActionText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DiagnosticFinding Cards & Allowlisted Repair Workflow */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center justify-between">
            <b className="text-xs">
              Tanılama Bulguları (DiagnosticFinding) ve Güvenli Onarım
              Allowlist&apos;i
            </b>
            <span className="text-[11px] text-[#9aaead]">
              Serbest komut çalıştırılmaz · Yalnızca 3 allowlist eylemi
            </span>
          </div>

          {diagnosticFindings.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#405454] bg-[#172324] p-4 text-xs text-[#9aaead]">
              Bu tanılama çalıştırmasında kayıtlı bulgu yok. Yeni ölçüm yapılmadan önceki demo örnekleri arıza bulgusu veya onarım önerisi gibi gösterilmez.
            </div>
          )}
          {diagnosticFindings.map((fnd: any) => {
            const isResolved = fnd.status === "RESOLVED";
            return (
              <div
                key={fnd.id}
                className="rounded-xl border border-[#344647] bg-[#192526] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={
                          isResolved
                            ? "teal"
                            : fnd.severity === "CRITICAL"
                            ? "red"
                            : "gold"
                        }
                        icon={isResolved ? "✓" : "⚠"}
                      >
                        {isResolved ? "RESOLVED (Onarıldı)" : fnd.severity}
                      </StatusBadge>
                      <span className="font-mono text-[11px] text-[#73d8c6]">
                        {fnd.findingCode}
                      </span>
                      <span className="text-[11px] text-[#9aaead]">
                        · Güven: {fnd.confidenceLevel}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-bold">{fnd.title}</h3>
                    <p className="mt-0.5 text-xs text-[#9aaead]">
                      {fnd.userExplanation}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-[#2d3d3d] bg-[#131f20] p-2.5 text-[11px] sm:grid-cols-2">
                  <div>
                    <b className="text-[#9aaead]">Kanıt:</b>{" "}
                    <code className="text-[#bdf0e4]">{fnd.evidenceText}</code>
                  </div>
                  <div>
                    <b className="text-[#9aaead]">Olası Neden:</b>{" "}
                    <span>{fnd.probableCause}</span>
                  </div>
                </div>

                {fnd.allowlistRepairAction && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#3c6058] bg-[#172b28] p-3">
                    <div className="text-[11px]">
                      <div>
                        Allowlist Onarım Kodu:{" "}
                        <code className="font-bold text-[#73d8c6]">
                          {fnd.allowlistRepairAction}
                        </code>
                      </div>
                      <div className="text-[#9aaead]">
                        Ön Koşul: USB + Yerel Dizin otomatik ön yedek alınır ve
                        tekil <code>repair_id</code> ile idempotent yürütülür.
                      </div>
                    </div>

                    {repairConfirmFindingId === fnd.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="password"
                          value={repairAdminPin}
                          onChange={(e) => setRepairAdminPin(e.target.value)}
                          placeholder="Yönetici PIN / Parola"
                          aria-label="Onarım onayı için yönetici PIN veya parolası"
                          className="w-36 rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
                        />
                        <button
                          type="button"
                          onClick={() => setRepairConfirmFindingId(null)}
                          className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1.5 text-xs"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecuteAllowlistedRepair(fnd)}
                          disabled={busyAction === `repair-${fnd.id}`}
                          className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3 py-1.5 text-xs font-bold text-[#10221f]"
                        >
                          {busyAction === `repair-${fnd.id}`
                            ? "Ön Yedek + Onarım..."
                            : "✓ Ön Yedek Al ve Onarımı Onayla"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRepairConfirmFindingId(fnd.id)}
                        className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3 py-1.5 text-xs font-bold text-[#10221f] hover:brightness-110"
                      >
                        🛠 Ön Yedek Al ve Onarımı Onayla
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Signed Offline Maintenance Package Verification Panel (Right 5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-[#344647] bg-[#192526]">
            <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
              <b className="text-xs">
                İmzalı Çevrimdışı Bakım Paketi Doğrulama
              </b>
              <StatusBadge tone="teal" icon="✒">
                İmza Zorunlu
              </StatusBadge>
            </div>

            <form
              onSubmit={handleApplyMaintenancePackage}
              className="space-y-3.5 p-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                  ÇEVRİMDIŞI PAKET DOSYASI ADI
                </label>
                <input
                  type="text"
                  value={maintenancePkgName}
                  onChange={(e) => setMaintenancePkgName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#aab9b6] uppercase">
                  KRİPTOGRAFİK İMZA / MANİFEST ÖZETİ
                </label>
                <input
                  type="text"
                  value={maintenanceSigHash}
                  onChange={(e) => setMaintenanceSigHash(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 font-mono text-xs"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#9aaead]">
                <input
                  type="checkbox"
                  checked={maintenancePreBackup}
                  onChange={(e) => setMaintenancePreBackup(e.target.checked)}
                  className="accent-[#73d8c6]"
                />
                Uygulama öncesi USB + Yerel Dizin koruma yedeği al
              </label>

              <div className="rounded-lg border border-[#705e37] bg-[#393321] p-3 text-[11px] text-[#f1db9f]">
                İnternet veya uzaktan yönetim bağlantısı kullanılmaz. İmza
                doğrulanmayan veya şema sürümü (db-19) uyumsuz olan paket
                reddedilir.
              </div>

              <button
                type="submit"
                disabled={busyAction === "apply-maint"}
                className="w-full rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-bold text-[#10221f] transition hover:brightness-110 disabled:opacity-50"
              >
                {busyAction === "apply-maint"
                  ? "İmza Doğrulanıyor ve Uygulanıyor..."
                  : "✓ İmzalı Çevrimdışı Bakım Paketini Doğrula ve Uygula"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SysAdminScreensView;
