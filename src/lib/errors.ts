// Global error tracking — centralizirano beleženje napak
// Beleži napake v bazo (AuditLog) in konzolo
// V produkciji: integriraj z Sentry (https://sentry.io)

interface ErrorContext {
  userId?: string
  endpoint?: string
  method?: string
  statusCode?: number
  error: string
  stack?: string
  userAgent?: string
  ipAddress?: string
  metadata?: Record<string, any>
}

/**
 * Zabeleži napako v sistem (audit log + konzola)
 */
export async function trackError(ctx: ErrorContext): Promise<void> {
  // Vedno zapiši v konzolo
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    ...ctx,
  })

  // V produkciji: pošlji v Sentry
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(new Error(ctx.error), {
  //     tags: { endpoint: ctx.endpoint, method: ctx.method },
  //     user: { id: ctx.userId },
  //     extra: ctx.metadata,
  //   })
  // }

  // Zapiši v audit log (brez čakanja — fire and forget)
  try {
    // Dynamic import da ne blokiramo
    const { db } = await import('@/lib/db')
    if (ctx.userId) {
      await db.auditLog.create({
        data: {
          userId: ctx.userId,
          action: 'error',
          entityType: 'system',
          description: `Napaka: ${ctx.error.substring(0, 200)}`,
          metadata: JSON.stringify({
            endpoint: ctx.endpoint,
            method: ctx.method,
            statusCode: ctx.statusCode,
            stack: ctx.stack?.substring(0, 500),
            ...ctx.metadata,
          }),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      })
    }
  } catch (e) {
    // Ne smemo vržiti napake iz error trackerja
    console.error('[ERROR TRACKER] Napaka pri beleženju:', e)
  }
}

/**
 * Wrapper za API route handlerje z avtomatskim error tracking
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  context?: { endpoint?: string; method?: string }
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error: any) {
      await trackError({
        endpoint: context?.endpoint,
        method: context?.method,
        error: error.message,
        stack: error.stack,
      })
      throw error
    }
  }) as T
}

/**
 * Vrne IP naslov iz Next.js zahteve
 */
export function getIpAddress(req: Request): string {
  const headers = new Headers(req.headers)
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Vrne User-Agent iz zahteve
 */
export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || 'unknown'
}
