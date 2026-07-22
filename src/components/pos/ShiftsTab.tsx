'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Plus, Trash2, Clock, RefreshCw, Users, TrendingUp, Lightbulb } from 'lucide-react'

interface Shift {
  id: string
  userId: string
  user?: { id: string; name: string; role: string } | null
  startTime: string
  endTime?: string | null
  breakMinutes: number
  role: string
  status: string
  note?: string | null
}

interface User {
  id: string
  username: string
  name: string
  role: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Načrtovan', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  started: { label: 'V teku', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  completed: { label: 'Zaključen', className: 'bg-slate-100 text-slate-800 border-slate-300' },
  cancelled: { label: 'Preklican', className: 'bg-red-100 text-red-800 border-red-300' },
  no_show: { label: 'Ni prišel', className: 'bg-orange-100 text-orange-800 border-orange-300' },
}

const roleLabels: Record<string, string> = { admin: 'Administrator', cashier: 'Blagajnik', chef: 'Kuhar' }

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}
function formatTime(date: string): string {
  return new Intl.DateTimeFormat('sl-SI', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function ShiftsTab() {
  const { toast } = useToast()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filterFrom, setFilterFrom] = useState(new Date().toISOString().slice(0, 10))
  const [filterTo, setFilterTo] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [isAddOpen, setIsAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('from', filterFrom)
      params.set('to', filterTo)
      const [shiftsRes, usersRes] = await Promise.all([
        fetch(`/api/pos/shifts?${params}`),
        fetch('/api/users'),
      ])
      const shiftsData = await shiftsRes.json()
      const usersData = await usersRes.json()
      if (shiftsRes.ok) setShifts(shiftsData.shifts || [])
      if (usersRes.ok) setUsers(usersData.users || [])
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, toast])

  useEffect(() => { load() }, [load])

  // Grupiraj po datumu
  const grouped: Record<string, Shift[]> = {}
  for (const s of shifts) {
    const dateKey = new Date(s.startTime).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(s)
  }

  // Skupne ure
  const totalHours = shifts.reduce((sum, s) => {
    if (!s.endTime) return sum
    const diff = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000
    return sum + Math.max(0, diff - s.breakMinutes / 60)
  }, 0)

  const handleDelete = async (id: string) => {
    if (!confirm('Izbrišem ta urnik?')) return
    try {
      const res = await fetch(`/api/pos/shifts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Napaka')
      toast({ title: 'Urnik izbrisan' })
      load()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/pos/shifts/${id}`, {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="size-4 text-emerald-600" />
            Urnik zaposlenih
          </h2>
          <p className="text-xs text-slate-500">Razporeditev delavcev po izmenah</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Osveži
          </Button>
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="size-4 mr-1" /> Nova izmena
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Izmen</div><div className="text-xl font-bold">{shifts.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Skupno ur</div><div className="text-xl font-bold text-emerald-600">{totalHours.toFixed(1)}h</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Delavcev</div><div className="text-xl font-bold">{new Set(shifts.map(s => s.userId)).size}</div></CardContent></Card>
      </div>

      <div className="flex gap-2 items-end">
        <div className="space-y-1"><Label className="text-xs">Od</Label><Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-40 h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">Do</Label><Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-40 h-9" /></div>
      </div>

      {loading ? <div className="text-center py-8 text-slate-500">Nalagam...</div> : shifts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Ni urnikov za izbrano obdobje</p>
        </CardContent></Card>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="text-sm font-semibold text-slate-700 mb-1 sticky top-0 bg-white py-1">{date}</div>
                <div className="space-y-1">
                  {items.map(s => {
                    const status = statusConfig[s.status] || statusConfig.scheduled
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-2 border rounded-lg">
                        <div className="w-12 h-12 rounded-lg bg-emerald-50 flex flex-col items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-emerald-700">{formatTime(s.startTime)}</span>
                          <span className="text-[10px] text-slate-400">{s.endTime ? formatTime(s.endTime) : '—'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{s.user?.name || '—'}</span>
                            <Badge variant="outline" className="text-[10px]">{roleLabels[s.role] || s.role}</Badge>
                            <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatDateTime(s.startTime)} — {s.endTime ? formatDateTime(s.endTime) : 'odprto'}
                            {' · '}odmor {s.breakMinutes}min
                            {s.note && ` · 📝 ${s.note}`}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {s.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatusChange(s.id, 'started')}>Začni</Button>
                          )}
                          {s.status === 'started' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatusChange(s.id, 'completed')}>Zaključi</Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <AddShiftDialog open={isAddOpen} onOpenChange={setIsAddOpen} users={users} onSaved={load} />
    </div>
  )
}

function AddShiftDialog({ open, onOpenChange, users, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; users: User[]; onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ userId: '', date: new Date().toISOString().slice(0, 10), startTime: '08:00', endTime: '16:00', breakMinutes: 30, role: 'cashier', note: '' })

  const handleSubmit = async () => {
    if (!form.userId) { toast({ title: 'Izberi delavca', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const startDateTime = new Date(`${form.date}T${form.startTime}:00`)
      const endDateTime = form.endTime ? new Date(`${form.date}T${form.endTime}:00`) : null
      const res = await fetch('/api/pos/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: form.userId, startTime: startDateTime.toISOString(), endTime: endDateTime?.toISOString() || null, breakMinutes: parseInt(form.breakMinutes), role: form.role, note: form.note || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: '✅ Izmena ustvarjena' })
      setForm({ userId: '', date: new Date().toISOString().slice(0, 10), startTime: '08:00', endTime: '16:00', breakMinutes: 30, role: 'cashier', note: '' })
      onOpenChange(false); onSaved()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova izmena</DialogTitle><DialogDescription>Razporedi delavca na izmeno</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Delavec *</Label>
            <div className="flex gap-1 flex-wrap">
              {users.filter(u => u.role !== 'admin' || true).map(u => (
                <Button key={u.id} size="sm" variant={form.userId === u.id ? 'default' : 'outline'} onClick={() => setForm({ ...form, userId: u.id, role: u.role })} className="h-7 text-xs">
                  {u.name} ({roleLabels[u.role]})
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Datum</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Od</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Do</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Odmor (min)</Label><Input type="number" min="0" step="15" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: parseInt(e.target.value) || 0 })} /></div>
            <div className="space-y-1.5"><Label>Vloga</Label>
              <div className="flex gap-1">
                {['cashier', 'chef', 'admin'].map(r => (
                  <Button key={r} size="sm" variant={form.role === r ? 'default' : 'outline'} onClick={() => setForm({ ...form, role: r })} className="h-9 text-xs">{roleLabels[r]}</Button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Opomba</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Posebna navodila..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? 'Shranjujem...' : 'Shrani izmeno'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
