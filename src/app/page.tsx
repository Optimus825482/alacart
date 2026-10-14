import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuditChainIntegrity } from "@/lib/audit";
import { getAuthenticatedActor } from "@/lib/auth-guard";
import { AlacarteWorkspace } from "@/components/AlacarteWorkspace";
import type { ScreenId } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ screen?: string }>;
}) {
  await connection();
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/login");
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedScreen = (resolvedParams?.screen?.toUpperCase() || "SCR-03") as ScreenId;

  const [
    config,
    areas,
    tables,
    categories,
    menuItems,
    modifierGroups,
    stations,
    printerQueues,
    users,
    sessions,
    cancelRequests,
    printJobs,
    auditLogs,
    backups,
    diagnosticRuns,
    auditIntegrity,
  ] = await Promise.all([
    prisma.restaurantConfig.findFirst(),
    prisma.area.findMany({
      orderBy: { displayOrder: "asc" },
    }),
    prisma.restaurantTable.findMany({
      include: { area: true },
      orderBy: { number: "asc" },
    }),
    prisma.category.findMany({
      include: { parent: true, children: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.menuItem.findMany({
      include: {
        category: { include: { parent: true } },
        station: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { options: { orderBy: { displayOrder: "asc" } } },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.modifierGroup.findMany({
      include: { options: { orderBy: { displayOrder: "asc" } } },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.kitchenStation.findMany({
      include: { printerQueue: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.printerQueue.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
    }),
    prisma.serviceSession.findMany({
      include: {
        table: { include: { area: true } },
        openedBy: true,
        completedBy: true,
        rounds: {
          include: {
            createdBy: true,
            sentBy: true,
            items: {
              include: {
                menuItem: true,
                createdBy: true,
                cancelRequests: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { roundNumber: "asc" },
        },
        items: {
          include: {
            menuItem: true,
            round: true,
            createdBy: true,
            cancelRequests: true,
          },
          orderBy: { createdAt: "asc" },
        },
        cancelRequests: {
          include: {
            requestedBy: true,
            decidedBy: true,
            orderItem: true,
            round: true,
          },
          orderBy: { requestedAt: "desc" },
        },
        printJobs: {
          include: { printerQueue: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.cancellationRequest.findMany({
      include: {
        session: { include: { table: true } },
        round: true,
        orderItem: true,
        requestedBy: true,
        decidedBy: true,
      },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.printJob.findMany({
      include: {
        printerQueue: true,
        session: { include: { table: true } },
        round: true,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.auditLog.findMany({
      orderBy: { sequenceNumber: "desc" },
      take: 100,
    }),
    prisma.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.diagnosticRun.findMany({
      include: {
        checks: { orderBy: { stepOrder: "asc" } },
        findings: { orderBy: { createdAt: "desc" } },
        repairs: { orderBy: { startedAt: "desc" } },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    verifyAuditChainIntegrity(),
  ]);

  // Serialize dates cleanly for Client Components
  const deploymentMode = process.env.DEPLOYMENT_MODE ?? "local";
  const isCoolifyDemo = deploymentMode === "coolify-demo";
  const physicalPrintingConfigured = false;
  const realBackupConfigured = false;
  const presentQueue = (queue: any) => queue && !physicalPrintingConfigured
    ? { ...queue, status: "PILOT_PENDING", spoolerStatus: "NOT_CONNECTED", lastCheckedAt: null, lastSuccessAt: null, lastErrorMessage: "Coolify demo restoran LAN'ına ve fiziksel yazıcıya bağlı değil." }
    : queue;
  const presentPrintJob = (job: any) => !physicalPrintingConfigured
    ? { ...job, status: "PENDING", submittedAt: null, completedAt: null, printerQueue: presentQueue(job.printerQueue), errorMessage: "Bu dağıtımda fiziksel yazıcıya teslim doğrulanmadı." }
    : job;
  const serialized = JSON.parse(
    JSON.stringify({
      actor,
      deploymentMode,
      config: { ...config, deploymentMode, physicalPrintingConfigured, realBackupConfigured },
      areas,
      tables,
      categories,
      menuItems,
      modifierGroups,
      stations: stations.map((station) => ({ ...station, printerQueue: presentQueue(station.printerQueue) })),
      printerQueues: printerQueues.map(presentQueue),
      users: (actor.role === "WAITER" ? users.filter((u) => u.id === actor.id) : users).map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        active: u.active,
        mustChangePassword: u.mustChangePassword,
        failedLoginCount: u.failedLoginCount,
        lockedUntil: u.lockedUntil,
        canApproveCancel: u.canApproveCancel,
        permissionsJson: u.permissionsJson,
        sessionVersion: u.sessionVersion,
        lastHeartbeatAt: isCoolifyDemo ? null : u.lastHeartbeatAt,
        lastDeviceInfo: u.lastDeviceInfo,
        lastSyncedMenuVersion: u.lastSyncedMenuVersion,
      })),
      sessions: sessions.map((session) => ({ ...session, printJobs: (session.printJobs ?? []).map(presentPrintJob) })),
      cancelRequests: actor.role === "WAITER" ? cancelRequests.filter((r) => r.requestedById === actor.id) : cancelRequests,
      printJobs: printJobs.map(presentPrintJob),
      auditLogs: actor.role === "SYSTEM_ADMIN" ? auditLogs : [],
      backups: actor.role === "SYSTEM_ADMIN" ? backups.map((backup) => !realBackupConfigured
        ? { ...backup, status: "UNVERIFIED_DEMO", verified: false, verifiedAt: null, fileSizeBytes: 0, errorMessage: "Coolify demo: doğrulanmış yedek dosyası bu dağıtımda yok." }
        : backup) : [],
      diagnosticRuns: actor.role === "SYSTEM_ADMIN" ? diagnosticRuns.map((run) => {
        const supportedChecks = new Set(["APP_RUNTIME", "DATABASE_QUERY", "BACKUP_VOLUME", "WAITER_HEARTBEAT", "PRINTER_BRIDGE", "AUDIT_HASH_CHAIN"]);
        const legacyRun = run.checks.some((check) => !supportedChecks.has(check.component));
        return {
          ...run,
          ...(legacyRun ? {
            overallStatus: "UNKNOWN",
            summaryText: "Önceki demo tanılama kaydı doğrulanmış gerçek ölçüm değildir; yeni tanılama çalıştırın.",
            checks: run.checks.map((check) => ({ ...check, status: "UNKNOWN", durationMs: 0, firstErrorAt: null, lastSuccessAt: null, maskedEvidence: "Eski/demo kaydı; gerçek cihaz/altyapı ölçümü değildir.", nextActionText: "Güncel tanılama çalıştırın." })),
          } : {}),
          findings: run.findings.map((finding) => ({ ...finding, allowlistRepairAction: null, status: "MANUAL_REQUIRED" })),
          repairs: [],
        };
      }) : [],
      auditIntegrity: actor.role === "SYSTEM_ADMIN" ? auditIntegrity : null,
    })
  );

  return (
    <AlacarteWorkspace
      initialData={serialized}
      initialScreen={requestedScreen}
    />
  );
}
