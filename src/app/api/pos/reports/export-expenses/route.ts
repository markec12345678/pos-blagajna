// API: GET /api/pos/reports/export-expenses - izvozi stroške v CSV
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

const CATEGORY_LABELS = {
  rent: 'Najemnina',
  utilities: 'Komunalne',
  salaries: 'Plače',
  supplies: 'Dobave',
  other: 'Ostalo',
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

    const where: any = {}
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { user: { select: { name: true } } },
    })

    const headers = [
      'Datum',
      'Kategorija',
      'Opis',
      'Znesek (EUR)',
      'Uporabnik',
      'Opomba',
    ]

    const rows = expenses.map(exp => [
      new Date(exp.date).toLocaleDateString('sl-SI'),
      CATEGORY_LABELS[exp.category as keyof typeof CATEGORY_LABELS] || exp.category,
      exp.description,
      exp.amount.toFixed(2),
      exp.user?.name || '',
      exp.note || '',
    ])

    // Dodaj skupno vrstico
    const total = expenses.reduce((sum, e) => sum + e.amount, 0)
    rows.push(['', '', 'SKUPAJ', total.toFixed(2), '', ''])

    const csv = [
      headers.map(escapeCsv).join(';'),
      ...rows.map(row => row.map(escapeCsv).join(';')),
    ].join('\n')

    const bom = '\uFEFF'
    const csvContent = bom + csv

    const filename = `stroski-${from || 'zacetek'}-do-${to || 'konec'}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: any) {
    console.error('GET /api/pos/reports/export-expenses error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
