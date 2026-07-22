// Package middlewares — VARNOSTNI POPRAVEK #04
//
// Rate limiting middleware za občutljive endpointe (login, register,
// password reset). Preprečuje brute-force napade na gesla.
//
// UPORABA v modules/core/core.go:
//
//   router.Handle(prefix+"/api/auth/login",
//       core_middlewares.AllowCors(
//           core_middlewares.LoginRateLimit(c.Config)(
//               auth_svc.AllowAnyOfRoles(
//                   http.HandlerFunc(authHandler.Login), "admin", "cashier", "chef", "superuser"))))
//
// ali enostavneje (ker login ne zahteva vlog):
//
//   router.Handle(prefix+"/api/auth/login",
//       core_middlewares.AllowCors(
//           core_middlewares.LoginRateLimit(c.Config)(
//               http.HandlerFunc(authHandler.Login))))
//
// Prav tako registriraj /api/auth/register in /api/auth/password z
// LoginRateLimit middleware-om.
package middlewares

import (
	"net/http"
	"sync"
	"time"

	"github.com/nutrixpos/pos/common/config"
)

// loginAttempt shrani število poskusov in čas zadnjega poskusa za IP.
type loginAttempt struct {
	count       int
	firstFailed time.Time
	blockedUntil time.Time
}

// LoginRateLimiter je singleton, ki hrani stanje poskusov za vse IP-je.
// Uporablja se sync.Map za thread-safe dostop.
type LoginRateLimiter struct {
	mu       sync.RWMutex
	attempts map[string]*loginAttempt
	maxReqs  int           // max requests v oknu
	window   time.Duration // velikost okna
	blockFor time.Duration // kako dolgo blokiramo po prekoračitvi
}

var (
	globalLoginLimiter *LoginRateLimiter
	limiterOnce        sync.Once
)

// NewLoginRateLimiter inicializira singleton omejevalnik z nastavitvami
// iz konfiguracije.
func NewLoginRateLimiter(conf config.Config) *LoginRateLimiter {
	limiterOnce.Do(func() {
		maxReqs := 5
		windowSecs := 60
		blockMin := 15
		// TODO: ko bo RateLimit konfiguracija dodana v config.Config,
		// uporabi conf.RateLimit.LoginMaxFailures itd.
		globalLoginLimiter = &LoginRateLimiter{
			attempts: make(map[string]*loginAttempt),
			maxReqs:  maxReqs,
			window:   time.Duration(windowSecs) * time.Second,
			blockFor: time.Duration(blockMin) * time.Minute,
		}
	})
	return globalLoginLimiter
}

// LoginRateLimit vrne middleware, ki omejuje število poskusov prijave
// na IP. Po prekoračitvi IP blokira za blockFor časa.
func LoginRateLimit(conf config.Config) func(http.Handler) http.Handler {
	limiter := NewLoginRateLimiter(conf)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)

			// Preveri, ali je IP trenutno blokiran
			if limiter.isBlocked(ip) {
				w.Header().Set("Retry-After", "900") // 15 min v sekundah
				http.Error(w, `{"error":"preveč neuspelih poskusov, poskusi znova čez 15 minut"}`, http.StatusTooManyRequests)
				return
			}

			// Za OPTIONS preflight ne štej poskusov
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Za vsak POST na login/register/preveri stanje
			limiter.recordAttempt(ip)

			if limiter.isBlocked(ip) {
				w.Header().Set("Retry-After", "900")
				http.Error(w, `{"error":"preveč neuspelih poskusov, poskusi znova čez 15 minut"}`, http.StatusTooManyRequests)
				return
			}

			// Status 429 če je v oknu preveč poskusov (tudi uspešnih, da
			// preprečimo scraping)
			if limiter.exceedsRate(ip) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"preveč zahtevkov, poskusi znova čez 1 minuto"}`, http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)

			// PO uspešnem loginu lahko resetiramo števec za ta IP
			// (opcionalno, glej ResetAttemptsAfterSuccess)
		})
	}
}

// isBlocked vrne true, če je IP trenutno v blokadi.
func (l *LoginRateLimiter) isBlocked(ip string) bool {
	l.mu.RLock()
	defer l.mu.RUnlock()
	a, ok := l.attempts[ip]
	if !ok {
		return false
	}
	return time.Now().Before(a.blockedUntil)
}

// recordAttempt zabeleži poskus za podan IP. Če je število preseženo,
// nastavi blockedUntil.
func (l *LoginRateLimiter) recordAttempt(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	a, ok := l.attempts[ip]
	if !ok {
		l.attempts[ip] = &loginAttempt{
			count:       1,
			firstFailed: now,
		}
		return
	}

	// Če je okno poteklo, resetiraj
	if now.Sub(a.firstFailed) > l.window {
		a.count = 1
		a.firstFailed = now
		a.blockedUntil = time.Time{}
		return
	}

	a.count++

	// Po prekoračitvi maxReqs v oknu blokiraj
	if a.count >= l.maxReqs {
		a.blockedUntil = now.Add(l.blockFor)
	}
}

// exceedsRate preveri, ali je IP presegel hitrost v oknu.
func (l *LoginRateLimiter) exceedsRate(ip string) bool {
	l.mu.RLock()
	defer l.mu.RUnlock()
	a, ok := l.attempts[ip]
	if !ok {
		return false
	}
	if time.Since(a.firstFailed) > l.window {
		return false
	}
	return a.count > l.maxReqs
}

// ResetAttemptsAfterSuccess resetira števec za podan IP. Kliči ga
// v login handlerju PO uspešni prijavi.
func ResetAttemptsAfterSuccess(conf config.Config, ip string) {
	limiter := NewLoginRateLimiter(conf)
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	delete(limiter.attempts, ip)
}

// clientIP izvleče IP odjemalca. Upošteva X-Forwarded-For in X-Real-IP
// (za proxy/CDN). Pozor: zaupaj samo proxyjem, ki jih kontroliraš!
func clientIP(r *http.Request) string {
	// Če si za znanim proxyjem, uporabi X-Forwarded-For
	xf := r.Header.Get("X-Forwarded-For")
	if xf != "" {
		// Vzemi prvi IP (originalni odjemalec)
		for i := 0; i < len(xf); i++ {
			if xf[i] == ',' {
				return xf[:i]
			}
		}
		return xf
	}
	xr := r.Header.Get("X-Real-IP")
	if xr != "" {
		return xr
	}
	// Strip port from RemoteAddr
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}
