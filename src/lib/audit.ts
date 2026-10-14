import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface AuditInput {
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  deviceSession?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  result?: "SUCCESS" | "REJECTED" | "WARNING" | "ERROR";
  reason?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  details?: string | null;
  traceId?: string;
}

export function computeAuditHash(payload: {
  prevHash: string;
  serverTimestampIso: string;
  timezone?: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  result: string;
  reason?: string;
  beforeValueJson: string;
  afterValueJson: string;
  details: string;
}): string {
  const canonical = [
    payload.prevHash,
    payload.serverTimestampIso,
    payload.timezone ?? "Asia/Nicosia",
    payload.actorId ?? "",
    payload.actorName,
    payload.actorRole,
    payload.action,
    payload.entityType,
    payload.entityId,
    payload.result,
    payload.reason ?? "",
    payload.beforeValueJson,
    payload.afterValueJson,
    payload.details,
  ].join("|");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

export async function recordAuditEvent(input: AuditInput) {
  const now = new Date();
  const serverTimestampIso = now.toISOString();
  const beforeValueJson =
    input.beforeValue !== undefined ? JSON.stringify(input.beforeValue) : "";
  const afterValueJson =
    input.afterValue !== undefined ? JSON.stringify(input.afterValue) : "";
  const result = input.result ?? "SUCCESS";
  const entityId = input.entityId ?? "";
  const details = input.details ?? "";
  const timezone = "Asia/Nicosia";

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261013::bigint)`;
    const lastEntry = await tx.auditLog.findFirst({
      orderBy: { sequenceNumber: "desc" },
      select: { entryHash: true },
    });
    const prevHash = lastEntry?.entryHash ?? "GENESIS";
    const entryHash = computeAuditHash({
      prevHash,
      serverTimestampIso,
      timezone,
      actorId: input.actorId ?? "",
      actorName: input.actorName,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId,
      result,
      reason: input.reason ?? "",
      beforeValueJson,
      afterValueJson,
      details,
    });

    return tx.auditLog.create({
      data: {
        serverTimestamp: now,
        timezone,
        traceId: input.traceId ?? crypto.randomUUID(),
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        actorRole: input.actorRole,
        deviceSession: input.deviceSession ?? "Yerel LAN Terminali",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        result,
        reason: input.reason ?? null,
        beforeValueJson: beforeValueJson || null,
        afterValueJson: afterValueJson || null,
        details: details || null,
        prevHash,
        entryHash,
      },
    });
  });
}

export async function verifyAuditChainIntegrity() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { sequenceNumber: "asc" },
  });

  let expectedPrev = "GENESIS";
  let brokenAtSequence: number | null = null;

  for (const log of logs) {
    if (log.prevHash !== expectedPrev) {
      brokenAtSequence = log.sequenceNumber;
      break;
    }
    const recomputedHash = computeAuditHash({
      prevHash: log.prevHash,
      serverTimestampIso: log.serverTimestamp.toISOString(),
      timezone: log.timezone,
      actorId: log.actorId ?? "",
      actorName: log.actorName,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? "",
      result: log.result,
      reason: log.reason ?? "",
      beforeValueJson: log.beforeValueJson ?? "",
      afterValueJson: log.afterValueJson ?? "",
      details: log.details ?? "",
    });
    // Geriye dönük uyumluluk kontrolü (eski kayıtlar varsa)
    const legacyHash = [
      log.prevHash,
      log.serverTimestamp.toISOString(),
      log.actorName,
      log.actorRole,
      log.action,
      log.entityType,
      log.entityId ?? "",
      log.result,
      log.beforeValueJson ?? "",
      log.afterValueJson ?? "",
      log.details ?? "",
    ].join("|");
    const recomputedLegacy = crypto.createHash("sha256").update(legacyHash, "utf8").digest("hex");

    if (recomputedHash !== log.entryHash && recomputedLegacy !== log.entryHash) {
      brokenAtSequence = log.sequenceNumber;
      break;
    }
    expectedPrev = log.entryHash;
  }

  return {
    verified: brokenAtSequence === null,
    totalEvents: logs.length,
    firstEventAt: logs[0]?.serverTimestamp ?? null,
    lastEventAt: logs[logs.length - 1]?.serverTimestamp ?? null,
    headHash: logs[logs.length - 1]?.entryHash ?? "GENESIS",
    brokenAtSequence,
    checkedAt: new Date(),
  };
}
