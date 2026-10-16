import { prisma } from "@/lib/db";

export interface AuditInput {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary?: string | null;
  requestId?: string | null;
  ip?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? undefined,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? undefined,
        summary: input.summary ? input.summary.slice(0, 500) : undefined,
        requestId: input.requestId ?? undefined,
        ip: input.ip ?? undefined,
      },
    });
  } catch {
    // Audit must never break the primary workflow.
  }
}
