# Worklog — NutrixPOS analiza

---
Task ID: 1
Agent: Main (Super Z)
Task: Analiziraj GitHub repozitorij github.com/nutrixpos/pos

Work Log:
- Kloniral repozitorij v /home/z/my-project/pos
- Prebral README.md, AGENTS.md, go.mod, main.go, docker-compose.yaml, config.example.yaml
- Preučil strukturo: 66 Go datotek (~11.500 LOC) + 47 frontend datotek (~10.100 LOC)
- Identificiral tehnologije: Go 1.25, Vue 3, MongoDB, JWT/Zitadel, gorilla/mux, Cobra/Viper
- Analiziral arhitekturo: modularni monolit z IBaseModule vmesnikom
- Preveril varnostne vidike: CORS, JWT, bcrypt, setup endpointi, MongoDB avtentikacija
- Identificiral 18 varnostnih ugotovitev (4 kritične, 6 visokih, 5 srednjih, 3 nizke)

Stage Summary:
- Generiral prvo analizo v /home/z/my-project/download/analiza_nutrixpos.docx
- Skupna ocena varnostne zrelosti: 2.9/5
- Projekt še ni primeren za produkcijsko uporabo brez dodatnega truda
- Priporočila razdeljena po časovni nujnosti (takoj, kratkoročno, srednjeročno, dolgoročno)

---
Task ID: 2
Agent: Main (Super Z)
Task: Poglobljen varnostni pregled s pripravljenimi popravki in arhitekturnim diagramom

Work Log:
- Prebral dodatne kritične datoteke: cors.go, viper.go, config.go, bcrypt.go, user.go, jwt.go, order.go (deli)
- Pripravil 7 patch datotek v /home/z/my-project/download/security-fixes/:
  * 01-cors.go — CORS allowlist iz konfiguracije
  * 02-setup-protection.go — X-Setup-Token zaščita setup endpointov
  * 03-main.go — validacija JWT skrivnosti ob zagonu
  * 04-ratelimit.go — rate limiting za login endpoint
  * 05-docker-compose.yaml — MongoDB avtentikacija + odstranitev zunanjega porta
  * 06-auth.ts — popravek registracijskega URL-ja + fetch timeout
  * 07-config-snippet.yaml + 07-config-types.go.txt — dodatne konfiguracijske nastavitve
- Napisal INSTALL.md z navodili za aplikacijo popravkov
- Generiral poglobljen varnostni pregled v PDF formatu (34 KB, 8 poglavij, 18 ugotovitev)
- Generiral arhitekturni diagram PNG z označenimi tveganji

Stage Summary:
- Varnostni pregled PDF: /home/z/my-project/download/varnostni_pregled_nutrixpos.pdf
- Arhitekturni diagram: /home/z/my-project/download/arhitektura_nutrixpos.png
- Popravki kode: /home/z/my-project/download/security-fixes/ (9 datotek, ~46 KB skupaj)
- Po aplikaciji vseh popravkov se ocena zrelosti dvigne z 1.5/5 na 3.3/5
- Ciljna ocena po 12 mesecih z dodatnimi izboljšavami: 4.5/5

---
Task ID: 6-batch1
Agent: General purpose
Task: Build 10 API route files for POS (tables, orders, stock, customers, expenses, settings, reports)

Work Log:
- src/app/api/pos/tables/route.ts (GET/POST)
- src/app/api/pos/orders/route.ts (GET/POST with orderNo generation)
- src/app/api/pos/orders/active/route.ts (GET active orders)
- src/app/api/pos/orders/[id]/route.ts (GET/PATCH with action handlers)
- src/app/api/pos/stock/route.ts (GET low stock)
- src/app/api/pos/stock/moves/route.ts (GET/POST with transactional stock update)
- src/app/api/pos/customers/route.ts (GET/POST with search)
- src/app/api/pos/expenses/route.ts (GET/POST with filters)
- src/app/api/pos/settings/route.ts (GET/PATCH, public GET)
- src/app/api/pos/reports/route.ts (GET dashboard with range filter)

