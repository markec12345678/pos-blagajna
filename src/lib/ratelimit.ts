// Rate limiting — preprost in-memory rate limiter za API route
// Za produkcijo: uporabi Redis ali podobno perzistentno shrambo

interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
  blockedUntil: number
}

const attempts = new Map<string, RateLimitEntry>()

// Očisti stare vnose vsakih 5 minut
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of attempts.entries()) {
    if (entry.resetTime < now && (!entry.blocked || entry.blockedUntil < now)) {
      attempts.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  maxRequests: number  // največje število zahtevkov v oknu
  windowMs: number     // velikost okna v ms
  blockMs: number      // kako dolgo blokiramo po prekoračitvi
}

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 5,       // 5 poskusov
  windowMs: 60 * 1000,  // v 1 minuti
  blockMs: 15 * 60 * 1000, // blokada 15 minut
}

export const API_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,     // 100 zahtevkov
  windowMs: 60 * 1000,  // v 1 minuti
  blockMs: 60 * 1000,   // blokada 1 minuta
}

/**
 * Preveri ali je IP blokiran ali je prekoračil limit.
 * Vrne: { allowed, remaining, retryAfter }
 */
export function checkRateLimit(key: string, config: RateLimitConfig): {
  allowed: boolean
  remaining: number
  retryAfter: number // sekunde do ponovnega dovoljenja
} {
  const now = Date.now()
  const entry = attempts.get(key)

  // Če je blokiran
  if (entry?.blocked && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    }
  }

  // Če je okno poteklo, ponastavi
  if (!entry || entry.resetTime < now) {
    attempts.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      blocked: false,
      blockedUntil: 0,
    })
    return { allowed: true, remaining: config.maxRequests - 1, retryAfter: 0 }
  }

  // Povečaj števec
  entry.count++

  // Preveri prekoračitev
  if (entry.count > config.maxRequests) {
    entry.blocked = true
    entry.blockedUntil = now + config.blockMs
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(config.blockMs / 1000),
    }
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    retryAfter: 0,
  }
}

/**
 * Pridobi IP naslov iz zahteve
 */
export function getClientIp(req: Request): string {
  const headers = new Headers(req.headers)
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Resetiraj rate limit za ključ (npr. ob uspešni prijavi)
 */
export function resetRateLimit(key: string): void {
  attempts.delete(key)
}
