// API: POST /api/pos/print/receipt - izpis računa na ESC/POS tiskalnik preko mreže
// Telo: { saleId: string }
// Prebere sale iz baze, zgenerira ESC/POS byte array, pošlje na tiskalnik preko TCP
//
// Tiskalnik mora biti konfiguriran v Settings (printerIp, printerPort)
// Če printerIp ni nastavljen, vrne byte array kot base64 (za client-side WebUSB)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { buildReceipt, buildTestPrint } from '@/lib/escpos'
import * as net from 'net'

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
      printerWidth: 32, // 58mm privzeto
      language: language as 'sl' | 'en' | 'it',
    })

    // Če imamo IP tiskalnika, pošlji preko TCP
    // (v sandboxu bo to verjetno failalo — vendar vračamo tudi base64 za client-side)
    const base64 = Buffer.from(bytes).toString('base64')
    let printed = false
    let printError: string | null = null

    // Trenutno ne pošiljamo preko TCP, ker nimamo IP shranjenega v Settings.
    // To bo implementirano, ko bomo dodali printerIp polje v Settings model.
    // Zaenkrat vračamo base64, ki ga klient lahko uporabi z WebUSB.

    return NextResponse.json({
      success: true,
      printed, // ali je bilo tiskano preko TCP
      printError, // napaka TCP tiskanja, če obstaja
      base64, // za client-side WebUSB ali debug
      bytes: bytes.length, // število byte-ov
      receiptNo: sale.receiptNo,
    })
  } catch (e: any) {
    console.error('POST /api/pos/print/receipt error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
