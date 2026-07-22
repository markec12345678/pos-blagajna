// Skupni tipi in pomožne funkcije za POS komponente.
// Tipi so pripravljeni tako, da ustrezajo odgovorom API-jev pod
// `/api/pos/*` (glej prisma/schema.prisma za izvirne modele).

export type OrderStatus =
  | 'open'
  | 'sent'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'
  | 'paid'

export type OrderType = 'dine_in' | 'takeaway' | 'delivery'

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served'

export type PaymentMethod = 'cash' | 'card' | 'mobile'

export interface PosTable {
  id: string
  name: string
  seats?: number
  area?: string | null
  status?: string
}

export interface PosCashier {
  id: string
  username: string
  name: string
}

// --- Uporabniki (RBAC) ------------------------------------------------------

export type UserRole = 'admin' | 'cashier' | 'chef'

export interface User {
  id: string
  username: string
  name: string
  email?: string | null
  role: UserRole | string
  active?: boolean
  lastLogin?: string | null
  createdAt?: string
}

export const userRoleLabels: Record<string, string> = {
  admin: 'Administrator',
  cashier: 'Blagajnik',
  chef: 'Kuhar',
}

// --- Mize -------------------------------------------------------------------

export type TableArea = 'notranja' | 'terasa' | 'bar' | string
export type TableStatus = 'free' | 'occupied' | 'reserved' | 'dirty' | string

export interface Table {
  id: string
  name: string
  seats?: number
  area?: TableArea | null
  status?: TableStatus
  active?: boolean
  activeOrdersCount?: number
}

export const tableAreaLabels: Record<string, string> = {
  notranja: 'Notranja',
  terasa: 'Terasa',
  bar: 'Bar',
}

