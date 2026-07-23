// API: GET /api/pos/performance — performance monitoring (admin only)
// Vrne metrike o zmogljivosti sistema
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const memUsage = process.memoryUsage()
    const now = Date.now()
    const uptimeSeconds = process.uptime()

    // DB metrike (število zapisov v ključnih tabelah)
    const [
      salesCount, productsCount, customersCount, ordersCount,
      activeOrdersCount, auditLogsCount, timeEntriesCount,
    ] = await Promise.all([
      db.sale.count(),
      db.product.count(),
      db.customer.count(),
      db.order.count(),
      db.order.count({ where: { status: { in: ['open', 'sent', 'preparing', 'ready'] } } }),
      db.auditLog.count(),
      db.timeEntry.count(),
    ])

    // Error count v zadnjih 24h
    const yesterday = new Date(now - 24 * 60 * 60 * 1000)
    const errors24h = await db.auditLog.count({
      where: { action: 'error', createdAt: { gte: yesterday } },
    })

    return NextResponse.json({
      system: {
        uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
        uptimeSeconds: Math.round(uptimeSeconds),
        memory: {
          rss: `${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
          external: `${(memUsage.external / 1024 / 1024).toFixed(1)} MB`,
        },
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
      },
      database: {
        sales: salesCount,
        products: productsCount,
        customers: customersCount,
        orders: ordersCount,
        activeOrders: activeOrdersCount,
        auditLogs: auditLogsCount,
        timeEntries: timeEntriesCount,
        errors24h,
      },
      features: {
        fiskalizacija: process.env.FISCAL_COUNTRY || 'NONE',
        stripe: !!process.env.STRIPE_SECRET_KEY,
        smtp: !!process.env.SMTP_HOST,
        twilio: !!process.env.TWILIO_ACCOUNT_SID,
        mailchimp: !!process.env.MAILCHIMP_API_KEY,
        redis: process.env.REDIS_URL || 'not configured',
        sentry: !!process.env.SENTRY_DSN,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
