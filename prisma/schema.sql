-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SYSTEM_ADMIN', 'RESTAURANT_MANAGER', 'WAITER');

-- CreateEnum
CREATE TYPE "TableOperationalStatus" AS ENUM ('EMPTY', 'IN_SERVICE', 'DRAFT_PENDING', 'SCHEDULED_PENDING', 'PRINT_PENDING', 'PRINT_WARNING', 'CANCEL_PENDING');

-- CreateEnum
CREATE TYPE "ServiceSessionStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('DRAFT', 'HELD', 'SCHEDULED', 'OVERDUE', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('DRAFT', 'HELD', 'SCHEDULED', 'OVERDUE', 'SENT', 'CANCEL_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CancelRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PrintJobType" AS ENUM ('KITCHEN_ORDER', 'KITCHEN_VOID', 'PRICELESS_CHECK', 'TEST_PRINT', 'REPORT_PRINT');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'SENDING', 'SUBMITTED_TO_OS_QUEUE', 'ERROR', 'UNCERTAIN', 'REPRINTED');

-- CreateEnum
CREATE TYPE "BackupTargetType" AS ENUM ('USB', 'LOCAL_DIR');

-- CreateEnum
CREATE TYPE "DiagnosticStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'WARNING', 'FAILED', 'UNKNOWN', 'SKIPPED', 'STOPPED');

