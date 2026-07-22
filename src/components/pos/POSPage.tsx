'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Product, Category, CartItem, Sale, User, Order, Table, Settings, formatEUR, formatDate, orderStatusConfig } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, Receipt,
  CreditCard, Wallet, Smartphone, Printer, Clock, TrendingUp,
  Package, Tag, User as UserIcon, Percent, CheckCircle2, LogOut,
  Utensils, ChefHat, Settings as SettingsIcon, ClipboardList
} from 'lucide-react'
import KitchenDisplay from './KitchenDisplay'
import AdminPanel from './AdminPanel'
import { usePosRealtime, notifyNewOrder, notifyOrderStatusChange, notifyNewSale, disconnectRealtime } from '@/lib/realtime'

export default function POSPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeTab, setActiveTab] = useState<'blagajna' | 'narocila' | 'kuhinja' | 'zgodovina' | 'admin'>('blagajna')
  const [sales, setSales] = useState<Sale[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in')
  const [discount, setDiscount] = useState<number>(0)
  const [tips, setTips] = useState<number>(0)
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash')
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)

  // Preveri auth
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUser(data.user)
      setAuthLoading(false)
    }).catch(() => {
      router.push('/login')
    })
  }, [router])

  // Nalozi settings
  useEffect(() => {
    if (!user) return
    fetch('/api/pos/settings').then(r => r.json()).then(data => {
      if (data.settings) setSettings(data.settings)
    }).catch(() => {})
  }, [user])

  // Nalozi kategorije in mize
  useEffect(() => {
    if (!user) return
    fetch('/api/pos/categories').then(r => r.json()).then(data => setCategories(data.categories || [])).catch(() => {})
    fetch('/api/pos/tables').then(r => r.json()).then(data => setTables(data.tables || [])).catch(() => {})
  }, [user])

  // Nalozi izdelke
  const loadProducts = useCallback(() => {
    if (!user) return
    const params = new URLSearchParams()
    if (selectedCategory !== 'all') params.set('categoryId', selectedCategory)
    if (search) params.set('search', search)
    fetch(`/api/pos/products?${params}`)
      .then(r => r.json())
      .then(data => setProducts(data.products || []))
      .catch(e => console.error(e))
  }, [selectedCategory, search, user])

  useEffect(() => {
    const t = setTimeout(loadProducts, 200)
    return () => clearTimeout(t)
  }, [loadProducts])

  // Barkod scan: ko uporabnik pritisne Enter v iskalnem polju, preveri
  // ali obstaja izdelek z natančnim SKU/barkodom. Če da, ga dodaj v košarico.
  const handleBarcodeScan = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    try {
      const res = await fetch(`/api/pos/products?barcode=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (data.product) {
        addToCart(data.product)
        toast({
          title: '✅ Izdelek dodan',
          description: `${data.product.name} — ${formatEUR(data.product.price)}`,
        })
        setSearch('')
      } else {
        // Ne najdemo — pusti v iskalniku za normalno iskanje
        console.log('[Barcode] Ni najden:', trimmed)
      }
    } catch (e) {
      console.error('[Barcode] Napaka:', e)
    }
  }

  // Nalozi zgodovino
  const loadSales = useCallback(() => {
    if (!user) return
    fetch('/api/pos/sales?limit=50')
      .then(r => r.json())
      .then(data => setSales(data.sales || []))
      .catch(e => console.error(e))
  }, [user])

  // Nalozi aktivna narocila
  const loadOrders = useCallback(() => {
    if (!user) return
    fetch('/api/pos/orders/active')
      .then(r => r.json())
      .then(data => setOrders(data.orders || []))
      .catch(e => console.error(e))
  }, [user])

  useEffect(() => {
    if (activeTab === 'zgodovina') loadSales()
    if (activeTab === 'narocila') loadOrders()
  }, [activeTab, loadSales, loadOrders])

  // Logout
  const handleLogout = async () => {
    disconnectRealtime()
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // WebSocket za real-time posodobitve (samo za admin/cashier)
  const { socket, isConnected } = usePosRealtime({
    role: user?.role,
    username: user?.username,
  })

  // Ko pride novo naročilo ali se spremeni status, osveži prikaz
  useEffect(() => {
    if (!socket || !user) return
    const onOrderStatus = (data: { orderId: string; status: string; orderNo: string }) => {
      // Osveži seznam naročil, če smo na tem tabu
      if (activeTab === 'narocila') {
        loadOrders()
      }
      // Pokaži toast za pomembne spremembe
      if (data.status === 'ready') {
        toast({
          title: '🍽️ Naročilo pripravljeno',
          description: `${data.orderNo} je pripravljeno za postrežbo`,
        })
      } else if (data.status === 'served') {
        toast({
          title: '✅ Naročilo postreženo',
          description: `${data.orderNo}`,
        })
      }
    }
    const onNewOrder = (data: { orderNo: string }) => {
      if (activeTab === 'narocila') {
        loadOrders()
      }
    }
    socket.on('order:status', onOrderStatus)
    socket.on('order:new', onNewOrder)
    return () => {
      socket.off('order:status', onOrderStatus)
      socket.off('order:new', onNewOrder)
    }
  }, [socket, user, activeTab, loadOrders, toast])

  // Cart operacije
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(it => it.productId === product.id)
      if (existing) {
        return prev.map(it =>
          it.productId === product.id
            ? { ...it, quantity: it.quantity + 1, total: (it.quantity + 1) * it.price }
            : it
        )
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        unit: product.unit || 'kos',
        total: product.price,
      }]
    })
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(it => {
        if (it.productId === productId) {
          const newQty = it.quantity + delta
          if (newQty <= 0) return null
          return { ...it, quantity: newQty, total: newQty * it.price }
        }
        return it
      })
      .filter(Boolean) as CartItem[])
  }

  const setQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(it => it.productId !== productId))
      return
    }
    setCart(prev => prev.map(it =>
      it.productId === productId
        ? { ...it, quantity: qty, total: qty * it.price }
        : it
    ))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(it => it.productId !== productId))
  }

  const clearCart = () => {
    setCart([])
    setDiscount(0)
    setTips(0)
    setPaidAmount('')
    setCustomerName('')
    setNote('')
    setSelectedTable('')
    setOrderType('dine_in')
  }

  // Izracun
  const subtotal = cart.reduce((sum, it) => sum + it.total, 0)
  const discountAmount = Math.min(discount || 0, subtotal)
  const tipsAmount = tips || 0
  const total = Math.max(0, subtotal - discountAmount) + tipsAmount
  const taxRate = settings?.taxRate ?? 0.22
  const taxAmount = Math.max(0, subtotal - discountAmount) * taxRate / (1 + taxRate)
  const paid = parseFloat(paidAmount || '0') || 0
  const change = Math.max(0, paid - total)

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: 'Košarica je prazna', variant: 'destructive' })
      return
    }
    if (paymentMethod === 'cash' && paid < total - 0.01) {
      toast({ title: 'Plačilo ni dovolj', description: `Manjka ${formatEUR(total - paid)}`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          paymentMethod,
          paidAmount: paid,
          customerName: customerName || null,
          note: note || null,
          discount: discountAmount,
          tips: tipsAmount,
          cashierId: user?.id,
          settings: { taxRate },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka')

      setLastSale(data.sale)
      setIsCheckoutOpen(false)
      setIsReceiptOpen(true)
      clearCart()
      toast({
        title: 'Prodaja uspešna!',
        description: `Račun ${data.sale.receiptNo} — ${formatEUR(data.sale.total)}`,
      })
      // Obvesti vse admin/dashboard povezane o novi prodaji
      notifyNewSale({ receiptNo: data.sale.receiptNo, total: data.sale.total })
    } catch (e: any) {
      toast({ title: 'Napaka pri prodaji', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Ustvari narocilo (za kuhinjo)
  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      toast({ title: 'Košarica je prazna', variant: 'destructive' })
      return
    }
    if (orderType === 'dine_in' && !selectedTable) {
      toast({ title: 'Izberi mizo', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: orderType === 'dine_in' ? selectedTable : null,
          type: orderType,
          customerName: customerName || null,
          note: note || null,
          items: cart.map(it => ({
            productId: it.productId,
            quantity: it.quantity,
            note: it.note,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka')

      toast({
        title: 'Naročilo ustvarjeno!',
        description: `${data.order.orderNo} — pošiljam v kuhinjo`,
      })
      // Obvesti vse kuharje in admin o novem naročilu (real-time)
      notifyNewOrder({
        orderId: data.order.id,
        orderNo: data.order.orderNo,
        table: data.order.tableId,
        items: data.order.items || [],
      })
      clearCart()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const setQuickPay = () => setPaidAmount(total.toFixed(2))
  const quickCash = [total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10]

  // Ack sajta - dokler ne preverimo auth
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Nalagam...</div>
      </div>
    )
  }

  const isAdmin = user.role === 'admin'
  const isChef = user.role === 'chef'
  const isCashier = user.role === 'cashier'

  // Chef vidi samo kuhinjo
  if (isChef) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b shadow-sm sticky top-0 z-30">
          <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-none">Kuhinja</h1>
                <p className="text-xs text-slate-500 mt-0.5">{user.name}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Odjava
            </Button>
          </div>
        </header>
        <main className="max-w-[1600px] mx-auto p-4">
          <KitchenDisplay />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">
                {settings?.restaurantName || 'POS Blagajna'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {user.name} · {user.role === 'admin' ? 'Administrator' : 'Blagajnik'}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="blagajna" className="gap-2">
                <ShoppingCart className="w-4 h-4" /> Blagajna
              </TabsTrigger>
              <TabsTrigger value="narocila" className="gap-2">
                <ClipboardList className="w-4 h-4" /> Naročila
                {orders.length > 0 && (
                  <Badge className="ml-1 bg-amber-500">{orders.length}</Badge>
                )}
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="gap-2">
                  <SettingsIcon className="w-4 h-4" /> Admin
                </TabsTrigger>
              )}
              <TabsTrigger value="zgodovina" className="gap-2">
                <Clock className="w-4 h-4" /> Zgodovina
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-500">Danes</div>
              <div className="text-sm font-medium text-slate-900">
                {new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Vsebina */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4">
        {activeTab === 'blagajna' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 h-[calc(100vh-120px)]">
            {/* LEVO: katalog */}
            <div className="flex flex-col bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Iskanje izdelkov po imenu/SKU ali pa skeniraj barkodo + Enter..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleBarcodeScan(search)
                      }
                    }}
                    className="pl-9 h-10"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Button
                    size="sm"
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory('all')}
                    className="shrink-0"
                  >
                    Vsi ({products.length})
                  </Button>
                  {categories.map(cat => (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="shrink-0 gap-1.5"
                      style={selectedCategory === cat.id ? {
                        backgroundColor: cat.color,
                        borderColor: cat.color,
                      } : { color: cat.color, borderColor: cat.color + '50' }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={p.stock <= 0 && p.minStock > 0}
                      className="group relative bg-white border rounded-lg p-3 text-left hover:border-emerald-500 hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {p.category && (
                        <div
                          className="absolute top-2 right-2 w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.category.color }}
                          title={p.category.name}
                        />
                      )}
                      <div className="aspect-square mb-2 rounded-md bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="font-medium text-sm text-slate-900 line-clamp-2 mb-1 min-h-[2.5rem]">
                        {p.name}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-emerald-600">{formatEUR(p.price)}</div>
                        {p.stock <= 5 && p.minStock > 0 && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                            {p.stock} {p.unit}
                          </Badge>
                        )}
                        {p.stock <= 0 && p.minStock > 0 && (
                          <Badge variant="outline" className="text-red-600 border-red-300 text-[10px]">
                            Ni zal.
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                  {products.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Ni najdenih izdelkov</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* DESNO: kosarica */}
            <div className="flex flex-col bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b bg-slate-50">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Košarica
                    {cart.length > 0 && <Badge className="ml-1">{cart.length}</Badge>}
                  </h2>
                  {cart.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={clearCart} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2">
                  {cart.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Košarica je prazna</p>
                      <p className="text-xs mt-1">Kliknite na izdelek za dodajanje</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.productId} className="flex items-start gap-2 p-2 border-b last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 line-clamp-2">{item.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatEUR(item.price)} × {item.quantity} = <span className="font-semibold text-slate-900">{formatEUR(item.total)}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.productId, -1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => setQuantity(item.productId, parseFloat(e.target.value) || 0)}
                              className="h-7 w-14 px-1 text-center text-xs"
                              step="0.5"
                            />
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.productId, 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto text-red-600 hover:text-red-700" onClick={() => removeFromCart(item.productId)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {cart.length > 0 && (
                <div className="border-t bg-slate-50 p-4 space-y-3">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Vrednost:</span>
                      <span>{formatEUR(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Popust:</span>
                      <Input
                        type="number"
                        value={discount || ''}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="h-7 w-24 px-2 text-right text-xs"
                        placeholder="0.00"
                        step="0.10"
                        min="0"
                      />
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>💆 Napitnina:</span>
                      <Input
                        type="number"
                        value={tips || ''}
                        onChange={(e) => setTips(parseFloat(e.target.value) || 0)}
                        className="h-7 w-24 px-2 text-right text-xs"
                        placeholder="0.00"
                        step="0.10"
                        min="0"
                      />
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>DDV ({(taxRate * 100).toFixed(0)}% vključen):</span>
                      <span>{formatEUR(taxAmount)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-slate-900">SKUPAJ:</span>
                      <span className="font-bold text-emerald-600 text-xl">{formatEUR(total)}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setIsCheckoutOpen(true)}
                  >
                    <Receipt className="w-5 h-5 mr-2" /> Zaključi prodajo
                  </Button>
                  <Button
                    className="w-full h-10 text-sm bg-amber-500 hover:bg-amber-600"
                    onClick={handleCreateOrder}
                    disabled={loading}
                  >
                    <ClipboardList className="w-4 h-4 mr-2" /> Pošlji v kuhinjo
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'narocila' && (
          <OrdersView orders={orders} onRefresh={loadOrders} onPay={(order) => {
            // Pretvori naročilo v košarico
            setCart(order.items.map(it => ({
              productId: it.productId || '',
              name: it.name,
              price: it.price,
              quantity: it.quantity,
              unit: it.unit,
              total: it.total,
            })))
            setSelectedTable(order.tableId || '')
            setCustomerName(order.customerName || '')
            setActiveTab('blagajna')
            toast({ title: 'Naročilo naloženo', description: 'V košarici — končaj prodajo' })
          }} />
        )}

        {activeTab === 'zgodovina' && (
          <SalesHistory sales={sales} onRefresh={loadSales} onView={(sale) => {
            setLastSale(sale)
            setIsReceiptOpen(true)
          }} />
        )}

        {activeTab === 'admin' && isAdmin && <AdminPanel />}
      </main>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zaključi prodajo</DialogTitle>
            <DialogDescription>
              Skupaj za plačilo: <span className="font-bold text-emerald-600">{formatEUR(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Način plačila</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <Button variant={paymentMethod === 'cash' ? 'default' : 'outline'} onClick={() => setPaymentMethod('cash')} className="h-16 flex-col gap-1">
                  <Wallet className="w-5 h-5" /><span className="text-xs">Gotovina</span>
                </Button>
                <Button variant={paymentMethod === 'card' ? 'default' : 'outline'} onClick={() => setPaymentMethod('card')} className="h-16 flex-col gap-1">
                  <CreditCard className="w-5 h-5" /><span className="text-xs">Kartica</span>
                </Button>
                <Button variant={paymentMethod === 'mobile' ? 'default' : 'outline'} onClick={() => setPaymentMethod('mobile')} className="h-16 flex-col gap-1">
                  <Smartphone className="w-5 h-5" /><span className="text-xs">Mobilno</span>
                </Button>
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div>
                <Label className="text-xs text-slate-500">Plačano (EUR)</Label>
                <Input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="text-lg font-bold h-12"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {Array.from(new Set(quickCash)).map((amt, i) => (
                    <Button key={i} size="sm" variant="outline" onClick={() => setPaidAmount(amt.toFixed(2))} className="text-xs">
                      {formatEUR(amt)}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="secondary" onClick={setQuickPay} className="w-full mt-1.5">
                  Točno: {formatEUR(total)}
                </Button>
                {paid > 0 && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-md text-center">
                    <div className="text-xs text-slate-600">Vračilo:</div>
                    <div className="text-xl font-bold text-emerald-600">{formatEUR(change)}</div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs text-slate-500">Kupec (opcijsko)</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ime kupca" className="mt-1.5" />
            </div>

            <div>
              <Label className="text-xs text-slate-500">Opomba (opcijsko)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opomba na računu..." rows={2} className="mt-1.5 text-sm" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>Prekliči</Button>
            <Button onClick={handleCheckout} disabled={loading || (paymentMethod === 'cash' && paid < total - 0.01)} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? 'Obdelava...' : 'Zaključi in natisni'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <DialogTitle>Prodaja uspešna</DialogTitle>
                <DialogDescription>Račun je bil ustvarjen</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {lastSale && <ReceiptView sale={lastSale} settings={settings} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Natisni
            </Button>
            <Button onClick={() => setIsReceiptOpen(false)}>Nov račun</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Komponenta: aktivna narocila
function OrdersView({ orders, onRefresh, onPay }: {
  orders: Order[]
  onRefresh: () => void
  onPay: (order: Order) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  const handleAction = async (orderId: string, action: string) => {
    setLoading(orderId)
    try {
      const res = await fetch(`/api/pos/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Napaka')
      const data = await res.json()
      toast({ title: 'Status posodobljen' })
      onRefresh()
      // Obvesti kuharje in admin o spremembi statusa (real-time)
      if (data.order) {
        notifyOrderStatusChange({
          orderId: data.order.id,
          status: data.order.status,
          orderNo: data.order.orderNo,
        })
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(null)
    }
  }

  const sorted = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Aktivna naročila ({orders.length})</h2>
        <Button size="sm" variant="ghost" onClick={onRefresh}>Osveži</Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ni aktivnih naročil</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map(order => {
            const cfg = orderStatusConfig[order.status as keyof typeof orderStatusConfig]
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-sm font-bold">{order.orderNo}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {order.table?.name || (order.type === 'takeaway' ? 'Prodnaja' : 'Dostava')}
                      </div>
                    </div>
                    <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-slate-500">
                    {new Date(order.createdAt).toLocaleString('sl-SI')}
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {order.items.map(it => (
                      <div key={it.id} className="text-sm flex justify-between">
                        <span className="truncate pr-2">{it.quantity}× {it.name}</span>
                        <span className="text-slate-500">{formatEUR(it.total)}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Skupaj:</span>
                    <span>{formatEUR(order.total)}</span>
                  </div>
                  {order.note && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                      📝 {order.note}
                    </div>
                  )}
                  <div className="flex gap-1 pt-1">
                    {order.status === 'open' && (
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" disabled={loading === order.id} onClick={() => handleAction(order.id, 'send')}>
                        Pošlji v kuhinjo
                      </Button>
                    )}
                    {order.status === 'ready' && (
                      <>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" disabled={loading === order.id} onClick={() => handleAction(order.id, 'serve')}>
                          Postreženo
                        </Button>
                        <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onPay(order)}>
                          Plačaj
                        </Button>
                      </>
                    )}
                    {order.status === 'served' && (
                      <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onPay(order)}>
                        Plačaj
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600" disabled={loading === order.id} onClick={() => handleAction(order.id, 'cancel')}>
                      Prekliči
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Komponenta: zgodovina prodaje
function SalesHistory({ sales, onRefresh, onView }: {
  sales: Sale[]
  onRefresh: () => void
  onView: (sale: Sale) => void
}) {
  const todaySales = sales.filter(s => {
    const d = new Date(s.createdAt)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0)
  const todayTips = todaySales.reduce((sum, s) => sum + s.tips, 0)
  const avgReceipt = sales.length > 0 ? sales.reduce((sum, s) => sum + s.total, 0) / sales.length : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Danes prodano</div>
                <div className="text-xl font-bold">{formatEUR(todayTotal)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Računov danes</div>
                <div className="text-xl font-bold">{todaySales.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Povprečni račun</div>
                <div className="text-xl font-bold">{formatEUR(avgReceipt)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Napitnine danes</div>
                <div className="text-xl font-bold">{formatEUR(todayTips)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Zadnja prodaja</CardTitle>
          <Button size="sm" variant="ghost" onClick={onRefresh}>Osveži</Button>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni še prodaje</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {sales.map(sale => (
                <div
                  key={sale.id}
                  className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <button
                    onClick={() => onView(sale)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{sale.receiptNo}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {sale.paymentMethod === 'cash' ? 'Gotovina' : sale.paymentMethod === 'card' ? 'Kartica' : 'Mobilno'}
                        </Badge>
                        {sale.tips > 0 && <Badge variant="outline" className="text-[10px] text-amber-700">💆 {formatEUR(sale.tips)}</Badge>}
                        {sale.status === 'refunded' && (
                          <Badge variant="outline" className="text-[10px] text-red-700 border-red-300">STORNIRANO</Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(sale.createdAt).toLocaleString('sl-SI')} • {sale.items.length} postavk
                        {sale.customerName && ` • ${sale.customerName}`}
                        {sale.cashier?.name && ` • ${sale.cashier.name}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${sale.status === 'refunded' ? 'text-red-600 line-through' : ''}`}>
                        {formatEUR(sale.total)}
                      </div>
                    </div>
                  </button>
                  {sale.status === 'completed' && (
                    <RefundButton saleId={sale.id} receiptNo={sale.receiptNo} onRefunded={onRefresh} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Komponenta: izpis računa
function ReceiptView({ sale, settings }: { sale: Sale, settings: Settings | null }) {
  return (
    <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-4 font-mono text-xs space-y-2">
      <div className="text-center">
        <div className="font-bold text-sm">{settings?.restaurantName || 'POS BLAGAJNA'}</div>
        {settings?.address && <div className="text-slate-500">{settings.address}</div>}
        {settings?.phone && <div className="text-slate-500">Tel: {settings.phone}</div>}
        {settings?.vatNumber && <div className="text-slate-500">Davčna št.: {settings.vatNumber}</div>}
        {settings?.receiptHeader && <div className="text-slate-600 mt-1">{settings.receiptHeader}</div>}
      </div>
      <Separator />
      <div className="flex justify-between">
        <span>Račun:</span>
        <span className="font-bold">{sale.receiptNo}</span>
      </div>
      <div className="flex justify-between">
        <span>Datum:</span>
        <span>{new Date(sale.createdAt).toLocaleString('sl-SI')}</span>
      </div>
      {sale.customerName && (
        <div className="flex justify-between">
          <span>Kupec:</span>
          <span>{sale.customerName}</span>
        </div>
      )}
      {sale.cashier?.name && (
        <div className="flex justify-between">
          <span>Blagajnik:</span>
          <span>{sale.cashier.name}</span>
        </div>
      )}
      <Separator />
      <div className="space-y-1">
        {sale.items.map((it, i) => (
          <div key={i}>
            <div className="flex justify-between">
              <span className="truncate pr-2">{it.name}</span>
              <span>{formatEUR(it.total)}</span>
            </div>
            <div className="text-slate-500 text-[10px]">
              {it.quantity} {it.unit} × {formatEUR(it.price)}
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="flex justify-between">
        <span>Vrednost:</span>
        <span>{formatEUR(sale.subtotal)}</span>
      </div>
      {sale.discount > 0 && (
        <div className="flex justify-between text-red-600">
          <span>Popust:</span>
          <span>-{formatEUR(sale.discount)}</span>
        </div>
      )}
      <div className="flex justify-between text-slate-500 text-[10px]">
        <span>DDV {(sale.taxRate * 100).toFixed(0)}% (vključen):</span>
        <span>{formatEUR(sale.taxAmount)}</span>
      </div>
      {sale.tips > 0 && (
        <div className="flex justify-between">
          <span>Napitnina:</span>
          <span>{formatEUR(sale.tips)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
        <span>SKUPAJ:</span>
        <span>{formatEUR(sale.total)}</span>
      </div>
      {sale.paymentMethod === 'cash' && (
        <>
          <div className="flex justify-between">
            <span>Plačano:</span>
            <span>{formatEUR(sale.paidAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Vračilo:</span>
            <span>{formatEUR(sale.changeAmount)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between">
        <span>Plačilo:</span>
        <span>
          {sale.paymentMethod === 'cash' && 'Gotovina'}
          {sale.paymentMethod === 'card' && 'Kartica'}
          {sale.paymentMethod === 'mobile' && 'Mobilno'}
        </span>
      </div>
      {sale.note && (
        <>
          <Separator />
          <div className="text-slate-600">{sale.note}</div>
        </>
      )}
      {settings?.receiptFooter && (
        <div className="text-center pt-2 text-slate-500">{settings.receiptFooter}</div>
      )}
    </div>
  )
}

// Komponenta: gumb za storno računa (admin only)
function RefundButton({ saleId, receiptNo, onRefunded }: {
  saleId: string
  receiptNo: string
  onRefunded: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRefund = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pos/sales/${saleId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Brez razloga' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Napaka')
      toast({
        title: '✅ Račun storniran',
        description: `${receiptNo} — zaloge so bile vrnjene`,
      })
      setOpen(false)
      setReason('')
      onRefunded()
    } catch (e: any) {
      toast({ title: 'Napaka pri stornu', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-red-600 border-red-300 hover:bg-red-50 h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        Storno
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Storno računa {receiptNo}?</DialogTitle>
            <DialogDescription>
              Dejanje je nepopravljivo. Zaloge bodo vrnjene, račun pa označen kot storniran.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-500">Razlog storna</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Npr. kupec je vrnil izdelek, napaka na računu..."
                rows={3}
                className="mt-1.5 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Prekliči</Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={loading}
            >
              {loading ? 'Storniram...' : 'Potrdi storno'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
