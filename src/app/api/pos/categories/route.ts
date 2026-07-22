// API: GET /api/pos/categories - vrne vse kategorije
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const categories = await db.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json({ categories })
  } catch (e: any) {
    console.error('GET /api/pos/categories error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
