// Avtentikacija utilities (server-side only)
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'

const COOKIE_NAME = 'pos_session'
const SESSION_DURATION_DAYS = 7

// Preprost JWT-style token (base64 payload + signature z HMAC)
// Za produkciijo uporabi pravi JWT (jose knjižnica), tu enostavno zato ker deluje
export interface SessionUser {
  id: string
  username: string
  name: string
  role: string
}

export async function hashPassword(p: string): Promise<string> {
  return bcrypt.hash(p, 10)
}

export async function verifyPassword(p: string, hash: string): Promise<boolean> {
  return bcrypt.compare(p, hash)
}

function getSecret(): string {
  return process.env.JWT_SECRET || 'pos-dev-secret-change-in-production'
}

function signToken(payload: any): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifyToken(token: string): any | null {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const expectedSig = createHmac('sha256', getSecret()).update(body).digest('base64url')
    if (sig !== expectedSig) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = signToken({
    ...user,
    exp: Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  })
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return {
    id: payload.id,
    username: payload.username,
    name: payload.name,
    role: payload.role,
  }
}

export async function requireUser(allowedRoles?: string[]): Promise<SessionUser | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (allowedRoles && !allowedRoles.includes(user.role)) return null
  return user
}

// Za API routes - vrne 401 ce ni prijavljen
export async function requireAuth(allowedRoles?: string[]): Promise<SessionUser | { error: true; status: number; message: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: true, status: 401, message: 'Niste prijavljeni' }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { error: true, status: 403, message: 'Nimate dovoljenja' }
  }
  return user
}
