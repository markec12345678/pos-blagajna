// API: GET /api/pos/analytics - napredna analitika prodaje
// Heatmap prodaje po dnevih v tednu in urah, analiza košarice, trendi
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Pridobi prodajo z postavkami
    const sales = await db.sale.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: 'completed',
      },
      include: {
        items: { select: { name: true, quantity: true, total: true, productId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 1. HEATMAP: prodaja po dnevu v tednu × uri
    const dayNames = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))

    for (const sale of sales) {
      const day = sale.createdAt.getDay()
      const hour = sale.createdAt.getHours()
      heatmap[day][hour] += sale.total
    }

    // 2. ANALIZA KOŠARICE (basket analysis)
    // Pogoste kombinacije izdelkov
    const pairCounts: Record<string, { count: number; revenue: number }> = {}
    const basketSizes: number[] = []
    const basketValues: number[] = []

    for (const sale of sales) {
      basketSizes.push(sale.items.length)
      basketValues.push(sale.total)

      // Pari izdelkov
      const items = sale.items.map(i => i.name).sort()
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const key = `${items[i]} + ${items[j]}`
          if (!pairCounts[key]) pairCounts[key] = { count: 0, revenue: 0 }
          pairCounts[key].count++
          pairCounts[key].revenue += sale.total
        }
      }
    }

    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([pair, data]) => ({
        pair,
        count: data.count,
        avgRevenue: Math.round((data.revenue / data.count) * 100) / 100,
      }))

    const avgBasketSize = basketSizes.length > 0
      ? basketSizes.reduce((a, b) => a + b, 0) / basketSizes.length
      : 0
    const avgBasketValue = basketValues.length > 0
      ? basketValues.reduce((a, b) => a + b, 0) / basketValues.length
      : 0

    // 3. TRENDI IZDELKOV (7-dnevni trendi)
    const productTrends: Record<string, {
      name: string
      last7days: number
      prev7days: number
      trend: string
      trendPercent: number
    }> = {}

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    for (const sale of sales) {
      const isLast7 = sale.createdAt >= sevenDaysAgo
      const isPrev7 = sale.createdAt >= fourteenDaysAgo && sale.createdAt < sevenDaysAgo

      for (const item of sale.items) {
        if (!item.productId) continue
        if (!productTrends[item.productId]) {
          productTrends[item.productId] = { name: item.name, last7days: 0, prev7days: 0, trend: 'neutral', trendPercent: 0 }
        }
        if (isLast7) productTrends[item.productId].last7days += item.quantity
        if (isPrev7) productTrends[item.productId].prev7days += item.quantity
      }
    }

    // Izračunaj trend
    const trends = Object.values(productTrends).map(t => {
      if (t.prev7days > 0) {
        t.trendPercent = Math.round(((t.last7days - t.prev7days) / t.prev7days) * 100)
        t.trend = t.trendPercent > 10 ? 'up' : t.trendPercent < -10 ? 'down' : 'stable'
      } else if (t.last7days > 0) {
        t.trend = 'new'
      }
      return t
    })

    const topTrending = trends
      .sort((a, b) => Math.abs(b.trendPercent) - Math.abs(a.trendPercent))
      .slice(0, 10)

    // 4. UČNE URE (peak hours)
    const hourlyTotals: Array<{ hour: number; total: number; count: number }> = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, count: 0 }))
    for (const sale of sales) {
      const h = sale.createdAt.getHours()
      hourlyTotals[h].total += sale.total
      hourlyTotals[h].count++
    }
    const peakHours = hourlyTotals
      .filter(h => h.count > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(h => ({
        hour: `${h.hour}:00`,
        total: Math.round(h.total * 100) / 100,
        avgPerSale: h.count > 0 ? Math.round((h.total / h.count) * 100) / 100 : 0,
        count: h.count,
      }))

    // 5. DNEVNI PROMET (30 dni)
    const dailyRevenue: Array<{ date: string; total: number; count: number }> = []
    const dailyMap: Record<string, { total: number; count: number }> = {}
    for (const sale of sales) {
      const dateKey = sale.createdAt.toISOString().slice(0, 10)
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { total: 0, count: 0 }
      dailyMap[dateKey].total += sale.total
      dailyMap[dateKey].count++
    }
    for (const [date, data] of Object.entries(dailyMap)) {
      dailyRevenue.push({ date, total: Math.round(data.total * 100) / 100, count: data.count })
    }
    dailyRevenue.sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      heatmap: heatmap.map((hours, dayIndex) => ({
        day: dayNames[dayIndex],
        dayIndex,
        hours: hours.map((total, hour) => ({ hour, total: Math.round(total * 100) / 100 })),
      })),
      basketAnalysis: {
        avgBasketSize: Math.round(avgBasketSize * 100) / 100,
        avgBasketValue: Math.round(avgBasketValue * 100) / 100,
        totalSales: sales.length,
        topPairs,
      },
      productTrends: topTrending,
      peakHours,
      dailyRevenue,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
