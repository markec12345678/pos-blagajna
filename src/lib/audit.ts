// Audit log helper — beleženje admin akcij za varnost in skladnost
import { db } from '@/lib/db'
import { headers } from 'next/headers'

export interface AuditContext {
  userId: string
  action: string // 'create', 'update', 'delete', 'login', 'logout', 'refund', 'storno'
  entityType: string // 'user', 'product', 'sale', 'settings', etc.
  entityId?: string
  description: string
  metadata?: Record<string, any>
}

export async function logAudit(ctx: AuditContext): Promise<void> {
  try {
    const h = await headers()
    const ipAddress = h.get('x-forwarded-for') || h.get('x-real-ip') || 'unknown'
    const userAgent = h.get('user-agent') || 'unknown'

    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        action: ctx.action,
        entityType: ctx.entityType,
        entityId: ctx.entityId || null,
        description: ctx.description,
        metadata: ctx.metadata ? JSON.stringify(ctx.metadata) : null,
        ipAddress,
        userAgent,
      },
    })
  } catch (e) {
    // Audit logging should never break the main operation
    console.error('[Audit] Failed to log:', e)
  }
}
