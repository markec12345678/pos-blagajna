'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  RefreshCw,
  ShoppingBag,
  Utensils,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

import {
  type Order,
  type OrderStatus,
  type OrderType,
  formatElapsed,
  formatTime,
  orderStatusConfig,
  orderTypeLabels,
} from './types'
import { usePosRealtime } from '@/lib/realtime'

// --- Konstante ---------------------------------------------------------------

type KitchenAction = 'start_preparing' | 'ready' | 'serve'

const VISIBLE_STATUSES: OrderStatus[] = ['sent', 'preparing', 'ready']

const REFRESH_INTERVAL_MS = 5_000
const TICK_INTERVAL_MS = 1_000

const ACTION_LABELS: Record<KitchenAction, string> = {
  start_preparing: 'Začni pripravo',
  ready: 'Označi kot pripravljeno',
  serve: 'Postreženo',
}

const ACTION_BY_STATUS: Record<OrderStatus, KitchenAction | null> = {
  open: null,
  sent: 'start_preparing',
  preparing: 'ready',
  ready: 'serve',
  served: null,
  cancelled: null,
  paid: null,
}

// --- Pomožne funkcije --------------------------------------------------------

function OrderTypeIcon({
  type,
  className,
}: {
  type: OrderType
  className?: string
}) {
  switch (type) {
    case 'takeaway':
      return <ShoppingBag className={className} aria-hidden />
    case 'delivery':
      return <Bike className={className} aria-hidden />
    case 'dine_in':
    default:
      return <Utensils className={className} aria-hidden />
  }
}

function getTableName(order: Order): string {
  if (order.type !== 'dine_in' || !order.table) return 'Prodnaja'
  return order.table.name
}

/**
 * Ali je naročilo "zastarelo" — kuhar naj ga obravnava prednostno.
 * - sent: več kot 10 minut od oddaje
 * - preparing: več kot 20 minut od oddaje
 * - ready: več kot 5 minut od pripravljenosti
 */
function isStale(order: Order, now: Date): boolean {
  const created = new Date(order.createdAt)
  if (Number.isNaN(created.getTime())) return false
  const mins = (now.getTime() - created.getTime()) / 60000
  if (order.status === 'sent') return mins >= 10
  if (order.status === 'preparing') return mins >= 20
  if (order.status === 'ready') {
    if (order.readyAt) {
      const ready = new Date(order.readyAt)
      if (!Number.isNaN(ready.getTime())) {
        return (now.getTime() - ready.getTime()) / 60000 >= 5
      }
    }
    return mins >= 5
  }
  return false
}

// --- Komponenta --------------------------------------------------------------