-- CreateTable
CREATE TABLE "RestaurantConfig" (
    "id" TEXT NOT NULL DEFAULT 'local-restaurant-config',
    "name" TEXT NOT NULL DEFAULT 'Merit Garden · A La Carte',
    "code" TEXT NOT NULL DEFAULT 'MERIT_GARDEN_LOCAL',
    "description" TEXT DEFAULT 'Yerel kapalı LAN restoran operasyon sistemi (İnternet, PMS ve ödeme bağlantısız)',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Nicosia',
    "setupCompleted" BOOLEAN NOT NULL DEFAULT true,
    "setupKeyHash" TEXT,
    "learningModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shiftCancelDelegate" BOOLEAN NOT NULL DEFAULT false,
    "menuVersion" INTEGER NOT NULL DEFAULT 1,
    "retentionDays" INTEGER NOT NULL DEFAULT 1825,
    "usbBackupPath" TEXT NOT NULL DEFAULT '/mnt/usb/alacarte/backups',
    "localBackupPath" TEXT NOT NULL DEFAULT '/var/lib/alacarte/backups',
    "maxBackupCopies" INTEGER NOT NULL DEFAULT 15,
    "appVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "dbSchemaVersion" TEXT NOT NULL DEFAULT 'db-19',
    "hardwareTopologyJson" TEXT NOT NULL DEFAULT '{}',
    "certificateValidTo" TIMESTAMP(3) NOT NULL DEFAULT (NOW() + interval '1 year'),
    "serverStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "TableOperationalStatus" NOT NULL DEFAULT 'EMPTY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastActivityAt" TIMESTAMP(3),
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "pinHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'WAITER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "canApproveCancel" BOOLEAN NOT NULL DEFAULT false,
    "permissionsJson" TEXT NOT NULL DEFAULT '{}',
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastDeviceInfo" TEXT,
    "lastSyncedMenuVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL DEFAULT 'Restoran Terminali',
    "ipAddress" TEXT NOT NULL DEFAULT '192.168.10.1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrinterQueue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "osQueueName" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "deviceModel" TEXT NOT NULL DEFAULT 'Epson TM-T20III (011)',
    "printServerModel" TEXT,
    "bridgeApModel" TEXT,
    "routerModel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "spoolerStatus" TEXT NOT NULL DEFAULT 'RUNNING',
    "pendingJobCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "printerQueueId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "receiptName" TEXT NOT NULL,
    "description" TEXT,
    "allergens" TEXT,
    "dietaryTags" TEXT,
    "productClass" TEXT NOT NULL DEFAULT 'STANDARD',
    "askSeatOnAdd" BOOLEAN NOT NULL DEFAULT false,
    "isShareable" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is86ed" BOOLEAN NOT NULL DEFAULT false,
    "availableCount" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "menuVersion" INTEGER NOT NULL DEFAULT 1,
    "categoryId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 3,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualifier" TEXT NOT NULL DEFAULT 'DEFAULT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemModifierGroup" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,

    CONSTRAINT "MenuItemModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSession" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" "ServiceSessionStatus" NOT NULL DEFAULT 'OPEN',
    "guestCount" INTEGER NOT NULL DEFAULT 2,
    "seatCount" INTEGER NOT NULL DEFAULT 2,
    "serviceType" TEXT NOT NULL DEFAULT 'MASA_SERVISI',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "openedById" TEXT NOT NULL,
    "completedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT,
    "holdEntireRound" BOOLEAN NOT NULL DEFAULT false,
    "isRush" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "scheduledById" TEXT,
    "overdueAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "receiptNameSnapshot" TEXT NOT NULL,
    "stationNameSnapshot" TEXT NOT NULL,
    "allergensSnapshot" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "seatNumber" INTEGER,
    "sharedSeatsJson" TEXT,
    "modifiersJson" TEXT NOT NULL DEFAULT '[]',
    "kitchenNote" TEXT,
    "isRush" BOOLEAN NOT NULL DEFAULT false,
    "status" "ItemStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "scheduledById" TEXT,
    "overdueAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL DEFAULT 1,
    "reasonCategory" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "CancelRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "voidPrintJobId" TEXT,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "jobCode" TEXT NOT NULL,
    "jobType" "PrintJobType" NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'SUBMITTED_TO_OS_QUEUE',
    "printerQueueId" TEXT NOT NULL,
    "stationName" TEXT,
    "sessionId" TEXT,
    "roundId" TEXT,
    "cancelRequestId" TEXT,
    "idempotencyKey" TEXT,
    "isReprint" BOOLEAN NOT NULL DEFAULT false,
    "originalJobId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "contentSnapshot" TEXT NOT NULL,
    "scopeDescription" TEXT,
    "sessionVersionSnapshot" INTEGER,
    "requestedById" TEXT,
    "actorName" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "sequenceNumber" SERIAL NOT NULL,
    "serverTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Nicosia',
    "traceId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "deviceSession" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "reason" TEXT,
    "beforeValueJson" TEXT,
    "afterValueJson" TEXT,
    "details" TEXT,
    "prevHash" TEXT NOT NULL DEFAULT 'GENESIS',
    "entryHash" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "backupCode" TEXT NOT NULL,
    "targetType" "BackupTargetType" NOT NULL,
    "targetPath" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'AUTO_DAILY',
    "appVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "dbSchemaVersion" TEXT NOT NULL DEFAULT 'db-19',
    "recordCountSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "manifestHash" TEXT NOT NULL,
    "encryptedKeyVersion" TEXT NOT NULL DEFAULT 'KEY-2026-V1',
    "fileSizeBytes" INTEGER NOT NULL DEFAULT 48234496,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedOutAt" TIMESTAMP(3),
    "createdById" TEXT,
    "actorName" TEXT NOT NULL DEFAULT 'SİSTEM',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticRun" (
    "id" TEXT NOT NULL,
    "runCode" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "overallStatus" "DiagnosticStatus" NOT NULL DEFAULT 'PASSED',
    "stoppedByUser" BOOLEAN NOT NULL DEFAULT false,
    "summaryText" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiagnosticRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticCheck" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "component" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DiagnosticStatus" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "durationMs" INTEGER NOT NULL DEFAULT 42,
    "eventCode" TEXT NOT NULL,
    "firstErrorAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "maskedEvidence" TEXT NOT NULL,
    "affectedFunction" TEXT NOT NULL,
    "nextActionText" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "probableCause" TEXT NOT NULL,
    "confidenceLevel" TEXT NOT NULL DEFAULT 'Yüksek (%90)',
    "userExplanation" TEXT NOT NULL,
    "manualSteps" TEXT NOT NULL,
    "allowlistRepairAction" TEXT,
    "repairPrerequisites" TEXT,
    "repairImpact" TEXT,
    "rollbackMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairRun" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "diagnosticRunId" TEXT NOT NULL,
    "findingId" TEXT,
    "allowlistAction" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "usbBackupId" TEXT NOT NULL,
    "localBackupId" TEXT NOT NULL,
    "usbManifestHash" TEXT NOT NULL,
    "localManifestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "beforeStateJson" TEXT NOT NULL,
    "afterStateJson" TEXT NOT NULL,
    "postVerifyPassed" BOOLEAN NOT NULL DEFAULT true,
    "resultSummary" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExecution" (
    "id" TEXT NOT NULL,
    "reportCode" TEXT NOT NULL,
    "reportTitle" TEXT NOT NULL,
    "reportVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "filtersJson" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "exportFormat" TEXT NOT NULL DEFAULT 'VIEW',
    "executedById" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_name_key" ON "Area"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_number_key" ON "RestaurantTable"("number");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_name_key" ON "RestaurantTable"("name");

-- CreateIndex
CREATE INDEX "RestaurantTable_areaId_idx" ON "RestaurantTable"("areaId");

-- CreateIndex
CREATE INDEX "RestaurantTable_status_idx" ON "RestaurantTable"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PrinterQueue_name_key" ON "PrinterQueue"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenStation_name_key" ON "KitchenStation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenStation_code_key" ON "KitchenStation"("code");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_stationId_idx" ON "MenuItem"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "ModifierGroup_name_key" ON "ModifierGroup"("name");

-- CreateIndex
CREATE INDEX "ModifierOption_groupId_idx" ON "ModifierOption"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemModifierGroup_menuItemId_modifierGroupId_key" ON "MenuItemModifierGroup"("menuItemId", "modifierGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSession_referenceCode_key" ON "ServiceSession"("referenceCode");

-- CreateIndex
CREATE INDEX "ServiceSession_tableId_status_idx" ON "ServiceSession"("tableId", "status");

-- CreateIndex
CREATE INDEX "ServiceSession_status_openedAt_idx" ON "ServiceSession"("status", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRound_idempotencyKey_key" ON "ServiceRound"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ServiceRound_sessionId_roundNumber_idx" ON "ServiceRound"("sessionId", "roundNumber");

-- CreateIndex
CREATE INDEX "ServiceRound_status_scheduledAt_idx" ON "ServiceRound"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "OrderItem_sessionId_idx" ON "OrderItem"("sessionId");

-- CreateIndex
CREATE INDEX "OrderItem_roundId_idx" ON "OrderItem"("roundId");

-- CreateIndex
CREATE INDEX "OrderItem_status_idx" ON "OrderItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationRequest_referenceCode_key" ON "CancellationRequest"("referenceCode");

-- CreateIndex
CREATE INDEX "CancellationRequest_status_requestedAt_idx" ON "CancellationRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "CancellationRequest_sessionId_idx" ON "CancellationRequest"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_jobCode_key" ON "PrintJob"("jobCode");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_idempotencyKey_key" ON "PrintJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PrintJob_status_createdAt_idx" ON "PrintJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrintJob_sessionId_idx" ON "PrintJob"("sessionId");

-- CreateIndex
CREATE INDEX "PrintJob_printerQueueId_idx" ON "PrintJob"("printerQueueId");

-- CreateIndex
CREATE INDEX "AuditLog_serverTimestamp_idx" ON "AuditLog"("serverTimestamp");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BackupRecord_targetType_status_createdAt_idx" ON "BackupRecord"("targetType", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticRun_runCode_key" ON "DiagnosticRun"("runCode");

-- CreateIndex
CREATE INDEX "DiagnosticCheck_runId_stepOrder_idx" ON "DiagnosticCheck"("runId", "stepOrder");

-- CreateIndex
CREATE INDEX "DiagnosticFinding_runId_idx" ON "DiagnosticFinding"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairRun_repairId_key" ON "RepairRun"("repairId");

-- CreateIndex
CREATE INDEX "ReportExecution_executedAt_idx" ON "ReportExecution"("executedAt");

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenStation" ADD CONSTRAINT "KitchenStation_printerQueueId_fkey" FOREIGN KEY ("printerQueueId") REFERENCES "PrinterQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifierGroup" ADD CONSTRAINT "MenuItemModifierGroup_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSession" ADD CONSTRAINT "ServiceSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSession" ADD CONSTRAINT "ServiceSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSession" ADD CONSTRAINT "ServiceSession_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRound" ADD CONSTRAINT "ServiceRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRound" ADD CONSTRAINT "ServiceRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRound" ADD CONSTRAINT "ServiceRound_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ServiceRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ServiceRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_printerQueueId_fkey" FOREIGN KEY ("printerQueueId") REFERENCES "PrinterQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ServiceRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCheck" ADD CONSTRAINT "DiagnosticCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiagnosticRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticFinding" ADD CONSTRAINT "DiagnosticFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiagnosticRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRun" ADD CONSTRAINT "RepairRun_diagnosticRunId_fkey" FOREIGN KEY ("diagnosticRunId") REFERENCES "DiagnosticRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

