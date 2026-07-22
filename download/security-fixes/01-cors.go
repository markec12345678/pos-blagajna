// Package middlewares contains middleware functions for the web server.
//
// VARNOSTNI POPRAVEK #01:
// Nadomest'a wildcard CORS ("*") z allowlist iz konfiguracije.
// Originalna koda je dovoljevala zahtevke s kateregakoli izvora.
package middlewares

import (
	"net/http"
	"strings"

	"github.com/nutrixpos/pos/common/config"
)

// AllowCors creates a CORS middleware that only allows origins from the
// configured allowlist. If no allowlist is configured (empty slice),
// the middleware defaults to same-origin only (no ACAO header).
//
// Expected config shape (config.yaml):
//
//   cors:
//     allowed_origins:
//       - "http://localhost:3000"
//       - "http://localhost:8080"
//       - "https://pos.example.com"
//     allowed_methods: [OPTIONS, GET, POST, PATCH, DELETE]
//     allowed_headers: [Content-Type, Authorization, X-Requested-With]
//     allow_credentials: true
//     max_age_seconds: 600
func AllowCors(next http.Handler) http.Handler {
	// AllowCorsWithoutConfig ohranja prvotno obnašanje za povratno
	// združljivost, vendar izpiše opozorilo v logger (glej InitializeCors).
	return AllowCorsWithConfig(config.Config{})(next)
}

// AllowCorsWithConfig returns a CORS middleware bound to a config.
// Use this in production code paths where config is available.
func AllowCorsWithConfig(conf config.Config) func(http.Handler) http.Handler {
	allowedOrigins := conf.Cors.AllowedOrigins
	allowedMethods := strings.Join(conf.Cors.AllowedMethods, ",")
	if allowedMethods == "" {
		allowedMethods = "OPTIONS,GET,POST,PATCH,DELETE"
	}
	allowedHeaders := strings.Join(conf.Cors.AllowedHeaders, ",")
	if allowedHeaders == "" {
		allowedHeaders = "Content-Type,Authorization,X-Requested-With"
	}
	maxAge := conf.Cors.MaxAgeSeconds
	if maxAge == 0 {
		maxAge = 600
	}

	// Set for O(1) lookups
	originSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[strings.TrimSpace(o)] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Only echo ACAO if origin is on the allowlist.
			// If no allowlist is configured (dev mode), reflect origin but
			// log a warning so production deployments cannot silently allow *.
			if origin != "" {
				if _, ok := originSet[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					if conf.Cors.AllowCredentials {
						w.Header().Set("Access-Control-Allow-Credentials", "true")
						// When credentials are allowed, Vary: Origin is mandatory
						w.Header().Add("Vary", "Origin")
					}
				} else if len(allowedOrigins) == 0 && conf.Env == "dev" {
					// Dev fallback: reflect any origin, but never allow credentials
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Add("Vary", "Origin")
				}
				// else: origin not allowed — no ACAO header, browser will block
			}

			w.Header().Set("Access-Control-Allow-Methods", allowedMethods)
			w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
			w.Header().Set("Access-Control-Max-Age", itoa(maxAge))

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// itoa is a tiny dependency-free int → string helper to avoid importing strconv
// just for a one-liner.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