export function KitchenDisplay() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [now, setNow] = useState<Date>(() => new Date())
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set())
  const [fetchError, setFetchError] = useState<string | null>(null)

  // WebSocket za real-time posodobitve
  const { socket, isConnected } = usePosRealtime({ role: 'chef' })

  const fetchOrders = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false
      if (!silent) setIsRefreshing(true)
      try {
        const res = await fetch('/api/pos/orders/active', {
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body?.error || `Napaka ${res.status}`)
        }
        const data = (await res.json()) as { orders: Order[] }
        const filtered = data.orders
          .filter((o) => VISIBLE_STATUSES.includes(o.status))
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        setOrders(filtered)
        setFetchError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Neznana napaka'
        setFetchError(msg)
        if (!silent) {
          toast({
            title: 'Napaka pri nalaganju',
            description: msg,
            variant: 'destructive',
          })
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [toast]
  )

  // Prvo nalaganje + samodejna osvežitev vsakih 5 sekund.
  useEffect(() => {
    void fetchOrders()
    const id = window.setInterval(() => {
      void fetchOrders({ silent: true })
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [fetchOrders])

  // WebSocket listenerji — ko pridi novo naročilo ali se spremeni status,
  // takoj osveži podatke (brez čakanja na naslednji polling).
  useEffect(() => {
    if (!socket) return
    const onNewOrder = () => {
      console.log('[KDS] Realtime: novo naročilo, osvežujem...')
      void fetchOrders({ silent: true })
    }
    const onStatusChange = () => {
      console.log('[KDS] Realtime: sprememba statusa, osvežujem...')
      void fetchOrders({ silent: true })
    }
    const onKdsRefresh = () => {
      console.log('[KDS] Realtime: zahteva za osvežitev')
      void fetchOrders({ silent: true })
    }
    socket.on('order:new', onNewOrder)
    socket.on('order:status', onStatusChange)
    socket.on('kds:refresh', onKdsRefresh)
    return () => {
      socket.off('order:new', onNewOrder)
      socket.off('order:status', onStatusChange)
      socket.off('kds:refresh', onKdsRefresh)
    }
  }, [socket, fetchOrders])

  // Vsako sekundo posodobi `now`, da se prikaz pretečenega časa samodejno
  // osvežuje, ne da bi pri tem morali znova pridobivati naročila.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), TICK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  const handleAction = useCallback(
    async (order: Order, action: KitchenAction) => {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.add(order.id)
        return next
      })
      try {
        const res = await fetch(`/api/pos/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body?.error || `Napaka ${res.status}`)
        }
        const data = (await res.json()) as { order: Order }
        // Če naročilo po akciji ni več v vidnem seznamu, ga odstranimo;
        // sicer posodobimo lokalno stanje, da je UI takoj consistenten.
        setOrders((prev) => {
          if (!VISIBLE_STATUSES.includes(data.order.status)) {
            return prev.filter((o) => o.id !== data.order.id)
          }
          return prev.map((o) => (o.id === data.order.id ? data.order : o))
        })
        toast({
          title: 'Uspešno posodobljeno',
          description: `Naročilo ${order.orderNo}: ${ACTION_LABELS[action]}`,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Neznana napaka'
        toast({
          title: 'Napaka pri posodobitvi',
          description: msg,
          variant: 'destructive',
        })
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev)
          next.delete(order.id)
          return next
        })
      }
    },
    [toast]
  )

  const counts = useMemo(() => {
    const c = { sent: 0, preparing: 0, ready: 0 }
    for (const o of orders) {
      if (o.status === 'sent') c.sent += 1
      else if (o.status === 'preparing') c.preparing += 1
      else if (o.status === 'ready') c.ready += 1
    }
    return c
  }, [orders])

  // --- Stanje: prvo nalaganje ----------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Glava z naslovom in povzetkom statusov */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ChefHat className="size-7 text-orange-500" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Kuhinjski zaslon
            </h1>
            <p className="text-sm text-slate-500">
              Aktivna naročila · {orders.length} skupno
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800"
          >
            Poslano: {counts.sent}
          </Badge>
          <Badge
            variant="outline"
            className="border-orange-300 bg-orange-50 text-orange-800"
          >
            V pripravi: {counts.preparing}
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-50 text-emerald-800"
          >
            Pripravljeno: {counts.ready}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void fetchOrders()}
            disabled={isRefreshing}
            aria-label="Osveži"
            className="size-10"
          >
            <RefreshCw
              className={cn('size-4', isRefreshing && 'animate-spin')}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      {fetchError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Prazno stanje */}
      {orders.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300 py-0">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="size-8 text-emerald-500" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">
                Ni aktivnih naročil
              </p>
              <p className="text-sm text-slate-500">
                Vsa naročila so postrežena. Kuhinja je pripravljena za naslednji
                val!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((order) => {
            const config = orderStatusConfig[order.status]
            const action = ACTION_BY_STATUS[order.status]
            const isUpdating = updatingIds.has(order.id)
            const stale = isStale(order, now)
            return (
              <Card
                key={order.id}
                className={cn(
                  'gap-0 border-2 py-0 shadow-sm',
                  config.border,
                  stale && 'ring-2 ring-red-300 ring-offset-1'
                )}
              >
                <CardHeader
                  className={cn(
                    'rounded-t-xl px-4 py-3',
                    config.headerBg
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="text-xl font-bold tracking-tight text-slate-900">
                        {order.orderNo}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          config.badgeBorder,
                          config.badgeBg,
                          config.badgeText
                        )}
                      >
                        {config.label}
                      </Badge>
                    </CardTitle>
                    <span
                      title={orderTypeLabels[order.type]}
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md bg-white/70',
                        config.text
                      )}
                    >
                      <OrderTypeIcon type={order.type} className="size-4" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span className="font-medium">{getTableName(order)}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="size-3.5" aria-hidden />
                      {formatTime(order.createdAt)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="px-4 py-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Čas od naročila
                    </span>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-lg font-bold tabular-nums',
                        stale ? 'text-red-600' : 'text-slate-900'
                      )}
                    >
                      {stale && <AlertCircle className="size-4" aria-hidden />}
                      {formatElapsed(order.createdAt, now)}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="text-sm leading-tight">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-slate-900">
                            <span className="text-slate-500">
                              {item.quantity}x
                            </span>{' '}
                            {item.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {item.total.toFixed(2)} €
                          </span>
                        </div>
                        {item.note && (
                          <div className="mt-0.5 pl-4 text-xs text-slate-500">
                            ↳ {item.note}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {order.note && (
                    <div className="mt-3 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      <span className="font-semibold">Opomba naročila:</span>{' '}
                      {order.note}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="px-4 pb-4 pt-0">
                  {action ? (
                    <Button
                      onClick={() => void handleAction(order, action)}
                      disabled={isUpdating}
                      className={cn(
                        'h-12 w-full text-sm font-semibold',
                        config.buttonClass
                      )}
                    >
                      {isUpdating && (
                        <RefreshCw className="size-4 animate-spin" aria-hidden />
                      )}
                      {ACTION_LABELS[action]}
                    </Button>
                  ) : (
                    <div className="flex h-12 w-full items-center justify-center text-sm text-slate-400">
                      Brez razpoložljive akcije
                    </div>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default KitchenDisplay
