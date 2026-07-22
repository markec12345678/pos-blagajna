'use client'

// =============================================================================
// AdminPanel — nadzorna plošča za admin uporabnike (8 pod-zavihnikov).
//
// Zavihki:
//   1. Pregled     — poročila iz /api/pos/reports?range=today|week|month|all
//   2. Uporabniki  — seznam in dodajanje uporabnikov (/api/users)
//   3. Izdelki     — seznam in dodajanje izdelkov (/api/pos/products)
//   4. Mize        — seznam po območjih in dodajanje miz (/api/pos/tables)
//   5. Kupci       — iskanje in dodajanje kupcev (/api/pos/customers)
//   6. Skladišče   — nizka zaloga, zgodovina premikov, sprejem in odpis
//                    (/api/pos/stock, /api/pos/stock/moves)
//   7. Stroški     — seznam in dodajanje stroškov (/api/pos/expenses)
//   8. Nastavitve  — urejanje nastavitev aplikacije (/api/pos/settings)
//
// Vsi API klici so avtentificirani (cookie), vsi uporabniški vnosi pa so
// potrjeni s toast obvestili.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Users as UsersIcon,
  Package,
  Table2,
  UserCircle2,
  Boxes,
  Receipt,
  Settings as SettingsIcon,
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  Euro,
  Percent,
  Wallet,
  TrendingDown,
  TrendingUp,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  PackageX,
  ArrowDownToLine,
  Trash2,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  Tag,
  Layers,
  Calendar,
  Clock,
  Network,
  History,
  CreditCard,
} from 'lucide-react'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

import {
  type User,
  type Product,
  type Category,
  type Table as TableType,
  type Customer,
  type StockMove,
  type Expense,
  type Settings,
  type Reports,
  type ReportRange,
  type Order,
  formatEUR,
  formatDate,
  formatTime,
  formatDateTime,
  userRoleLabels,
  tableAreaLabels,
  tableStatusConfig,
  stockMoveTypeConfig,
  expenseCategoryLabels,
  reportRangeLabels,
} from './types'
import { PrinterSettings } from './PrinterSettings'
import { ReservationsTab } from './ReservationsTab'
import { TimeEntriesTab } from './TimeEntriesTab'
import { PdfExportButton } from './PdfExportButton'
import { HubSyncTab } from './HubSyncTab'
import { AuditLogTab } from './AuditLogTab'
import { EmailSettingsTab } from './EmailSettingsTab'
import { DashboardCharts } from './DashboardCharts'
import { CrmDashboard } from './CrmDashboard'
import { ShiftsTab } from './ShiftsTab'
import { SalesForecast } from './SalesForecast'
import { BillingTab } from './BillingTab'

// =============================================================================
// Pomožne konstante
// =============================================================================

const TABS = [
  { value: 'pregled', label: 'Pregled', icon: LayoutDashboard },
  { value: 'uporabniki', label: 'Uporabniki', icon: UsersIcon },
  { value: 'izdelki', label: 'Izdelki', icon: Package },
  { value: 'mize', label: 'Mize', icon: Table2 },
  { value: 'rezervacije', label: 'Rezervacije', icon: Calendar },
  { value: 'kupci', label: 'Kupci', icon: UserCircle2 },
  { value: 'crm', label: 'CRM', icon: UsersIcon },
  { value: 'skladisce', label: 'Skladišče', icon: Boxes },
  { value: 'stroski', label: 'Stroški', icon: Receipt },
  { value: 'delavci', label: 'Delavci', icon: Clock },
  { value: 'urnik', label: 'Urnik', icon: Calendar },
  { value: 'napoved', label: 'Napoved', icon: TrendingUp },
  { value: 'hubsync', label: 'HubSync', icon: Network },
  { value: 'billing', label: 'Billing', icon: CreditCard },
  { value: 'audit', label: 'Audit', icon: History },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'nastavitve', label: 'Nastavitve', icon: SettingsIcon },
] as const

const TABLE_AREAS = ['notranja', 'terasa', 'bar'] as const
const USER_ROLES = ['admin', 'cashier', 'chef'] as const
const EXPENSE_CATEGORIES = ['rent', 'utilities', 'salaries', 'supplies', 'other'] as const

// =============================================================================
// Pomožne komponente
// =============================================================================

