# NutrixPOS — Varnostni popravki

Ta direktorij vsebuje pripravljene popravke za kritične varnostne težave,
najdene pri analizi repozitorija. Vsaka datoteka je popolna nadomestna
različica originala — kopirajte jo na navedeno pot.

## Uporaba

```bash
cd /path/to/pos  # kloniran repozitorij

# 1. CORS utrditev
cp /home/z/my-project/download/security-fixes/01-cors.go \
   modules/core/middlewares/cors.go

# 2. Zaščita setup endpointov
cp /home/z/my-project/download/security-fixes/02-setup-protection.go \
   cmd/root.go

# 3. Validacija JWT skrivnosti ob zagonu
cp /home/z/my-project/download/security-fixes/03-main.go main.go

# 4. Rate limiting middleware (nova datoteka)
cp /home/z/my-project/download/security-fixes/04-ratelimit.go \
   modules/core/middlewares/ratelimit.go

# 5. Mongo avtentikacija v docker-compose
cp /home/z/my-project/download/security-fixes/05-docker-compose.yaml \
   docker-compose.yaml

# 6. Frontend register URL popravek
cp /home/z/my-project/download/security-fixes/06-auth.ts \
   frontend/src/services/auth.ts

# 7. Dodatne konfiguracijske nastavitve (dodaj v config.yaml)
cat /home/z/my-project/download/security-fixes/07-config-snippet.yaml >> config.yaml

# 8. Registracija rate limit middleware-a v core.go
# (glej komentar v 04-ratelimit.go za navodila)
```

Po aplikaciji vseh popravkov zaženite:

```bash
go build ./...
cd frontend && npm run build-only
```

## Seznam popravkov

| # | Datoteka | Težava | Tveganje |
|---|----------|--------|----------|
| 01 | `01-cors.go` | CORS dovoli vse izvore (`*`) | Visoko |
| 02 | `02-setup-protection.go` | Setup endpointi zapišejo config brez avtentikacije | Kritično |
| 03 | `03-main.go` | JWT skrivnost ni validirana ob zagonu | Kritično |
| 04 | `04-ratelimit.go` | Brez omejevanja hitrosti na login | Visoko |
| 05 | `05-docker-compose.yaml` | MongoDB brez avtentikacije | Kritično |
| 06 | `06-auth.ts` | Register URL je nepravilen | Srednje |
| 07 | `07-config-snippet.yaml` | Manjkajo CORS allowlist in rate limit nastavitve | Konfiguracija |

## Pomembna opozorila

1. **Pred aplikacijo popravkov** si naredite rezervo (backup) repozitorija:
   ```bash
   git stash push -m "before security patches" || git checkout -b pre-security-patches
   ```

2. **Po aplikaciji** generirajte novo JWT skrivnost:
   ```bash
   openssl rand -base64 48
   # Vrednost vstavite v config.yaml pod auth.jwt_secret
   ```

3. **MongoDB geslo** v `05-docker-compose.yaml` je placeholder —
   generirajte svoje:
   ```bash
   openssl rand -base64 24
   ```

4. **CORS allowlist** v `07-config-snippet.yaml` vsebuje `localhost` —
   v produkciji jo zamenjajte z dejanskimi domenami.

5. Popravki so **neodvisni** — lahko aplikirate samo tiste, ki jih
   potrebujete. Vendar priporočamo aplikacijo vseh, saj se medsebojno
   dopolnjujejo.

## Testiranje po aplikaciji

```bash
# Preverite, da se aplikacija ne zažene s privzeto skrivnostjo
JWT_SECRET="your-super-secret-jwt-key-change-in-production" go run ./cmd/pos
# Pričakovan izhod: panic("default JWT secret detected ...")

# Preverite CORS
curl -v -H "Origin: https://evil.com" http://localhost:8000/core/api/settings
# Pričakovan odgovor: brez Access-Control-Allow-Origin headerja

# Preverite setup zaščito
curl -X POST http://localhost:8000/api/setup/config -d '{"host":"x"}'
# Pričakovan odgovor: 401 Unauthorized (zahteva setup token)

# Preverite rate limit
for i in {1..10}; do
  curl -X POST http://localhost:8000/core/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' &
done
# Pričakovan rezultat: po 5 poskusih 429 Too Many Requests
```
