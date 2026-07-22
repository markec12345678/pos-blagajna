// API: GET /api/pos/forecast - AI napoved prodaje na podlagi zgodovinskih podatkov
// Analizira zadnjih 30 dni in napove prodajo za naslednjih 7 dni
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

    // Pridobi prodajo zadnjih 30 dni
    const sales = await db.sale.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: 'completed',
      },
      select: { total: true, createdAt: true, tips: true, paymentMethod: true },
    })

    if (sales.length === 0) {
      return NextResponse.json({
        forecast: [],
        insights: ['Ni dovolj podatkov za napoved. Zberite vsaj 7 dni prodaje.'],
        avgDaily: 0,
        trend: 'neutral',
      })
    }

    // Grupiraj po dnevih
    const dailyData: Record<string, { total: number; count: number }> = {}
    for (const sale of sales) {
      const dateKey = sale.createdAt.toISOString().slice(0, 10)
      if (!dailyData[dateKey]) dailyData[dateKey] = { total: 0, count: 0 }
      dailyData[dateKey].total += sale.total
      dailyData[dateKey].count++
    }

    const days = Object.entries(dailyData).map(([date, data]) => ({ date, ...data }))
    days.sort((a, b) => a.date.localeCompare(b.date))

    // Izračunaj povprečje po dnevih v tednu
    const dayOfWeekAvg: Record<number, { total: number; count: number }> = {}
    for (const d of days) {
      const dow = new Date(d.date).getDay()
      if (!dayOfWeekAvg[dow]) dayOfWeekAvg[dow] = { total: 0, count: 0 }
      dayOfWeekAvg[dow].total += d.total
      dayOfWeekAvg[dow].count++
    }

    // Napovej naslednjih 7 dni
    const forecast: Array<{ date: string; dayName: string; predicted: number; confidence: number }> = []
    const dayNames = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota']
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
      const dow = futureDate.getDay()
      const avg = dayOfWeekAvg[dow]
      const predicted = avg ? avg.total / avg.count : 0
      const confidence = avg ? Math.min(0.95, avg.count / 7 * 0.5 + 0.3) : 0.3
      forecast.push({
        date: futureDate.toISOString().slice(0, 10),
        dayName: dayNames[dow],
        predicted: Math.round(predicted * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
      })
    }

    // Trend analiza (zadnjih 7 dni vs prejšnjih 7 dni)
    const last7 = days.slice(-7).reduce((sum, d) => sum + d.total, 0)
    const prev7 = days.slice(-14, -7).reduce((sum, d) => sum + d.total, 0)
    let trend = 'neutral'
    let trendPercent = 0
    if (prev7 > 0) {
      trendPercent = Math.round(((last7 - prev7) / prev7) * 100)
      trend = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'neutral'
    }

    // Skupni povprečni dnevni promet
    const totalSales = sales.reduce((sum, s) => sum + s.total, 0)
    const avgDaily = days.length > 0 ? totalSales / days.length : 0

    // Insights
    const insights: string[] = []
    const bestDay = Object.entries(dayOfWeekAvg).sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)[0]
    if (bestDay) {
      insights.push(`Najboljši dan v tednu: ${dayNames[parseInt(bestDay[0])]} (povprečno ${Math.round(bestDay[1].total / bestDay[1].count)} €)`)
    }
    const worstDay = Object.entries(dayOfWeekAvg).sort((a, b) => a[1].total / a[1].count - b[1].total / b[1].count)[0]
    if (worstDay) {
      insights.push(`Najslabši dan v tednu: ${dayNames[parseInt(worstDay[0])]} (povprečno ${Math.round(worstDay[1].total / worstDay[1].count)} €)`)
    }
    if (trend === 'up') {
      insights.push(`📈 Trend narašča: +${trendPercent}% v zadnjih 7 dneh`)
    } else if (trend === 'down') {
      insights.push(`📉 Trend pada: ${trendPercent}% v zadnjih 7 dneh`)
    } else {
      insights.push(`➡️ Stabilen trend: ${trendPercent}% spremembe`)
    }
    insights.push(`Povprečni dnevni promet: ${Math.round(avgDaily)} €`)
    insights.push(`Skupno prodaj v 30 dneh: ${sales.length} računov, ${Math.round(totalSales)} €`)

    // Priporočilo za osebje
    const totalForecast = forecast.reduce((sum, f) => sum + f.predicted, 0)
    const avgForecast = totalForecast / 7
    if (avgForecast > avgDaily * 1.15) {
      insights.push(`⚠️ Napovedana višja prodaja — razmisli o dodatnem osebju`)
    } else if (avgForecast < avgDaily * 0.85) {
      insights.push(`💡 Napovedana nižja prodaja — možna optimizacija osebja`)
    }

    return NextResponse.json({
      forecast,
      insights,
      avgDaily: Math.round(avgDaily * 100) / 100,
      trend,
      trendPercent,
      historical: days.map(d => ({ date: d.date, total: Math.round(d.total * 100) / 100, count: d.count })),
      dayOfWeekStats: Object.entries(dayOfWeekAvg).map(([dow, data]) => ({
        day: dayNames[parseInt(dow)],
        dayIndex: parseInt(dow),
        avg: Math.round((data.total / data.count) * 100) / 100,
        samples: data.count,
      })).sort((a, b) => a.dayIndex - b.dayIndex),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
