// API: GET /api/pos/forecast/products - AI napoved povpraševanja po izdelkih
// Analizira prodajo zadnjih 30 dni in priporoča naročila
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

    // Pridobi vse postavke računov v zadnjih 30 dneh
    const saleItems = await db.saleItem.findMany({
      where: {
        sale: {
          createdAt: { gte: thirtyDaysAgo },
          status: 'completed',
        },
      },
      select: {
        productId: true,
        name: true,
        quantity: true,
        total: true,
        sale: { select: { createdAt: true } },
      },
    })

    // Grupiraj po izdelkih
    const productStats: Record<string, {
      productId: string
      name: string
      totalQuantity: number
      totalRevenue: number
      saleCount: number
      dailyAvg: number
      lastSold: Date | null
    }> = {}

    for (const item of saleItems) {
      if (!item.productId) continue
      if (!productStats[item.productId]) {
        productStats[item.productId] = {
          productId: item.productId,
          name: item.name,
          totalQuantity: 0,
          totalRevenue: 0,
          saleCount: 0,
          dailyAvg: 0,
          lastSold: null,
        }
      }
      productStats[item.productId].totalQuantity += item.quantity
      productStats[item.productId].totalRevenue += item.total
      productStats[item.productId].saleCount++
      const saleDate = new Date(item.sale.createdAt)
      if (!productStats[item.productId].lastSold || saleDate > productStats[item.productId].lastSold!) {
        productStats[item.productId].lastSold = saleDate
      }
    }

    // Pridobi trenutne zaloge
    const products = await db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, stock: true, minStock: true, unit: true, price: true, category: { select: { name: true } } },
    })

    const productMap = new Map(products.map(p => [p.id, p]))

    // Generiraj priporočila
    const recommendations: Array<{
      productId: string
      name: string
      category: string
      currentStock: number
      minStock: number
      unit: string
      avgDailyDemand: number
      daysUntilStockout: number
      recommendedOrder: number
      urgency: 'critical' | 'high' | 'medium' | 'low'
      reason: string
      lastSold: string | null
      totalSold30d: number
      revenue30d: number
    }> = []

    for (const product of products) {
      const stats = productStats[product.id]
      const totalSold = stats?.totalQuantity || 0
      const dailyAvg = totalSold / 30
      const daysUntilStockout = dailyAvg > 0 ? Math.floor(product.stock / dailyAvg) : 999

      let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low'
      let reason = ''

      if (product.stock <= 0) {
        urgency = 'critical'
        reason = 'Zaloga je nič — takojšnje naročilo!'
      } else if (product.stock <= product.minStock) {
        urgency = 'critical'
        reason = `Zaloga pod minimumom (${product.stock}/${product.minStock} ${product.unit})`
      } else if (daysUntilStockout <= 3 && dailyAvg > 0) {
        urgency = 'high'
        reason = `Zaloga zadostuje le še ${daysUntilStockout} dni pri povprečni prodaji`
      } else if (daysUntilStockout <= 7 && dailyAvg > 0) {
        urgency = 'medium'
        reason = `Zaloga zadostuje še ${daysUntilStockout} dni`
      } else if (daysUntilStockout <= 14 && dailyAvg > 0) {
        urgency = 'low'
        reason = `Zaloga zadostuje še ${daysUntilStockout} dni`
      } else {
        reason = dailyAvg > 0
          ? `Zaloga zadostuje še ${daysUntilStockout} dni`
          : 'Ni prodaje v zadnjih 30 dneh'
      }

      // Priporočilo količine naročila (7-dnevna zaloga - trenutna zaloga)
      const recommendedOrder = dailyAvg > 0
        ? Math.max(0, Math.ceil(dailyAvg * 7 - product.stock))
        : 0

      recommendations.push({
        productId: product.id,
        name: product.name,
        category: product.category?.name || 'Brez kategorije',
        currentStock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
        avgDailyDemand: Math.round(dailyAvg * 100) / 100,
        daysUntilStockout: dailyAvg > 0 ? daysUntilStockout : null as any,
        recommendedOrder,
        urgency,
        reason,
        lastSold: stats?.lastSold ? stats.lastSold.toISOString() : null,
        totalSold30d: totalSold,
        revenue30d: Math.round((stats?.totalRevenue || 0) * 100) / 100,
      })
    }

    // Sortiraj po urgentnosti
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

    // Skupni povzetek
    const summary = {
      totalProducts: products.length,
      critical: recommendations.filter(r => r.urgency === 'critical').length,
      high: recommendations.filter(r => r.urgency === 'high').length,
      medium: recommendations.filter(r => r.urgency === 'medium').length,
      low: recommendations.filter(r => r.urgency === 'low').length,
      totalRecommendedOrder: recommendations.reduce((s, r) => s + r.recommendedOrder, 0),
      totalRevenue30d: recommendations.reduce((s, r) => s + r.revenue30d, 0),
    }

    return NextResponse.json({
      recommendations: recommendations.slice(0, 20), // top 20
      summary,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
