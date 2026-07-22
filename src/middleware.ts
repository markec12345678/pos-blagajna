// Next.js middleware — globalni rate limiting za API endpointe
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, API_RATE_LIMIT, LOGIN_RATE_LIMIT } from '@/lib/ratelimit'

// Endpointi z posebnimi omejitvami
const STRICT_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/2fa']
const PUBLIC_ENDPOINTS = ['/api/public/', '/api/webhooks/', '/api/docs', '/api/health']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip ne-API poti
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip javne endpointe (webhooks, public menu)
  for (const pub of PUBLIC_ENDPOINTS) {
    if (pathname.startsWith(pub)) {
      return NextResponse.next()
    }
  }

  // Določi konfiguracijo glede na endpoint
  const config = STRICT_ENDPOINTS.some(ep => pathname.startsWith(ep))
    ? LOGIN_RATE_LIMIT
    : API_RATE_LIMIT

  // Preveri rate limit
  const ip = getClientIp(req)
  const key = `${pathname.split('/').slice(0, 4).join(':')}:${ip}`
  const result = checkRateLimit(key, config)

  if (!result.allowed) {
    return NextResponse.json(
      { error: `Preveč zahtevkov. Poskusite znova čez ${result.retryAfter} sekund.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Limit': String(config.maxRequests),
        },
      }
    )
  }

  // Dodaj rate limit headerje
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Limit', String(config.maxRequests))

  return response
}

export const config = {
  matcher: '/api/:path*',
}