Stage Summary:
- All 10 route files created using TypeScript, Next.js 16 App Router, and the established requireAuth pattern
- All files pass ESLint cleanly (only pre-existing errors in src/lib/auth.ts remain, which were not in scope)
- TypeScript type-check passes with no errors in any of the new src/app/api/pos/ files
- Implemented RBAC per spec: admin-only for stock moves POST, expenses POST, settings PATCH, reports GET; admin/cashier for orders/tables/customers/stock GET; admin/cashier/chef for orders/[id] with chef restricted to start_preparing/ready actions
- OrderNo generation uses N-YYYYMMDD-XXXX format with retry loop for uniqueness
- Stock moves use Prisma $transaction to atomically record move and update product.stock
- Reports endpoint computes totals, avg receipt, payment method breakdown, hourly buckets, top 10 products, expenses, and net profit for today/week/month/all ranges

---
Task ID: 6-kds
Agent: General purpose
Task: Build Kitchen Display System component

Work Log:
- Created /home/z/my-project/src/components/pos/types.ts (shared POS types) exporting: OrderStatus, OrderType, OrderItemStatus, PaymentMethod, PosTable, PosCashier, OrderItem, Order, OrderStatusConfig, orderStatusConfig (amber/orange/emerald/slate/red/green palette), orderTypeLabels, formatTime (HH:mm sl-SI), formatElapsed ("5 min" / "1 h 5 min"), formatEUR (sl-SI EUR). Also added Product, Category, CartItem, SaleItem, Sale types to satisfy the concurrently-built POSPage.tsx (parallel task 6-pos) so the whole `pos/` folder compiles together.
- Created /home/z/my-project/src/components/pos/KitchenDisplay.tsx ('use client') with:
  * Auto-refresh every 5 s via setInterval+useEffect (silent background refresh + manual refresh button with spinner).
  * 1 s tick interval driving a `now` state so the elapsed-time display auto-updates without re-fetching.
  * Filters API response to visible statuses (sent/preparing/ready) and sorts by createdAt asc (oldest first).
  * Responsive grid: 1 col mobile, 2 col sm, 3 col lg, 4 col xl.
  * Each Card: status-coloured border + tinted header (amber=Poslano, orange=V pripravi, emerald=Pripravljeno), orderNo prominent, status Badge, OrderType icon (Utensils/ShoppingBag/Bike), table name (or "Prodnaja" for takeaway/delivery), placed-at time (formatTime), elapsed time (formatElapsed) shown large with red AlertCircle when stale (>10 min sent / >20 min preparing / >5 min ready), items list rendered as "2x Burger cheese" with optional "↳ note" line, optional order-level note block, and an action button in the footer mapped per status:
      - sent     -> "Začni pripravo"   (PATCH { action: 'start_preparing' })
      - preparing -> "Označi kot pripravljeno" (PATCH { action: 'ready' })
      - ready    -> "Postreženo"        (PATCH { action: 'serve' })
  * Action handler does optimistic local update (replace or remove the order), tracks per-order `updatingIds` set for button spinners, and fires useToast notifications on success ("Uspešno posodobljeno") and failure ("Napaka pri posodobitvi", destructive variant).
  * Loading state (Skeleton cards), empty state (CheckCircle2 + Slovenian message), inline fetch error banner (AlertCircle + red box) plus toast on manual refresh failure; silent refreshes do NOT spam toasts.
  * Touch-friendly: action buttons are h-12 (48px) full-width, refresh button is size-10 (40px+ icon), Card has 2px coloured border.
  * All UI text in Slovenian; tabular-nums for time/price alignment.