export const tableStatusConfig: Record<string, { label: string; className: string }> = {
  free: { label: 'Prosta', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  occupied: { label: 'Zasedena', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  reserved: { label: 'Rezervirana', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  dirty: { label: 'Umazana', className: 'bg-slate-200 text-slate-700 border-slate-300' },
}

// --- Kupci ------------------------------------------------------------------

export interface Customer {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  loyaltyPoints?: number
  totalSpent?: number
  visits?: number
  createdAt?: string
  updatedAt?: string
}

// --- Premiki zaloge ---------------------------------------------------------

export type StockMoveType = 'receiving' | 'waste' | 'adjustment' | 'transfer' | string

export interface StockMove {
  id: string
  productId: string
  product?: { id: string; name: string; unit?: string; sku?: string | null } | null
  type: StockMoveType
  quantity: number
  reason?: string | null
  unitCost?: number | null
  totalValue?: number | null
  userId?: string | null
  user?: { id: string; username: string; name: string } | null
  supplier?: string | null
  createdAt: string
}

export const stockMoveTypeConfig: Record<string, { label: string; className: string }> = {
  receiving: { label: 'Sprejem', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  waste: { label: 'Odpis', className: 'bg-red-100 text-red-800 border-red-300' },
  adjustment: { label: 'Popravek', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  transfer: { label: 'Prenos', className: 'bg-blue-100 text-blue-800 border-blue-300' },
}

// --- Stroški ----------------------------------------------------------------

export type ExpenseCategory = 'rent' | 'utilities' | 'salaries' | 'supplies' | 'other' | string

export interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  userId?: string | null
  user?: { id: string; username: string; name: string } | null
  note?: string | null
  createdAt?: string
}

export const expenseCategoryLabels: Record<string, string> = {
  rent: 'Najemnina',
  utilities: 'Storitve',
  salaries: 'Plače',
  supplies: 'Material',
  other: 'Ostalo',
}

// --- Nastavitve -------------------------------------------------------------

export interface Settings {
  id: string
  restaurantName?: string
  address?: string | null
  phone?: string | null
  email?: string | null
  vatNumber?: string | null
  currency?: string
  currencySymbol?: string
  taxRate?: number
  receiptHeader?: string | null
  receiptFooter?: string | null
  lowStockAlert?: boolean
  printKitchenReceipt?: boolean
  printClientReceipt?: boolean
  defaultCashier?: string | null
  updatedAt?: string
}

// --- Poročila ---------------------------------------------------------------

export interface ReportHourBucket {
  hour: number
  total: number
}

export interface ReportTopProduct {
  name: string
  quantity: number
  total: number
}

export type ReportRange = 'today' | 'week' | 'month' | 'all'

export interface Reports {
  range: ReportRange | string
  totalSales: number
  salesCount: number
  avgReceipt: number
  totalTips: number
  totalDiscounts: number
  salesByPaymentMethod?: Record<string, number>
  salesByHour?: ReportHourBucket[]
  topProducts?: ReportTopProduct[]
  totalExpenses: number
  netProfit: number
}

export const reportRangeLabels: Record<ReportRange, string> = {
  today: 'Danes',
  week: 'Teden',
  month: 'Mesec',
  all: 'Vse',
}

// --- Katalog (izdelki / kategorije) -----------------------------------------

export interface Category {
  id: string
  name: string
  color: string
  position?: number
}

export interface Product {
  id: string
  name: string
  description?: string | null
  price: number
  sku?: string | null
  barcode?: string | null
  stock: number
  minStock?: number
  unit?: string
  image?: string | null
  categoryId?: string | null
  category?: Category | null
  active?: boolean
  isFood?: boolean
}

// --- Košarica (UI-side) -----------------------------------------------------

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  unit: string
  total: number
  note?: string | null
}

// --- Prodaja (račun) --------------------------------------------------------

export interface SaleItem {
  id?: string
  saleId?: string
  productId?: string | null
  name: string
  price: number
  quantity: number
  unit: string
  total: number
}

export interface Sale {
  id: string
  receiptNo: string
  subtotal: number
  taxRate?: number
  taxAmount: number
  discount: number
  tips?: number
  total: number
  paymentMethod: PaymentMethod | string
  paidAmount: number
  changeAmount: number
  status?: string
  customerId?: string | null
  customerName?: string | null
  cashierId?: string | null
  cashierName?: string | null
  note?: string | null
  orderId?: string | null
  createdAt: string
  items: SaleItem[]
}

export interface OrderItem {
  id: string
  orderId: string
  productId?: string | null
  name: string
  price: number
  quantity: number
  unit: string
  total: number
  note?: string | null
  status: OrderItemStatus
}

export interface Order {
  id: string
  orderNo: string
  tableId?: string | null
  table?: PosTable | null
  status: OrderStatus
  type: OrderType
  customerName?: string | null
  itemsCount: number
  total: number
  note?: string | null
  cashierId?: string | null
  cashier?: PosCashier | null
  createdAt: string
  updatedAt: string
  sentAt?: string | null
  readyAt?: string | null
  servedAt?: string | null
  paidAt?: string | null
  items: OrderItem[]
}

/**
 * Nastavitve za prikaz posameznega statusa naročila.
 * `border` / `headerBg` / `text` so Tailwind razredi, ki se uporabljajo
 * neposredno na elementih kartice; `badge*` razredi se uporabljajo na
 * statusnem značilu; `buttonClass` določa barvo akcijskega gumba.
 */
export interface OrderStatusConfig {
  label: string
  border: string
  headerBg: string
  text: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  buttonClass: string
}

export const orderStatusConfig: Record<OrderStatus, OrderStatusConfig> = {
  open: {
    label: 'Odprto',
    border: 'border-slate-300',
    headerBg: 'bg-slate-50',
    text: 'text-slate-700',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    buttonClass: 'bg-slate-600 hover:bg-slate-700 text-white',
  },
  sent: {
    label: 'Poslano',
    border: 'border-amber-400',
    headerBg: 'bg-amber-50',
    text: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    buttonClass: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  preparing: {
    label: 'V pripravi',
    border: 'border-orange-400',
    headerBg: 'bg-orange-50',
    text: 'text-orange-700',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-300',
    buttonClass: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  ready: {
    label: 'Pripravljeno',
    border: 'border-emerald-400',
    headerBg: 'bg-emerald-50',
    text: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    buttonClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  },
  served: {
    label: 'Postreženo',
    border: 'border-slate-300',
    headerBg: 'bg-slate-50',
    text: 'text-slate-600',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300',
    buttonClass: 'bg-slate-500 hover:bg-slate-600 text-white',
  },
  cancelled: {
    label: 'Preklicano',
    border: 'border-red-400',
    headerBg: 'bg-red-50',
    text: 'text-red-700',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-300',
    buttonClass: 'bg-red-500 hover:bg-red-600 text-white',
  },
  paid: {
    label: 'Plačano',
    border: 'border-green-400',
    headerBg: 'bg-green-50',
    text: 'text-green-700',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-800',
    badgeBorder: 'border-green-300',
    buttonClass: 'bg-green-500 hover:bg-green-600 text-white',
  },
}

export const orderTypeLabels: Record<OrderType, string> = {
  dine_in: 'V restavraciji',
  takeaway: 'Za prevzem',
  delivery: 'Dostava',
}

/**
 * Formatira datum v obliko `HH:mm` (slovenska lokalizacija).
 * Sprejme `Date` ali ISO datumski niz. Ob neveljavnem datumu vrne `'--:--'`.
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('sl-SI', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Formatira datum v obliko `dd. MM. yyyy` (slovenska lokalizacija).
 * Sprejme `Date` ali ISO datumski niz. Ob neveljavnem datumu vrne `'--'`.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formatira datum in čas skupaj (slovenska lokalizacija, npr. `"31. 12. 2024, 14:30"`).
 * Sprejme `Date` ali ISO datumski niz. Ob neveljavnem datumu vrne `'--'`.
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '--'
  return `${formatDate(d)}, ${formatTime(d)}`
}

/**
 * Formatira pretekli čas od `from` do `now` (privzeto trenuten datum).
 * Vrne nize kot `"pravkar"`, `"5 min"`, `"1 h 5 min"`, `"2 h"`.
 * Ob neveljavnem datumu vrne `'--'`.
 */
export function formatElapsed(from: Date | string, now: Date = new Date()): string {
  const d = typeof from === 'string' ? new Date(from) : from
  if (Number.isNaN(d.getTime())) return '--'
  const ms = Math.max(0, now.getTime() - d.getTime())
  const totalMin = Math.floor(ms / 60000)
  if (totalMin < 1) return 'pravkar'
  if (totalMin < 60) return `${totalMin} min`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`
}

/**
 * Formatira znesek v evrih (slovenska lokalizacija, npr. `"1.234,50 €"`).
 */
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(amount) ? amount : 0)
}
