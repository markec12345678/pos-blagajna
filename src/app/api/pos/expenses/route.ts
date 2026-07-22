// API: GET/POST /api/pos/expenses - stroški
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

const VALID_CATEGORIES = ['rent', 'utilities', 'salaries', 'supplies', 'other']

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (category) where.category = category
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        user: { select: { id: true, username: true, name: true } },
      },
    })

    const total = expenses.reduce((sum, e) => sum + e.amount, 0)
    return NextResponse.json({ expenses, total })
  } catch (e: any) {
    console.error('GET /api/pos/expenses error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { category, description, amount, date, note } = body as {
      category: string
      description: string
      amount: number
      date?: string
      note?: string
    }

    if (!category || !description || amount === undefined) {
      return NextResponse.json(
        { error: 'Manjkajo obvezna polja (category, description, amount)' },
        { status: 400 }
      )
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Neveljaven stroškov. Dovoljeni: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      )
    }
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Znesek mora biti pozitivno število' },
        { status: 400 }
      )
    }

    const expense = await db.expense.create({
      data: {
        category,
        description,
        amount: numAmount,
        date: date ? new Date(date) : new Date(),
        userId: auth.id,
        note: note || null,
      },
      include: {
        user: { select: { id: true, username: true, name: true } },
      },
    })
    return NextResponse.json({ expense }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/pos/expenses error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
