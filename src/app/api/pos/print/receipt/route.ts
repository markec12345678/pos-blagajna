// API: POST /api/pos/print/receipt - izpis računa na ESC/POS tiskalnik
// Telo: { saleId: string, language?: 'sl'|'en'|'it' }
//
// Strategija:
// 1. Preberi Settings — če je printerType='network' in printerEnabled, poskusi TCP
// 2. Če printerType='usb' ali network fail, vrni base64 za client-side WebUSB
// 3. Če printerType='browser', samo vrni success (client uporabi window.print)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { buildReceipt } from '@/lib/escpos'
import { printToNetworkPrinter } from '@/lib/network-printer'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { saleId, language = 'sl' } = body

    if (!saleId) {
      return NextResponse.json({ error: 'Manjka saleId' }, { status: 400 })
    }

    // Pridobi sale z postavkami
    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: { items: true, cashier: { select: { name: true } } },
    })
    if (!sale) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    // Pridobi nastavitve
    const settings = await db.settings.findUnique({ where: { id: 'default' } })
    if (!settings) {
      return NextResponse.json({ error: 'Nastavitve niso konfigurirane' }, { status: 500 })
    }

    // Zgeneriraj ESC/POS byte array
    const printerWidth = (settings.printerWidth === 48 ? 48 : 32) as 32 | 48
    const bytes = buildReceipt({
      receiptNo: sale.receiptNo,
      date: sale.createdAt,
      restaurantName: settings.restaurantName,
      address: settings.address || undefined,
      phone: settings.phone || undefined,
      vatNumber: settings.vatNumber || undefined,
      header: settings.receiptHeader || undefined,
      footer: settings.receiptFooter || undefined,
      items: sale.items.map(it => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        total: it.total,
        unit: it.unit,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      taxRate: sale.taxRate,
      taxAmount: sale.taxAmount,
      tips: sale.tips,
      total: sale.total,
      paymentMethod: sale.paymentMethod as 'cash' | 'card' | 'mobile',
      paidAmount: sale.paidAmount,
      changeAmount: sale.changeAmount,
      customerName: sale.customerName || undefined,
      cashierName: sale.cashier?.name,
      note: sale.note || undefined,
      printerWidth,
      language: language as 'sl' | 'en' | 'it',
    })

    const base64 = Buffer.from(bytes).toString('base64')

    // Strategija tiskanja
    let printed = false
    let printError: string | null = null
    let printMethod: 'network' | 'usb' | 'browser' = 'browser'

    // 1. Poskusi TCP/IP mrežni tiskalnik, če je konfiguriran
    if (settings.printerEnabled && settings.printerType === 'network' && settings.printerIp) {
      printMethod = 'network'
      const result = await printToNetworkPrinter(bytes, {
        ip: settings.printerIp,
        port: settings.printerPort || 9100,
        timeout: 5000,
      })
      if (result.success) {
        printed = true
      } else {
        printError = result.error || 'Napaka mrežnega tiskanja'
      }
    } else if (settings.printerEnabled && settings.printerType === 'usb') {
      printMethod = 'usb'
      // Client-side bo poslal preko WebUSB
    } else {
      printMethod = 'browser'
    }

    return NextResponse.json({
      success: true,
      printed,
      printMethod,
      printError,
      base64, // za client-side WebUSB ali debug
      bytes: bytes.length,
      receiptNo: sale.receiptNo,
    })
  } catch (e: any) {
    console.error('POST /api/pos/print/receipt error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
