// API: GET /api/pos/reports - nadzorna plošča s povzetki prodaje
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type Range = 'today' | 'week' | 'month' | 'all'

function getRangeStart(range: Range): Date | null {
  const now = new Date()
  if (range === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (range === 'week') {
    // Začetek tedna (ponedeljek)
    const day = now.getDay() // 0=nedelja, 1=ponedeljek
    const diff = day === 0 ? 6 : day - 1
    const start = new Date(now)
    start.setDate(now.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return start
  }
  return null // all
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const rangeParam = searchParams.get('range') || 'today'
    const range: Range = (['today', 'week', 'month', 'all'].includes(rangeParam)
      ? rangeParam
      : 'today') as Range

    const start = getRangeStart(range)
    const dateFilter: any = start ? { gte: start } : {}

    // Prodaje v obdobju
    const sales = await db.sale.findMany({
      where: { createdAt: dateFilter, status: 'completed' },
      include: { items: true },
    })

    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const salesCount = sales.length
    const avgReceipt = salesCount > 0 ? totalSales / salesCount : 0
    const totalTips = sales.reduce((s, x) => s + (x.tips || 0), 0)
    const totalDiscounts = sales.reduce((s, x) => s + (x.discount || 0), 0)

    // Po načinu plačila
    const salesByPaymentMethod: Record<string, number> = { cash: 0, card: 0, mobile: 0 }
    for (const s of sales) {
      const m = s.paymentMethod as keyof typeof salesByPaymentMethod
      if (m in salesByPaymentMethod) {
        salesByPaymentMethod[m] += s.total
      }
    }

    // Po uri
    const hourBuckets: Record<number, number> = {}
    for (let h = 0; h < 24; h++) hourBuckets[h] = 0
    for (const s of sales) {
      hourBuckets[s.createdAt.getHours()] += s.total
    }
    const salesByHour = Object.entries(hourBuckets)
      .filter(([, v]) => v > 0)
      .map(([h, v]) => ({ hour: Number(h), total: v }))
      .sort((a, b) => a.hour - b.hour)

    // Top izdelki
    const productAgg: Record<string, { name: string; quantity: number; total: number }> = {}
    for (const s of sales) {
      for (const it of s.items) {
        const key = it.productId || it.name
        if (!productAgg[key]) {
          productAgg[key] = { name: it.name, quantity: 0, total: 0 }
        }
        productAgg[key].quantity += it.quantity
        productAgg[key].total += it.total
      }
    }
    const topProducts = Object.values(productAgg)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    // Stroški v obdobju
    const expenses = await db.expense.findMany({
      where: { date: dateFilter },
    })
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0)
    const netProfit = totalSales - totalExpenses

    return NextResponse.json({
      range,
      totalSales,
      salesCount,
      avgReceipt,
      totalTips,
      totalDiscounts,
      salesByPaymentMethod,
      salesByHour,
      topProducts,
      totalExpenses,
      netProfit,
    })
  } catch (e: any) {
    console.error('GET /api/pos/reports error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
