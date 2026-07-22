// API: POST /api/pos/sales/[id]/refund - storno/refund računa
// - admin only
// - označi sale kot 'refunded'
// - vrne zaloge (poveča stock za vse postavke)
// - če je sale povezan z Order, označi Order kot 'cancelled'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason = body.reason || 'Brez razloga'

    // Pridobi sale z postavkami
    const sale = await db.sale.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }
    if (sale.status === 'refunded') {
      return NextResponse.json({ error: 'Račun je že storniran' }, { status: 400 })
    }
    if (sale.status === 'voided') {
      return NextResponse.json({ error: 'Račun je že razveljavljen' }, { status: 400 })
    }

    // Transakcijsko storniraj
    const result = await db.$transaction(async (tx) => {
      // 1. Označi sale kot refunded
      const updated = await tx.sale.update({
        where: { id },
        data: {
          status: 'refunded',
          note: (sale.note ? sale.note + '\n\n' : '') + `[STORNO ${new Date().toISOString()}] Razlog: ${reason}`,
        },
        include: { items: true },
      })

      // 2. Vrni zaloge
      for (const item of sale.items) {
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } })
          if (product) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: product.stock + item.quantity },
            })
          }
        }
      }

      // 3. Če je povezan z Order, označi tudi Order kot cancelled
      if (sale.orderId) {
        await tx.order.update({
          where: { id: sale.orderId },
          data: { status: 'cancelled' },
        })
      }

      // 4. Posodobi strankine točke (vrni)
      if (sale.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: sale.customerId } })
        if (customer) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              totalSpent: Math.max(0, customer.totalSpent - sale.total),
              visits: Math.max(0, customer.visits - 1),
              loyaltyPoints: Math.max(0, customer.loyaltyPoints - Math.floor(sale.total)),
            },
          })
        }
      }

      // 5. Zapiši StockMove za vračilo (adjustment)
      for (const item of sale.items) {
        if (item.productId) {
          await tx.stockMove.create({
            data: {
              productId: item.productId,
              type: 'adjustment',
              quantity: item.quantity, // pozitivno = povečanje
              reason: `Storno računa ${sale.receiptNo}: ${reason}`,
              userId: auth.id,
            },
          })
        }
      }

      return updated
    })

    return NextResponse.json({
      sale: result,
      message: `Račun ${sale.receiptNo} je bil uspešno storniran`,
    })
  } catch (e: any) {
    console.error('POST /api/pos/sales/[id]/refund error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
