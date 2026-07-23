// API: POST /api/pos/backup/auto — avtomatski backup (za cron job)
// Brez auth — zaščiten z API ključem
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-backup-api-key')
  const expectedKey = process.env.BACKUP_API_KEY

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Napačen API ključ' }, { status: 401 })
  }

  try {
    const [categories, products, tables, sales, saleItems, customers, stockMoves, expenses, settings, reservations] = await Promise.all([
      db.category.findMany(), db.product.findMany(), db.table.findMany(),
      db.sale.findMany({ take: 10000 }), db.saleItem.findMany({ take: 50000 }),
      db.customer.findMany(), db.stockMove.findMany(), db.expense.findMany(),
      db.settings.findMany(), db.reservation.findMany(),
    ])

    const backup = {
      _meta: {
        version: '2.7.0', exportedAt: new Date().toISOString(), exportedBy: 'auto-backup', auto: true,
        tables: {
          categories: categories.length, products: products.length, tables: tables.length,
          sales: sales.length, saleItems: saleItems.length, customers: customers.length,
          stockMoves: stockMoves.length, expenses: expenses.length, settings: settings.length,
          reservations: reservations.length,
        },
      },
      data: { categories, products, tables, sales, saleItems, customers, stockMoves, expenses, settings, reservations },
    }

    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    if (adminUser) {
      await logAudit({
        userId: adminUser.id, action: 'export', entityType: 'backup',
        description: `Avtomatski backup: ${Object.values(backup._meta.tables).reduce((a, b) => a + b, 0)} zapisov`,
        metadata: { ...backup._meta.tables, auto: true },
      })
    }

    return NextResponse.json({
      success: true, timestamp: backup._meta.exportedAt,
      recordCount: Object.values(backup._meta.tables).reduce((a, b) => a + b, 0),
      tables: backup._meta.tables,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
