'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Calendar,
  Plus,
  Phone,
  Mail,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  CalendarPlus,
  Filter,
} from 'lucide-react'
import { Reservation, ReservationStatus, Table, reservationStatusConfig } from './types'

export function ReservationsTab() {
  const { toast } = useToast()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState<string>('') // YYYY-MM-DD
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)

  // Nalozi mize
  useEffect(() => {
    fetch('/api/pos/tables')
      .then(r => r.json())
      .then(data => setTables(data.tables || []))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterDate) params.set('date', filterDate)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`/api/pos/reservations?${params}`)
      const data = await res.json()
      if (res.ok) {
        setReservations(data.reservations || [])
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterDate, filterStatus, toast])

  useEffect(() => {
    load()
  }, [load])

  // Grupiraj po datumu
  const grouped: Record<string, Reservation[]> = {}
  for (const r of reservations) {
    const dateKey = new Date(r.datetime).toLocaleDateString('sl-SI')
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(r)
  }

  // Statistika za danes
  const today = new Date().toDateString()
  const todayReservations = reservations.filter(r => new Date(r.datetime).toDateString() === today)
  const todayPending = todayReservations.filter(r => r.status === 'pending').length
  const todayConfirmed = todayReservations.filter(r => r.status === 'confirmed').length
  const todayTotalGuests = todayReservations
    .filter(r => r.status === 'pending' || r.status === 'confirmed')
    .reduce((sum, r) => sum + r.partySize, 0)

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    try {
      const res = await fetch(`/api/pos/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Napaka')
      toast({ title: 'Status posodobljen' })
      load()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Brisanje rezervacije — nadaljujem?')) return
    try {
      const res = await fetch(`/api/pos/reservations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      toast({ title: 'Rezervacija izbrisana' })
      load()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="size-4 text-emerald-600" />
            Rezervacije miz
          </h2>
          <p className="text-xs text-slate-500">Upravljanje rezervacij in zgodovina</p>
        </div>
        <Button size="sm" onClick={() => setIsAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <CalendarPlus className="size-4 mr-1" />
          Nova rezervacija
        </Button>
      </div>

      {/* Statistika za danes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Danes rezervacij</div>
            <div className="text-xl font-bold">{todayReservations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Čaka na potrditev</div>
            <div className="text-xl font-bold text-amber-600">{todayPending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Potrjene</div>
            <div className="text-xl font-bold text-emerald-600">{todayConfirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Skupno gostov</div>
            <div className="text-xl font-bold">{todayTotalGuests}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Datum</Label>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-44 h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <div className="flex gap-1 flex-wrap">
            {['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'].map(s => (
              <Button
                key={s}
                size="sm"
                variant={filterStatus === s ? 'default' : 'outline'}
                onClick={() => setFilterStatus(s)}
                className="h-7 text-xs"
              >
                {s === 'all' ? 'Vsi' : s === 'pending' ? 'Čaka' : s === 'confirmed' ? 'Potrjena' : s === 'completed' ? 'Zaključena' : s === 'cancelled' ? 'Preklicana' : 'Ni se poglobil'}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <Filter className="size-4 mr-1" />
          Osveži
        </Button>
        {(filterDate || filterStatus !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterDate('')
              setFilterStatus('all')
            }}
            className="h-9"
          >
            Počisti filtre
          </Button>
        )}
      </div>

      {/* Seznam rezervacij */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">Nalagam...</div>
      ) : reservations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ni rezervacij</p>
            <p className="text-xs mt-1">Klikni "Nova rezervacija" za dodajanje</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="sticky top-0 bg-white py-1.5 z-10">
                  <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Calendar className="size-4" />
                    {date}
                    <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  {items.map(r => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onClick={() => setSelectedReservation(r)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Add dialog */}
      <AddReservationDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        tables={tables}
        onSaved={load}
      />

      {/* Detail dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && setSelectedReservation(null)}>
        <DialogContent className="max-w-md">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle>Rezervacija — {selectedReservation.customerName}</DialogTitle>
                <DialogDescription>
                  {new Date(selectedReservation.datetime).toLocaleString('sl-SI')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-500">Miza</div>
                    <div className="font-medium">{selectedReservation.table?.name || 'Ni določena'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Št. gostov</div>
                    <div className="font-medium flex items-center gap-1">
                      <Users className="size-3.5" /> {selectedReservation.partySize}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Trajanje</div>
                    <div className="font-medium flex items-center gap-1">
                      <Clock className="size-3.5" /> {selectedReservation.duration} min
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Status</div>
                    <Badge variant="outline" className={reservationStatusConfig[selectedReservation.status].className}>
                      {reservationStatusConfig[selectedReservation.status].label}
                    </Badge>
                  </div>
                  {selectedReservation.customerPhone && (
                    <div>
                      <div className="text-xs text-slate-500">Telefon</div>
                      <div className="font-medium flex items-center gap-1">
                        <Phone className="size-3.5" /> {selectedReservation.customerPhone}
                      </div>
                    </div>
                  )}
                  {selectedReservation.customerEmail && (
                    <div>
                      <div className="text-xs text-slate-500">Email</div>
                      <div className="font-medium flex items-center gap-1 truncate">
                        <Mail className="size-3.5 shrink-0" /> {selectedReservation.customerEmail}
                      </div>
                    </div>
                  )}
                </div>
                {selectedReservation.note && (
                  <div className="p-2 bg-slate-50 rounded-md">
                    <div className="text-xs text-slate-500 mb-1">Opomba</div>
                    <div className="text-sm">{selectedReservation.note}</div>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(selectedReservation.id, 'confirmed')}
                  disabled={selectedReservation.status === 'confirmed' || selectedReservation.status === 'completed'}
                >
                  <CheckCircle2 className="size-4 mr-1" /> Potrdi
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(selectedReservation.id, 'completed')}
                  disabled={selectedReservation.status === 'completed'}
                >
                  Zaključi
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(selectedReservation.id, 'no_show')}
                  disabled={selectedReservation.status === 'no_show' || selectedReservation.status === 'completed'}
                >
                  Ni se poglobil
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => handleStatusChange(selectedReservation.id, 'cancelled')}
                  disabled={selectedReservation.status === 'cancelled' || selectedReservation.status === 'completed'}
                >
                  <XCircle className="size-4 mr-1" /> Prekliči
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    handleDelete(selectedReservation.id)
                    setSelectedReservation(null)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReservationCard({
  reservation,
  onStatusChange,
  onDelete,
  onClick,
}: {
  reservation: Reservation
  onStatusChange: (id: string, status: ReservationStatus) => void
  onDelete: (id: string) => void
  onClick: () => void
}) {
  const status = reservationStatusConfig[reservation.status]
  const time = new Date(reservation.datetime).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  const isPast = new Date(reservation.datetime) < new Date()

  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
      onClick={onClick}
    >
      <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white shrink-0 ${
        isPast ? 'bg-slate-400' : 'bg-emerald-600'
      }`}>
        <div className="text-xs font-bold">{time}</div>
        <div className="text-[10px] opacity-90">{reservation.duration}min</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{reservation.customerName}</span>
          <Badge variant="outline" className={`text-[10px] ${status.className}`}>
            {status.label}
          </Badge>
          {isPast && reservation.status !== 'completed' && reservation.status !== 'cancelled' && (
            <Badge variant="outline" className="text-[10px] text-orange-700 border-orange-300">ZAMUDA</Badge>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="size-3" /> {reservation.partySize}
          </span>
          {reservation.table && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {reservation.table.name}
            </span>
          )}
          {reservation.customerPhone && (
            <span className="flex items-center gap-1 truncate">
              <Phone className="size-3" /> {reservation.customerPhone}
            </span>
          )}
        </div>
        {reservation.note && (
          <div className="text-xs text-amber-700 mt-0.5 truncate">📝 {reservation.note}</div>
        )}
      </div>
      {reservation.status === 'pending' && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onStatusChange(reservation.id, 'confirmed')
          }}
        >
          <CheckCircle2 className="size-3.5 mr-1" /> Potrdi
        </Button>
      )}
    </div>
  )
}

function AddReservationDialog({
  open,
  onOpenChange,
  tables,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tables: Table[]
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tableId: 'none',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    partySize: 2,
    date: new Date().toISOString().slice(0, 10),
    time: '19:00',
    duration: 120,
    note: '',
  })

  const reset = () => {
    setForm({
      tableId: 'none',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      partySize: 2,
      date: new Date().toISOString().slice(0, 10),
      time: '19:00',
      duration: 120,
      note: '',
    })
  }

  const handleSubmit = async () => {
    if (!form.customerName) {
      toast({ title: 'Manjka ime kupca', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const datetime = new Date(`${form.date}T${form.time}:00`)
      if (datetime < new Date()) {
        toast({ title: 'Datum mora biti v prihodnosti', variant: 'destructive' })
        setSaving(false)
        return
      }
      const res = await fetch('/api/pos/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: form.tableId === 'none' ? null : form.tableId,
          customerName: form.customerName,
          customerPhone: form.customerPhone || null,
          customerEmail: form.customerEmail || null,
          partySize: parseInt(String(form.partySize)),
          datetime: datetime.toISOString(),
          duration: parseInt(String(form.duration)),
          note: form.note || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: '✅ Rezervacija ustvarjena' })
      reset()
      onOpenChange(false)
      onSaved()
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
          <DialogTitle>Nova rezervacija</DialogTitle>
          <DialogDescription>Vnosi rezervacijo v sistem</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-name">Ime kupca *</Label>
            <Input
              id="r-name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="Janez Novak"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-phone">Telefon</Label>
              <Input
                id="r-phone"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                placeholder="+386 31 234 567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-email">Email</Label>
              <Input
                id="r-email"
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                placeholder="janez@email.si"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-date">Datum</Label>
              <Input
                id="r-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-time">Čas</Label>
              <Input
                id="r-time"
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-size">Št. gostov</Label>
              <Input
                id="r-size"
                type="number"
                min="1"
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-note">Opomba</Label>
            <Input
              id="r-note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Alergije, posebne želje..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Shranjujem...' : 'Shrani rezervacijo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
