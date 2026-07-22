// API: GET /api/pos/crm/stats - CRM analitika (admin only)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    // Skupno kupcev
    const totalCustomers = await db.customer.count()

    // Po segmentih
    const segments = await db.customer.groupBy({
      by: ['segment'],
      _count: { id: true },
      _sum: { totalSpent: true },
    })

    // Top 10 kupcev po porabi
    const topCustomers = await db.customer.findMany({
      orderBy: { totalSpent: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        segment: true,
        loyaltyPoints: true,
        totalSpent: true,
        visits: true,
        createdAt: true,
      },
    })

    // Kupci z največ interakcij
    const topInteractions = await db.customerInteraction.groupBy({
      by: ['customerId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })
    const topInteractionCustomers = await Promise.all(
      topInteractions.map(async (ti) => {
        const customer = await db.customer.findUnique({
          where: { id: ti.customerId },
          select: { id: true, name: true, segment: true },
        })
        return { ...customer, interactionCount: ti._count.id }
      })
    )

    // Interakcije po tipu
    const interactionsByType = await db.customerInteraction.groupBy({
      by: ['type'],
      _count: { id: true },
    })

    // Zadnje interakcije
    const recentInteractions = await db.customerInteraction.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, segment: true } },
      },
    })

    // Kupci rojeni ta mesec (za promocije)
    const now = new Date()
    const birthdayThisMonth = await db.customer.findMany({
      where: {
        birthday: { not: null },
      },
      select: { id: true, name: true, birthday: true, email: true, phone: true },
    })
    const birthdayFiltered = birthdayThisMonth.filter(c => {
      if (!c.birthday) return false
      const b = new Date(c.birthday)
      return b.getMonth() === now.getMonth()
    })

    // Novi kupci v zadnjih 30 dneh
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const newCustomers = await db.customer.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    })

    // Skupna poraba vseh kupcev
    const totalSpent = await db.customer.aggregate({ _sum: { totalSpent: true } })
    const totalLoyaltyPoints = await db.customer.aggregate({ _sum: { loyaltyPoints: true } })
    const totalVisits = await db.customer.aggregate({ _sum: { visits: true } })

    return NextResponse.json({
      totalCustomers,
      newCustomers,
      totalSpent: totalSpent._sum.totalSpent || 0,
      totalLoyaltyPoints: totalLoyaltyPoints._sum.loyaltyPoints || 0,
      totalVisits: totalVisits._sum.visits || 0,
      avgSpentPerCustomer: totalCustomers > 0 ? (totalSpent._sum.totalSpent || 0) / totalCustomers : 0,
      segments: segments.map(s => ({
        segment: s.segment,
        count: s._count.id,
        totalSpent: s._sum.totalSpent || 0,
      })),
      topCustomers,
      topInteractionCustomers: topInteractionCustomers.filter(Boolean),
      interactionsByType: interactionsByType.map(t => ({
        type: t.type,
        count: t._count.id,
      })),
      recentInteractions,
      birthdayThisMonth: birthdayFiltered,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
