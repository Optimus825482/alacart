"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  toggleLearningModeAction,
  transferTableAction,
  completeServiceSessionAction,
  createCancellationRequestAction,
  decideCancellationRequestAction,
  controlledRetryPrintJobAction,
  reprintJobAction,
  printPricelessCheckAction,
  runOperationalReportAction,
} from "@/actions/manager";
import { formatPricelessCheckSummary } from "@/lib/receipt-templates";

export interface ManagerScreensProps {
  activeScreen: "SCR-07" | "SCR-08" | "SCR-09" | "SCR-10" | "SCR-11" | "SCR-12";
  currentUser: any;
  config: any;
  areas: any[];
  tables: any[];
  categories: any[];
  menuItems: any[];
  sessions: any[];
  cancelRequests: any[];
  printJobs: any[];
  printerQueues: any[];
  users: any[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
  onNavigate: (screen: any) => void;
  onRefresh: () => void;
  notify: (msg: string, tone?: "teal" | "gold" | "red") => void;
}

const CANCEL_REASON_CATEGORIES = [
  "Misafir tercihini değiştirdi",
  "Yanlış ürün girildi",
  "Hazırlık başlamadı",
  "Alerjen/diyet uyarısı",
  "Diğer",
] as const;

export interface OperationalReportCardDef {
  code:
    | "OPERASYON_OZETI"
    | "MASA_HAREKETLERI"
    | "URUN_ADETLERI"
    | "ACIK_SIPARISLER"
    | "TAMAMLANAN_OTURUMLAR"
    | "BEKLETILEN_ZAMANLI"
    | "GARSON_GUNLUGU"
    | "SIPARIS_DENETIM"
    | "IPTAL_ONAYLAR"
    | "YAZDIRMA_GUNLUGU";
  title: string;
  subtitle: string;
  microsRef: string;
}

const REPORT_CATALOG: OperationalReportCardDef[] = [
  {
    code: "OPERASYON_OZETI",
    title: "Operasyon Özeti",
    subtitle: "Masa, servis turu, kuver, iptal ve yazdırma özeti",
    microsRef: "MICROS TSR · Daily Ops Summary",
  },
  {
    code: "MASA_HAREKETLERI",
    title: "Masa Hareketleri",
    subtitle: "Alan, servis açılış/kapanış süresi ve kuver dağılımı",
    microsRef: "MICROS TSR · Table Turn & Seating",
  },
  {
    code: "URUN_ADETLERI",
    title: "Ürün Adetleri",
    subtitle: "Kategori, mutfak istasyonu ve gönderilen kalem adetleri",
    microsRef: "MICROS TSR · Menu Item Count Mix",
  },
  {
    code: "ACIK_SIPARISLER",
    title: "Açık Siparişler",
    subtitle: "Aktif masa oturumları, gönderilen ve bekleyen turlar",
    microsRef: "MICROS TSR · Open Checks / Active Service",
  },
  {
    code: "TAMAMLANAN_OTURUMLAR",
    title: "Tamamlanan Oturumlar",
    subtitle: "Kapatılmış servis oturumları, süre ve tur sayıları",
    microsRef: "MICROS TSR · Closed Service Sessions",
  },
  {
    code: "BEKLETILEN_ZAMANLI",
    title: "Bekletilen / Zamanlı",
    subtitle: "Tutulan (HOLD), ileri saate planlanan ve geciken işler",
    microsRef: "MICROS TSR · Hold & Fire Schedule Log",
  },
  {
    code: "GARSON_GUNLUGU",
    title: "Garson İşlem Günlüğü",
    subtitle: "Kişisel kullanıcı bazlı masa açılış, tur ve kalem hareketleri",
    microsRef: "MICROS TSR · Employee Activity Log",
  },
  {
    code: "SIPARIS_DENETIM",
    title: "Sipariş Denetim",
    subtitle: "Masa taşıma, koltuk paylaşımı ve tur izlenebilirliği",
    microsRef: "MICROS TSR · Service Audit Trail",
  },
  {
    code: "IPTAL_ONAYLAR",
    title: "İptal ve Onaylar",
    subtitle: "Gönderilmiş kalem iptal gerekçeleri, kararlar ve VOID işleri",
    microsRef: "MICROS TSR · Void & Approval Detail",
  },
  {
    code: "YAZDIRMA_GUNLUGU",
    title: "Yazdırma Günlüğü",
    subtitle: "Mutfak-Windows ve Adisyon-USB işleri, belirsiz ve tekrar baskılar",
    microsRef: "MICROS TSR · Kitchen & Slip Print Log",
  },
];

function formatDateTimeTR(val?: string | Date | null, withSeconds = false): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

function formatTimeOnlyTR(val?: string | Date | null, withSeconds = true): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

function parseJsonArray<T = any>(raw?: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getTableStatusBadge(status: string) {
  switch (status) {
    case "IN_SERVICE":
      return {
        label: "● Serviste",
        cls: "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]",
      };
    case "DRAFT_PENDING":
      return {
        label: "◐ Taslak Bekliyor",
        cls: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
      };
    case "SCHEDULED_PENDING":
      return {
        label: "◷ Zamanlı / Bekletildi",
        cls: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
      };
    case "PRINT_PENDING":
      return {
        label: "⎙ Çıktı Kuyrukta",
        cls: "border-[#3c5968] bg-[#233742] text-[#b8e2f8]",
      };
    case "PRINT_WARNING":
      return {
        label: "▲ Baskı Uyarısı",
        cls: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
      };
    case "CANCEL_PENDING":
      return {
        label: "■ İptal Kararı Bekliyor",
        cls: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
      };
    case "EMPTY":
    default:
      return {
        label: "○ Boş",
        cls: "border-[#465353] bg-[#2d3939] text-[#bbc8c6]",
      };
  }
}

function getItemStatusBadge(status: string) {
  switch (status) {
    case "SENT":
      return {
        label: "✓ Mutfağa Gönderildi",
        cls: "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]",
      };
    case "DRAFT":
      return {
        label: "✎ Taslak (Gönderilmedi)",
        cls: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
      };
    case "HELD":
      return {
        label: "⏸ Bekletildi (HOLD)",
        cls: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
      };
    case "SCHEDULED":
      return {
        label: "◷ Zamanlandı",
        cls: "border-[#3c5968] bg-[#233742] text-[#b8e2f8]",
      };
    case "OVERDUE":
      return {
        label: "▲ Zamanı Geldi / Gecikti",
        cls: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
      };
    case "CANCEL_REQUESTED":
      return {
        label: "⏳ İptal Onayı Bekliyor",
        cls: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
      };
    case "CANCELLED":
      return {
        label: "✕ İptal Edildi (VOID)",
        cls: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
      };
    default:
      return {
        label: status,
        cls: "border-[#465353] bg-[#2d3939] text-[#bbc8c6]",
      };
  }
}

function getPrintJobStatusBadge(status: string) {
  switch (status) {
    case "SUBMITTED_TO_OS_QUEUE":
      return {
        label: "✓ Windows Kuyruğuna İletildi",
        cls: "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]",
      };
    case "REPRINTED":
      return {
        label: "↻ Tekrar Baskı Üretildi",
        cls: "border-[#3c5968] bg-[#233742] text-[#b8e2f8]",
      };
    case "PENDING":
    case "SENDING":
      return {
        label: "◷ Kuyruğa Gönderiliyor",
        cls: "border-[#665637] bg-[#3b3325] text-[#f2d38f]",
      };
    case "UNCERTAIN":
      return {
        label: "▲ Sonucu Belirsiz (İnceleme Gerekli)",
        cls: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
      };
    case "ERROR":
      return {
        label: "✕ Yazdırma Hatası",
        cls: "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]",
      };
    default:
      return {
        label: status,
        cls: "border-[#465353] bg-[#2d3939] text-[#bbc8c6]",
      };
  }
}

function getPrintJobTypeLabel(jobType: string) {
  switch (jobType) {
    case "KITCHEN_ORDER":
      return "Mutfak Siparişi (YENİ TUR)";
    case "KITCHEN_VOID":
      return "Mutfak İptal / VOID Bildirimi";
    case "PRICELESS_CHECK":
      return "Adisyon / Servis Özeti";
    case "TEST_PRINT":
      return "Test / Tanılama Fişi";
    case "REPORT_PRINT":
      return "Operasyonel Rapor Çıktısı";
    default:
      return jobType;
  }
}

export function ManagerScreensView(props: ManagerScreensProps) {
  const {
    activeScreen,
    currentUser,
    config,
    areas = [],
    tables = [],
    categories = [],
    menuItems = [],
    sessions = [],
    cancelRequests = [],
    printJobs = [],
    printerQueues = [],
    users = [],
    selectedTableId,
    onSelectTable,
    onNavigate,
    onRefresh,
    notify,
  } = props;

  const [busyAction, setBusyAction] = useState<string | null>(null);

  // SCR-07 state
  const [selectedHealthLight, setSelectedHealthLight] = useState<number | null>(null);

  // SCR-08 state
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [activeRoundFilter, setActiveRoundFilter] = useState<string>("ALL");
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferTargetTableId, setTransferTargetTableId] = useState<string>("");
  const [transferReason, setTransferReason] = useState<string>("Misafir masa değişikliği talep etti");
  const [completionBlockersModal, setCompletionBlockersModal] = useState<boolean>(false);

  // SCR-09 state
  const [cancelFormSessionId, setCancelFormSessionId] = useState<string>("");
  const [cancelFormItemId, setCancelFormItemId] = useState<string>("");
  const [cancelFormQty, setCancelFormQty] = useState<number>(1);
  const [cancelFormReason, setCancelFormReason] = useState<string>(CANCEL_REASON_CATEGORIES[0]);
  const [cancelFormExplanation, setCancelFormExplanation] = useState<string>("");
  const [decisionNotesById, setDecisionNotesById] = useState<Record<string, string>>({});
  const [cancelFilterStatus, setCancelFilterStatus] = useState<string>("ALL");

  // SCR-10 state
  const [printFilterType, setPrintFilterType] = useState<string>("ALL");
  const [printFilterStatus, setPrintFilterStatus] = useState<string>("ALL");
  const [printSearchQuery, setPrintSearchQuery] = useState<string>("");
  const [inspectedPrintJob, setInspectedPrintJob] = useState<any | null>(null);

  // SCR-11 state
  const [checkSessionId, setCheckSessionId] = useState<string>("");
  const [checkRoundScope, setCheckRoundScope] = useState<string>("ALL");

  // SCR-12 state
  const [selectedReportCode, setSelectedReportCode] =
    useState<OperationalReportCardDef["code"]>("OPERASYON_OZETI");
  const [reportDatePreset, setReportDatePreset] = useState<
    "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "ALL_HISTORY" | "CUSTOM"
  >("ALL_HISTORY");
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");
  const [reportWaiterId, setReportWaiterId] = useState<string>("ALL");
  const [reportAreaOrTableId, setReportAreaOrTableId] = useState<string>("ALL");
  const [reportCategoryId, setReportCategoryId] = useState<string>("ALL");
  const [reportServerResult, setReportServerResult] = useState<any | null>(null);

  // Synchronize default session selection when selectedTableId or sessions change
  const openSessions = useMemo(
    () => sessions.filter((s) => s.status === "OPEN"),
    [sessions]
  );

  useEffect(() => {
    if (selectedTableId) {
      const openForTable = sessions.find(
        (s) => s.tableId === selectedTableId && s.status === "OPEN"
      );
      const anyForTable = sessions.find((s) => s.tableId === selectedTableId);
      if (openForTable) {
        setSelectedSessionId(openForTable.id);
        setCheckSessionId(openForTable.id);
        setCancelFormSessionId(openForTable.id);
        return;
      }
      if (anyForTable && !selectedSessionId) {
        setSelectedSessionId(anyForTable.id);
        setCheckSessionId(anyForTable.id);
      }
    }
    if (!selectedSessionId && sessions.length > 0) {
      const firstOpen = openSessions[0] ?? sessions[0];
      setSelectedSessionId(firstOpen.id);
    }
    if (!checkSessionId && sessions.length > 0) {
      const firstOpen = openSessions[0] ?? sessions[0];
      setCheckSessionId(firstOpen.id);
    }
    if (!cancelFormSessionId && openSessions.length > 0) {
      setCancelFormSessionId(openSessions[0].id);
    }
  }, [selectedTableId, sessions, openSessions, selectedSessionId, checkSessionId, cancelFormSessionId]);

  // Derived metrics for SCR-07
  const sentItemsCountInOpenSessions = useMemo(() => {
    let total = 0;
    for (const s of openSessions) {
      const items = s.items ?? [];
      for (const it of items) {
        if (it.status === "SENT") {
          total += Number(it.quantity ?? 1);
        }
      }
    }
    return total;
  }, [openSessions]);

  const uncertainOrErrorJobs = useMemo(
    () =>
      printJobs.filter(
        (j) => j.status === "UNCERTAIN" || j.status === "ERROR"
      ),
    [printJobs]
  );

  const pendingCancelRequests = useMemo(
    () => cancelRequests.filter((c) => c.status === "PENDING"),
    [cancelRequests]
  );

  // Active session for SCR-08
  const currentDetailSession = useMemo(() => {
    return (
      sessions.find((s) => s.id === selectedSessionId) ??
      openSessions[0] ??
      sessions[0] ??
      null
    );
  }, [sessions, selectedSessionId, openSessions]);

  // Blockers for session completion
  const sessionBlockers = useMemo(() => {
    if (!currentDetailSession) return [];
    const blockers: Array<{
      id: string;
      type: "DRAFT" | "SCHEDULED_OR_HELD" | "PENDING_CANCEL" | "UNCERTAIN_PRINT";
      title: string;
      detail: string;
      targetScreen: "SCR-04" | "SCR-06" | "SCR-09" | "SCR-10";
      targetLabel: string;
    }> = [];

    const items = currentDetailSession.items ?? [];
    for (const item of items) {
      if (item.status === "DRAFT") {
        blockers.push({
          id: `draft-${item.id}`,
          type: "DRAFT",
          title: `Gönderilmemiş Taslak Kalem: ${item.quantity}x ${item.productNameSnapshot}`,
          detail: `Koltuk ${item.seatNumber ?? "-"} · Taslak kalem mutfağa gönderilmeli veya silinmelidir.`,
          targetScreen: "SCR-04",
          targetLabel: "Sipariş Ekranında Çöz",
        });
      } else if (
        item.status === "HELD" ||
        item.status === "SCHEDULED" ||
        item.status === "OVERDUE"
      ) {
        blockers.push({
          id: `sched-${item.id}`,
          type: "SCHEDULED_OR_HELD",
          title: `Bekletilen / Zamanlı Kalem: ${item.quantity}x ${item.productNameSnapshot}`,
          detail: `Durum: ${item.status} · Şimdi gönderilmeli veya zamanlama iptal edilmelidir.`,
          targetScreen: "SCR-06",
          targetLabel: "Zamanlama Ekranında Çöz",
        });
      }
    }

    const sessCancels = cancelRequests.filter(
      (cr) =>
        cr.sessionId === currentDetailSession.id && cr.status === "PENDING"
    );
    for (const cr of sessCancels) {
      blockers.push({
        id: `cancel-${cr.id}`,
        type: "PENDING_CANCEL",
        title: `Bekleyen İptal Kararı: ${cr.referenceCode}`,
        detail: `${cr.reasonCategory} — Yönetici onay veya red kararı verilmelidir.`,
        targetScreen: "SCR-09",
        targetLabel: "İptal Taleplerinde Karar Ver",
      });
    }

    const sessUncertainPrints = printJobs.filter(
      (pj) =>
        pj.sessionId === currentDetailSession.id &&
        (pj.status === "UNCERTAIN" || pj.status === "ERROR")
    );
    for (const pj of sessUncertainPrints) {
      blockers.push({
        id: `print-${pj.id}`,
        type: "UNCERTAIN_PRINT",
        title: `Sonucu Belirsiz / Hatalı Baskı İşi: ${pj.jobCode}`,
        detail: `${pj.stationName ?? "Yazıcı Kuyruğu"} · Kontrollü tekrar deneme veya inceleme gereklidir.`,
        targetScreen: "SCR-10",
        targetLabel: "Yazdırma Kuyruğunda Çöz",
      });
    }

    return blockers;
  }, [currentDetailSession, cancelRequests, printJobs]);

  // Sent items available for cancellation in SCR-09
  const sentItemsForCancelSession = useMemo(() => {
    const sess = openSessions.find((s) => s.id === cancelFormSessionId) ?? openSessions[0];
    if (!sess) return [];
    return (sess.items ?? []).filter((it: any) => it.status === "SENT");
  }, [openSessions, cancelFormSessionId]);

  useEffect(() => {
    if (sentItemsForCancelSession.length > 0) {
      const exists = sentItemsForCancelSession.some(
        (it: any) => it.id === cancelFormItemId
      );
      if (!exists) {
        setCancelFormItemId(sentItemsForCancelSession[0].id);
        setCancelFormQty(1);
      }
    } else {
      setCancelFormItemId("");
    }
  }, [sentItemsForCancelSession, cancelFormItemId]);

  // Handlers
  async function handleToggleLearningMode() {
    setBusyAction("learning-mode");
    try {
      const nextState = !(config?.learningModeEnabled ?? false);
      const res: any = await toggleLearningModeAction({
        actorId: currentUser?.id,
        enabled: nextState,
      });
      if (res && res.ok === false) {
        notify(
          res.error ||
            "Yetki reddedildi: Garson Öğrenme Modu yalnız Restoran Yöneticisi tarafından değiştirilebilir.",
          "red"
        );
      } else {
        notify(
          `Garson Öğrenme Modu ${nextState ? "AÇIK" : "KAPALI"} konuma getirildi.`,
          "teal"
        );
      }
      onRefresh();
    } catch (err: any) {
      notify(
        err?.message ||
          "Yetki reddedildi: Garson Öğrenme Modu yalnız Restoran Yöneticisi tarafından değiştirilebilir.",
        "red"
      );
      onRefresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTransferTable(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDetailSession) return;
    if (!transferTargetTableId) {
      notify("Lütfen taşınacak boş bir hedef masa seçin.", "gold");
      return;
    }
    setBusyAction("transfer-table");
    try {
      const res: any = await transferTableAction({
        actorId: currentUser?.id,
        sessionId: currentDetailSession.id,
        targetTableId: transferTargetTableId,
        reason: transferReason,
      });
      if (res && res.ok === false) {
        notify(res.error || "Masa taşıma işlemi tamamlanamadı.", "red");
      } else {
        notify(
          `Sipariş ${currentDetailSession.referenceCode} seçili masaya taşındı.`,
          "teal"
        );
        setShowTransferModal(false);
        onSelectTable(transferTargetTableId);
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "Masa taşıma sırasında hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCompleteServiceSession() {
    if (!currentDetailSession) return;
    setBusyAction("complete-session");
    try {
      const res: any = await completeServiceSessionAction({
        actorId: currentUser?.id,
        sessionId: currentDetailSession.id,
      });
      if (!res?.ok) {
        setCompletionBlockersModal(true);
        notify(
          `Servisi tamamlamak için önce ${
            res?.blockers?.length ?? sessionBlockers.length
          } açık engeli çözmelisiniz.`,
          "red"
        );
        onRefresh();
      } else {
        notify(
          `${currentDetailSession.referenceCode} servisi tamamlandı ve masa boşaltıldı.`,
          "teal"
        );
        setCompletionBlockersModal(false);
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "Servis tamamlama engellendi.", "red");
      onRefresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateCancelRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelFormSessionId || !cancelFormItemId) {
      notify("Lütfen açık bir servis ve mutfağa gönderilmiş bir kalem seçin.", "gold");
      return;
    }
    if (!cancelFormExplanation.trim()) {
      notify("İptal talebi için açıklama girilmesi zorunludur.", "gold");
      return;
    }
    setBusyAction("create-cancel");
    try {
      const res: any = await createCancellationRequestAction({
        actorId: currentUser?.id,
        orderItemId: cancelFormItemId,
        requestedQuantity: cancelFormQty,
        reasonCategory: cancelFormReason,
        explanation: cancelFormExplanation.trim(),
      });
      if (res && res.ok === false) {
        notify(res.error || "İptal talebi oluşturulamadı.", "red");
      } else {
        notify(
          "İptal talebi oluşturuldu ve yönetici onay kuyruğuna eklendi.",
          "teal"
        );
        setCancelFormExplanation("");
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "İptal talebi oluşturulurken hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDecideCancelRequest(
    requestId: string,
    decision: "APPROVED" | "REJECTED"
  ) {
    const decisionNote =
      decisionNotesById[requestId]?.trim() ||
      (decision === "APPROVED"
        ? "Yönetici tarafından onaylandı; mutfağa VOID bildirimi iletildi."
        : "Yönetici tarafından reddedildi; hazırlık tamamlanmış.");
    setBusyAction(`decide-${requestId}`);
    try {
      const mappedDecision: "APPROVE" | "REJECT" =
        decision === "APPROVED" ? "APPROVE" : "REJECT";
      const res: any = await decideCancellationRequestAction({
        actorId: currentUser?.id,
        requestId,
        decision: mappedDecision,
        decisionNote,
      });
      if (res && res.ok === false) {
        notify(res.error || "İptal kararı kaydedilemedi.", "red");
      } else {
        notify(
          decision === "APPROVED"
            ? "İptal onaylandı. Kalem kaydı korundu ve ayrı Mutfak VOID fişi oluşturuldu."
            : "İptal talebi reddedildi ve denetim izine kaydedildi.",
          decision === "APPROVED" ? "teal" : "gold"
        );
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "İptal kararı işlenemedi.", "red");
      onRefresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleControlledRetryPrint(job: any) {
    setBusyAction(`retry-${job.id}`);
    try {
      const res: any = await controlledRetryPrintJobAction({
        actorId: currentUser?.id,
        printJobId: job.id,
      });
      if (res && res.ok === false) {
        notify(res.error || "Kontrollü tekrar deneme yapılamadı.", "red");
      } else {
        notify(
          `${job.jobCode} işi aynı iş referansıyla kontrollü olarak tekrar kuyruğa iletildi.`,
          "teal"
        );
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "Kontrollü tekrar deneme hatası.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReprintJob(job: any) {
    setBusyAction(`reprint-${job.id}`);
    try {
      const res: any = await reprintJobAction({
        actorId: currentUser?.id,
        printJobId: job.id,
        reason: "Yönetici tarafından SCR-10 üzerinden tekrar baskı alındı",
      });
      if (res && res.ok === false) {
        notify(res.error || "Tekrar baskı oluşturulamadı.", "red");
      } else {
        notify(
          `İlk iş (${job.jobCode}) referansıyla *** TEKRAR BASKI *** fişi oluşturuldu (Yeni sipariş üretilmedi).`,
          "teal"
        );
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "Tekrar baskı hatası.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePrintPricelessCheck() {
    if (!checkSessionId) {
      notify("Lütfen adisyon için bir servis oturumu seçin.", "gold");
      return;
    }
    setBusyAction("print-priceless-check");
    try {
      const res: any = await printPricelessCheckAction({
        actorId: currentUser?.id,
        sessionId: checkSessionId,
        roundScope: checkRoundScope,
      });
      if (res && res.ok === false) {
        notify(res.error || "Adisyon yazdırılamadı.", "red");
      } else {
        notify("Adisyon yazdırma işi kuyruğa eklendi.", "teal");
        onRefresh();
      }
    } catch (err: any) {
      notify(err?.message || "Adisyon yazdırma hatası.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  // 4-Light Live Connection Health Indicator Data (§5.12 & §5.18)
  const healthLights = useMemo(() => {
    const kitchenQueue = printerQueues.find(
      (q) => q.name === "Mutfak-Windows" || q.role === "KITCHEN"
    );
    const receiptQueue = printerQueues.find(
      (q) => q.name === "Adisyon-USB" || q.role === "RECEIPT"
    );
    const activeWaiters = users.filter(
      (u) => u.role === "WAITER" && u.active
    );
    const recentWaiters = activeWaiters.filter((u) =>
      u.lastHeartbeatAt && Date.now() - new Date(u.lastHeartbeatAt).getTime() <= 90_000
    );

    return [
      {
        id: 1,
        name: "1. Sunucu / Uygulama + PostgreSQL",
        state: "NORMAL" as const,
        badgeText: "● Son sayfa yüklemesinde yanıt verdi",
        summary: "Bu ekranın verileri sunucudan yüklendi; bağımsız periyodik sağlık ölçümü yok.",
        detail: `Uygulama v${config?.appVersion ?? "1.0.0"} (${
          config?.dbSchemaVersion ?? "db-19"
        }) çalışıyor. Son sayfa yüklemesinde veritabanı sorguları yanıt verdi.`,
      },
      {
        id: 2,
        name: "2. Windows Print Spooler · Mutfak & Adisyon Kuyrukları",
        state: "INFO" as const,
        badgeText: `◐ Fiziksel bağlantı doğrulanmadı · ${uncertainOrErrorJobs.length} belirsiz/hatalı iş`,
        summary: `Mutfak-Windows: ${
          kitchenQueue?.status ?? "kuyruk yok"
        } · Adisyon-USB: ${receiptQueue?.status ?? "kuyruk yok"}; fiziksel spooler probe etkin değil.`,
        detail: "Veritabanındaki kuyruk etiketi yazıcının erişilebilir olduğunu kanıtlamaz. OS spooler/Print Bridge adaptörü kurulana dek işler fiziksel çıktı olarak gösterilmez.",
      },
      {
        id: 3,
        name: "3. Yerel LAN / Router / Access Point",
        state: "INFO" as const,
        badgeText: "◐ Bilinmiyor · Coolify demo restoran ağına bağlı değil",
        summary: "Router/AP bağlantısı demo ortamından ölçülemiyor.",
        detail: "Ağ cihazlarının marka/modeli veya erişilebilirliği veritabanı tanımından çıkarılmaz; saha ağına bağlı kurulumda doğrulanmalıdır.",
      },
      {
        id: 4,
        name: "4. Garson Cihazları Heartbeat",
        state: activeWaiters.length === 0 ? "INFO" as const : recentWaiters.length === activeWaiters.length ? "NORMAL" as const : "WARNING" as const,
        badgeText: `${recentWaiters.length}/${activeWaiters.length} garson heartbeat'i son 90 sn içinde`,
        summary: `Son heartbeat'i güncel: ${recentWaiters.length}; eski/eksik: ${activeWaiters.length - recentWaiters.length}.`,
        detail: "Heartbeat yalnızca kimliği doğrulanmış istemcinin son uygulama temasını gösterir; telefonun şu an çevrimiçi olduğunu garanti etmez.",
      },
    ];
  }, [printerQueues, uncertainOrErrorJobs, users, config]);

  // Precomputed dynamic report data for SCR-12 (works immediately + updates when server action runs)
  const computedReportView = useMemo(() => {
    const startMs = reportStartDate
      ? new Date(`${reportStartDate}T00:00:00`).getTime()
      : null;
    const endMs = reportEndDate
      ? new Date(`${reportEndDate}T23:59:59.999`).getTime()
      : null;

    const inDateRange = (dVal?: string | Date | null) => {
      if (reportDatePreset === "ALL_HISTORY" && !startMs && !endMs) return true;
      if (!dVal) return true;
      const t = new Date(dVal).getTime();
      if (Number.isNaN(t)) return true;
      if (startMs && t < startMs) return false;
      if (endMs && t > endMs) return false;
      return true;
    };

    const filteredSessions = sessions.filter((s) => {
      if (!inDateRange(s.openedAt)) return false;
      if (reportWaiterId !== "ALL" && s.openedById !== reportWaiterId) {
        return false;
      }
      if (reportAreaOrTableId !== "ALL") {
        if (reportAreaOrTableId.startsWith("AREA:")) {
          const areaId = reportAreaOrTableId.replace("AREA:", "");
          const tbl = tables.find((t) => t.id === s.tableId);
          if (tbl?.areaId !== areaId) return false;
        } else if (s.tableId !== reportAreaOrTableId) {
          return false;
        }
      }
      return true;
    });

    const allFilteredItems = filteredSessions.flatMap((s) =>
      (s.items ?? []).map((it: any) => ({ ...it, session: s }))
    ).filter((it: any) => {
      if (reportCategoryId !== "ALL") {
        const mi = menuItems.find((m) => m.id === it.menuItemId);
        if (mi?.categoryId !== reportCategoryId) return false;
      }
      return true;
    });

    const totalGuests = filteredSessions.reduce(
      (acc, s) => acc + Number(s.guestCount ?? 0),
      0
    );
    const totalSentQty = allFilteredItems
      .filter((i: any) => i.status === "SENT")
      .reduce((acc: number, i: any) => acc + Number(i.quantity ?? 1), 0);

    let columns: string[] = [];
    let rows: string[][] = [];

    switch (selectedReportCode) {
      case "OPERASYON_OZETI": {
        columns = [
          "Sipariş Ref",
          "Masa / Alan",
          "Durum",
          "Garson",
          "Misafir (Kuver)",
          "Tur Sayısı",
          "Etkin Kalem Adedi",
          "Açılış Zamanı",
        ];
        rows = filteredSessions.map((s) => {
          const tbl = tables.find((t) => t.id === s.tableId);
          const area = areas.find((a) => a.id === tbl?.areaId);
          const waiter = users.find((u) => u.id === s.openedById);
          const activeQty = (s.items ?? [])
            .filter((i: any) => i.status === "SENT")
            .reduce((sum: number, i: any) => sum + Number(i.quantity ?? 1), 0);
          return [
            s.referenceCode,
            `${tbl?.name ?? s.table?.name ?? "Masa"} (${area?.name ?? "Salon"})`,
            s.status === "OPEN" ? "Açık Servis" : "Tamamlandı",
            waiter?.name ?? s.openedBy?.name ?? "—",
            String(s.guestCount ?? 0),
            String((s.rounds ?? []).length),
            String(activeQty),
            formatDateTimeTR(s.openedAt),
          ];
        });
        break;
      }
      case "MASA_HAREKETLERI": {
        columns = [
          "Masa",
          "Alan",
          "Kapasite (Görsel)",
          "Güncel Durum",
          "Toplam Oturum",
          "Toplam Misafir / Kuver",
          "Son Hareket",
        ];
        rows = tables
          .filter((t) => {
            if (reportAreaOrTableId === "ALL") return true;
            if (reportAreaOrTableId.startsWith("AREA:")) {
              return t.areaId === reportAreaOrTableId.replace("AREA:", "");
            }
            return t.id === reportAreaOrTableId;
          })
          .map((t) => {
            const area = areas.find((a) => a.id === t.areaId);
            const tSessions = filteredSessions.filter((s) => s.tableId === t.id);
            const guests = tSessions.reduce(
              (sum, s) => sum + Number(s.guestCount ?? 0),
              0
            );
            return [
              t.name,
              area?.name ?? "—",
              `${t.capacity} Kişilik`,
              getTableStatusBadge(t.status).label,
              String(tSessions.length),
              String(guests),
              formatDateTimeTR(t.lastActivityAt),
            ];
          });
        break;
      }
      case "URUN_ADETLERI": {
        columns = [
          "Ürün Adı",
          "Fiş Adı",
          "Kategori",
          "Mutfak İstasyonu",
          "Gönderilen Adet",
          "Taslak / Bekleyen Adet",
          "İptal (VOID) Adet",
        ];
        const byProduct = new Map<
          string,
          {
            name: string;
            receiptName: string;
            catName: string;
            station: string;
            sent: number;
            pending: number;
            cancelled: number;
          }
        >();
        for (const it of allFilteredItems) {
          const mi = menuItems.find((m) => m.id === it.menuItemId);
          const cat = categories.find((c) => c.id === mi?.categoryId);
          const key = it.productNameSnapshot || mi?.name || "Ürün";
          const entry = byProduct.get(key) ?? {
            name: key,
            receiptName: it.receiptNameSnapshot || mi?.receiptName || key,
            catName: cat?.name ?? "Genel",
            station: it.stationNameSnapshot || "Mutfak",
            sent: 0,
            pending: 0,
            cancelled: 0,
          };
          const q = Number(it.quantity ?? 1);
          if (it.status === "SENT") entry.sent += q;
          else if (it.status === "CANCELLED") entry.cancelled += q;
          else entry.pending += q;
          byProduct.set(key, entry);
        }
        rows = Array.from(byProduct.values()).map((v) => [
          v.name,
          v.receiptName,
          v.catName,
          v.station,
          String(v.sent),
          String(v.pending),
          String(v.cancelled),
        ]);
        break;
      }
      case "ACIK_SIPARISLER": {
        columns = [
          "Sipariş Ref",
          "Masa",
          "Garson",
          "Kuver",
          "Gönderilen Kalem",
          "Taslak / Zamanlı",
          "Açılış Saati",
        ];
        rows = filteredSessions
          .filter((s) => s.status === "OPEN")
          .map((s) => {
            const tbl = tables.find((t) => t.id === s.tableId);
            const waiter = users.find((u) => u.id === s.openedById);
            const sentC = (s.items ?? []).filter(
              (i: any) => i.status === "SENT"
            ).length;
            const draftC = (s.items ?? []).filter(
              (i: any) => i.status !== "SENT" && i.status !== "CANCELLED"
            ).length;
            return [
              s.referenceCode,
              tbl?.name ?? s.table?.name ?? "—",
              waiter?.name ?? s.openedBy?.name ?? "—",
              String(s.guestCount ?? 0),
              String(sentC),
              String(draftC),
              formatDateTimeTR(s.openedAt),
            ];
          });
        break;
      }
      case "TAMAMLANAN_OTURUMLAR": {
        columns = [
          "Sipariş Ref",
          "Masa",
          "Açan Garson",
          "Kuver",
          "Toplam Tur",
          "Açılış Zamanı",
          "Tamamlanma Zamanı",
        ];
        rows = filteredSessions
          .filter((s) => s.status === "COMPLETED")
          .map((s) => {
            const tbl = tables.find((t) => t.id === s.tableId);
            const waiter = users.find((u) => u.id === s.openedById);
            return [
              s.referenceCode,
              tbl?.name ?? s.table?.name ?? "—",
              waiter?.name ?? s.openedBy?.name ?? "—",
              String(s.guestCount ?? 0),
              String((s.rounds ?? []).length),
              formatDateTimeTR(s.openedAt),
              formatDateTimeTR(s.completedAt),
            ];
          });
        break;
      }
      case "BEKLETILEN_ZAMANLI": {
        columns = [
          "Sipariş Ref",
          "Masa",
          "Kalem",
          "Adet",
          "Koltuk",
          "Durum",
          "Planlanan Gönderim Saati",
        ];
        rows = allFilteredItems
          .filter(
            (i: any) =>
              i.status === "HELD" ||
              i.status === "SCHEDULED" ||
              i.status === "OVERDUE"
          )
          .map((i: any) => {
            const tbl = tables.find((t) => t.id === i.session?.tableId);
            return [
              i.session?.referenceCode ?? "—",
              tbl?.name ?? "—",
              i.productNameSnapshot,
              String(i.quantity ?? 1),
              i.seatNumber ? `Koltuk ${i.seatNumber}` : "Ortak",
              getItemStatusBadge(i.status).label,
              formatDateTimeTR(i.scheduledAt),
            ];
          });
        break;
      }
      case "GARSON_GUNLUGU": {
        columns = [
          "Garson / Kullanıcı",
          "Rol",
          "Açtığı Servis Sayısı",
          "Oluşturduğu Kalem Satırı",
          "Gönderilen Ürün Adedi",
          "İptal Talebi Sayısı",
        ];
        rows = users
          .filter((u) => reportWaiterId === "ALL" || u.id === reportWaiterId)
          .map((u) => {
            const opened = filteredSessions.filter(
              (s) => s.openedById === u.id
            ).length;
            const itemsByU = allFilteredItems.filter(
              (i: any) => i.createdById === u.id
            );
            const sentQtyByU = itemsByU
              .filter((i: any) => i.status === "SENT")
              .reduce((sum: number, i: any) => sum + Number(i.quantity ?? 1), 0);
            const cancelsByU = cancelRequests.filter(
              (c) => c.requestedById === u.id
            ).length;
            return [
              u.name,
              u.role,
              String(opened),
              String(itemsByU.length),
              String(sentQtyByU),
              String(cancelsByU),
            ];
          });
        break;
      }
      case "SIPARIS_DENETIM": {
        columns = [
          "Zaman",
          "Sipariş Ref",
          "Masa",
          "Kalem / İşlem",
          "Koltuk / Paylaşım",
          "Modifier & Not",
          "Durum",
        ];
        rows = allFilteredItems.map((i: any) => {
          const tbl = tables.find((t) => t.id === i.session?.tableId);
          const shared = parseJsonArray<number>(i.sharedSeatsJson);
          const mods = parseJsonArray<string>(i.modifiersJson);
          const seatDesc =
            shared.length > 1
              ? `Paylaşım Koltuk [${shared.join(",")}] (Adet Çoğalmaz)`
              : i.seatNumber
              ? `Koltuk ${i.seatNumber}`
              : "Atanmamış";
          return [
            formatDateTimeTR(i.sentAt ?? i.createdAt),
            i.session?.referenceCode ?? "—",
            tbl?.name ?? "—",
            `${i.quantity}x ${i.productNameSnapshot}`,
            seatDesc,
            [...mods, i.kitchenNote].filter(Boolean).join(" · ") || "—",
            getItemStatusBadge(i.status).label,
          ];
        });
        break;
      }
      case "IPTAL_ONAYLAR": {
        columns = [
          "İptal Ref",
          "Sipariş / Masa",
          "Kalem & Adet",
          "Gerekçe Kategorisi",
          "Açıklama",
          "Talep Eden",
          "Karar Veren",
          "Durum",
        ];
        rows = cancelRequests
          .filter((c) => inDateRange(c.requestedAt))
          .map((c) => {
            const sess = sessions.find((s) => s.id === c.sessionId);
            const tbl = tables.find((t) => t.id === sess?.tableId);
            const reqUser = users.find((u) => u.id === c.requestedById);
            const decUser = users.find((u) => u.id === c.decidedById);
            return [
              c.referenceCode,
              `${sess?.referenceCode ?? "—"} · ${tbl?.name ?? "—"}`,
              `${c.requestedQuantity}x ${
                c.orderItem?.productNameSnapshot ?? "Kalem"
              }`,
              c.reasonCategory,
              c.explanation,
              reqUser?.name ?? c.requestedBy?.name ?? "—",
              decUser?.name ?? c.decidedBy?.name ?? "Bekliyor",
              c.status === "APPROVED"
                ? "Onaylandı (VOID)"
                : c.status === "REJECTED"
                ? "Reddedildi"
                : "Karar Bekliyor",
            ];
          });
        break;
      }
      case "YAZDIRMA_GUNLUGU": {
        columns = [
          "İş Kodu",
          "Çıktı Türü",
          "Kuyruk / İstasyon",
          "Sipariş Ref",
          "Durum",
          "Tekrar Baskı",
          "Tetikleyen",
          "Zaman",
        ];
        rows = printJobs
          .filter((pj) => inDateRange(pj.submittedAt ?? pj.createdAt))
          .map((pj) => {
            const sess = sessions.find((s) => s.id === pj.sessionId);
            const q = printerQueues.find((pq) => pq.id === pj.printerQueueId);
            return [
              pj.jobCode,
              getPrintJobTypeLabel(pj.jobType),
              `${q?.name ?? "Kuyruk"} (${pj.stationName ?? "Genel"})`,
              sess?.referenceCode ?? "—",
              getPrintJobStatusBadge(pj.status).label,
              pj.isReprint
                ? `Evet (İlk: ${pj.originalJobId ?? "-"})`
                : "Hayır (Orijinal)",
              pj.actorName,
              formatDateTimeTR(pj.submittedAt ?? pj.createdAt, true),
            ];
          });
        break;
      }
    }

    if (
      reportServerResult &&
      reportServerResult.reportCode === selectedReportCode &&
      Array.isArray(reportServerResult.rows)
    ) {
      const srvCols = Array.isArray(reportServerResult.columns)
        ? reportServerResult.columns
        : [];
      const normalizedColumns: string[] =
        srvCols.length > 0
          ? srvCols.map((c: any) =>
              typeof c === "string" ? c : String(c.header ?? c.key ?? "")
            )
          : columns;

      const normalizedRows: string[][] = reportServerResult.rows.map(
        (r: any) => {
          if (Array.isArray(r)) return r.map((cell) => String(cell ?? ""));
          if (srvCols.length > 0 && r && typeof r === "object") {
            return srvCols.map((c: any) =>
              String(r[c.key ?? c] ?? "—")
            );
          }
          return Object.values(r ?? {}).map((v) => String(v ?? ""));
        }
      );

      return {
        columns: normalizedColumns,
        rows: normalizedRows,
        kpis: {
          sessionsCount: filteredSessions.length,
          totalGuests,
          totalSentQty,
          cancelCount: cancelRequests.length,
        },
      };
    }

    return {
      columns,
      rows,
      kpis: {
        sessionsCount: filteredSessions.length,
        totalGuests,
        totalSentQty,
        cancelCount: cancelRequests.length,
      },
    };
  }, [
    selectedReportCode,
    reportDatePreset,
    reportStartDate,
    reportEndDate,
    reportWaiterId,
    reportAreaOrTableId,
    reportCategoryId,
    sessions,
    tables,
    areas,
    users,
    menuItems,
    categories,
    cancelRequests,
    printJobs,
    printerQueues,
    reportServerResult,
  ]);

  function applyReportDatePreset(
    preset: "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "ALL_HISTORY"
  ) {
    setReportDatePreset(preset);
    const now = new Date();
    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === "TODAY") {
      const s = toIsoDate(now);
      setReportStartDate(s);
      setReportEndDate(s);
    } else if (preset === "YESTERDAY") {
      const y = new Date(now.getTime() - 86400000);
      const s = toIsoDate(y);
      setReportStartDate(s);
      setReportEndDate(s);
    } else if (preset === "LAST_7_DAYS") {
      const w = new Date(now.getTime() - 6 * 86400000);
      setReportStartDate(toIsoDate(w));
      setReportEndDate(toIsoDate(now));
    } else {
      setReportStartDate("");
      setReportEndDate("");
    }
  }

  async function handleRunReport(exportFormat: "VIEW" | "CSV" | "PRINT" = "VIEW") {
    setBusyAction("run-report");
    try {
      const areaId =
        reportAreaOrTableId !== "ALL" &&
        reportAreaOrTableId.startsWith("AREA:")
          ? reportAreaOrTableId.replace("AREA:", "")
          : undefined;
      const tableId =
        reportAreaOrTableId !== "ALL" &&
        !reportAreaOrTableId.startsWith("AREA:")
          ? reportAreaOrTableId
          : undefined;

      const res: any = await runOperationalReportAction({
        actorId: currentUser?.id,
        reportCode: selectedReportCode,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
        waiterId: reportWaiterId === "ALL" ? undefined : reportWaiterId,
        areaId,
        tableId,
        categoryId: reportCategoryId === "ALL" ? undefined : reportCategoryId,
        exportFormat,
      });
      if (res && res.ok === false) {
        notify(res.error || "Rapor çalıştırılamadı.", "red");
      } else {
        setReportServerResult({
          reportCode: selectedReportCode,
          ...res,
        });
        const def = REPORT_CATALOG.find((r) => r.code === selectedReportCode);
        notify(
          `${def?.title ?? selectedReportCode} raporu başarıyla üretildi.`,
          "teal"
        );
      }
    } catch (err: any) {
      notify(err?.message || "Rapor çalıştırılırken hata oluştu.", "red");
    } finally {
      setBusyAction(null);
    }
  }

  function handleDownloadCsv() {
    const def = REPORT_CATALOG.find((r) => r.code === selectedReportCode);
    const { columns, rows } = computedReportView;
    const escapeCsv = (cell: string) =>
      `"${String(cell ?? "").replace(/"/g, '""')}"`;

    const metaHeader = [
      `# ALACARTE YEREL OPERASYON RAPORU - ${def?.title ?? selectedReportCode}`,
      `# Restoran: ${config?.name ?? "Merit Garden · A La Carte"}`,
      `# Üretim Zamanı: ${formatDateTimeTR(new Date(), true)}`,
      "",
    ];

    const csvLines = [
      ...metaHeader,
      columns.map(escapeCsv).join(";"),
      ...rows.map((r) => r.map(escapeCsv).join(";")),
    ];
    const csvContent = "\uFEFF" + csvLines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alacarte-rapor-${selectedReportCode.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    handleRunReport("CSV");
  }

  // Render helpers per screen
  if (activeScreen === "SCR-07") {
    const isRestaurantManager = currentUser?.role === "RESTAURANT_MANAGER";
    const learningEnabled = Boolean(config?.learningModeEnabled);

    return (
      <section className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#73d8c6]">
              SCR-07 · YÖNETİCİ OPERASYON PANOSU
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f0f5f3]">
              Servis Operasyonu ve Canlı Sağlık Görünümü
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Açık masalar, mutfak yazdırma kuyrukları, bekleyen iptal kararları, 4 ışıklı yerel ağ/sistem sağlığı ve Garson Öğrenme Modu kontrolü.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("SCR-11")}
              className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-2 text-xs font-bold text-[#f0f5f3] hover:brightness-110"
            >
              ⎙ Adisyon Yazdır
            </button>
            <button
              type="button"
              onClick={() => onNavigate("SCR-12")}
              className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3.5 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110"
            >
              📊 Rapor Merkezi
            </button>
          </div>
        </div>

        {/* Top 4 KPI Stat Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              AÇIK MASA
            </div>
            <strong className="mt-1 block font-mono text-2xl font-extrabold text-[#f0f5f3]">
              {String(openSessions.length).padStart(2, "0")}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              {tables.length} toplam kayıtlı masa
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              MUTFAKTA GÖNDERİLMİŞ KALEM
            </div>
            <strong className="mt-1 block font-mono text-2xl font-extrabold text-[#f0f5f3]">
              {String(sentItemsCountInOpenSessions).padStart(2, "0")}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              Açık servislerde gönderilmiş toplam adet
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              YAZDIRMA UYARISI / BELİRSİZ İŞ
            </div>
            <strong
              className={`mt-1 block font-mono text-2xl font-extrabold ${
                uncertainOrErrorJobs.length > 0
                  ? "text-[#f18d83]"
                  : "text-[#f0f5f3]"
              }`}
            >
              {String(uncertainOrErrorJobs.length).padStart(2, "0")}
            </strong>
            <small className="text-[10px] text-[#efc97b]">
              {uncertainOrErrorJobs.length > 0
                ? "Kontrollü inceleme gerekli"
                : "Belirsiz veya hatalı iş yok"}
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              BEKLEYEN İPTAL KARARI
            </div>
            <strong
              className={`mt-1 block font-mono text-2xl font-extrabold ${
                pendingCancelRequests.length > 0
                  ? "text-[#efc97b]"
                  : "text-[#f0f5f3]"
              }`}
            >
              {String(pendingCancelRequests.length).padStart(2, "0")}
            </strong>
            <small className="text-[10px] text-[#efc97b]">
              {pendingCancelRequests.length > 0
                ? "Yönetici onayı bekliyor"
                : "Bekleyen iptal talebi yok"}
            </small>
          </div>
        </div>

        {/* 4-Light Live Connection Health Indicator Strip (§5.12 & §5.18) + Learning Mode Switch (§5.17) */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* 4-Light Connection Health Panel */}
          <div className="rounded-xl border border-[#344647] bg-[#192526] lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] px-4 py-3">
              <div>
                <b className="text-xs text-[#f0f5f3]">
                  Canlı Donanım ve Bağlantı Durumu
                </b>
                <small className="block text-[10px] text-[#9aaead]">
                  Cihaz ve servislerin anlık çalışma durumunu izleyin.
                </small>
              </div>
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2.5 py-1 text-[10px] font-bold text-[#bdf0e4]">
                ● Sistem Çevrimiçi
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 p-3.5 sm:grid-cols-2">
              {healthLights.map((light) => {
                const dotColor =
                  light.state === "NORMAL"
                    ? "bg-[#73d8c6] shadow-[0_0_10px_#73d8c6]"
                    : light.state === "WARNING"
                    ? "bg-[#efc97b] shadow-[0_0_10px_#efc97b]"
                    : "bg-[#8dc4e9] shadow-[0_0_10px_#8dc4e9]";

                return (
                  <button
                    key={light.id}
                    type="button"
                    onClick={() => {
                      if (currentUser?.role === "SYSTEM_ADMIN") {
                        notify(
                          `${light.name} seçildi — SCR-19 Sistem Durumu ve Tanılama ekranı açılıyor.`,
                          "teal"
                        );
                        onNavigate("SCR-19");
                      } else {
                        setSelectedHealthLight(
                          selectedHealthLight === light.id ? null : light.id
                        );
                      }
                    }}
                    className="flex flex-col justify-between rounded-xl border border-[#344647] bg-[#202f30] p-3 text-left transition hover:border-[#73d8c6]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`}
                          aria-hidden="true"
                        />
                        <b className="text-[11px] text-[#f0f5f3]">
                          {light.name}
                        </b>
                      </div>
                      <span className="rounded-full border border-[#3c6058] bg-[#182927] px-2 py-0.5 text-[9px] font-bold text-[#bdf0e4]">
                        {light.badgeText}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-[#9aaead]">
                      {light.summary}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedHealthLight !== null && (
              <div className="border-t border-[#344647] bg-[#152021] px-4 py-3 text-xs">
                {(() => {
                  const item = healthLights.find(
                    (h) => h.id === selectedHealthLight
                  );
                  if (!item) return null;
                  return (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <b className="text-[#73d8c6]">{item.name} — Operasyonel Ayrıntı:</b>
                        <p className="mt-1 text-[11px] text-[#f0f5f3]">
                          {item.detail}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedHealthLight(null)}
                        className="rounded border border-[#344647] px-2 py-1 text-[10px] text-[#9aaead]"
                      >
                        Kapat
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Waiter Learning Mode Control Panel (§5.17) */}
          <div className="flex flex-col justify-between rounded-xl border border-[#344647] bg-[#192526]">
            <div className="border-b border-[#344647] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <b className="text-xs text-[#f0f5f3]">
                  Garson Öğrenme Modu
                </b>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${
                    learningEnabled
                      ? "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]"
                      : "border-[#465353] bg-[#2d3939] text-[#bbc8c6]"
                  }`}
                >
                  {learningEnabled
                    ? "● Garson Öğrenme Modu: Açık"
                    : "○ Garson Öğrenme Modu: Kapalı"}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <p className="text-[11px] leading-relaxed text-[#9aaead]">
                Açık olduğunda garson ekranlarında bağlamsal <b className="text-[#f0f5f3]">“Nasıl Kullanılır?”</b> rehberi, gönderim öncesi doğrulama özeti ve terim açıklamaları gösterilir.
              </p>

              <div className="rounded-lg border border-[#705e37] bg-[#393321] p-2.5 text-[10px] leading-relaxed text-[#f1db9f]">
                <b>Görev Ayrılığı:</b> Bu ayarı yalnızca{" "}
                <b>Restoran Yöneticisi</b> değiştirebilir.{" "}
                {isRestaurantManager
                  ? "Aktif rolünüz Restoran Yöneticisi — durumu değiştirebilirsiniz."
                  : `Aktif rolünüz (${currentUser?.role}) — Tıkladığınızda sunucu RBAC kuralı işlemi reddeder ve AuditLog'a REJECTED kaydı düşer.`}
              </div>

              <button
                type="button"
                disabled={busyAction === "learning-mode"}
                onClick={handleToggleLearningMode}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-xs font-extrabold transition ${
                  isRestaurantManager
                    ? "border-[#58b7a6] bg-[#73d8c6] text-[#10221f] hover:brightness-110"
                    : "border-[#755f38] bg-[#433820] text-[#ffe0a2] hover:brightness-110"
                }`}
              >
                {busyAction === "learning-mode"
                  ? "İşleniyor..."
                  : learningEnabled
                  ? "Garson Öğrenme Modunu Kapat (Kapalı Yap)"
                  : "Garson Öğrenme Modunu Aç (Açık Yap)"}
              </button>
            </div>
          </div>
        </div>

        {/* Active Tables & Pending Decisions Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Active Tables List */}
          <div className="rounded-xl border border-[#344647] bg-[#192526] lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
              <div>
                <b className="text-xs text-[#f0f5f3]">Aktif Masalar ve Açık Servisler</b>
                <small className="ml-2 text-[10px] text-[#9aaead]">
                  Son hareket sırasına göre · Ayrıntı için SCR-08’e geçin
                </small>
              </div>
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2.5 py-0.5 text-[10px] font-bold text-[#bdf0e4]">
                {openSessions.length} Açık Oturum
              </span>
            </div>

            <div className="divide-y divide-[#2d3d3d]">
              {openSessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9aaead]">
                  Şu anda açık masa servisi bulunmuyor.
                </div>
              ) : (
                openSessions.map((sess) => {
                  const tbl = tables.find((t) => t.id === sess.tableId);
                  const area = areas.find((a) => a.id === tbl?.areaId);
                  const waiter = users.find((u) => u.id === sess.openedById);
                  const badge = getTableStatusBadge(tbl?.status ?? "IN_SERVICE");
                  const items = sess.items ?? [];
                  const sentQty = items
                    .filter((i: any) => i.status === "SENT")
                    .reduce((acc: number, i: any) => acc + Number(i.quantity ?? 1), 0);
                  const draftQty = items
                    .filter((i: any) => i.status === "DRAFT")
                    .reduce((acc: number, i: any) => acc + Number(i.quantity ?? 1), 0);

                  return (
                    <div
                      key={sess.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#1e2d2d]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <b className="text-xs text-[#f0f5f3]">
                            {tbl?.name ?? sess.table?.name ?? "Masa"} ·{" "}
                            {area?.name ?? "Salon"}
                          </b>
                          <span className="font-mono text-[10px] text-[#73d8c6]">
                            {sess.referenceCode}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#9aaead]">
                          Garson: {waiter?.name ?? sess.openedBy?.name ?? "—"} ·{" "}
                          {sess.guestCount} Misafir/Kuver · {sentQty} gönderilmiş kalem
                          {draftQty > 0 ? ` · ${draftQty} taslak bekliyor` : ""} · Son hareket:{" "}
                          {formatTimeOnlyTR(sess.lastActivityAt, false)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTable(sess.tableId);
                            setSelectedSessionId(sess.id);
                            onNavigate("SCR-08");
                          }}
                          className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1.5 text-[10px] font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
                        >
                          Masa Ayrıntısı →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending Manager Decisions & Queue Alerts */}
          <div className="space-y-3">
            <div className="rounded-xl border border-[#344647] bg-[#192526]">
              <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
                <b className="text-xs text-[#f0f5f3]">
                  Karar ve İşlem Bekleyenler
                </b>
                <span className="rounded-full border border-[#665637] bg-[#3b3325] px-2.5 py-0.5 text-[10px] font-bold text-[#f2d38f]">
                  {pendingCancelRequests.length + uncertainOrErrorJobs.length} Kayıt
                </span>
              </div>

              <div className="divide-y divide-[#2d3d3d]">
                {pendingCancelRequests.map((req) => {
                  const sess = sessions.find((s) => s.id === req.sessionId);
                  const tbl = tables.find((t) => t.id === sess?.tableId);
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <b className="block text-[11px] text-[#f0f5f3]">
                          {tbl?.name ?? "Masa"} · İptal Talebi ({req.referenceCode})
                        </b>
                        <p className="mt-0.5 text-[10px] text-[#9aaead]">
                          {req.requestedQuantity}x{" "}
                          {req.orderItem?.productNameSnapshot ?? "Gönderilmiş Kalem"} ·{" "}
                          {req.reasonCategory}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate("SCR-09")}
                        className="rounded-lg border border-[#665637] bg-[#3b3325] px-2.5 py-1.5 text-[10px] font-bold text-[#f2d38f] hover:brightness-110"
                      >
                        Karar Ver
                      </button>
                    </div>
                  );
                })}

                {uncertainOrErrorJobs.map((job) => {
                  const sess = sessions.find((s) => s.id === job.sessionId);
                  const tbl = tables.find((t) => t.id === sess?.tableId);
                  return (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <b className="block text-[11px] text-[#ffc0b5]">
                          {tbl?.name ?? "Masa"} · Baskı Sonucu Belirsiz ({job.jobCode})
                        </b>
                        <p className="mt-0.5 text-[10px] text-[#9aaead]">
                          {job.stationName ?? "Mutfak"} · Otomatik tekrar yapılmadı
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate("SCR-10")}
                        className="rounded-lg border border-[#684442] bg-[#3e2c2b] px-2.5 py-1.5 text-[10px] font-bold text-[#ffc0b5] hover:brightness-110"
                      >
                        Yazıcı Kuyruğu
                      </button>
                    </div>
                  );
                })}

                {pendingCancelRequests.length === 0 &&
                  uncertainOrErrorJobs.length === 0 && (
                    <div className="p-5 text-center text-xs text-[#9aaead]">
                      Bekleyen iptal kararı veya belirsiz yazdırma işi bulunmuyor.
                    </div>
                  )}
              </div>
            </div>

            <div className="rounded-xl border border-[#705e37] bg-[#393321] p-3.5 text-[11px] leading-relaxed text-[#f1db9f]">
              <b>Servis Tamamlama:</b> Açık taslak kalem, bekleyen iptal talebi veya belirsiz baskı işi çözülmeden masa kapatılamaz.
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (activeScreen === "SCR-08") {
    const emptyTables = tables.filter(
      (t) => t.status === "EMPTY" && t.active !== false
    );
    const rounds = currentDetailSession?.rounds ?? [];
    const items = (currentDetailSession?.items ?? []).filter((it: any) => {
      if (activeRoundFilter === "ALL") return true;
      return String(it.roundId) === activeRoundFilter;
    });
    const sessionPrintJobs = printJobs.filter(
      (pj) => pj.sessionId === currentDetailSession?.id
    );
    const sessionCancels = cancelRequests.filter(
      (cr) => cr.sessionId === currentDetailSession?.id
    );
    const currentTable = tables.find(
      (t) => t.id === currentDetailSession?.tableId
    );
    const currentArea = areas.find((a) => a.id === currentTable?.areaId);

    // Build chronological timeline
    const timelineEvents: Array<{
      id: string;
      time: Date;
      title: string;
      subtitle: string;
      tone: "teal" | "gold" | "red";
    }> = [];

    if (currentDetailSession) {
      timelineEvents.push({
        id: `open-${currentDetailSession.id}`,
        time: new Date(currentDetailSession.openedAt),
        title: `Masa servisi açıldı (${currentDetailSession.referenceCode})`,
        subtitle: `${currentTable?.name ?? "Masa"} · Misafir/Kuver: ${
          currentDetailSession.guestCount
        }`,
        tone: "teal",
      });

      for (const r of rounds) {
        if (r.sentAt) {
          timelineEvents.push({
            id: `round-${r.id}`,
            time: new Date(r.sentAt),
            title: `Tur ${String(r.roundNumber).padStart(2, "0")} mutfağa gönderildi`,
            subtitle: `Durum: ${r.status}`,
            tone: "teal",
          });
        }
      }

      for (const pj of sessionPrintJobs) {
        timelineEvents.push({
          id: `pj-${pj.id}`,
          time: new Date(pj.submittedAt ?? pj.createdAt),
          title: `${getPrintJobTypeLabel(pj.jobType)} (${pj.jobCode})`,
          subtitle: `${pj.stationName ?? "Yazıcı Kuyruğu"} · Durum: ${pj.status} · Aktör: ${
            pj.actorName
          }`,
          tone:
            pj.status === "UNCERTAIN" || pj.status === "ERROR"
              ? "red"
              : "teal",
        });
      }

      for (const cr of sessionCancels) {
        timelineEvents.push({
          id: `cr-${cr.id}`,
          time: new Date(cr.requestedAt),
          title: `İptal Talebi (${cr.referenceCode}) — ${cr.status}`,
          subtitle: `${cr.reasonCategory}: ${cr.explanation}`,
          tone: cr.status === "PENDING" ? "gold" : "red",
        });
      }

      if (currentDetailSession.completedAt) {
        timelineEvents.push({
          id: `comp-${currentDetailSession.id}`,
          time: new Date(currentDetailSession.completedAt),
          title: "Servis oturumu tamamlandı ve masa boşaltıldı",
          subtitle: `Sipariş Ref: ${currentDetailSession.referenceCode}`,
          tone: "teal",
        });
      }
    }

    timelineEvents.sort((a, b) => b.time.getTime() - a.time.getTime());

    return (
      <section className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#73d8c6]">
              SCR-08 · SİPARİŞ VE MASA AYRINTISI
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f0f5f3]">
              {currentTable?.name ?? "Masa"} ({currentArea?.name ?? "Salon"}) ·{" "}
              <span className="font-mono text-[#73d8c6]">
                {currentDetailSession?.referenceCode ?? "—"}
              </span>
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Servis turları, koltuk/paylaşım bilgileri, işlem ve yazdırma zaman çizgisi, Masa Taşı ve Servisi Tamamla kontrolü.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("SCR-07")}
              className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-2 text-xs font-bold text-[#f0f5f3] hover:brightness-110"
            >
              ← Panoya Dön
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentDetailSession) {
                  setCheckSessionId(currentDetailSession.id);
                }
                onNavigate("SCR-11");
              }}
              className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-2 text-xs font-bold text-[#f0f5f3] hover:brightness-110"
            >
              ⎙ Adisyon Önizle
            </button>
            {currentDetailSession?.status === "OPEN" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (emptyTables.length > 0 && !transferTargetTableId) {
                      setTransferTargetTableId(emptyTables[0].id);
                    }
                    setShowTransferModal(true);
                  }}
                  className="rounded-lg border border-[#755f38] bg-[#433820] px-3 py-2 text-xs font-bold text-[#ffe0a2] hover:brightness-110"
                >
                  ⇄ Masa Taşı
                </button>
                <button
                  type="button"
                  disabled={busyAction === "complete-session"}
                  onClick={handleCompleteServiceSession}
                  className="rounded-lg border border-[#754541] bg-[#452c2a] px-3.5 py-2 text-xs font-extrabold text-[#ffc7be] hover:brightness-110"
                >
                  {busyAction === "complete-session"
                    ? "Kontrol Ediliyor..."
                    : "✓ Servisi Tamamla / Masayı Boşalt"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Session Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#344647] bg-[#192526] p-3">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="scr08-session-select"
              className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
            >
              İNCELENEN SERVİS OTURUMU:
            </label>
            <select
              id="scr08-session-select"
              value={currentDetailSession?.id ?? ""}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedSessionId(nextId);
                setActiveRoundFilter("ALL");
                const found = sessions.find((s) => s.id === nextId);
                if (found?.tableId) onSelectTable(found.tableId);
              }}
              className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs font-bold text-[#f0f5f3]"
            >
              {sessions.map((s) => {
                const t = tables.find((tbl) => tbl.id === s.tableId);
                return (
                  <option key={s.id} value={s.id}>
                    {t?.name ?? "Masa"} · {s.referenceCode} (
                    {s.status === "OPEN" ? "AÇIK SERVİS" : "TAMAMLANDI"} ·{" "}
                    {s.guestCount} Misafir)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#9aaead]">Masa Durumu:</span>
            {sessionBlockers.length === 0 ? (
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2.5 py-1 text-[10px] font-bold text-[#bdf0e4]">
                ✓ Masayı Boşaltmaya Hazır
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCompletionBlockersModal(true)}
                className="rounded-full border border-[#684442] bg-[#3e2c2b] px-2.5 py-1 text-[10px] font-bold text-[#ffc0b5]"
              >
                ▲ {sessionBlockers.length} Bekleyen İşlem Var (İncele)
              </button>
            )}
          </div>
        </div>

        {/* Blocker Resolution Panel */}
        {(sessionBlockers.length > 0 || completionBlockersModal) && (
          <div className="rounded-xl border-2 border-[#744947] bg-[#2d1e1e] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <b className="text-xs font-extrabold uppercase tracking-wider text-[#ffc4bc]">
                  ▲ SERVİSİ TAMAMLAMADAN ÖNCE BEKLEYEN İŞLEMLER ({sessionBlockers.length})
                </b>
                <p className="mt-0.5 text-[11px] text-[#f3d2ce]">
                  Masayı kapatmadan önce aşağıdaki taslak veya bekleyen işlemler tamamlanmalıdır:
                </p>
              </div>
              {completionBlockersModal && (
                <button
                  type="button"
                  onClick={() => setCompletionBlockersModal(false)}
                  className="rounded border border-[#744947] px-2.5 py-1 text-[10px] text-[#ffc4bc]"
                >
                  Gizle
                </button>
              )}
            </div>

            <div className="mt-3 divide-y divide-[#4d3434] rounded-lg border border-[#5d3d3d] bg-[#1e1515]">
              {sessionBlockers.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div>
                    <b className="text-xs text-[#ffc4bc]">{b.title}</b>
                    <p className="text-[10px] text-[#d6b4b0]">{b.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentDetailSession?.tableId) {
                        onSelectTable(currentDetailSession.tableId);
                      }
                      onNavigate(b.targetScreen);
                    }}
                    className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3 py-1.5 text-[10px] font-extrabold text-[#10221f]"
                  >
                    {b.targetLabel} →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 4 Session Stat Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              SİPARİŞ REFERANSI
            </div>
            <strong className="mt-1 block font-mono text-xl font-extrabold text-[#f0f5f3]">
              {currentDetailSession?.referenceCode ?? "—"}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              Açılış: {formatDateTimeTR(currentDetailSession?.openedAt)}
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              MİSAFİR / KUVER & KOLTUK
            </div>
            <strong className="mt-1 block font-mono text-xl font-extrabold text-[#f0f5f3]">
              {currentDetailSession?.guestCount ?? 0} Misafir ·{" "}
              {currentDetailSession?.seatCount ?? 0} Koltuk
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              Kayıtlı kişi ve koltuk sayısı
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              SERVİS TURU SAYISI
            </div>
            <strong className="mt-1 block font-mono text-xl font-extrabold text-[#f0f5f3]">
              {rounds.length} Tur
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              Gönderilen ve taslak turlar
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              OTURUM DURUMU
            </div>
            <strong className="mt-1 block text-xl font-extrabold text-[#f0f5f3]">
              {currentDetailSession?.status === "OPEN"
                ? "Açık Servis"
                : "Tamamlandı"}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              {rounds.length} Tur Kayıtlı
            </small>
          </div>
        </div>

        {/* Service Rounds & Chronological Timeline */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Rounds and Items */}
          <div className="rounded-xl border border-[#344647] bg-[#192526] lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] px-4 py-2.5">
              <b className="text-xs text-[#f0f5f3]">Servis Turları ve Kalemler</b>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveRoundFilter("ALL")}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                    activeRoundFilter === "ALL"
                      ? "bg-[#73d8c6] text-[#10221f]"
                      : "bg-[#202f30] text-[#9aaead]"
                  }`}
                >
                  Tüm Turlar ({(currentDetailSession?.items ?? []).length})
                </button>
                {rounds.map((r: any) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveRoundFilter(String(r.id))}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                      activeRoundFilter === String(r.id)
                        ? "bg-[#73d8c6] text-[#10221f]"
                        : "bg-[#202f30] text-[#9aaead]"
                    }`}
                  >
                    Tur {r.roundNumber} ({r.status})
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#2d3d3d]">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9aaead]">
                  Bu filtrede görüntülenecek sipariş kalemi yok.
                </div>
              ) : (
                items.map((item: any) => {
                  const roundObj = rounds.find((r: any) => r.id === item.roundId);
                  const badge = getItemStatusBadge(item.status);
                  const sharedSeats = parseJsonArray<number>(item.sharedSeatsJson);
                  const modifiers = parseJsonArray<string>(item.modifiersJson);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded border border-[#3c6058] bg-[#243d39] px-2 py-0.5 font-mono text-[10px] font-bold text-[#bdf0e4]">
                            Tur {roundObj?.roundNumber ?? 1}
                          </span>
                          <b className="text-xs text-[#f0f5f3]">
                            {item.quantity} × {item.productNameSnapshot}
                          </b>
                          {sharedSeats.length > 1 ? (
                            <span className="rounded border border-[#49605b] bg-[#243432] px-2 py-0.5 text-[10px] text-[#73d8c6]">
                              Paylaşım Koltuklar: {sharedSeats.join(", ")} (Adet çoğalmaz)
                            </span>
                          ) : item.seatNumber ? (
                            <span className="rounded border border-[#49605b] bg-[#243432] px-2 py-0.5 text-[10px] text-[#9aaead]">
                              Koltuk {item.seatNumber}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] text-[#9aaead]">
                          İstasyon: {item.stationNameSnapshot}
                          {modifiers.length > 0
                            ? ` · Seçenekler: ${modifiers.join(", ")}`
                            : ""}
                          {item.kitchenNote
                            ? ` · Mutfak Notu: ${item.kitchenNote}`
                            : ""}
                          {item.allergensSnapshot
                            ? ` · Alerjen: ${item.allergensSnapshot}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-mono text-[10px] text-[#9aaead]">
                          {formatTimeOnlyTR(item.sentAt ?? item.createdAt, false)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chronological Event & Print Timeline */}
          <div className="rounded-xl border border-[#344647] bg-[#192526]">
            <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
              <b className="text-xs text-[#f0f5f3]">İşlem ve Yazdırma Zaman Çizgisi</b>
              <small className="text-[10px] text-[#9aaead]">Sunucu saati</small>
            </div>

            <div className="space-y-3 p-4">
              {timelineEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="grid grid-cols-[66px_16px_1fr] items-start gap-2 text-xs"
                >
                  <span className="font-mono text-[10px] text-[#9aaead]">
                    {formatTimeOnlyTR(ev.time, true)}
                  </span>
                  <div className="flex justify-center pt-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        ev.tone === "red"
                          ? "bg-[#f18d83]"
                          : ev.tone === "gold"
                          ? "bg-[#efc97b]"
                          : "bg-[#73d8c6]"
                      }`}
                    />
                  </div>
                  <div>
                    <b className="block text-[11px] text-[#f0f5f3]">{ev.title}</b>
                    <small className="block text-[10px] text-[#9aaead]">
                      {ev.subtitle}
                    </small>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[#344647] p-3">
              <button
                type="button"
                onClick={() => onNavigate("SCR-10")}
                className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-1.5 text-[10px] font-bold text-[#f0f5f3]"
              >
                Yazdırma Kuyruğu
              </button>
              <button
                type="button"
                onClick={() => onNavigate("SCR-09")}
                className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-1.5 text-[10px] font-bold text-[#f0f5f3]"
              >
                İptal Talepleri
              </button>
            </div>
          </div>
        </div>

        {/* Masa Taşı Modal */}
        {showTransferModal && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-modal-title"
          >
            <form
              onSubmit={handleTransferTable}
              className="w-full max-w-md space-y-4 rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-2xl"
            >
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#73d8c6]">
                  MASA TAŞIMA İŞLEMİ
                </div>
                <h2
                  id="transfer-modal-title"
                  className="mt-1 text-base font-bold text-[#f0f5f3]"
                >
                  {currentTable?.name ?? "Masa"} ({currentDetailSession?.referenceCode}) Oturumunu Taşı
                </h2>
                <p className="mt-1 text-xs text-[#9aaead]">
                  Açık servis oturumu tüm turları, koltuk atamaları ve geçmişiyle birlikte seçilen boş masaya aktarılır.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="transfer-target-table"
                  className="block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                >
                  HEDEF BOŞ MASA SEÇİN
                </label>
                <select
                  id="transfer-target-table"
                  value={transferTargetTableId}
                  onChange={(e) => setTransferTargetTableId(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                >
                  <option value="">-- Boş Masa Seçin ({emptyTables.length} uygun) --</option>
                  {emptyTables.map((t) => {
                    const a = areas.find((ar) => ar.id === t.areaId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} · {a?.name ?? "Salon"} (Kapasite: {t.capacity})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="transfer-reason-input"
                  className="block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                >
                  TAŞIMA GEREKÇESİ (AUDİT KAYDI İÇİN)
                </label>
                <input
                  id="transfer-reason-input"
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-lg border border-[#344647] bg-[#202f30] px-3.5 py-2 text-xs font-bold text-[#f0f5f3]"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={busyAction === "transfer-table" || emptyTables.length === 0}
                  className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-extrabold text-[#10221f]"
                >
                  {busyAction === "transfer-table"
                    ? "Taşınıyor..."
                    : "Masayı Taşı ve Kaydet"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    );
  }

  if (activeScreen === "SCR-09") {
    const visibleCancelRequests = cancelRequests.filter((cr) => {
      if (cancelFilterStatus === "ALL") return true;
      return cr.status === cancelFilterStatus;
    });

    const selectedItemForCancel = sentItemsForCancelSession.find(
      (it: any) => it.id === cancelFormItemId
    );

    return (
      <section className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#73d8c6]">
              SCR-09 · İPTAL TALEPLERİ VE YÖNETİCİ KARARI
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f0f5f3]">
              Gönderilmiş Kalem İptal Talebi ve VOID Onayı
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Mutfağa gönderilmiş kalemler doğrudan silinemez; zorunlu gerekçe ile iptal talebi açılır. Talep sahibi kendi talebini onaylayamaz. Onaylandığında orijinal kalem satırı korunur ve ayrı <b className="text-[#f0f5f3]">KITCHEN_VOID</b> fişi üretilir.
            </p>
          </div>
          <span className="rounded-full border border-[#665637] bg-[#3b3325] px-3 py-1 text-xs font-extrabold text-[#f2d38f]">
            ⏳ {pendingCancelRequests.length} Bekleyen Karar
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Section 1: Create Cancellation Request Form (For Waiters & Managers) */}
          <div className="rounded-xl border border-[#344647] bg-[#192526]">
            <div className="border-b border-[#344647] px-4 py-3">
              <b className="text-xs text-[#f0f5f3]">
                1. Yeni İptal Talebi Oluştur (Garson / Yönetici)
              </b>
              <small className="block text-[10px] text-[#9aaead]">
                Yalnız mutfağa gönderilmiş (SENT) kalemler için talep açılır
              </small>
            </div>

            <form onSubmit={handleCreateCancelRequest} className="space-y-3 p-4">
              <div>
                <label
                  htmlFor="cancel-session-select"
                  className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                >
                  AÇIK MASA / SERVİS OTURUMU
                </label>
                <select
                  id="cancel-session-select"
                  value={cancelFormSessionId}
                  onChange={(e) => setCancelFormSessionId(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                >
                  {openSessions.map((s) => {
                    const t = tables.find((tbl) => tbl.id === s.tableId);
                    return (
                      <option key={s.id} value={s.id}>
                        {t?.name ?? "Masa"} · {s.referenceCode}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cancel-item-select"
                  className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                >
                  GÖNDERİLMİŞ KALEM (SENT)
                </label>
                <select
                  id="cancel-item-select"
                  value={cancelFormItemId}
                  onChange={(e) => {
                    setCancelFormItemId(e.target.value);
                    setCancelFormQty(1);
                  }}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                >
                  {sentItemsForCancelSession.length === 0 ? (
                    <option value="">
                      Bu masada gönderilmiş (SENT) kalem yok
                    </option>
                  ) : (
                    sentItemsForCancelSession.map((it: any) => (
                      <option key={it.id} value={it.id}>
                        {it.quantity}x {it.productNameSnapshot} (Koltuk{" "}
                        {it.seatNumber ?? "-"} · {it.stationNameSnapshot})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cancel-qty-input"
                  className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                >
                  İPTAL EDİLECEK ADET
                </label>
                <input
                  id="cancel-qty-input"
                  type="number"
                  min={1}
                  max={selectedItemForCancel?.quantity ?? 10}
                  value={cancelFormQty}
                  onChange={(e) =>
                    setCancelFormQty(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                />
              </div>

              <div>
                <label
                  htmlFor="cancel-reason-select"
                  className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                >
                  ZORUNLU GEREKÇE KATEGORİSİ
                </label>
                <select
                  id="cancel-reason-select"
                  value={cancelFormReason}
                  onChange={(e) => setCancelFormReason(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                >
                  {CANCEL_REASON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cancel-explanation-textarea"
                  className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                >
                  AÇIKLAMA / DETAY (ZORUNLU)
                </label>
                <textarea
                  id="cancel-explanation-textarea"
                  rows={3}
                  placeholder="Örn: Misafir siparişi verdikten hemen sonra ana yemek tercihini değiştirdi..."
                  value={cancelFormExplanation}
                  onChange={(e) => setCancelFormExplanation(e.target.value)}
                  className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] p-2.5 text-xs text-[#f0f5f3]"
                />
              </div>

              <button
                type="submit"
                disabled={
                  busyAction === "create-cancel" ||
                  sentItemsForCancelSession.length === 0
                }
                className="w-full rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2.5 text-xs font-extrabold text-[#10221f] hover:brightness-110 disabled:opacity-50"
              >
                {busyAction === "create-cancel"
                  ? "Kaydediliyor..."
                  : "＋ İptal Talebi Oluştur"}
              </button>

              <div className="rounded-lg border border-[#3c6259] bg-[#1c3531] p-2.5 text-[10px] leading-relaxed text-[#c0eee5]">
                ● Onayda ürün kalemi veritabanından silinmez; durum <b>CANCELLED</b> olur ve mutfak yazıcısına ayrı <b>*** İPTAL / VOID BİLDİRİMİ ***</b> işi gönderilir.
              </div>
            </form>
          </div>

          {/* Section 2: Pending & Historical Requests */}
          <div className="rounded-xl border border-[#344647] bg-[#192526] lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#344647] px-4 py-3">
              <div>
                <b className="text-xs text-[#f0f5f3]">
                  2. Bekleyen ve Geçmiş İptal Talepleri
                </b>
                <small className="ml-2 text-[10px] text-[#9aaead]">
                  Kural: Talep eden kullanıcı kendi talebini onaylayamaz (`requestedById !== currentUser.id`)
                </small>
              </div>
              <div className="flex gap-1.5">
                {[
                  { id: "ALL", label: `Tümü (${cancelRequests.length})` },
                  {
                    id: "PENDING",
                    label: `Bekleyen (${pendingCancelRequests.length})`,
                  },
                  { id: "APPROVED", label: "Onaylanan" },
                  { id: "REJECTED", label: "Reddedilen" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCancelFilterStatus(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                      cancelFilterStatus === tab.id
                        ? "bg-[#73d8c6] text-[#10221f]"
                        : "bg-[#202f30] text-[#9aaead]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#2d3d3d]">
              {visibleCancelRequests.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#9aaead]">
                  Seçili filtrede iptal talebi bulunmuyor.
                </div>
              ) : (
                visibleCancelRequests.map((req) => {
                  const sess = sessions.find((s) => s.id === req.sessionId);
                  const tbl = tables.find((t) => t.id === sess?.tableId);
                  const requester = users.find((u) => u.id === req.requestedById);
                  const decider = users.find((u) => u.id === req.decidedById);
                  const isSelfRequest = req.requestedById === currentUser?.id;
                  const canUserDecide =
                    currentUser?.role === "RESTAURANT_MANAGER" ||
                    currentUser?.role === "SYSTEM_ADMIN" ||
                    Boolean(
                      config?.shiftCancelDelegate &&
                        currentUser?.canApproveCancel
                    );

                  return (
                    <div key={req.id} className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-[#73d8c6]">
                              {req.referenceCode}
                            </span>
                            <b className="text-xs text-[#f0f5f3]">
                              {tbl?.name ?? "Masa"} ({sess?.referenceCode ?? "—"}) ·{" "}
                              {req.requestedQuantity} ×{" "}
                              {req.orderItem?.productNameSnapshot ?? "Ürün"}
                            </b>
                          </div>
                          <p className="mt-1 text-[11px] text-[#9aaead]">
                            Gerekçe: <b className="text-[#f0f5f3]">{req.reasonCategory}</b> — “
                            {req.explanation}”
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#9aaead]">
                            Talep Eden:{" "}
                            <b className="text-[#f0f5f3]">
                              {requester?.name ?? req.requestedBy?.name ?? "—"}
                            </b>{" "}
                            · {formatDateTimeTR(req.requestedAt, true)}
                            {req.decidedAt && (
                              <>
                                {" "}
                                · Karar Veren:{" "}
                                <b className="text-[#f0f5f3]">
                                  {decider?.name ?? req.decidedBy?.name ?? "Yönetici"}
                                </b>{" "}
                                ({formatDateTimeTR(req.decidedAt, true)})
                              </>
                            )}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                            req.status === "PENDING"
                              ? "border-[#665637] bg-[#3b3325] text-[#f2d38f]"
                              : req.status === "APPROVED"
                              ? "border-[#3c6058] bg-[#243d39] text-[#bdf0e4]"
                              : "border-[#684442] bg-[#3e2c2b] text-[#ffc0b5]"
                          }`}
                        >
                          {req.status === "PENDING"
                            ? "⏳ Karar Bekliyor"
                            : req.status === "APPROVED"
                            ? "✓ Onaylandı · VOID Basıldı"
                            : "✕ Reddedildi"}
                        </span>
                      </div>

                      {req.status === "PENDING" && (
                        <div className="rounded-xl border border-[#344647] bg-[#152021] p-3">
                          {isSelfRequest && (
                            <div className="mb-2.5 rounded-lg border border-[#744947] bg-[#3d2929] px-3 py-2 text-[10px] font-bold text-[#ffc4bc]">
                              ▲ Görev Ayrılığı Kuralı: Bu iptal talebini siz ({currentUser?.name}) oluşturdunuz. Talep sahibi kendi talebini onaylayamaz (`requestedById !== currentUser.id`). Başka bir yetkili yönetici onaylamalıdır.
                            </div>
                          )}

                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[220px] flex-1">
                              <label
                                htmlFor={`dec-note-${req.id}`}
                                className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                              >
                                YÖNETİCİ KARAR NOTU (AUDİT VE VOID FİŞİ İÇİN)
                              </label>
                              <input
                                id={`dec-note-${req.id}`}
                                type="text"
                                placeholder="Karar açıklaması girin..."
                                value={decisionNotesById[req.id] ?? ""}
                                onChange={(e) =>
                                  setDecisionNotesById((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={
                                busyAction === `decide-${req.id}` ||
                                !canUserDecide
                              }
                              onClick={() =>
                                handleDecideCancelRequest(req.id, "REJECTED")
                              }
                              className="rounded-lg border border-[#754541] bg-[#452c2a] px-3.5 py-2 text-xs font-bold text-[#ffc7be] hover:brightness-110 disabled:opacity-45"
                            >
                              ✕ Reddet
                            </button>

                            <button
                              type="button"
                              disabled={
                                busyAction === `decide-${req.id}` ||
                                isSelfRequest ||
                                !canUserDecide
                              }
                              onClick={() =>
                                handleDecideCancelRequest(req.id, "APPROVED")
                              }
                              className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3.5 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110 disabled:opacity-45"
                            >
                              ✓ Onayla ve Mutfağa VOID Bildir
                            </button>
                          </div>
                        </div>
                      )}

                      {req.decisionNote && req.status !== "PENDING" && (
                        <div className="rounded-lg border border-[#344647] bg-[#141f20] px-3 py-2 text-[10px] text-[#9aaead]">
                          <b>Karar Notu:</b> {req.decisionNote}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (activeScreen === "SCR-10") {
    const kitchenQueue = printerQueues.find(
      (q) => q.name === "Mutfak-Windows" || q.role === "KITCHEN"
    );
    const receiptQueue = printerQueues.find(
      (q) => q.name === "Adisyon-USB" || q.role === "RECEIPT"
    );

    const filteredJobs = printJobs.filter((pj) => {
      if (printFilterType !== "ALL" && pj.jobType !== printFilterType) {
        return false;
      }
      if (printFilterStatus !== "ALL" && pj.status !== printFilterStatus) {
        return false;
      }
      if (printSearchQuery.trim()) {
        const q = printSearchQuery.toLocaleLowerCase("tr-TR");
        const sess = sessions.find((s) => s.id === pj.sessionId);
        const tbl = tables.find((t) => t.id === sess?.tableId);
        const hay = [
          pj.jobCode,
          pj.stationName,
          pj.actorName,
          sess?.referenceCode,
          tbl?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return (
      <section className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#73d8c6]">
              YAZICILAR VE YAZDIRMA KUYRUĞU
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f0f5f3]">
              Yazdırma Kuyrukları ve Fiş İşleri
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Yazıcı kuyruklarını ve mutfak/adisyon fiş işlerini takip edin. Belirsiz işlerde aynı iş koduyla <b className="text-[#f0f5f3]">Kontrollü Tekrar Dene</b> veya <b className="text-[#f0f5f3]">Tekrar Baskı</b> kullanılır.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {currentUser?.role === "SYSTEM_ADMIN" && (
              <button
                type="button"
                onClick={() => onNavigate("SCR-17")}
                className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-2 text-xs font-bold text-[#f0f5f3]"
              >
                ⚙ Yazıcı ve İstasyon Ayarları
              </button>
            )}
          </div>
        </div>

        {/* Status Cards for Mutfak and Adisyon */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
                MUTFAK YAZICI KUYRUĞU
              </span>
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2 py-0.5 text-[9px] font-bold text-[#bdf0e4]">
                {kitchenQueue?.status ?? "ONLINE"}
              </span>
            </div>
            <strong className="mt-1.5 block text-sm font-extrabold text-[#f0f5f3]">
              Mutfak Yazıcısı
            </strong>
            <small className="mt-1 block text-[10px] text-[#9aaead]">
              Ağ Bağlantılı · 80mm Termal Sipariş Fişi
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
                ADİSYON YAZICI KUYRUĞU
              </span>
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2 py-0.5 text-[9px] font-bold text-[#bdf0e4]">
                {receiptQueue?.status ?? "ONLINE"}
              </span>
            </div>
            <strong className="mt-1.5 block text-sm font-extrabold text-[#f0f5f3]">
              Kasa / Bar Adisyon Yazıcısı
            </strong>
            <small className="mt-1 block text-[10px] text-[#9aaead]">
              USB Bağlantılı · 80mm Termal Servis Özeti
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              SONUCU BELİRSİZ / HATALI
            </div>
            <strong
              className={`mt-1 block font-mono text-2xl font-extrabold ${
                uncertainOrErrorJobs.length > 0
                  ? "text-[#f18d83]"
                  : "text-[#f0f5f3]"
              }`}
            >
              {String(uncertainOrErrorJobs.length).padStart(2, "0")}
            </strong>
            <small className="text-[10px] text-[#efc97b]">
              Yetkili kontrollü deneme bekliyor
            </small>
          </div>

          <div className="rounded-xl border border-[#344647] bg-[#192526] p-3.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
              TOPLAM KAYITLI BASKI İŞİ
            </div>
            <strong className="mt-1 block font-mono text-2xl font-extrabold text-[#f0f5f3]">
              {String(printJobs.length).padStart(2, "0")}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">
              80mm ESC/POS metin anlık görüntülü
            </small>
          </div>
        </div>

        {/* Filterable PrintJob Table */}
        <div className="rounded-xl border border-[#344647] bg-[#192526]">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-[#344647] p-3.5">
            <select
              aria-label="Çıktı türü filtresi"
              value={printFilterType}
              onChange={(e) => setPrintFilterType(e.target.value)}
              className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
            >
              <option value="ALL">Tüm Çıktı Türleri</option>
              <option value="KITCHEN_ORDER">Mutfak Siparişi (KITCHEN_ORDER)</option>
              <option value="KITCHEN_VOID">Mutfak VOID Bildirimi (KITCHEN_VOID)</option>
              <option value="PRICELESS_CHECK">Adisyon / Servis Özeti (PRICELESS_CHECK)</option>
              <option value="TEST_PRINT">Test / Tanılama Fişi (TEST_PRINT)</option>
            </select>

            <select
              aria-label="Yazdırma durumu filtresi"
              value={printFilterStatus}
              onChange={(e) => setPrintFilterStatus(e.target.value)}
              className="rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="UNCERTAIN">Sonucu Belirsiz (UNCERTAIN)</option>
              <option value="ERROR">Hata (ERROR)</option>
              <option value="SUBMITTED_TO_OS_QUEUE">
                Windows Kuyruğuna İletildi
              </option>
              <option value="REPRINTED">Tekrar Baskı (REPRINTED)</option>
            </select>

            <input
              type="text"
              placeholder="İş kodu (P-2045), sipariş ref veya masa ara..."
              value={printSearchQuery}
              onChange={(e) => setPrintSearchQuery(e.target.value)}
              className="min-w-[240px] flex-1 rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
            />
          </div>

          <div className="alacarte-table-wrapper">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#344647] text-[10px] font-extrabold uppercase tracking-wider text-[#91a3a0]">
                  <th className="px-3.5 py-2.5">İş Kodu / Zaman</th>
                  <th className="px-3.5 py-2.5">Tür / Hedef Kuyruk</th>
                  <th className="px-3.5 py-2.5">Masa / Sipariş Ref</th>
                  <th className="px-3.5 py-2.5">Durum</th>
                  <th className="px-3.5 py-2.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a3939]">
                {filteredJobs.map((job) => {
                  const sess = sessions.find((s) => s.id === job.sessionId);
                  const tbl = tables.find((t) => t.id === sess?.tableId);
                  const queue = printerQueues.find(
                    (q) => q.id === job.printerQueueId
                  );
                  const badge = getPrintJobStatusBadge(job.status);
                  const isUncertainOrError =
                    job.status === "UNCERTAIN" || job.status === "ERROR";

                  return (
                    <tr key={job.id} className="hover:bg-[#1e2d2d]">
                      <td className="px-3.5 py-3">
                        <b className="font-mono text-xs text-[#f0f5f3]">
                          {job.jobCode}
                        </b>
                        {job.isReprint && (
                          <span className="ml-1.5 rounded border border-[#665637] bg-[#3b3325] px-1.5 py-0.5 text-[9px] font-bold text-[#f2d38f]">
                            TEKRAR BASKI
                          </span>
                        )}
                        <div className="text-[10px] text-[#9aaead]">
                          {formatDateTimeTR(job.submittedAt ?? job.createdAt, true)}
                        </div>
                      </td>

                      <td className="px-3.5 py-3">
                        <b className="text-xs text-[#f0f5f3]">
                          {getPrintJobTypeLabel(job.jobType)}
                        </b>
                        <div className="text-[10px] text-[#9aaead]">
                          {queue?.name ?? "Mutfak-Windows"} ·{" "}
                          {job.stationName ?? "Genel İstasyon"} · Deneme:{" "}
                          {job.attemptCount ?? 1}
                        </div>
                      </td>

                      <td className="px-3.5 py-3">
                        <b className="text-xs text-[#f0f5f3]">
                          {tbl?.name ?? "—"} · {sess?.referenceCode ?? "—"}
                        </b>
                        <div className="text-[10px] text-[#9aaead]">
                          Tetikleyen: {job.actorName}
                        </div>
                      </td>

                      <td className="px-3.5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        {job.errorMessage && (
                          <div className="mt-1 text-[10px] text-[#ffc0b5]">
                            {job.errorMessage}
                          </div>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectedPrintJob(job)}
                            className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-1.5 text-[10px] font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
                          >
                            Fiş Önizlemesi / İş Ayrıntısı
                          </button>

                          {isUncertainOrError && (
                            <button
                              type="button"
                              disabled={busyAction === `retry-${job.id}`}
                              onClick={() => handleControlledRetryPrint(job)}
                              className="rounded-lg border border-[#665637] bg-[#3b3325] px-2.5 py-1.5 text-[10px] font-extrabold text-[#f2d38f] hover:brightness-110"
                            >
                              {busyAction === `retry-${job.id}`
                                ? "Deneniyor..."
                                : "Kontrollü Tekrar Dene"}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={busyAction === `reprint-${job.id}`}
                            onClick={() => handleReprintJob(job)}
                            className="rounded-lg border border-[#3c6058] bg-[#243d39] px-2.5 py-1.5 text-[10px] font-extrabold text-[#bdf0e4] hover:brightness-110"
                          >
                            {busyAction === `reprint-${job.id}`
                              ? "Üretiliyor..."
                              : "Tekrar Baskı"}
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

        {/* Thermal Receipt Snapshot Modal */}
        {inspectedPrintJob && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-snapshot-modal-title"
          >
            <div className="w-full max-w-lg space-y-3 rounded-2xl border border-[#344647] bg-[#192526] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#73d8c6]">
                    80MM TERMAL FİŞ METİN ANLIK GÖRÜNTÜSÜ ({inspectedPrintJob.jobCode})
                  </div>
                  <h2
                    id="print-snapshot-modal-title"
                    className="mt-0.5 text-base font-bold text-[#f0f5f3]"
                  >
                    {getPrintJobTypeLabel(inspectedPrintJob.jobType)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedPrintJob(null)}
                  className="rounded border border-[#344647] px-2.5 py-1 text-xs text-[#9aaead]"
                >
                  ✕ Kapat
                </button>
              </div>

              <div className="rounded-lg bg-[#f4f2eb] p-4 font-mono text-[11px] leading-relaxed text-[#181818] shadow-inner">
                <pre className="whitespace-pre-wrap break-words font-mono">
                  {inspectedPrintJob.contentSnapshot}
                </pre>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <div className="flex gap-2">
                  {(inspectedPrintJob.status === "UNCERTAIN" ||
                    inspectedPrintJob.status === "ERROR") && (
                    <button
                      type="button"
                      onClick={() => {
                        handleControlledRetryPrint(inspectedPrintJob);
                        setInspectedPrintJob(null);
                      }}
                      className="rounded-lg border border-[#665637] bg-[#3b3325] px-3 py-1.5 text-xs font-bold text-[#f2d38f]"
                    >
                      Kontrollü Tekrar Dene
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleReprintJob(inspectedPrintJob);
                      setInspectedPrintJob(null);
                    }}
                    className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3 py-1.5 text-xs font-extrabold text-[#10221f]"
                  >
                    Tekrar Baskı Oluştur
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (activeScreen === "SCR-11") {
    const selectedCheckSession =
      sessions.find((s) => s.id === checkSessionId) ??
      openSessions[0] ??
      sessions[0] ??
      null;
    const checkTable = tables.find(
      (t) => t.id === selectedCheckSession?.tableId
    );
    const checkWaiter = users.find(
      (u) => u.id === selectedCheckSession?.openedById
    );
    const checkRounds = selectedCheckSession?.rounds ?? [];
    const checkItemsRaw = (selectedCheckSession?.items ?? []).filter(
      (it: any) =>
        it.status === "SENT" ||
        it.status === "CANCELLED" ||
        it.status === "CANCEL_REQUESTED"
    );

    const filteredCheckItems = checkItemsRaw.filter((it: any) => {
      if (checkRoundScope === "ALL") return true;
      const rObj = checkRounds.find((r: any) => r.id === it.roundId);
      return String(rObj?.roundNumber ?? 1) === String(checkRoundScope);
    });

    const scopeDescriptionText =
      checkRoundScope === "ALL"
        ? "Tüm gönderilmiş turlar"
        : `Yalnız Tur ${String(checkRoundScope).padStart(2, "0")}`;

    const thermalReceiptText = selectedCheckSession
      ? formatPricelessCheckSummary({
          restaurantName: config?.name ?? "Merit Garden · A La Carte",
          tableName:
            checkTable?.name ?? selectedCheckSession.table?.name ?? "Masa 08",
          orderReference: selectedCheckSession.referenceCode,
          waiterName:
            checkWaiter?.name ??
            selectedCheckSession.openedBy?.name ??
            "Garson",
          guestCount: selectedCheckSession.guestCount ?? 2,
          scopeDescription: scopeDescriptionText,
          printedAt: new Date(),
          jobCode: "ÖNİZLEME",
          isReprint: false,
          items: filteredCheckItems.map((it: any) => {
            const rObj = checkRounds.find((r: any) => r.id === it.roundId);
            const cancelReq = cancelRequests.find(
              (cr) => cr.orderItemId === it.id && cr.status === "APPROVED"
            );
            return {
              roundNumber: rObj?.roundNumber ?? 1,
              sentTimeText: formatTimeOnlyTR(it.sentAt ?? it.createdAt, false),
              quantity: it.quantity ?? 1,
              receiptName:
                it.receiptNameSnapshot || it.productNameSnapshot || "Ürün",
              seatNumber: it.seatNumber,
              sharedSeats: parseJsonArray<number>(it.sharedSeatsJson),
              modifiers: parseJsonArray<string>(it.modifiersJson),
              kitchenNote: it.kitchenNote,
              isCancelled: it.status === "CANCELLED",
              cancelReason: cancelReq?.reasonCategory ?? "Onaylı iptal",
            };
          }),
        })
      : "Önizleme için servis oturumu seçin.";

    return (
      <section className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#73d8c6]">
              ADİSYON / SERVİS ÖZETİ ÖNİZLEME VE YAZDIRMA
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f0f5f3]">
              80mm Servis Özeti (Adisyon) Önizlemesi
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
              Adisyon çıktısı mutfak siparişinden ayrı bir servis özeti belgesidir. Masanın servis akışını ve sipariş detaylarını özetler.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate("SCR-08")}
              className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-2 text-xs font-bold text-[#f0f5f3]"
            >
              ← Sipariş Ayrıntısına Dön
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-[#344647] bg-[#202f30] px-3 py-2 text-xs font-bold text-[#f0f5f3]"
            >
              🖨 Tarayıcıdan 80mm Yazdır
            </button>
            <button
              type="button"
              disabled={busyAction === "print-priceless-check"}
              onClick={handlePrintPricelessCheck}
              className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-4 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110"
            >
              {busyAction === "print-priceless-check"
                ? "Kuyruğa İletiliyor..."
                : "⎙ Adisyon Yazdır"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 80mm Thermal Paper Preview */}
          <div className="rounded-xl border border-[#344647] bg-[#192526] p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[#344647] pb-2.5">
              <b className="text-xs text-[#f0f5f3]">
                80mm Termal Kâğıt Önizlemesi ({selectedCheckSession?.referenceCode ?? "—"})
              </b>
              <span className="rounded-full border border-[#3c6058] bg-[#243d39] px-2.5 py-0.5 text-[10px] font-bold text-[#bdf0e4]">
                SERVİS ÖZETİ
              </span>
            </div>

            <div
              id="alacarte-thermal-print-area"
              className="mx-auto max-w-[430px] rounded-xl border border-[#d8d3c4] bg-[#f4f2eb] p-5 font-mono text-[11.5px] leading-[1.42] text-[#1d1d1b] shadow-xl"
            >
              <pre className="whitespace-pre-wrap break-words font-mono">
                {thermalReceiptText}
              </pre>
            </div>
          </div>

          {/* Scope Controls & Strict Compliance Notices */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[#344647] bg-[#192526] p-4">
              <b className="block border-b border-[#344647] pb-2.5 text-xs text-[#f0f5f3]">
                Çıktı Kapsamı ve Hedef Kuyruk Seçimi
              </b>

              <div className="mt-3 space-y-3">
                <div>
                  <label
                    htmlFor="scr11-session-select"
                    className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                  >
                    MASA / SERVİS OTURUMU
                  </label>
                  <select
                    id="scr11-session-select"
                    value={selectedCheckSession?.id ?? ""}
                    onChange={(e) => {
                      setCheckSessionId(e.target.value);
                      setCheckRoundScope("ALL");
                    }}
                    className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                  >
                    {sessions.map((s) => {
                      const t = tables.find((tbl) => tbl.id === s.tableId);
                      return (
                        <option key={s.id} value={s.id}>
                          {t?.name ?? "Masa"} · {s.referenceCode} (
                          {s.status === "OPEN" ? "Açık Servis" : "Tamamlandı"})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="scr11-round-scope"
                    className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]"
                  >
                    KAPSANACAK SERVİS TURLARI
                  </label>
                  <select
                    id="scr11-round-scope"
                    value={checkRoundScope}
                    onChange={(e) => setCheckRoundScope(e.target.value)}
                    className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-3 py-2 text-xs text-[#f0f5f3]"
                  >
                    <option value="ALL">Tüm gönderilmiş turlar</option>
                    {checkRounds.map((r: any) => (
                      <option key={r.id} value={String(r.roundNumber)}>
                        Yalnız Tur {String(r.roundNumber).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-[#3c6259] bg-[#1c3531] p-3 text-[11px] leading-relaxed text-[#c0eee5]">
                  ● Bu işlem masanın servis dökümünü yazdırır; mutfağa yeni sipariş göndermez veya masayı kapatmaz. İptal edilen (VOID) kalemler şeffaflık için ayrı <b>İPTAL EDİLEN KALEMLER</b> bölümünde gösterilir.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // SCR-12: Rapor Merkezi (MICROS Örnekli 10 Operasyonel Rapor)
  const activeReportDef =
    REPORT_CATALOG.find((r) => r.code === selectedReportCode) ??
    REPORT_CATALOG[0];

  const activeFilterSummaryText = [
    `Rapor: ${activeReportDef.title} (${activeReportDef.code})`,
    reportDatePreset === "ALL_HISTORY" && !reportStartDate && !reportEndDate
      ? "Tarih: Tüm Tarihsel Kayıtlar (5 Yıl Sorgu Sınırı Yoktur)"
      : `Tarih Aralığı: ${reportStartDate || "Başlangıç"} → ${
          reportEndDate || "Bitiş"
        }`,
    `Garson: ${
      reportWaiterId === "ALL"
        ? "Tüm Kullanıcılar"
        : users.find((u) => u.id === reportWaiterId)?.name ?? reportWaiterId
    }`,
    `Alan/Masa: ${
      reportAreaOrTableId === "ALL"
        ? "Tüm Alanlar ve Masalar"
        : reportAreaOrTableId
    }`,
    `Kategori: ${
      reportCategoryId === "ALL"
        ? "Tüm Kategoriler"
        : categories.find((c) => c.id === reportCategoryId)?.name ??
          reportCategoryId
    }`,
  ].join("  |  ");

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#73d8c6]">
            SCR-12 · RAPOR MERKEZİ (MICROS ÖRNEKLİ 10 OPERASYONEL RAPOR)
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f0f5f3]">
            Operasyonel Raporlar ve Dışa Aktarım
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-[#9aaead]">
            Kayıtlı verilerden 10 kategoride operasyonel rapor üretin, yazdırın veya CSV olarak indirin.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="rounded-lg border border-[#344647] bg-[#202f30] px-3.5 py-2 text-xs font-bold text-[#f0f5f3] hover:border-[#73d8c6]"
          >
            ⬇ CSV İndir (.csv)
          </button>
          <button
            type="button"
            onClick={() => {
              handleRunReport("PRINT");
              window.print();
            }}
            className="rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3.5 py-2 text-xs font-extrabold text-[#10221f] hover:brightness-110"
          >
            ⎙ Raporu Yazdır
          </button>
        </div>
      </div>

      {/* 10 Interactive Report Category Cards */}
      <div className="rounded-xl border border-[#344647] bg-[#192526]">
        <div className="flex items-center justify-between border-b border-[#344647] px-4 py-3">
          <b className="text-xs text-[#f0f5f3]">
            10 Operasyonel Rapor Kategorisi
          </b>
          <small className="text-[10px] text-[#9aaead]">
            MICROS Simphony TSR operasyonel rapor akışları
          </small>
        </div>

        <div className="grid grid-cols-1 gap-2.5 p-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {REPORT_CATALOG.map((rep) => {
            const isSelected = rep.code === selectedReportCode;
            return (
              <button
                key={rep.code}
                type="button"
                onClick={() => setSelectedReportCode(rep.code)}
                className={`flex min-h-[92px] flex-col justify-between rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? "border-[#73d8c6] bg-[#213a36] shadow-md"
                    : "border-[#344647] bg-[#202e2f] hover:border-[#58b7a6]"
                }`}
              >
                <div>
                  <span className="block font-mono text-[9px] font-bold text-[#73d8c6]">
                    {rep.microsRef}
                  </span>
                  <b className="mt-0.5 block text-xs text-[#f0f5f3]">
                    {rep.title}
                  </b>
                </div>
                <small className="mt-1.5 block text-[10px] leading-snug text-[#9aaead]">
                  {rep.subtitle}
                </small>
              </button>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className="space-y-3 border-t border-[#344647] bg-[#152021] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9aaead]">
                HIZLI TARİH SEÇİMİ:
              </span>
              {[
                { id: "TODAY" as const, label: "Bugün" },
                { id: "YESTERDAY" as const, label: "Dün" },
                { id: "LAST_7_DAYS" as const, label: "Son 7 Gün" },
                {
                  id: "ALL_HISTORY" as const,
                  label: "Tüm Tarihsel Kayıtlar (Yaş Sınırsız)",
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyReportDatePreset(p.id)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                    reportDatePreset === p.id
                      ? "bg-[#73d8c6] text-[#10221f]"
                      : "border border-[#344647] bg-[#202f30] text-[#f0f5f3]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <label
                htmlFor="rep-start-date"
                className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-[#9aaead]"
              >
                BAŞLANGIÇ TARİHİ
              </label>
              <input
                id="rep-start-date"
                type="date"
                value={reportStartDate}
                onChange={(e) => {
                  setReportStartDate(e.target.value);
                  setReportDatePreset("CUSTOM");
                }}
                className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
              />
            </div>

            <div>
              <label
                htmlFor="rep-end-date"
                className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-[#9aaead]"
              >
                BİTİŞ TARİHİ
              </label>
              <input
                id="rep-end-date"
                type="date"
                value={reportEndDate}
                onChange={(e) => {
                  setReportEndDate(e.target.value);
                  setReportDatePreset("CUSTOM");
                }}
                className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
              />
            </div>

            <div>
              <label
                htmlFor="rep-waiter-select"
                className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-[#9aaead]"
              >
                GARSON / KULLANICI
              </label>
              <select
                id="rep-waiter-select"
                value={reportWaiterId}
                onChange={(e) => setReportWaiterId(e.target.value)}
                className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
              >
                <option value="ALL">Tüm Kullanıcılar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="rep-area-table-select"
                className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-[#9aaead]"
              >
                ALAN / MASA
              </label>
              <select
                id="rep-area-table-select"
                value={reportAreaOrTableId}
                onChange={(e) => setReportAreaOrTableId(e.target.value)}
                className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
              >
                <option value="ALL">Tüm Alanlar ve Masalar</option>
                {areas.map((a) => (
                  <option key={`area-${a.id}`} value={`AREA:${a.id}`}>
                    Alan: {a.name}
                  </option>
                ))}
                {tables.map((t) => (
                  <option key={`tbl-${t.id}`} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="rep-category-select"
                className="mb-1 block text-[9px] font-extrabold uppercase tracking-wider text-[#9aaead]"
              >
                ÜRÜN KATEGORİSİ
              </label>
              <select
                id="rep-category-select"
                value={reportCategoryId}
                onChange={(e) => setReportCategoryId(e.target.value)}
                className="w-full rounded-lg border border-[#3a4c4b] bg-[#101a1a] px-2.5 py-1.5 text-xs text-[#f0f5f3]"
              >
                <option value="ALL">Tüm Kategoriler</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setReportDatePreset("ALL_HISTORY");
                  setReportStartDate("");
                  setReportEndDate("");
                  setReportWaiterId("ALL");
                  setReportAreaOrTableId("ALL");
                  setReportCategoryId("ALL");
                  setReportServerResult(null);
                  notify("Rapor filtreleri temizlendi.", "teal");
                }}
                className="rounded-lg border border-[#344647] bg-[#202f30] px-2.5 py-2 text-[11px] font-bold text-[#f0f5f3]"
              >
                Filtreleri Temizle
              </button>
              <button
                type="button"
                disabled={busyAction === "run-report"}
                onClick={() => handleRunReport("VIEW")}
                className="flex-1 rounded-lg border border-[#58b7a6] bg-[#73d8c6] px-3 py-2 text-[11px] font-extrabold text-[#10221f]"
              >
                {busyAction === "run-report"
                  ? "Çalışıyor..."
                  : "Raporu Çalıştır"}
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Summary Banner */}
        <div className="border-t border-[#344647] bg-[#1c3531] px-4 py-2 text-[11px] text-[#c0eee5]">
          <b>Aktif Filtre Özeti:</b> {activeFilterSummaryText}
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-3 p-3.5 lg:grid-cols-4">
          <div className="rounded-xl border border-[#344647] bg-[#152021] p-3">
            <div className="text-[10px] font-extrabold uppercase text-[#9aaead]">
              KAPSANAN SERVİS OTURUMU
            </div>
            <strong className="mt-1 block font-mono text-xl font-extrabold text-[#f0f5f3]">
              {computedReportView.kpis.sessionsCount}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">Seçili filtre aralığı</small>
          </div>
          <div className="rounded-xl border border-[#344647] bg-[#152021] p-3">
            <div className="text-[10px] font-extrabold uppercase text-[#9aaead]">
              TOPLAM MİSAFİR / KUVER
            </div>
            <strong className="mt-1 block font-mono text-xl font-extrabold text-[#f0f5f3]">
              {computedReportView.kpis.totalGuests}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">Kayıtlı kişi sayısı</small>
          </div>
          <div className="rounded-xl border border-[#344647] bg-[#152021] p-3">
            <div className="text-[10px] font-extrabold uppercase text-[#9aaead]">
              GÖNDERİLEN MUTFAK KALEMİ
            </div>
            <strong className="mt-1 block font-mono text-xl font-extrabold text-[#f0f5f3]">
              {computedReportView.kpis.totalSentQty}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">Etkin gönderim adedi</small>
          </div>
          <div className="rounded-xl border border-[#344647] bg-[#152021] p-3">
            <div className="text-[10px] font-extrabold uppercase text-[#9aaead]">
              RAPOR SATIR SAYISI
            </div>
            <strong className="mt-1 block font-mono text-xl font-extrabold text-[#f0f5f3]">
              {computedReportView.rows.length}
            </strong>
            <small className="text-[10px] text-[#73d8c6]">Aktif veriler</small>
          </div>
        </div>

        {/* Report Data Table */}
        <div className="alacarte-table-wrapper border-t border-[#344647]">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#344647] text-[10px] font-extrabold uppercase tracking-wider text-[#91a3a0]">
                {computedReportView.columns.map((col: string, idx: number) => (
                  <th key={idx} className="px-3.5 py-2.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a3939]">
              {computedReportView.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, computedReportView.columns.length)}
                    className="p-6 text-center text-xs text-[#9aaead]"
                  >
                    Seçilen filtre kriterlerine uygun kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                computedReportView.rows.map((row: string[], rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-[#1e2d2d]">
                    {row.map((cell: string, cIdx: number) => (
                      <td key={cIdx} className="px-3.5 py-2.5 text-[11px] text-[#f0f5f3]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
export default ManagerScreensView;
