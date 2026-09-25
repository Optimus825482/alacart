import { prisma } from "@/lib/prisma";

export async function logAudit(data: {
  userId?: string | null;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  restaurantId?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        userName: data.userName,
        userRole: data.userRole,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId || null,
        details: data.details || null,
        restaurantId: data.restaurantId || null,
      },
    });
  } catch (error) {
    console.error("Audit log recording error:", error);
  }
}
