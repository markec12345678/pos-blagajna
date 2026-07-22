# 🏪 POS Blagajna — NutrixPOS

Sodoben, odprtokodni sistem za upravljanje prodaje (Point of Sale) za restavracije, bife in trgovine. Zgrajen z Next.js 16, Prisma ORM in SQLite.

![Status](https://img.shields.io/badge/status-aktivni%20razvoj-emerald)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-indigo)

---

## 📋 Kazalo

- [Pregled](#-pregled)
- [Funkcionalnosti](#-funkcionalnosti)
- [Tehnologije](#-tehnologije)
- [Hitri začetek](#-hitri-začetek)
- [Demo računi](#-demo-računi)
- [Arhitektura](#-arhitektura)
- [API dokumentacija](#-api-dokumentacija)
- [Prisma shema](#-prisma-shema)
- [Vloge in dovoljenja](#-vloge-in-dovoljenja)
- [Namestitev v produkciji](#-namestitev-v-produkciji)
- [Varnost](#-varnost)
- [Fejlendar](#-fejlendar)
- [Prispevanje](#-prispevanje)

---

## 🎯 Pregled

POS Blagajna je popoln sistem za upravljanje prodaje z naslednjimi ključnimi lastnostmi:

- **Modularna arhitektura** — ločeni moduli za prodajo, naročila, kuhinjo, skladišče, stroške
- **Realnočasovna komunikacija** — WebSocket za takojšnje posodobitve med blagajno in kuhinjo
- **Večvložni dostop** — admin, blagajnik, kuhar z različnimi dovoljenji
- **Slovenščina** — celoten UI v slovenščini z EUR in slovenskim datumskim formatom
- **DDV 22%** — vgrajena podpora za slovenski DDV z izpisom na računih
- **Mize in naročila** — upravljanje miz z notranjo/teraso/bar območji
- **Skladišče** — sledenje zalog, sprejem, odpisi, opozorila ob nizki zalogi
- **Poročila** — dashboard s prodajo, top izdelki, stroški, čisti dobiček

---

## ✨ Funkcionalnosti

### 🛒 Blagajna (POS)
- Katalog izdelkov z barvno kodiranimi kategorijami
- Iskanje po imenu/SKU/barcode
- Košarica s spreminjanjem količin
- Popusti v EUR
- Napitnine (tips)
- 3 načini plačila: gotovina, kartica, mobilno
- Avtomatsko vračilo pri gotovini
- Hitre cene za gotovino (točno, zaokroženo na 5€/10€)
- DDV 22% (vključen v cene, prikazan na računu)
- Generiranje številke računa (R-YYYYMMDD-XXXX)
- Tiskanje računa preko brskalnika

### 👨‍🍳 Naročila in kuhinja (KDS)
- Ustvarjanje naročil iz košarice
- Pošiljanje v kuhinjo z gumbom
- **Kitchen Display System (KDS)** za kuharje
- Status naročil: `open` → `sent` → `preparing` → `ready` → `served` → `paid`
- Barvno kodirani statusi
- Prikaz elapsed časa (avto-update vsako sekundo)
- Opozarjanje ob naročilih, ki čakajo > 10 minut
- Beležke na postavkah ("brez čebule", "extra sir")

### 🪑 Mize
- 10 vzorčnih miz v 3 območjih (Notranja, Terasa, Bar)
- Status: prosta, zasedena, rezervirana, za čiščenje
- Prikaz aktivnih naročil na mizi
- Avtomatska sprememba statusa ob ustvarjanju naročila

### 👥 Kupci
- CRUD operacije
- Iskanje po imenu/telefonu/email
- Loyalty točke (1 točka na porabljen 1€)
- Zgodovina obiskov in skupna poraba
- VIP označbe

### 📦 Skladišče
- Sprejem zaloge (z dobaviteljem in nabavno ceno)
- Odpisi (z razlogom)
- Adjustacije (inventura)
- Zgodovina vseh premikov
- Opozarjanja ob nizki zalogi (stock ≤ minStock)

### 💰 Stroški
- 5 kategorij: najemnina, komunalne, plače, dobave, ostalo
- Filtriranje po kategoriji in datumu
- Skupni seštevek stroškov
- Prikaz v dashboardu za izračun čistega dobička

### 📊 Poročila in dashboard
- Skupna prodaja (danes/teden/mesec/vse)
- Število računov in povprečni račun
- Skupne napitnine in popusti
- Prodaja po urah (bar chart)
- Top 10 izdelkov po količini in vrednosti
- Skupni stroški in čisti dobiček
- Prodaja po načinih plačila (gotovina/kartica/mobilno)

### ⚙️ Nastavitve
- Ime restavracije, naslov, telefon, email
- Davčna številka
- Stopnja DDV (privzeto 22%)
- Glava in noga računa
- Opozarjanja ob nizki zalogi
- Avtomatsko tiskanje kuhinjskega/klientskega računa

### 🔐 Avtentikacija in avtorizacija
- Login z uporabniškim imenom in geslom
- bcrypt hashing gesel (cost 10)
- JWT-style session token (HMAC-SHA256) v httpOnly cookie
- 3 vloge z različnimi dovoljenji:
  - **admin** — poln dostop (blagajna + admin panel)
  - **cashier** — blagajna in naročila
  - **chef** — samo kuhinja zaslon (KDS)
- Session veljaven 7 dni
- Avtomatska preusmeritev na login

### 🌍 Večjezikovnost (i18n)
- 3 jeziki: **slovenščina** (privzeti), **angleščina**, **italijanščina**
- Samodejna detekcija jezika brskalnika
- Language switcher z zastavami (🇸🇮 🇬🇧 🇮🇹) v headerju in na login strani
- 200+ prevedenih ključev za vse dele aplikacije
- Persistenca izbire v localStorage
- Datumski formati prilagojeni jeziku (sl-SI, en-GB, it-IT)

### 🖨 ESC/POS tiskalnik podpora
- Polna implementacija ESC/POS protokola (Epson, Star, Bixolon, Zjiang)
- **3 načini povezave:**
  - **USB (WebUSB)** — direktno povezovanje v Chrome/Edge
  - **Mreža (TCP/IP)** — povezava preko mreže na port 9100
  - **Brskalnik** — fallback na window.print()
- Test povezave z latnostjo (samo za mrežne tiskalnike)
- Podpora za 58mm (32 znakov) in 80mm (48 znakov) papir
- Avtomatska transliteracija slovenskih šumnikov (č→c, š→s, ž→z)
- API za generiranje byte array-a (POST /api/pos/print/receipt)
- Testni izpis za preverjanje delovanja
- Avtomatsko odpiranje predala za gotovino ob plačilu z gotovino
- Beep po tiskanju računa
- Nastavitve tiskalnika v admin panelu

### 📱 PWA (Progressive Web App)
- Namestitev na domači zaslon (Android, iOS, desktop)
- **Offline mode** z service workerjem
  - App shell (HTML, CSS, JS, fonts) — Cache First
  - API zahteve — Network First z cache fallback
  - Slike — Cache First z revalidacijo
  - HTML navigacije — Network First z offline.html fallback
- Offline indicator (rumeni badge ob izgubi povezave)
- Avto-refresh ob povrnitvi povezave
- PWA manifest z ikonami (192, 512, 512 maskable)
- Shortcuts: Blagajna, Naročila, Admin
- Theme color: emerald (#059669)

### 📊 CSV izvoz poročil
- Izvoz prodaje v CSV (Excel združljiv z BOM)
- Izvoz stroškov v CSV s skupno vrstico
- Filtriranje po datumskem obsegu (from, to)
- Slovenski labeli (Gotovina/Kartica/Mobilno, Zaključen/Storniran)
- Stolpci: račun, datum, čas, blagajnik, kupec, vrednost, popust, DDV, napitnina, skupaj, način plačila, plačano, vračilo, status, postavke

### 📄 PDF poročila
- Profesionalen PDF izvoz poročil (A4 landscape)
- 8 metrik: skupna prodaja, št. računov, povprečni račun, napitnine, popusti, stroški, čisti dobiček, zapadli davki
- 4 tabele: prodaja po urah, top 10 izdelkov, plačila po načinu, stroški po kategorijah
- Slovenski labeli z EUR formatiranjem (1.234,56 €)
- PdfExportButton komponenta z datumskim obsegom
- Za računovodstvo in arhiviranje

### 📅 Rezervacije miz
- Nov Prisma model: Reservation (tableId, customerName, phone, email, partySize, datetime, duration, status, note)
- Status: pending → confirmed → completed | cancelled | no_show
- API: CRUD z validacijo (datetime v prihodnosti, partySize ≥ 1)
- ReservationsTab v admin panel:
  - Statistika danes (rezervacije, čakajoče, potrjene, gostje)
  - Filtri (datum, status z gumbi)
  - Seznam grupiran po datumu z barvno kodiranimi statusi
  - Detail dialog z akcijami (potrdi, zaključi, prekliči, no_show)
  - Opozorilo o zamudi za pretečene rezervacije

### ⏰ Sledenje delavcev (time tracking)
- Nov Prisma model: TimeEntry (userId, clockIn, clockOut, totalMinutes, note)
- API: POST /time/clock (in/out), GET /time/entries, GET /time/status
- **ClockButton v headerju**:
  - Prijava na delo → timer se začne (HH:MM:SS format, live update)
  - Odjava → prikaz trajanja v toast
  - Prikaz dnevnih minut
- TimeEntriesTab v admin panel:
  - Statistika (skupno ur, delavcev, vnosov, odprtih)
  - Filtri (datumski obseg)
  - Grupirano po uporabniku s skupnim trajanjem
  - Aktivni vnosi označeni z ACTIVE badge
  - Praćenje v realnem času za odprte vnose

### 🌐 HubSync (sinhronizacija več lokacij)
- Nov Prisma model: Location, SyncLog
- API: CRUD za lokacije + sinhronizacija z hub-om
- HubSyncTab v admin panel:
  - Upravljanje lokacij (ime, koda, naslov, hubUrl, hubToken)
  - Glavna lokacija in Hub (master) oznake
  - Sinhronizacija s hub-om (push prodaje, izdelkov, premikov, stroškov)
  - SyncLog zgodovina z statusi (uspeh/napaka/čaka)
  - Avtomatsko beleženje v audit log

### 📋 Audit log (sledenje akcij)
- Nov Prisma model: AuditLog (userId, action, entityType, entityId, description, metadata, ipAddress, userAgent)
- logAudit() helper za beleženje v vseh ključnih API-jih:
  - Prijava/odjava uporabnikov
  - Ustvarjanje/posodabljanje/brisanje lokacij
  - Storno računov
  - Sinhronizacija s hub-om
  - Testni email
- AuditLogTab v admin panel:
  - Statistika po tipih akcij
  - Filtri (akcija, tip entitete, datumski obseg)
  - Barvno kodirani akcije (create=zelena, update=modra, delete=red, storno=oranžna)
  - Prikaz uporabnika, IP naslova, user-agent, časa

### 📧 Email obvestila (SMTP)
- Nodemailer integracija z env-based konfiguracijo
- Email helperji:
  - sendReservationEmail — potrditev rezervacije stranki
  - sendLowStockEmail — opozorilo adminu o nizki zalogi
  - sendDailySummaryEmail — dnevni povzetek poslovanja
- EmailSettingsTab v admin panel:
  - SMTP konfiguracija navodila (.env spremenljivke)
  - Testni email z result feedback
  - Predlogi uporabe (rezervacije, nizka zaloga, dnevni povzetek, storno)
- API: POST /api/pos/email/test

### 🌐 Javni spletni meni (/menu)
- Javna stran brez auth za stranke
- Prikaz vseh izdelkov in kategorij z barvno kodiranjem
- Košarica z dodajanjem/odstranjevanjem izdelkov
- Hero sekcija z informacijami o restavraciji (naslov, telefon, VAT)
- Footer z davčno številko in avtorskim pravom
- Multilingual (SL/EN/IT) z LanguageSwitcher
- Responsive (mobile-first) — deluje na telefonu, tablici, računalniku
- API: GET /api/public/menu (javni podatki), POST /api/public/reserve (javna rezervacija)

### 🎫 QR loyalty sistem
- Generiranje QR kode za vsakega kupca (qrcode knjižnica)
- Format: `POS:CUSTOMER:{customerId}`
- 300×300 px, emerald barvna shema
- API: GET /api/pos/customers/[id]/qr — generira base64 PNG
- API: POST /api/pos/customers/scan — skenira QR in vrne kupca
- Loyalty točke: 1 točka na porabljen 1 EUR
- Vrne: loyaltyPoints, totalSpent, visits
- Uporaba: blagajnik skenira QR kodo kupca za hitro identifikacijo in pregled točk

---

## 🛠 Tehnologije

| Sklad | Tehnologija | Različica |
|---|---|---|
| **Framework** | Next.js (App Router) | 16 |
| **Jezik** | TypeScript | 5 |
| **Podatkovna baza** | SQLite (preko Prisma) | — |
| **ORM** | Prisma Client | 6.x |
| **Styling** | Tailwind CSS | 4 |
| **UI komponente** | shadcn/ui (New York) | — |
| **Ikone** | Lucide React | — |
| **Avtentikacija** | bcryptjs + HMAC-SHA256 | — |
| **Real-time** | Socket.io (načrtovano) | — |
| **Validacija** | Zod (načrtovano) | — |

---

## 🚀 Hitri začetek

### Zahteve

- Node.js 18+ ali Bun
- npm/bun/yarn

### Namestitev

```bash
# Kloniraj repozitorij
git clone https://github.com/markec12345678/pos-blagajna.git
cd pos-blagajna

# Namesti odvisnosti
bun install   # ali npm install

# Nastavi okolje
cp .env.example .env
# Uredi .env in nastavi JWT_SECRET na naključno vrednost:
# openssl rand -base64 48

# Inicializiraj bazo
bun run db:push

# Seed baze z vzorčnimi podatki
bun run scripts/seed-pos.ts

# Zaženi razvojni strežnik
bun run dev
```

Aplikacija bo na voljo na `http://localhost:3000`.

### Quick demo

Po seed-anju se prijavi z:
```
Uporabniško ime: admin
Geslo: admin123
```

---

## 🔑 Demo računi

| Vloga | Uporabniško ime | Geslo | Dostop |
|---|---|---|---|
| Administrator | `admin` | `admin123` | Blagajna + Admin panel |
| Blagajnik 1 | `cashier` | `cashier123` | Blagajna + Naročila |
| Blagajnik 2 | `cashier2` | `cashier123` | Blagajna + Naročila |
| Kuhar | `chef` | `chef123` | Samo Kuhinja zaslon (KDS) |

⚠️ **POMEMBNO:** V produkciji takoj spremenite vsa gesla!

---

## 🏗 Arhitektura

```
pos-blagajna/
├── prisma/
│   └── schema.prisma          # 11 modelov (User, Product, Order, Sale, ...)
├── scripts/
│   └── seed-pos.ts            # Seed: 4 uporabniki, 39 izdelkov, 10 miz
├── src/
│   ├── app/
│   │   ├── api/               # 15+ API route datotek
│   │   │   ├── auth/          # login, me, logout
│   │   │   ├── users/         # CRUD (admin)
│   │   │   └── pos/           # products, categories, sales, orders, ...
│   │   ├── login/             # Login stran
│   │   ├── layout.tsx         # Root layout z metadata
│   │   └── page.tsx           # Glavna stran (preverja auth)
│   ├── components/
│   │   ├── pos/
│   │   │   ├── POSPage.tsx        # Glavna komponenta (4 tabi)
│   │   │   ├── LoginPage.tsx      # Prijava
│   │   │   ├── KitchenDisplay.tsx # KDS za kuharje
│   │   │   ├── AdminPanel.tsx     # Admin z 8 pod-tabi
│   │   │   └── types.ts           # Tipi in helper funkcije
│   │   └── ui/                # shadcn/ui komponente
│   └── lib/
│       ├── auth.ts            # Avtentikacija (bcrypt + HMAC session)
│       ├── db.ts              # Prisma client singelton
│       └── utils.ts           # Pomožne funkcije
├── .env                       # Konfiguracija (JWT_SECRET, DATABASE_URL)
├── package.json
└── README.md
```

### Podatkovni model

```
User ──┬── Sale ──── SaleItem ── Product
       │                    └── Category
       ├── Order ── OrderItem
       │     └── Table
       ├── StockMove ── Product
       └── Expense

Settings (singelton)
Customer (z loyalty točkami)
```

---

## 📡 API dokumentacija

### Avtentikacija

| Metoda | Pot | Opis | Avtentikacija |
|---|---|---|---|
| POST | `/api/auth/login` | Prijava (vrne httpOnly cookie) | Javna |
| GET | `/api/auth/me` | Trenutni uporabnik | Javna |
| POST | `/api/auth/logout` | Odjava | Javna |

### Uporabniki (admin only)

| Metoda | Pot | Opis |
|---|---|---|
| GET | `/api/users` | Seznam uporabnikov |
| POST | `/api/users` | Ustvari uporabnika |

### Izdelki in kategorije

| Metoda | Pot | Opis | Vloge |
|---|---|---|---|
| GET | `/api/pos/products` | Seznam izdelkov (z filtri) | vse |
| POST | `/api/pos/products` | Nov izdelek | admin |
| GET | `/api/pos/categories` | Seznam kategorij | vse |

### Prodaja (sales)

| Metoda | Pot | Opis | Vloge |
|---|---|---|---|
| GET | `/api/pos/sales` | Zgodovina prodaje | vse |
| POST | `/api/pos/sales` | Zaključi prodajo (kreira račun) | admin, cashier |
| GET | `/api/pos/sales/latest` | Zadnji račun | vse |

### Naročila (orders)

| Metoda | Pot | Opis | Vloge |
|---|---|---|---|
| GET | `/api/pos/orders` | Seznam naročil (z filtri) | admin, cashier |
| POST | `/api/pos/orders` | Novo naročilo | admin, cashier |
| GET | `/api/pos/orders/active` | Aktivna naročila | vse |
| GET | `/api/pos/orders/[id]` | Detajl naročila | vse |
| PATCH | `/api/pos/orders/[id]` | Spremeni status (send, ready, serve, ...) | vse |

### Mize

| Metoda | Pot | Opis | Vloge |
|---|---|---|---|
| GET | `/api/pos/tables` | Seznam miz | vse |
| POST | `/api/pos/tables` | Nova miza | admin |

### Skladišče

| Metoda | Pot | Opis | Vloge |
|---|---|---|---|
| GET | `/api/pos/stock` | Nizka zaloga | admin, cashier |
| GET | `/api/pos/stock/moves` | Zgodovina premikov | admin |
| POST | `/api/pos/stock/moves` | Nov premik (receiving, waste, adjustment) | admin |

### Kupci

| Metoda | Pot | Opis | Vloge |
|---|---|---|---|
| GET | `/api/pos/customers` | Seznam (z iskanjem) | admin, cashier |
| POST | `/api/pos/customers` | Nov kupec | admin, cashier |

### Stroški (admin only)

| Metoda | Pot | Opis |
|---|---|---|
| GET | `/api/pos/expenses` | Seznam (z filtri) |
| POST | `/api/pos/expenses` | Nov strošek |

### Nastavitve in poročila

| Metoda | Pot | Opis | Vloge |
|---|---|---|---|
| GET | `/api/pos/settings` | Nastavitve | vse |
| PATCH | `/api/pos/settings` | Posodobi nastavitve | admin |
| GET | `/api/pos/reports?range=today\|week\|month\|all` | Dashboard podatki | admin |

---

## 🗄 Prisma shema

Glej [`prisma/schema.prisma`](prisma/schema.prisma) za polno definicijo. Modeli:

| Model | Namembnost |
|---|---|
| `User` | Uporabniki z vlogami (admin/cashier/chef) |
| `Category` | Kategorije izdelkov (Pijače, Hrana, Sladice, ...) |
| `Product` | Izdelki s ceno, zalogo, SKU, barcode |
| `Table` | Mize z območji in statusi |
| `Order` | Naročila z stanji (open→sent→preparing→ready→served→paid) |
| `OrderItem` | Postavke naročila z beležkami |
| `Sale` | Računi z DDV, popusti, napitninami |
| `SaleItem` | Postavke računa |
| `Customer` | Kupci z loyalty točkami |
| `StockMove` | Premiki zalog (sprejem, odpis, adjustacija) |
| `Expense` | Stroški po kategorijah |
| `Settings` | Singelton z nastavitvami restavracije |

---

## 👤 Vloge in dovoljenja

### admin
- Poln dostop do vseh funkcij
- Vidi Admin tab z 8 pod-tabi
- Upravlja uporabnike, izdelke, mize, kupce
- Sprejema/zavrača dobave, odpise
- Vidi poročila in stroške
- Ureja nastavitve

### cashier
- Blagajna (katalog, košarica, checkout)
- Ustvarja naročila in jih pošilja v kuhinjo
- Vidi zgodovino prodaje
- Vidi aktivna naročila
- Ne vidi Admin tab-a

### chef
- **Samo** Kuhinja zaslon (KDS)
- Vidi aktivna naročila (sent, preparing, ready)
- Spreminja status: začni pripravo, pripravljeno, postreženo
- Ne more prodajati, ne vidi zgodovine, ne vidi admin

---

## 🚢 Namestitev v produkciji

### Docker (priporočeno)

```bash
# Zgradi image
docker build -t pos-blagajna .

# Zaženi z mounted volume za bazo
docker run -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET="your-production-secret" \
  -e DATABASE_URL="file:/app/data/prod.db" \
  pos-blagajna
```

### Ročno

```bash
# Zgradi aplikacijo
bun run build

# Zaženi produkcijski strežnik
bun run start
```

### Okoljske spremenljivke

```env
DATABASE_URL="file:/path/to/prod.db"
JWT_SECRET="generiraj-z-openssl-rand-base64-48"
NODE_ENV="production"
```

---

## 🔒 Varnost

### Implementirano
- ✅ bcrypt hashing gesel (cost 10)
- ✅ httpOnly cookie za session (XSS zaščita)
- ✅ HMAC-SHA256 podpis session tokena
- ✅ RBAC na vsakem API endpointu
- ✅ Input validacija na API nivoju
- ✅ Foreign key constraints v bazi
- ✅ Type-safe z TypeScript

### Za produkcijo obvezno
- ⚠️ **Spremeni JWT_SECRET** na naključno vrednost
- ⚠️ **Spremeni vsa demo gesla** (admin, cashier, chef)
- ⚠️ **Omogoči HTTPS** z Let's Encrypt
- ⚠️ **Omeji CORS** na znane domene
- ⚠️ **Dodaj rate limiting** na login endpoint
- ⚠️ **Backup baze** dnevno

### Za načrtovano implementacijo
- 🔲 Prehod na pravi JWT (jose knjižnica)
- 🔲 Refresh token mehanizem
- 🔲 Audit log varnostnih dogodkov
- 🔲 CSRF zaščita
- 🔲 CSP headerji

---

## 📅 Fejlendar

### ✅ Opravljeno (v1.5)
- [x] Avtentikacija z JWT cookie
- [x] RBAC (admin/cashier/chef)
- [x] Katalog izdelkov s kategorijami
- [x] Blagajna s checkout in DDV
- [x] Naročila z stanji
- [x] Kitchen Display System (KDS) z WebSocket real-time
- [x] Mize z območji
- [x] Skladišče (sprejem, odpisi)
- [x] Stroški
- [x] Kupci z loyalty
- [x] Nastavitve
- [x] Poročila in dashboard
- [x] Napitnine
- [x] Popusti
- [x] Račun z izpisom in tiskanjem
- [x] Zgodovina prodaje
- [x] WebSocket za real-time KDS
- [x] Storno/refund računov
- [x] Barkodni bralnik podpora
- [x] Večjezikovnost (SL/EN/IT)
- [x] ESC/POS tiskalnik (USB + TCP/IP + brskalnik)
- [x] Nastavitve tiskalnika v admin panelu
- [x] PWA offline mode
- [x] CSV izvoz poročil (prodaja, stroški)
- [x] PDF izvoz poročil (pdfkit, A4 landscape)
- [x] Rezervacije miz z dashboardom
- [x] Sledenje delavcev (time tracking z clock in/out)
- [x] HubSync (sinhronizacija več lokacij)
- [x] Audit log (sledenje admin akcij)
- [x] Email obvestila (SMTP z Nodemailer)
- [x] Javni spletni meni (/menu) za stranke
- [x] QR loyalty sistem (generiranje + scan)

### 🔲 Načrtovano (v1.6+)
- [ ] SMS obvestila za rezervacije
- [ ] Mobilna aplikacija (React Native)
- [ ] Integracija z fiskalnim strojem (Slovenija)
- [ ] MailChimp integracija za marketing
- [ ] Online plačila (Stripe, PayPal)
- [ ] Real-time dashboard z grafikoni (Chart.js)

---

## 🤝 Prispevanje

Prispevki so dobrodošli! Prosimo:

1. Fork repozitorij
2. Ustvari feature branch (`git checkout -b feature/nova-funkcija`)
3. Commit spremembe (`git commit -m 'feat: dodana nova funkcija'`)
4. Push v branch (`git push origin feature/nova-funkcija`)
5. Odpri Pull Request

### Konvencije commitov

```
feat: nova funkcija
fix: popravljena napaka
docs: dokumentacija
refactor: prestrukturiranje
test: testi
chore: vzdrževanje
```

---

## 📄 Licenca

MIT License — glej [LICENSE](LICENSE) za podrobnosti.

---

## 🙏 Zahvale

- [OpenSourcePOS](https://github.com/opensourcepos/opensourcepos) — referenca za funkcionalnosti
- [NutrixPOS](https://github.com/nutrixpos/pos) — originalni projekt, ki smo ga analizirali
- [shadcn/ui](https://ui.shadcn.com/) — odlične UI komponente
- [Prisma](https://www.prisma.io/) — odličen ORM
- [Next.js](https://nextjs.org/) — najboljši React framework

---

## 📞 Podpora

- 🐛 **Bug reporti**: [GitHub Issues](https://github.com/markec12345678/pos-blagajna/issues)
- 💬 **Diskusije**: [GitHub Discussions](https://github.com/markec12345678/pos-blagajna/discussions)
- 📧 **Email**: markec12345678@users.noreply.github.com

---

**Avtor:** markec12345678
**Različica:** 1.0.0
**Zadnja posodobitev:** 21. julij 2026