Stage Summary:
- File created: /home/z/my-project/src/components/pos/KitchenDisplay.tsx (~415 lines)
- Shared types file created: /home/z/my-project/src/components/pos/types.ts (exports Order/OrderItem/orderStatusConfig/formatTime/formatElapsed plus Product/Category/CartItem/Sale/formatEUR used by the parallel POSPage.tsx task — added to keep the whole `pos/` folder compiling cleanly together).
- `bun run lint` passes with exit code 0 (no warnings/errors).
- `bunx tsc --noEmit` reports no errors in any `src/components/pos/*` file. (Only pre-existing unrelated errors remain in `pos/frontend/**` Vue files and `skills/**` which are outside the Next.js app and gitignored.)
- Component is ready to be dropped into a route/page that wraps it with the app's Toaster (already mounted in src/app/layout.tsx).

---
Task ID: 6-admin
Agent: General purpose
Task: Build Admin Panel with 8 sub-tabs (Dashboard, Users, Products, Tables, Customers, Stock, Expenses, Settings)

Work Log:
- Extended /home/z/my-project/src/components/pos/types.ts with new types and helpers needed by the admin panel:
  * User, UserRole, userRoleLabels
  * Table (separate from existing PosTable to avoid breaking Order), TableArea, TableStatus, tableAreaLabels, tableStatusConfig
  * Customer
  * StockMove, StockMoveType, stockMoveTypeConfig
  * Expense, ExpenseCategory, expenseCategoryLabels
  * Settings
  * Reports, ReportRange, ReportHourBucket, ReportTopProduct, reportRangeLabels
  * formatDate (sl-SI dd. MM. yyyy), formatDateTime (date + HH:mm)
