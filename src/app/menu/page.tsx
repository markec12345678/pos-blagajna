'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { LanguageSwitcher } from '@/components/pos/LanguageSwitcher'
import { useI18n } from '@/i18n'
import { Utensils, Phone, MapPin, Clock, Calendar, Users, ShoppingCart, Plus, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

interface PublicProduct {
  id: string
  name: string
  description?: string | null
  price: number
  image?: string | null
  categoryId: string
}

interface PublicCategory {
  id: string
  name: string
  color: string
  products: PublicProduct[]
}

interface PublicRestaurant {
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  vatNumber?: string | null
  currencySymbol: string
  taxRate: number
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

function formatPrice(amount: number, symbol: string = '€'): string {
  return `${amount.toFixed(2).replace('.', ',')} ${symbol}`
}

export default function MenuPage() {
  const { toast } = useToast()
  const { t, lang } = useI18n()
  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null)
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isReserveOpen, setIsReserveOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [reserveSuccess, setReserveSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/public/menu')
      .then(r => r.json())
      .then(data => {
        setRestaurant(data.restaurant)
        setCategories(data.categories || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const allProducts = categories.flatMap(c => c.products)
  const filteredProducts = activeCategory === 'all'
    ? allProducts
    : categories.find(c => c.id === activeCategory)?.products || []

  const addToCart = (product: PublicProduct) => {
    setCart(prev => {
      const existing = prev.find(it => it.productId === product.id)
      if (existing) {
        return prev.map(it => it.productId === product.id
          ? { ...it, quantity: it.quantity + 1 }
          : it)
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
    toast({ title: '✅ Dodano', description: product.name, duration: 1500 })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(it => {
      if (it.productId === productId) {
        const newQty = it.quantity + delta
        return newQty <= 0 ? null : { ...it, quantity: newQty }
      }
      return it
    }).filter(Boolean) as CartItem[])
  }

  const cartTotal = cart.reduce((sum, it) => sum + it.price * it.quantity, 0)
  const cartCount = cart.reduce((sum, it) => sum + it.quantity, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <a href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">{restaurant?.name || 'Restavracija'}</h1>
                {restaurant?.address && <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{restaurant.address}</p>}
              </div>
            </a>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button size="sm" variant="outline" onClick={() => setIsReserveOpen(true)}>
                <Calendar className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{lang === 'sl' ? 'Rezerviraj' : lang === 'en' ? 'Reserve' : 'Prenota'}</span>
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 relative" onClick={() => setIsCartOpen(true)}>
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white py-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">{restaurant?.name}</h2>
          <p className="text-emerald-100 text-sm">
            {lang === 'sl' ? 'Dobrodošli v naši restavraciji' : lang === 'en' ? 'Welcome to our restaurant' : 'Benvenuti al nostro ristorante'}
          </p>
          {restaurant?.phone && (
            <p className="mt-2 text-sm flex items-center justify-center gap-1">
              <Phone className="w-4 h-4" /> {restaurant.phone}
            </p>
          )}
        </div>
      </div>

      {/* Kategorije */}
      <div className="sticky top-[65px] z-20 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
          <Button
            size="sm"
            variant={activeCategory === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveCategory('all')}
            className="shrink-0"
          >
            {lang === 'sl' ? 'Vse' : lang === 'en' ? 'All' : 'Tutti'} ({allProducts.length})
          </Button>
          {categories.map(cat => (
            <Button
              key={cat.id}
              size="sm"
              variant={activeCategory === cat.id ? 'default' : 'outline'}
              onClick={() => setActiveCategory(cat.id)}
              className="shrink-0 gap-1.5"
              style={activeCategory === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : { color: cat.color, borderColor: cat.color + '50' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name} ({cat.products.length})
            </Button>
          ))}
        </div>
      </div>

      {/* Meni */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400 shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
                    {p.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.description}</div>}
                    <div className="flex items-center justify-between mt-2">
                      <div className="font-bold text-emerald-600">{formatPrice(p.price, restaurant?.currencySymbol)}</div>
                      <Button size="sm" className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-700" onClick={() => addToCart(p)}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Utensils className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>{lang === 'sl' ? 'Ni izdelkov' : lang === 'en' ? 'No products' : 'Nessun prodotto'}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm">
          <p className="font-semibold text-white">{restaurant?.name}</p>
          {restaurant?.address && <p className="mt-1">{restaurant.address}</p>}
          {restaurant?.phone && <p>{restaurant.phone}</p>}
          {restaurant?.vatNumber && <p className="text-xs text-slate-500 mt-2">Davčna št.: {restaurant.vatNumber}</p>}
          <p className="text-xs text-slate-500 mt-3">© 2026 {restaurant?.name}. Vse pravice pridržane.</p>
        </div>
      </footer>

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> {lang === 'sl' ? 'Košarica' : lang === 'en' ? 'Cart' : 'Carrello'}
            </DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{lang === 'sl' ? 'Košarica je prazna' : 'Cart is empty'}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cart.map(item => (
                <div key={item.productId} className="flex items-center gap-2 p-2 border rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-slate-500">{formatPrice(item.price, restaurant?.currencySymbol)} × {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(item.productId, -1)}>−</Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(item.productId, 1)}>+</Button>
                  </div>
                  <div className="text-sm font-bold w-20 text-right">{formatPrice(item.price * item.quantity, restaurant?.currencySymbol)}</div>
                </div>
              ))}
            </div>
          )}
          {cart.length > 0 && (
            <>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>{lang === 'sl' ? 'Skupaj' : 'Total'}:</span>
                <span className="text-emerald-600">{formatPrice(cartTotal, restaurant?.currencySymbol)}</span>
              </div>
              <p className="text-xs text-slate-500 text-center">
                {lang === 'sl' ? 'Cene vključujejo DDV. Naročilo opravite na blagajni.' : 'Prices include VAT. Order at the counter.'}
              </p>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCartOpen(false)}>{lang === 'sl' ? 'Zapri' : 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservation Dialog */}
      <ReservationDialog
        open={isReserveOpen}
        onOpenChange={setIsReserveOpen}
        restaurantName={restaurant?.name || 'Restavracija'}
        onSuccess={() => setReserveSuccess(true)}
      />
    </div>
  )
}

function ReservationDialog({ open, onOpenChange, restaurantName, onSuccess }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantName: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const { lang } = useI18n()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    partySize: 2, date: new Date().toISOString().slice(0, 10), time: '19:00',
    note: '',
  })

  const handleSubmit = async () => {
    if (!form.customerName) {
      toast({ title: 'Manjka ime', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const datetime = new Date(`${form.date}T${form.time}:00`)
      const res = await fetch('/api/public/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone || null,
          customerEmail: form.customerEmail || null,
          partySize: form.partySize,
          datetime: datetime.toISOString(),
          note: form.note || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: '✅ Rezervacija sprejeta', description: data.message })
      setForm({ customerName: '', customerPhone: '', customerEmail: '', partySize: 2, date: new Date().toISOString().slice(0, 10), time: '19:00', note: '' })
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> {lang === 'sl' ? 'Rezervacija mize' : lang === 'en' ? 'Table reservation' : 'Prenota tavolo'}
          </DialogTitle>
          <DialogDescription>{restaurantName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ime in priimek *</Label>
            <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Janez Novak" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="+386 31 234 567" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} placeholder="janez@email.si" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Čas</Label>
              <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Gostov</Label>
              <Input type="number" min="1" max="50" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: parseInt(e.target.value) || 2 })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Opomba</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Alergije, posebne želje..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Pošlji rezervacijo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
