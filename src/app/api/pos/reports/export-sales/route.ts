// API: GET /api/pos/reports/export-sales - izvozi prodajo v CSV
// Query parametri: ?from=2026-01-01&to=2026-12-31&format=csv
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const format = searchParams.get('format') || 'csv'

    const where: any = {}
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = toDate
      }
    }

    const sales = await db.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, cashier: { select: { name: true } } },
    })

    if (format === 'json') {
      return NextResponse.json({ sales, count: sales.length })
    }

    // CSV generiranje
    const headers = [
      'Št. računa',
      'Datum',
      'Čas',
      'Blagajnik',
      'Kupec',
      'Vrednost (EUR)',
      'Popust (EUR)',
      'DDV (EUR)',
      'Napitnina (EUR)',
      'Skupaj (EUR)',
      'Način plačila',
      'Plačano (EUR)',
      'Vračilo (EUR)',
      'Status',
      'Št. postavk',
      'Postavke',
    ]

    const rows = sales.map(sale => [
      sale.receiptNo,
      new Date(sale.createdAt).toLocaleDateString('sl-SI'),
      new Date(sale.createdAt).toLocaleTimeString('sl-SI'),
      sale.cashier?.name || '',
      sale.customerName || '',
      sale.subtotal.toFixed(2),
      sale.discount.toFixed(2),
      sale.taxAmount.toFixed(2),
      sale.tips.toFixed(2),
      sale.total.toFixed(2),
      sale.paymentMethod === 'cash' ? 'Gotovina' : sale.paymentMethod === 'card' ? 'Kartica' : 'Mobilno',
      sale.paidAmount.toFixed(2),
      sale.changeAmount.toFixed(2),
      sale.status === 'completed' ? 'Zaključen' : sale.status === 'refunded' ? 'Storniran' : sale.status,
      sale.items.length,
      sale.items.map(it => `${it.quantity}× ${it.name}`).join(' | '),
    ])

    const csv = [
      headers.map(escapeCsv).join(';'),
      ...rows.map(row => row.map(escapeCsv).join(';')),
    ].join('\n')

    // BOM za pravilno prikazovanje šumnikov v Excelu
    const bom = '\uFEFF'
    const csvContent = bom + csv

    const filename = `prodaja-${from || 'zacetek'}-do-${to || 'konec'}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: any) {
    console.error('GET /api/pos/reports/export-sales error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
