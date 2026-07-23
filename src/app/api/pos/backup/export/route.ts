// API: GET /api/pos/backup/export — izvozi celotno bazo v JSON
// Admin only. Vrne JSON z vsemi tabelami.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    // Pridobi vse podatke iz baze (brez gesel in občutljivih podatkov)
    const [
      users, categories, products, tables, orders, orderItems,
      sales, saleItems, customers, stockMoves, expenses,
      settings, reservations, timeEntries, shifts, locations,
      tenants, syncLogs, auditLogs, productModifiers, customerInteractions,
    ] = await Promise.all([
      db.user.findMany({ select: { id: true, username: true, name: true, email: true, role: true, active: true, lastLogin: true, createdAt: true, twoFactorEnabled: true } }),
      db.category.findMany(),
      db.product.findMany(),
      db.table.findMany(),
      db.order.findMany(),
      db.orderItem.findMany(),
      db.sale.findMany(),
      db.saleItem.findMany(),
      db.customer.findMany(),
      db.stockMove.findMany(),
      db.expense.findMany(),
      db.settings.findMany(),
      db.reservation.findMany(),
      db.timeEntry.findMany(),
      db.shift.findMany(),
      db.location.findMany(),
      db.tenant.findMany(),
      db.syncLog.findMany(),
      db.auditLog.findMany({ take: 1000 }), // omejimo audit log
      db.productModifier.findMany(),
      db.customerInteraction.findMany(),
    ])

    const backup = {
      _meta: {
        version: '2.6.0',
        exportedAt: new Date().toISOString(),
        exportedBy: auth.username,
        tables: {
          users: users.length,
          categories: categories.length,
          products: products.length,
          tables: tables.length,
          orders: orders.length,
          orderItems: orderItems.length,
          sales: sales.length,
          saleItems: saleItems.length,
          customers: customers.length,
          stockMoves: stockMoves.length,
          expenses: expenses.length,
          settings: settings.length,
          reservations: reservations.length,
          timeEntries: timeEntries.length,
          shifts: shifts.length,
          locations: locations.length,
          tenants: tenants.length,
          syncLogs: syncLogs.length,
          auditLogs: auditLogs.length,
          productModifiers: productModifiers.length,
          customerInteractions: customerInteractions.length,
        },
      },
      data: {
        users, categories, products, tables, orders, orderItems,
        sales, saleItems, customers, stockMoves, expenses,
        settings, reservations, timeEntries, shifts, locations,
        tenants, syncLogs, auditLogs, productModifiers, customerInteractions,
      },
    }

    await logAudit({
      userId: auth.id,
      action: 'export',
      entityType: 'backup',
      description: `Backup izvožen: ${Object.values(backup._meta.tables).reduce((a, b) => a + b, 0)} zapisov`,
      metadata: backup._meta.tables,
    })

    const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
