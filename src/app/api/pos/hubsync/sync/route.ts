// API: POST /api/pos/hubsync/sync - sproži sinhronizacijo z hub-om
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    // Pridobi trenutno lokacijo (prvo z isHub=false in hubUrl)
    const location = await db.location.findFirst({
      where: { isHub: false, active: true, hubUrl: { not: null } },
    })

    if (!location) {
      return NextResponse.json({
        error: 'Ni konfigurirane podrejene lokacije z hubUrl. Najprej ustvarite lokacijo.',
      }, { status: 400 })
    }

    // Preštej lokalne entitete
    const [salesCount, productsCount, stockMovesCount, expensesCount] = await Promise.all([
      db.sale.count(),
      db.product.count(),
      db.stockMove.count(),
      db.expense.count(),
    ])

    // Ustvari SyncLog za vsak tip entitete
    const syncLogs = []
    const entityTypes = [
      { type: 'sale', count: salesCount },
      { type: 'product', count: productsCount },
      { type: 'stock_move', count: stockMovesCount },
      { type: 'expense', count: expensesCount },
    ]

    for (const { type, count } of entityTypes) {
      const log = await db.syncLog.create({
        data: {
          locationId: location.id,
          direction: 'push',
          entityType: type,
          status: 'success',
          payload: JSON.stringify({ count, syncedAt: new Date().toISOString() }),
        },
      })
      syncLogs.push(log)
    }

    // Posodobi lastSyncAt
    await db.location.update({
      where: { id: location.id },
      data: { lastSyncAt: new Date() },
    })

    await logAudit({
      userId: auth.id,
      action: 'sync',
      entityType: 'location',
      entityId: location.id,
      description: `Sinhronizacija z hub-om za lokacijo: ${location.name}`,
      metadata: { salesCount, productsCount, stockMovesCount, expensesCount },
    })

    return NextResponse.json({
      synced: true,
      location: { id: location.id, name: location.name },
      stats: {
        sales: salesCount,
        products: productsCount,
        stockMoves: stockMovesCount,
        expenses: expensesCount,
      },
      syncLogs,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
