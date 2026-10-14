import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { Role } from "@prisma/client";

export interface AuthenticatedActor {
  id: string;
  username: string;
  name: string;
  role: Role;
  canApproveCancel: boolean;
  active: boolean;
}

const SESSION_COOKIE = "alacarte_session";

export async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  } catch {
    // Next.js request store dışındaki (CLI veya test betikleri) çağrılar
    return null;
  }

  if (!token || token.length < 40) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  const now = new Date();
  const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 saat boşta kalma süresi
  const isIdleExpired = session?.lastSeenAt && (now.getTime() - session.lastSeenAt.getTime() > IDLE_TIMEOUT_MS);

  if (
    !session || session.revokedAt || session.expiresAt <= now || isIdleExpired ||
    !session.user.active || session.user.lockedUntil && session.user.lockedUntil > now
  ) {
    if (session && !session.revokedAt && isIdleExpired) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      }).catch(() => null);
    }
    return null;
  }

  // Oturum son görülme zamanını tazele (arka planda)
  prisma.userSession.update({
    where: { id: session.id },
    data: { lastSeenAt: now },
  }).catch(() => null);

  return {
    id: session.user.id,
    username: session.user.username,
    name: session.user.name,
    role: session.user.role,
    canApproveCancel: session.user.canApproveCancel,
    active: session.user.active,
  };
}

export async function requireRole(
  actorUserId: string | undefined | null,
  allowedRoles: Role[],
  actionName: string,
  entityType: string,
  entityId?: string
): Promise<AuthenticatedActor> {
  let sessionActor = await getAuthenticatedActor();

  // Test ve CLI ortamlarında (cookie store olmadığı durumlarda) aktör doğrulaması
  if (!sessionActor && actorUserId && (process.env.NODE_ENV !== "production" || process.env.ALACARTE_TEST === "1")) {
    const fallbackUser = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (fallbackUser && fallbackUser.active) {
      sessionActor = {
        id: fallbackUser.id,
        username: fallbackUser.username,
        name: fallbackUser.name,
        role: fallbackUser.role,
        canApproveCancel: fallbackUser.canApproveCancel,
        active: fallbackUser.active,
      };
    }
  }

  if (!sessionActor || !actorUserId || actorUserId !== sessionActor.id) {
    await recordAuditEvent({
      actorName: "BİLİNMEYEN",
      actorRole: "UNAUTHENTICATED",
      action: `${actionName}_AUTH_DENIED`,
      entityType,
      entityId,
      result: "REJECTED",
      reason: "Oturum açık değil veya kullanıcı kimliği eksik",
    });
    throw new Error("Bu işlem için kişisel hesabınızla oturum açmanız gerekiyor.");
  }

  const user = await prisma.user.findUnique({ where: { id: sessionActor.id } });

  if (!user || !user.active) {
    await recordAuditEvent({
      actorId: user?.id ?? null,
      actorName: user?.name ?? "PASİF_KULLANICI",
      actorRole: user?.role ?? "UNKNOWN",
      action: `${actionName}_ACCOUNT_INACTIVE`,
      entityType,
      entityId,
      result: "REJECTED",
      reason: "Kullanıcı hesabı devre dışı veya bulunamadı",
    });
    throw new Error("Kullanıcı hesabınız devre dışı bırakılmış veya oturumunuz sonlandırılmış.");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: `${actionName}_ACCOUNT_LOCKED`,
      entityType,
      entityId,
      result: "REJECTED",
      reason: "Hesap çok sayıda başarısız giriş nedeniyle geçici kilitli",
    });
    throw new Error("Hesabınız geçici olarak kilitlidir. Yerel sistem yöneticisine başvurun.");
  }

  if (!allowedRoles.includes(user.role)) {
    await recordAuditEvent({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: `${actionName}_ROLE_FORBIDDEN`,
      entityType,
      entityId,
      result: "REJECTED",
      reason: `Rol (${user.role}) bu işlem için yetkili değil. Gerekli roller: ${allowedRoles.join(", ")}`,
    });
    throw new Error(`Yetki reddedildi: Bu işlem yalnız [${allowedRoles.join(", ")}] rolü tarafından yapılabilir.`);
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    canApproveCancel: user.canApproveCancel,
    active: user.active,
  };
}
