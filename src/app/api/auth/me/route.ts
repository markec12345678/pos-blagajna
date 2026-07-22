// API: GET /api/auth/me - vrne trenutno prijavljenega uporabnika
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getCurrentUser()
  if (!session) {
    return NextResponse.json({ user: null })
  }
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, name: true, email: true, role: true, active: true },
  })
  return NextResponse.json({ user })
}