- Created /home/z/my-project/src/components/pos/AdminPanel.tsx ('use client', ~2830 lines, single file, modular sub-components):
  * Default export AdminPanel with shadcn Tabs wrapper (8 TabsTrigger entries, each with lucide icon + Slovenian label). Header with emerald icon and slate neutrals. ScrollArea wraps the TabsList so it works on mobile.
  * Tab 1 (Pregled): GET /api/pos/reports?range=today|week|month|all. Range Select + Refresh button. 7 metric cards (Skupna prodaja, Število računov, Povprečni račun, Napitnine, Popusti, Stroški, Neto dobiček) with tone-coloured icons (emerald/teal/slate/amber/red). Bar chart of salesByHour rendered with simple divs (gradient from-emerald-500 to-teal-400, height proportional to max hour, hour labels and € tooltips). Top 10 products table. Payment method breakdown (cash/card/mobile) when present. Loading skeletons + ErrorState + EmptyState.
  * Tab 2 (Uporabniki): GET /api/users, list with name/username/email/role badge/active badge/last login (formatDateTime). Add-user Dialog with username, password, name, email, role Select (admin/cashier/chef). POST /api/users. Toast on success/error.
  * Tab 3 (Izdelki): GET /api/pos/products (parallel with /api/pos/categories for the form Select). Search Input with 250 ms debounce re-querying the API. Product list with name, SKU, category, price, stock (red when ≤ minStock), "Nizka zaloga"/"Na zalogi" badge, "Ne-hrana" outline badge when isFood===false. Add-product Dialog with name, price, sku, stock, minStock, category Select, isFood Checkbox. POST /api/pos/products.
  * Tab 4 (Mize): GET /api/pos/tables + GET /api/pos/orders/active in parallel. Tables grouped by area (notranja/terasa/bar) with section header containing Layers icon, area label, and count badge. Each table is a clickable button-card showing name, status Badge (free=emerald, occupied=amber, reserved=blue, dirty=slate), seats count, and active orders count. Clicking a table opens a Dialog listing its active orders (orderNo, status, itemsCount, total, formatTime). Add-table Dialog (name, seats, area Select) → POST /api/pos/tables.
  * Tab 5 (Kupci): GET /api/pos/customers?search= with 300 ms debounce. Search Input. List with name (and address sub-line with MapPin icon), phone (Phone icon), email (Mail icon), loyaltyPoints (emerald), visits, totalSpent (formatEUR). Add-customer Dialog (name, phone, email, address, notes Textarea) → POST /api/pos/customers.
  * Tab 6 (Skladišče): GET /api/pos/stock (low stock) + /api/pos/stock/moves + /api/pos/products (for the move Selects) in parallel. Two side-by-side cards: "Nizka zaloga" (red badge count, table with stock vs min) and "Zgodovina premikov" (scrollable list with type badge using stockMoveTypeConfig, product name, +/- quantity, optional reason/supplier/user chips with StickyNote/Tag/UsersIcon, formatDateTime). Two action buttons: "Sprejem" (default green, opens Dialog with product Select, quantity, unitCost, supplier → POST /api/pos/stock/moves type='receiving') and "Odpis" (destructive red, opens Dialog with product Select, quantity, reason Textarea → POST type='waste'). Toast confirmations on each move; auto-reload after success.
  * Tab 7 (Stroški): GET /api/pos/expenses?category=... Total sum card at top (TrendingDown red, formatEUR). Category filter Select (all + 5 categories). Expense list table with date (formatDate), description, category Badge, note (responsive — hidden on small screens but shown as inline sub-line), amount (red, formatEUR). Add-expense Dialog (category Select, date Input type=date defaulting to today, description, amount number, note Textarea) → POST /api/pos/expenses.
  * Tab 8 (Nastavitve): GET /api/pos/settings → PATCH /api/pos/settings. Two cards side-by-side: "Osnovni podatki" (restaurantName, address Textarea, phone, email, vatNumber, taxRate as % converted from 0.22→22 and back, currency, currencySymbol) and "Račun in tiskanje" (receiptHeader Textarea, receiptFooter Textarea, three Checkbox toggles: lowStockAlert, printKitchenReceipt, printClientReceipt; last-updated timestamp). Save button (top-right and bottom) calls PATCH and toasts "Nastavitve shranjene" on success or destructive toast on error.
  * Reusable helpers: LoadingState (spinner), ErrorState (red border), EmptyState (icon + title + description) used across all tabs.
  * All fetch errors are surfaced both inline (ErrorState) and via useToast destructive variant. Submitting buttons show Loader2 spinner and are disabled.
  * Mobile-first: responsive grids (1/2/3/4/5/7 cols depending on data), responsive table columns (hide secondary columns on small screens with sm:/md:/lg: prefixes), touch-friendly button sizes (h-9 sm, icon buttons for refresh), ScrollArea wraps the TabsList so all 8 tabs scroll horizontally on phones.
  * Color palette: emerald/teal primary (icons, accents, active states), slate neutrals, amber/red for warnings/destructive. Slovenian throughout (tab labels, table headers, dialog titles/descriptions, button labels, toast messages).
  * Imported UI components: Tabs/TabsList/TabsTrigger/TabsContent, Card family, Button, Input, Label, Textarea, Checkbox, Badge, Skeleton, ScrollArea, Select family, Dialog family, Table family. Used cn from @/lib/utils and useToast from @/hooks/use-toast. Table type aliased as TableType to avoid clash with @/components/ui/table's Table (renamed to UITable in import).

Stage Summary:
- Files created/modified:
  * /home/z/my-project/src/components/pos/types.ts (extended with 9 new types + 5 label/config maps + formatDate + formatDateTime; existing exports untouched so POSPage.tsx, KitchenDisplay.tsx and Order/Sale/OrderItem interfaces continue to compile)
  * /home/z/my-project/src/components/pos/AdminPanel.tsx (new, ~2830 lines, 8 tab sub-components)
- `cd /home/z/my-project && bun run lint` exits with code 0 (no warnings, no errors).
- `bunx tsc --noEmit` reports 0 errors in any src/ file (all 99 remaining errors are pre-existing in unrelated gitignored folders: download/security-fixes/, pos/frontend/ Vue/PrimeVue project, examples/websocket/).
- Component is ready to be rendered inside a route/page that wraps it with the app's Toaster (already mounted in src/app/layout.tsx) and an auth gate that only allows admin role (e.g. /admin route guarded by requireAuth(['admin'])).
