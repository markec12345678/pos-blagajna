// API: POST /api/pos/ai/recommend - AI priporočila za up-selling
// Uporablja z-ai-web-dev-sdk za generiranje pametnih predlogov
// Telo: { cartItems: [{name, price, quantity}], customerName?, customerSegment?, timeOfDay? }
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { cartItems, customerSegment, timeOfDay } = body

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: 'Košarica je prazna' }, { status: 400 })
    }

    // Preberi vse aktivne izdelke iz baze
    const products = await db.product.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    })

    // Preprost algoritem za priporočila (brez AI — pristop "pogosto kupljeno skupaj")
    // 1. Analiziraj kategorije v košarici
    const cartCategoryIds = new Set<string>()
    for (const item of cartItems) {
      const product = products.find(p => p.id === item.productId || p.name === item.name)
      if (product?.categoryId) cartCategoryIds.add(product.categoryId)
    }

    // 2. Priporočila glede na čas dneva
    const hour = timeOfDay ? new Date(timeOfDay).getHours() : new Date().getHours()
    const isMorning = hour >= 6 && hour < 11
    const isLunch = hour >= 11 && hour < 15
    const isDinner = hour >= 17 && hour < 23
    const isLateNight = hour >= 23 || hour < 6

    // 3. Priporočila glede na segment kupca
    const isVip = customerSegment === 'vip'

    // Generiraj priporočila
    const recommendations: Array<{
      productId: string
      name: string
      price: number
      reason: string
      category?: string
      confidence: number
    }> = []

    for (const product of products) {
      // Preskoči izdelke, ki so že v košarici
      if (cartItems.some((it: any) => it.productId === product.id || it.name === product.name)) continue

      let reason = ''
      let confidence = 0

      // Kava + sladica (klasična kombinacija)
      if (product.category?.name === 'Kava & Čaj' && cartCategoryIds.has(products.find(p => p.category?.name === 'Sladice')?.categoryId || '')) {
        reason = 'Pogosto kupljeno skupaj s sladico'
        confidence = 0.85
      }
      // Sladica + kava
      else if (product.category?.name === 'Sladice' && cartCategoryIds.has(products.find(p => p.category?.name === 'Kava & Čaj')?.categoryId || '')) {
        reason = 'Odlična kombinacija s kavo'
        confidence = 0.85
      }
      // Burger + pijača
      else if (product.category?.name === 'Pijače' && cartCategoryIds.has(products.find(p => p.category?.name === 'Hrana')?.categoryId || '')) {
        reason = 'Pijača k hrani'
        confidence = 0.75
      }
      // Hrana + pijača
      else if (product.category?.name === 'Hrana' && cartCategoryIds.has(products.find(p => p.category?.name === 'Pijače')?.categoryId || '')) {
        reason = 'Dodaj hrano k pijači'
        confidence = 0.70
      }
      // jutranja priporočila
      else if (isMorning && product.category?.name === 'Kava & Čaj' && !cartCategoryIds.has(product.categoryId || '')) {
        reason = 'Jutranja kava — dober začetek dneva'
        confidence = 0.65
      }
      // Kosilo: glavna jed
      else if (isLunch && product.category?.name === 'Hrana' && product.price > 7) {
        reason = 'Priljubljeno kosilo'
        confidence = 0.60
      }
      // Večerja: desert
      else if (isDinner && product.category?.name === 'Sladice') {
        reason = 'Sladica za konec večerje'
        confidence = 0.55
      }
      // Pozno pijača
      else if (isLateNight && product.category?.name === 'Alkohol') {
        reason = 'Pozni večer — toplo priporočilo'
        confidence = 0.50
      }
      // VIP: premium izdelki
      else if (isVip && product.price > 10) {
        reason = 'Premium izdelek za VIP kupca'
        confidence = 0.45
      }

      if (reason && confidence > 0) {
        recommendations.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          reason,
          category: product.category?.name,
          confidence,
        })
      }
    }

    // Sortiraj po confidence in omeji na 5
    recommendations.sort((a, b) => b.confidence - a.confidence)
    const top5 = recommendations.slice(0, 5)

    // Dodaj skupni potencialni dobiček
    const potentialUpsell = top5.reduce((sum, r) => sum + r.price, 0)

    return NextResponse.json({
      recommendations: top5,
      potentialUpsell,
      context: {
        timeOfDay: isMorning ? 'jutro' : isLunch ? 'kosilo' : isDinner ? 'večerja' : 'noč',
        customerSegment: customerSegment || 'regular',
        cartValue: cartItems.reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0),
      },
    })
  } catch (e: any) {
    console.error('AI recommend error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
