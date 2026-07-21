// API: GET/POST/PATCH/DELETE /api/users - upravljanje uporabnikov (admin only)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, hashPassword } from '@/lib/auth'

export async function GET() {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  const users = await db.user.findMany({
    select: { id: true, username: true, name: true, email: true, role: true, active: true, lastLogin: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { username, password, name, email, role } = body
    if (!username || !password || !name) {
      return NextResponse.json({ error: 'Manjkajo obvezna polja' }, { status: 400 })
    }
    if (!['admin', 'cashier', 'chef'].includes(role)) {
      return NextResponse.json({ error: 'Napačna vloga' }, { status: 400 })
    }
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Uporabniško ime že obstaja' }, { status: 400 })
    }
    const hash = await hashPassword(password)
    const user = await db.user.create({
      data: { username, password: hash, name, email: email || null, role },
      select: { id: true, username: true, name: true, email: true, role: true, active: true },
    })
    return NextResponse.json({ user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
