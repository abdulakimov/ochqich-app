import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function writeAuditLog(params: {
  action: AuditAction;
  userId?: string;
  deviceId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      userId: params.userId,
      deviceId: params.deviceId,
      metadata: params.metadata,
    },
  });
}