/** Polnozaslonski spinner za stanja nalaganja. */
function LoadingState({ label = 'Nalaganje ...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <Loader2 className="size-5 animate-spin text-emerald-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/** Prikaz napake z rdečim okvirjem. */
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

/** Prikaz praznega stanja z ikono in sporočilom. */
function EmptyState({
  icon: Icon = CheckCircle2,
  title,
  description,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-slate-500">
      <Icon className="size-8 text-slate-300" />
      <p className="font-medium text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-400">{description}</p>}
    </div>
  )
}

// =============================================================================
// Glavna komponenta
// =============================================================================

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<string>('pregled')

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-5 text-emerald-600" />
          <h1 className="text-lg font-semibold text-slate-900">Admin panel</h1>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Upravljanje POS sistema — uporabniki, izdelki, mize, kupci, zaloga, stroški in nastavitve
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b bg-white">
          <ScrollArea>
            <TabsList className="m-2 inline-flex h-auto w-max flex-wrap">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-1.5">
                  <Icon className="size-4" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <TabsContent value="pregled" className="mt-0 space-y-4">
            <DashboardTab />
            <DashboardCharts />
          </TabsContent>
          <TabsContent value="uporabniki" className="mt-0">
            <UsersTab />
          </TabsContent>
          <TabsContent value="izdelki" className="mt-0">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="mize" className="mt-0">
            <TablesTab />
          </TabsContent>
          <TabsContent value="rezervacije" className="mt-0">
            <ReservationsTab />
          </TabsContent>
          <TabsContent value="kupci" className="mt-0">
            <CustomersTab />
          </TabsContent>
          <TabsContent value="crm" className="mt-0">
            <CrmDashboard />
          </TabsContent>
          <TabsContent value="skladisce" className="mt-0">
            <StockTab />
          </TabsContent>
          <TabsContent value="stroski" className="mt-0">
            <ExpensesTab />
          </TabsContent>
          <TabsContent value="delavci" className="mt-0">
            <TimeEntriesTab />
          </TabsContent>
          <TabsContent value="urnik" className="mt-0">
            <ShiftsTab />
          </TabsContent>
          <TabsContent value="napoved" className="mt-0">
            <SalesForecast />
          </TabsContent>
          <TabsContent value="hubsync" className="mt-0">
            <HubSyncTab />
          </TabsContent>
          <TabsContent value="billing" className="mt-0">
            <BillingTab />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AuditLogTab />
          </TabsContent>
          <TabsContent value="email" className="mt-0">
            <EmailSettingsTab />
          </TabsContent>
          <TabsContent value="nastavitve" className="mt-0">
            <SettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// =============================================================================
// Zavihek 1: Pregled (Dashboard)
// =============================================================================

function DashboardTab() {
  const [range, setRange] = useState<ReportRange>('today')
  const [reports, setReports] = useState<Reports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pos/reports?range=${range}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri pridobivanju poročil')
      setReports(data as Reports)
    } catch (e: any) {
      setError(e.message || 'Neznana napaka')
      toast({
        title: 'Napaka',
        description: e.message || 'Neznana napaka',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [range, toast])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const cards = useMemo(() => {
    if (!reports) return []
    return [
      {
        label: 'Skupna prodaja',
        value: formatEUR(reports.totalSales),
        icon: Euro,
        tone: 'emerald',
      },
      {
        label: 'Število računov',
        value: String(reports.salesCount),
        icon: ShoppingCart,
        tone: 'slate',
      },
      {
        label: 'Povprečni račun',
        value: formatEUR(reports.avgReceipt),
        icon: Receipt,
        tone: 'teal',
      },
      {
        label: 'Napitnine',
        value: formatEUR(reports.totalTips),
        icon: Wallet,
        tone: 'emerald',
      },
      {
        label: 'Popusti',
        value: formatEUR(reports.totalDiscounts),
        icon: Percent,
        tone: 'amber',
      },
      {
        label: 'Stroški',
        value: formatEUR(reports.totalExpenses),
        icon: TrendingDown,
        tone: 'red',
      },
      {
        label: 'Neto dobiček',
        value: formatEUR(reports.netProfit),
        icon: TrendingUp,
        tone: reports.netProfit >= 0 ? 'emerald' : 'red',
      },
    ]
  }, [reports])

  const hourBuckets = reports?.salesByHour ?? []
  const maxHour = useMemo(
    () => hourBuckets.reduce((m, h) => Math.max(m, h.total), 0),
    [hourBuckets]
  )

  const topProducts = reports?.topProducts ?? []

  return (
    <div className="space-y-4">
      {/* Glava z izbiro obdobja */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Pregled poslovanja</h2>
          <p className="text-xs text-slate-500">
            Povzetek prodaje, stroškov in dobička za izbrano obdobje.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as ReportRange)}>
            <SelectTrigger className="h-9 w-32" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(reportRangeLabels) as ReportRange[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {reportRangeLabels[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadReports} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* PDF izvoz */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-medium">Izvoz poročila v PDF</div>
              <div className="text-xs text-slate-500">Za računovodstvo in arhiviranje</div>
            </div>
            <PdfExportButton defaultRange={range} />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Kartice z metrikami */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {cards.map((card) => {
              const Icon = card.icon
              const tone = TONE_CLASSES[card.tone] ?? TONE_CLASSES.slate
              return (
                <Card key={card.label} className="gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">{card.label}</span>
                    <Icon className={cn('size-4', tone.icon)} />
                  </div>
                  <div className={cn('text-lg font-bold tabular-nums', tone.text)}>
                    {card.value}
                  </div>
                </Card>
              )
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Prodaja po urah */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prodaja po urah</CardTitle>
                <CardDescription>
                  Skupna prodaja glede na uro dneva ({reportRangeLabels[range].toLowerCase()}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hourBuckets.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="Ni prodaje v izbranem obdobju"
                    description="Poskusite izbrati drugo obdobje."
                  />
                ) : (
                  <div className="flex h-48 items-end gap-1 overflow-x-auto pb-2">
                    {hourBuckets.map((bucket) => (
                      <div
                        key={bucket.hour}
                        className="flex min-w-9 flex-1 flex-col items-center gap-1"
                        title={`${bucket.hour}:00 — ${formatEUR(bucket.total)}`}
                      >
                        <div className="text-[10px] font-medium text-slate-600 tabular-nums">
                          {bucket.total >= 100
                            ? `${Math.round(bucket.total)} €`
                            : ''}
                        </div>
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-teal-400 transition-all"
                          style={{
                            height: `${Math.max(6, (bucket.total / Math.max(1, maxHour)) * 140)}px`,
                          }}
                        />
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {String(bucket.hour).padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 10 izdelkov */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 izdelkov</CardTitle>
                <CardDescription>Najbolj prodajani izdelki v obdobju.</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="Ni podatkov o prodaji"
                    description="V izbranem obdobju ni bilo prodaje."
                  />
                ) : (
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Izdelek</TableHead>
                        <TableHead className="text-right">Količina</TableHead>
                        <TableHead className="text-right">Promet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.slice(0, 10).map((p, i) => (
                        <TableRow key={`${p.name}-${i}`}>
                          <TableCell className="text-slate-400 tabular-nums">
                            {i + 1}
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">
                            {p.name}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEUR(p.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </UITable>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Način plačila */}
          {reports?.salesByPaymentMethod &&
            Object.keys(reports.salesByPaymentMethod).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Prodaja po načinu plačila</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {(['cash', 'card', 'mobile'] as const).map((m) => (
                      <div
                        key={m}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"
                      >
                        <div className="text-xs text-slate-500">
                          {m === 'cash' ? 'Gotovina' : m === 'card' ? 'Kartica' : 'Mobilno'}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800 tabular-nums">
                          {formatEUR(reports.salesByPaymentMethod?.[m] ?? 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
        </>
      )}
    </div>
  )
}

const TONE_CLASSES: Record<string, { icon: string; text: string }> = {
  emerald: { icon: 'text-emerald-600', text: 'text-emerald-700' },
  teal: { icon: 'text-teal-600', text: 'text-teal-700' },
  slate: { icon: 'text-slate-500', text: 'text-slate-700' },
  amber: { icon: 'text-amber-600', text: 'text-amber-700' },
  red: { icon: 'text-red-600', text: 'text-red-700' },
}

// =============================================================================
// Zavihek 2: Uporabniki
// =============================================================================

interface UserForm {
  username: string
  password: string
  name: string
  email: string
  role: string
}

const EMPTY_USER_FORM: UserForm = {
  username: '',
  password: '',
  name: '',
  email: '',
  role: 'cashier',
}

function UsersTab() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<UserForm>(EMPTY_USER_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka')
      setUsers(data.users ?? [])
    } catch (e: any) {
      setError(e.message)
      toast({
        title: 'Napaka pri nalaganju',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    setForm(EMPTY_USER_FORM)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.username || !form.password || !form.name) {
      toast({
        title: 'Manjkajo podatki',
        description: 'Uporabniško ime, geslo in ime so obvezni.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri dodajanju')
      toast({
        title: 'Uporabnik dodan',
        description: `${data.user.name} (${data.user.username}) je bil uspešno ustvarjen.`,
      })
      setDialogOpen(false)
      await load()
    } catch (e: any) {
      toast({
        title: 'Napaka',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Uporabniki</h2>
          <p className="text-xs text-slate-500">
            Seznam uporabnikov sistema z vlogami in statusom aktivnosti.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Osveži</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>Dodaj uporabnika</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <ErrorState message={error} />
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="Ni uporabnikov"
              description="Dodajte prvega uporabnika."
            />
          ) : (
            <UITable>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime</TableHead>
                  <TableHead>Uporabniško ime</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Vloga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Zadnja prijava</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-slate-800">{u.name}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {u.username}
                    </TableCell>
                    <TableCell className="hidden text-slate-600 md:table-cell">
                      {u.email || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={ROLE_BADGE_CLASSES[u.role] ?? 'bg-slate-100 text-slate-700'}>
                        {userRoleLabels[u.role] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Aktiven</Badge>
                      ) : (
                        <Badge variant="secondary">Neaktiven</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-xs text-slate-500 sm:table-cell">
                      {u.lastLogin ? formatDateTime(u.lastLogin) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </UITable>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj uporabnika</DialogTitle>
            <DialogDescription>
              Ustvari nov uporabniški račun z izbrano vlogo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="user-username">Uporabniško ime *</Label>
                <Input
                  id="user-username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="npr. jnovak"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="user-password">Geslo *</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-name">Polno ime *</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="npr. Janez Novak"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="janez@restavracija.si"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-role">Vloga</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {userRoleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-800',
  cashier: 'bg-blue-100 text-blue-800',
  chef: 'bg-amber-100 text-amber-800',
}

// =============================================================================
// Zavihek 3: Izdelki
// =============================================================================

interface ProductForm {
  name: string
  price: string
  sku: string
  stock: string
  minStock: string
  categoryId: string
  isFood: boolean
}

const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  price: '',
  sku: '',
  stock: '0',
  minStock: '5',
  categoryId: '',
  isFood: true,
}

function ProductsTab() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/pos/products'),
        fetch('/api/pos/categories'),
      ])
      const prodData = await prodRes.json()
      const catData = await catRes.json()
      if (!prodRes.ok) throw new Error(prodData.error || 'Napaka')
      setProducts(prodData.products ?? [])
      setCategories(catData.categories ?? [])
    } catch (e: any) {
      setError(e.message)
      toast({
        title: 'Napaka pri nalaganju',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Debounce iskanje
  useEffect(() => {
    const t = setTimeout(async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      try {
        const res = await fetch(`/api/pos/products?${params}`)
        const data = await res.json()
        if (res.ok) setProducts(data.products ?? [])
      } catch {
        // tiho
      }
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim()
    if (!s) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.sku ?? '').toLowerCase().includes(s)
    )
  }, [products, search])

  const openAdd = () => {
    setForm(EMPTY_PRODUCT_FORM)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name || form.price === '') {
      toast({
        title: 'Manjkajo podatki',
        description: 'Ime in cena izdelka sta obvezna.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const body = {
        name: form.name,
        price: parseFloat(form.price),
        sku: form.sku || undefined,
        stock: parseInt(form.stock || '0', 10),
        minStock: parseInt(form.minStock || '0', 10),
        categoryId: form.categoryId || undefined,
        isFood: form.isFood,
      }
      const res = await fetch('/api/pos/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri dodajanju')
      toast({
        title: 'Izdelek dodan',
        description: `Izdelek "${data.product.name}" je bil uspešno ustvarjen.`,
      })
      setDialogOpen(false)
      await load()
    } catch (e: any) {
      toast({
        title: 'Napaka',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Izdelki</h2>
          <p className="text-xs text-slate-500">
            Seznam izdelkov s ceno, zalogo in kategorijo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Osveži</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>Dodaj izdelek</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Iskanje po imenu ali SKU ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <ErrorState message={error} />
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Ni izdelkov"
              description="Dodajte prvi izdelek ali spremenite iskalni niz."
            />
          ) : (
            <UITable>
              <TableHeader>
                <TableRow>
                  <TableHead>Izdelek</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead>
                  <TableHead className="hidden lg:table-cell">Kategorija</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableHead className="text-right">Zaloga</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const lowStock =
                    (p.minStock ?? 0) > 0 && p.stock <= (p.minStock ?? 0)
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium text-slate-800">{p.name}</div>
                        {p.isFood === false && (
                          <Badge variant="outline" className="mt-0.5 text-[10px]">
                            Ne-hrana
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-slate-500 md:table-cell">
                        {p.sku || '—'}
                      </TableCell>
                      <TableCell className="hidden text-slate-600 lg:table-cell">
                        {p.category?.name || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-slate-800">
                        {formatEUR(p.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={cn(
                            'font-medium',
                            lowStock ? 'text-red-600' : 'text-slate-700'
                          )}
                        >
                          {p.stock} {p.unit || 'kos'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {lowStock ? (
                          <Badge className="bg-red-100 text-red-800">
                            <PackageX className="size-3" />
                            Nizka zaloga
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Na zalogi</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </UITable>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj izdelek</DialogTitle>
            <DialogDescription>
              Vnesite podatke o novem izdelku. Polja označena z * so obvezna.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-name">Ime izdelka *</Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="npr. Burger cheese"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="prod-price">Cena (EUR) *</Label>
                <Input
                  id="prod-price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="prod-sku">SKU</Label>
                <Input
                  id="prod-sku"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="npr. BUR-001"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="prod-stock">Zaloga</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="prod-minstock">Minimalna zaloga</Label>
                <Input
                  id="prod-minstock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-category">Kategorija</Label>
              <Select
                value={form.categoryId || 'none'}
                onValueChange={(v) =>
                  setForm({ ...form, categoryId: v === 'none' ? '' : v })
                }
              >
                <SelectTrigger id="prod-category" className="w-full">
                  <SelectValue placeholder="Brez kategorije" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brez kategorije —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 p-3">
              <Checkbox
                id="prod-isfood"
                checked={form.isFood}
                onCheckedChange={(v) => setForm({ ...form, isFood: v === true })}
              />
              <Label htmlFor="prod-isfood" className="cursor-pointer text-sm">
                Hrana (pošlje v kuhinjo)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// Zavihek 4: Mize
// =============================================================================

interface TableForm {
  name: string
  seats: string
  area: string
}

const EMPTY_TABLE_FORM: TableForm = {
  name: '',
  seats: '4',
  area: 'notranja',
}

function TablesTab() {
  const { toast } = useToast()
  const [tables, setTables] = useState<TableType[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<TableForm>(EMPTY_TABLE_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tabRes, ordRes] = await Promise.all([
        fetch('/api/pos/tables'),
        fetch('/api/pos/orders/active'),
      ])
      const tabData = await tabRes.json()
      const ordData = await ordRes.json()
      if (!tabRes.ok) throw new Error(tabData.error || 'Napaka')
      setTables(tabData.tables ?? [])
      setOrders(ordData.orders ?? [])
    } catch (e: any) {
      setError(e.message)
      toast({
        title: 'Napaka pri nalaganju',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const tablesByArea = useMemo(() => {
    const map: Record<string, TableType[]> = {}
    for (const t of tables) {
      const area = t.area || 'notranja'
      if (!map[area]) map[area] = []
      map[area].push(t)
    }
    return map
  }, [tables])

  const ordersForTable = useMemo(() => {
    if (!selectedTable) return []
    return orders.filter((o) => o.tableId === selectedTable.id)
  }, [orders, selectedTable])

  const openAdd = () => {
    setForm(EMPTY_TABLE_FORM)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name) {
      toast({
        title: 'Manjkajo podatki',
        description: 'Ime mize je obvezno.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pos/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          seats: parseInt(form.seats || '4', 10),
          area: form.area,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri dodajanju')
      toast({
        title: 'Miza dodana',
        description: `Miza "${data.table.name}" je bila uspešno ustvarjena.`,
      })
      setDialogOpen(false)
      await load()
    } catch (e: any) {
      toast({
        title: 'Napaka',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Mize</h2>
          <p className="text-xs text-slate-500">
            Mize razporejene po območjih s prikazom aktivnih naročil.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Osveži</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>Dodaj mizo</span>
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={Table2} title="Ni miz" description="Dodajte prvo mizo." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {TABLE_AREAS.map((area) => {
            const areaTables = tablesByArea[area] ?? []
            if (areaTables.length === 0) return null
            return (
              <div key={area}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Layers className="size-4 text-emerald-600" />
                  {tableAreaLabels[area] ?? area}
                  <Badge variant="secondary" className="text-xs">
                    {areaTables.length}
                  </Badge>
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {areaTables.map((t) => {
                    const status = t.status ?? 'free'
                    const statusCfg = tableStatusConfig[status] ?? tableStatusConfig.free
                    const orderCount = t.activeOrdersCount ?? 0
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTable(t)}
                        className="group rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        <div className="flex items-start justify-between">
                          <div className="font-semibold text-slate-800">{t.name}</div>
                          <Badge className={cn('border', statusCfg.className)}>
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <UsersIcon className="size-3" />
                            {t.seats ?? 4} sedežev
                          </span>
                          {orderCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-700">
                              <Receipt className="size-3" />
                              {orderCount} {orderCount === 1 ? 'naročilo' : 'naročila'}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dodaj mizo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj mizo</DialogTitle>
            <DialogDescription>
              Ustvari novo mizo v izbranem območju restavracije.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tab-name">Ime mize *</Label>
              <Input
                id="tab-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="npr. Miza 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tab-seats">Število sedežev</Label>
                <Input
                  id="tab-seats"
                  type="number"
                  min="1"
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tab-area">Območje</Label>
                <Select
                  value={form.area}
                  onValueChange={(v) => setForm({ ...form, area: v })}
                >
                  <SelectTrigger id="tab-area" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_AREAS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {tableAreaLabels[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pregled aktivnih naročil mize */}
      <Dialog open={!!selectedTable} onOpenChange={(o) => !o && setSelectedTable(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Miza: {selectedTable?.name}</DialogTitle>
            <DialogDescription>
              {selectedTable && (
                <>
                  {selectedTable.seats ?? 4} sedežev ·{' '}
                  {tableAreaLabels[selectedTable.area ?? 'notranja'] ??
                    selectedTable.area ??
                    'Brez območja'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {ordersForTable.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Ni aktivnih naročil"
              description="Za to mizo trenutno ni odprtih naročil."
            />
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2 pr-2">
                {ordersForTable.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-sm font-medium text-slate-800">
                        {o.orderNo}
                      </div>
                      <Badge variant="secondary">{o.status}</Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{o.itemsCount} postavk</span>
                      <span className="font-medium text-slate-700 tabular-nums">
                        {formatEUR(o.total)}
                      </span>
                      <span>{formatTime(o.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTable(null)}>
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// Zavihek 5: Kupci
// =============================================================================

interface CustomerForm {
  name: string
  email: string
  phone: string
  address: string
  notes: string
}

const EMPTY_CUSTOMER_FORM: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
}

function CustomersTab() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CustomerForm>(EMPTY_CUSTOMER_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (searchTerm?: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (searchTerm) params.set('search', searchTerm)
        const res = await fetch(`/api/pos/customers?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Napaka')
        setCustomers(data.customers ?? [])
      } catch (e: any) {
        setError(e.message)
        toast({
          title: 'Napaka pri nalaganju',
          description: e.message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    load()
  }, [load])

  // Debounce iskanje
  useEffect(() => {
    const t = setTimeout(() => {
      load(search)
    }, 300)
    return () => clearTimeout(t)
  }, [search, load])

  const openAdd = () => {
    setForm(EMPTY_CUSTOMER_FORM)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name) {
      toast({
        title: 'Manjkajo podatki',
        description: 'Ime kupca je obvezno.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pos/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri dodajanju')
      toast({
        title: 'Kupec dodan',
        description: `Kupec "${data.customer.name}" je bil uspešno ustvarjen.`,
      })
      setDialogOpen(false)
      await load(search)
    } catch (e: any) {
      toast({
        title: 'Napaka',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Kupci</h2>
          <p className="text-xs text-slate-500">
            Iskanje kupcev po imenu, telefonu ali emailu, s pregledom zvestobe.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          <span>Dodaj kupca</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Iskanje po imenu, telefonu ali emailu ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <ErrorState message={error} />
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              icon={UserCircle2}
              title="Ni kupcev"
              description="Dodajte prvega kupca ali spremenite iskalni niz."
            />
          ) : (
            <UITable>
              <TableHeader>
                <TableRow>
                  <TableHead>Ime</TableHead>
                  <TableHead className="hidden md:table-cell">Telefon</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="text-right">Točke</TableHead>
                  <TableHead className="text-right">Obiski</TableHead>
                  <TableHead className="text-right">Skupaj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-slate-800">{c.name}</div>
                      {c.address && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="size-3" />
                          {c.address}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-slate-600 md:table-cell">
                      {c.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3 text-slate-400" />
                          {c.phone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="hidden text-slate-600 lg:table-cell">
                      {c.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3 text-slate-400" />
                          {c.email}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">
                      {c.loyaltyPoints ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-700">
                      {c.visits ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-slate-800">
                      {formatEUR(c.totalSpent ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </UITable>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj kupca</DialogTitle>
            <DialogDescription>
              Ustvari nov vnos kupca. Ime je obvezno, ostali podatki so izbirni.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cust-name">Ime in priimek *</Label>
              <Input
                id="cust-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="npr. Janez Novak"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cust-phone">Telefon</Label>
                <Input
                  id="cust-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+386 ..."
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cust-email">Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ime@domena.si"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cust-address">Naslov</Label>
              <Input
                id="cust-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="ULica 1, 1000 Ljubljana"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cust-notes">Opombe</Label>
              <Textarea
                id="cust-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Alergije, preference ..."
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// Zavihek 6: Skladišče
// =============================================================================

interface StockMoveForm {
  productId: string
  quantity: string
  unitCost: string
  supplier: string
  reason: string
}

const EMPTY_RECEIVING_FORM: StockMoveForm = {
  productId: '',
  quantity: '1',
  unitCost: '',
  supplier: '',
  reason: '',
}

const EMPTY_WASTE_FORM: StockMoveForm = {
  productId: '',
  quantity: '1',
  unitCost: '',
  supplier: '',
  reason: '',
}

function StockTab() {
  const { toast } = useToast()
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [moves, setMoves] = useState<StockMove[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [receivingOpen, setReceivingOpen] = useState(false)
  const [wasteOpen, setWasteOpen] = useState(false)
  const [receivingForm, setReceivingForm] = useState<StockMoveForm>(EMPTY_RECEIVING_FORM)
  const [wasteForm, setWasteForm] = useState<StockMoveForm>(EMPTY_WASTE_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lowRes, movesRes, prodRes] = await Promise.all([
        fetch('/api/pos/stock'),
        fetch('/api/pos/stock/moves'),
        fetch('/api/pos/products'),
      ])
      const lowData = await lowRes.json()
      const movesData = await movesRes.json()
      const prodData = await prodRes.json()
      if (!lowRes.ok) throw new Error(lowData.error || 'Napaka')
      setLowStock(lowData.products ?? [])
      setMoves(movesData.moves ?? [])
      setProducts(prodData.products ?? [])
    } catch (e: any) {
      setError(e.message)
      toast({
        title: 'Napaka pri nalaganju',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const submitMove = async (
    form: StockMoveForm,
    type: 'receiving' | 'waste',
    close: () => void
  ) => {
    if (!form.productId || !form.quantity) {
      toast({
        title: 'Manjkajo podatki',
        description: 'Izberite izdelek in vnesite količino.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        productId: form.productId,
        type,
        quantity: Number(form.quantity),
      }
      if (type === 'receiving') {
        if (form.unitCost) body.unitCost = Number(form.unitCost)
        if (form.supplier) body.supplier = form.supplier
      } else {
        if (form.reason) body.reason = form.reason
      }
      const res = await fetch('/api/pos/stock/moves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri zapisu premika')
      toast({
        title: type === 'receiving' ? 'Sprejem zabeležen' : 'Odpis zabeležen',
        description: `${data.move.quantity} × ${data.move.product?.name ?? 'izdelek'}`,
      })
      close()
      await load()
    } catch (e: any) {
      toast({
        title: 'Napaka',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Skladišče</h2>
          <p className="text-xs text-slate-500">
            Nizka zaloga, zgodovina premikov, sprejemi in odpisi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Osveži</span>
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setReceivingForm(EMPTY_RECEIVING_FORM)
              setReceivingOpen(true)
            }}
          >
            <ArrowDownToLine className="size-4" />
            <span>Sprejem</span>
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setWasteForm(EMPTY_WASTE_FORM)
              setWasteOpen(true)
            }}
          >
            <Trash2 className="size-4" />
            <span>Odpis</span>
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Nizka zaloga */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageX className="size-4 text-red-600" />
                Nizka zaloga
                {lowStock.length > 0 && (
                  <Badge className="bg-red-100 text-red-800">{lowStock.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Izdelki, katerih zaloga je enaka ali pod minimalno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : lowStock.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Vse dobre zaloge"
                  description="Ni izdelkov z nizko zalogo."
                />
              ) : (
                <UITable>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Izdelek</TableHead>
                      <TableHead className="text-right">Zaloga</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium text-slate-800">{p.name}</div>
                          {p.sku && (
                            <div className="font-mono text-xs text-slate-400">{p.sku}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600 tabular-nums">
                          {p.stock} {p.unit || 'kos'}
                        </TableCell>
                        <TableCell className="text-right text-slate-500 tabular-nums">
                          {p.minStock ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </UITable>
              )}
            </CardContent>
          </Card>

          {/* Zgodovina premikov */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="size-4 text-emerald-600" />
                Zgodovina premikov
              </CardTitle>
              <CardDescription>Zadnji premiki zaloge.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : moves.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="Ni premikov"
                  description="Zgodovina premikov zaloge je prazna."
                />
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2 pr-2">
                    {moves.slice(0, 50).map((m) => {
                      const cfg = stockMoveTypeConfig[m.type] ?? {
                        label: m.type,
                        className: 'bg-slate-100 text-slate-700 border-slate-300',
                      }
                      return (
                        <div
                          key={m.id}
                          className="rounded-md border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge className={cn('border', cfg.className)}>
                              {cfg.label}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {formatDateTime(m.createdAt)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <div className="font-medium text-slate-800">
                              {m.product?.name ?? 'Neznan izdelek'}
                            </div>
                            <div className="font-semibold tabular-nums text-slate-700">
                              {m.type === 'waste' ? '-' : '+'}
                              {m.quantity} {m.product?.unit ?? ''}
                            </div>
                          </div>
                          {(m.reason || m.supplier || m.user) && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              {m.reason && (
                                <span className="flex items-center gap-1">
                                  <StickyNote className="size-3" />
                                  {m.reason}
                                </span>
                              )}
                              {m.supplier && (
                                <span className="flex items-center gap-1">
                                  <Tag className="size-3" />
                                  {m.supplier}
                                </span>
                              )}
                              {m.user?.name && (
                                <span className="flex items-center gap-1">
                                  <UsersIcon className="size-3" />
                                  {m.user.name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sprejem zaloge */}
      <Dialog open={receivingOpen} onOpenChange={setReceivingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sprejem zaloge</DialogTitle>
            <DialogDescription>
              Zabeleži sprejem nove zaloge od dobavitelja. Količina mora biti pozitivna.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="recv-product">Izdelek *</Label>
              <Select
                value={receivingForm.productId}
                onValueChange={(v) => setReceivingForm({ ...receivingForm, productId: v })}
              >
                <SelectTrigger id="recv-product" className="w-full">
                  <SelectValue placeholder="Izberi izdelek ..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="recv-qty">Količina *</Label>
                <Input
                  id="recv-qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={receivingForm.quantity}
                  onChange={(e) =>
                    setReceivingForm({ ...receivingForm, quantity: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="recv-cost">Nabavna cena (EUR/kos)</Label>
                <Input
                  id="recv-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={receivingForm.unitCost}
                  onChange={(e) =>
                    setReceivingForm({ ...receivingForm, unitCost: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recv-supplier">Dobavitelj</Label>
              <Input
                id="recv-supplier"
                value={receivingForm.supplier}
                onChange={(e) =>
                  setReceivingForm({ ...receivingForm, supplier: e.target.value })
                }
                placeholder="npr. Hofer, Mercator ..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivingOpen(false)}>
              Prekliči
            </Button>
            <Button
              onClick={() => submitMove(receivingForm, 'receiving', () => setReceivingOpen(false))}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Zabeleži sprejem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Odpis */}
      <Dialog open={wasteOpen} onOpenChange={setWasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odpis zaloge</DialogTitle>
            <DialogDescription>
              Zabeleži odpis (živila, lom, izgube). Količina mora biti pozitivna.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="waste-product">Izdelek *</Label>
              <Select
                value={wasteForm.productId}
                onValueChange={(v) => setWasteForm({ ...wasteForm, productId: v })}
              >
                <SelectTrigger id="waste-product" className="w-full">
                  <SelectValue placeholder="Izberi izdelek ..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="waste-qty">Količina *</Label>
              <Input
                id="waste-qty"
                type="number"
                min="0.01"
                step="0.01"
                value={wasteForm.quantity}
                onChange={(e) =>
                  setWasteForm({ ...wasteForm, quantity: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="waste-reason">Razlog odpisa</Label>
              <Textarea
                id="waste-reason"
                value={wasteForm.reason}
                onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                placeholder="npr. Potekel rok, lom, kuhinjska napaka ..."
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWasteOpen(false)}>
              Prekliči
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitMove(wasteForm, 'waste', () => setWasteOpen(false))}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Zabeleži odpis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// Zavihek 7: Stroški
// =============================================================================

interface ExpenseForm {
  category: string
  description: string
  amount: string
  date: string
  note: string
}

function todayISO(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

const EMPTY_EXPENSE_FORM: ExpenseForm = {
  category: 'other',
  description: '',
  amount: '',
  date: todayISO(),
  note: '',
}

function ExpensesTab() {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ExpenseForm>(EMPTY_EXPENSE_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      const res = await fetch(`/api/pos/expenses?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka')
      setExpenses(data.expenses ?? [])
      setTotal(data.total ?? 0)
    } catch (e: any) {
      setError(e.message)
      toast({
        title: 'Napaka pri nalaganju',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, toast])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    setForm({ ...EMPTY_EXPENSE_FORM, date: todayISO() })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.category || !form.description || form.amount === '') {
      toast({
        title: 'Manjkajo podatki',
        description: 'Kategorija, opis in znesek so obvezni.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pos/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          date: form.date || undefined,
          note: form.note || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri dodajanju')
      toast({
        title: 'Strošek dodan',
        description: `${data.expense.description} — ${formatEUR(data.expense.amount)}`,
      })
      setDialogOpen(false)
      await load()
    } catch (e: any) {
      toast({
        title: 'Napaka',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Stroški</h2>
          <p className="text-xs text-slate-500">
            Operativni stroški razvrščeni po kategorijah.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Osveži</span>
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            <span>Dodaj strošek</span>
          </Button>
        </div>
      </div>

      {/* Skupni stroški + filter */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Card className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <TrendingDown className="size-4 text-red-600" />
            Skupni stroški
          </div>
          <div className="text-2xl font-bold tabular-nums text-red-700">
            {formatEUR(total)}
          </div>
        </Card>
        <Card className="p-4">
          <Label htmlFor="exp-filter" className="mb-1.5 block text-xs text-slate-500">
            Filtriraj po kategoriji
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="exp-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vse kategorije</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {expenseCategoryLabels[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <ErrorState message={error} />
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Ni stroškov"
              description="Dodajte prvi strošek ali spremenite filter."
            />
          ) : (
            <UITable>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead className="hidden sm:table-cell">Kategorija</TableHead>
                  <TableHead className="hidden md:table-cell">Note</TableHead>
                  <TableHead className="text-right">Znesek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-slate-500">
                      {formatDate(e.date)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {e.description}
                      {e.note && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 md:hidden">
                          <StickyNote className="size-3" />
                          {e.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">
                        {expenseCategoryLabels[e.category] ?? e.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-slate-500 md:table-cell">
                      {e.note || '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-red-700">
                      {formatEUR(e.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </UITable>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj strošek</DialogTitle>
            <DialogDescription>
              Zabeleži nov operativni strošek. Polja označena z * so obvezna.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="exp-category">Kategorija *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger id="exp-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {expenseCategoryLabels[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exp-date">Datum</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exp-desc">Opis *</Label>
              <Input
                id="exp-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="npr. Najemnine za december"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exp-amount">Znesek (EUR) *</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exp-note">Opomba</Label>
              <Textarea
                id="exp-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Dodatne informacije ..."
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Prekliči
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Shrani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// Zavihek 8: Nastavitve
// =============================================================================

type SettingsForm = Settings

function SettingsTab() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SettingsForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/pos/settings')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka')
      setSettings(data.settings as Settings)
    } catch (e: any) {
      setError(e.message)
      toast({
        title: 'Napaka pri nalaganju',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/pos/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka pri shranjevanju')
      setSettings(data.settings as Settings)
      toast({
        title: 'Nastavitve shranjene',
        description: 'Spremembe so bile uspešno aplicirane.',
      })
    } catch (e: any) {
      toast({
        title: 'Napaka',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !settings) {
    return <ErrorState message={error ?? 'Nastavitve niso na voljo.'} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Nastavitve</h2>
          <p className="text-xs text-slate-500">
            Konfiguracija restavracije, davkov in tiskanja računov.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Ponovno naloži</span>
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>Shrani</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Osnovni podatki */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SettingsIcon className="size-4 text-emerald-600" />
              Osnovni podatki
            </CardTitle>
            <CardDescription>Podatki o restavraciji za račune.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="set-name">Ime restavracije</Label>
              <Input
                id="set-name"
                value={settings.restaurantName ?? ''}
                onChange={(e) => update('restaurantName', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="set-address">Naslov</Label>
              <Textarea
                id="set-address"
                value={settings.address ?? ''}
                onChange={(e) => update('address', e.target.value)}
                className="min-h-16"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="set-phone">Telefon</Label>
                <Input
                  id="set-phone"
                  value={settings.phone ?? ''}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="set-email">Email</Label>
                <Input
                  id="set-email"
                  type="email"
                  value={settings.email ?? ''}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="set-vat">Davčna številka</Label>
                <Input
                  id="set-vat"
                  value={settings.vatNumber ?? ''}
                  onChange={(e) => update('vatNumber', e.target.value)}
                  placeholder="SI12345678"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="set-tax">Davčna stopnja (%)</Label>
                <Input
                  id="set-tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    settings.taxRate !== undefined
                      ? String(Math.round(settings.taxRate * 10000) / 100)
                      : '22'
                  }
                  onChange={(e) =>
                    update('taxRate', Number(e.target.value) / 100)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="set-currency">Valuta</Label>
                <Input
                  id="set-currency"
                  value={settings.currency ?? 'EUR'}
                  onChange={(e) => update('currency', e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="set-symbol">Simbol valute</Label>
                <Input
                  id="set-symbol"
                  value={settings.currencySymbol ?? '€'}
                  onChange={(e) => update('currencySymbol', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Račun in tiskanje */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4 text-emerald-600" />
              Račun in tiskanje
            </CardTitle>
            <CardDescription>Vsebina glave/noge računa in nastavitve tiskanja.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="set-header">Glava računa</Label>
              <Textarea
                id="set-header"
                value={settings.receiptHeader ?? ''}
                onChange={(e) => update('receiptHeader', e.target.value)}
                className="min-h-16"
                placeholder="Dobrodošli ..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="set-footer">Noga računa</Label>
              <Textarea
                id="set-footer"
                value={settings.receiptFooter ?? ''}
                onChange={(e) => update('receiptFooter', e.target.value)}
                className="min-h-16"
                placeholder="Hvala za obisk ..."
              />
            </div>
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="set-lowstock" className="cursor-pointer">
                  Opozorila o nizki zalogi
                </Label>
                <Checkbox
                  id="set-lowstock"
                  checked={settings.lowStockAlert ?? false}
                  onCheckedChange={(v) => update('lowStockAlert', v === true)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="set-printkitchen" className="cursor-pointer">
                  Tiskaj kuhinjske račune
                </Label>
                <Checkbox
                  id="set-printkitchen"
                  checked={settings.printKitchenReceipt ?? false}
                  onCheckedChange={(v) => update('printKitchenReceipt', v === true)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="set-printclient" className="cursor-pointer">
                  Tiskaj račune za kupca
                </Label>
                <Checkbox
                  id="set-printclient"
                  checked={settings.printClientReceipt ?? false}
                  onCheckedChange={(v) => update('printClientReceipt', v === true)}
                />
              </div>
            </div>
            {settings.updatedAt && (
              <p className="text-xs text-slate-400">
                Zadnja posodobitev: {formatDateTime(settings.updatedAt)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Shrani nastavitve
        </Button>
      </div>

      {/* Nastavitve tiskalnika — ločena komponenta z lastnim UI-jem */}
      <PrinterSettings settings={settings} onSaved={load} />
    </div>
  )
}
