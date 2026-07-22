'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  RefreshCw, Plus, Trash2, Globe, MapPin, CloudUpload, Clock, CheckCircle2, XCircle, Loader2, Building2, Network,
} from 'lucide-react'
import type { Location, SyncLog, HubSyncStatus, syncLogStatusConfig } from './types'

const syncStatusConfig = {
  success: { label: 'Uspeh', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  failed: { label: 'Napaka', className: 'bg-red-100 text-red-800 border-red-300' },
  pending: { label: 'Čaka', className: 'bg-amber-100 text-amber-800 border-amber-300' },
} as const

function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d)
}

export function HubSyncTab() {
  const { toast } = useToast()
  const [locations, setLocations] = useState<Location[]>([])
  const [syncStatus, setSyncStatus] = useState<HubSyncStatus | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [locRes, statusRes, logsRes] = await Promise.all([
        fetch('/api/pos/locations'),
        fetch('/api/pos/hubsync/status'),
        fetch('/api/pos/hubsync/logs?limit=30'),
      ])
      const locData = await locRes.json()
      const statusData = await statusRes.json()
      const logsData = await logsRes.json()
      if (locRes.ok) setLocations(locData.locations || [])
      if (statusRes.ok) setSyncStatus(statusData)
      if (logsRes.ok) setSyncLogs(logsData.logs || [])
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/pos/hubsync/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: '✅ Sinhronizacija uspešna',
        description: `Prodaja: ${data.stats.sales}, Izdelki: ${data.stats.products}, Premiki: ${data.stats.stockMoves}, Stroški: ${data.stats.expenses}`,
      })
      load()
    } catch (e: any) {
      toast({ title: 'Napaka pri sinhronizaciji', description: e.message, variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Izbrišem lokacijo "${name}"?`)) return
    try {
      const res = await fetch(`/api/pos/locations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Lokacija izbrisana' })
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
            <Network className="size-4 text-emerald-600" />
            HubSync — sinhronizacija lokacij
          </h2>
          <p className="text-xs text-slate-500">Upravljanje več lokacij in sinhronizacija s hub-om</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Osveži
          </Button>
          <Button size="sm" onClick={handleSync} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-700">
            {syncing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CloudUpload className="size-4 mr-1" />}
            Sinhroniziraj
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)}>
            <Plus className="size-4 mr-1" />
            Nova lokacija
          </Button>
        </div>
      </div>

      {/* Status kartice */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Lokacij</div>
            <div className="text-xl font-bold">{locations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Zadnja sinhronizacija</div>
            <div className="text-sm font-bold">
              {syncStatus?.lastSyncAt ? formatDateTime(syncStatus.lastSyncAt) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Čakajoče</div>
            <div className="text-xl font-bold text-amber-600">{syncStatus?.pendingCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Sync logov</div>
            <div className="text-xl font-bold">{syncLogs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Seznam lokacij */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="size-4" />
            Lokacije ({locations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {locations.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ni lokacij. Ustvari prvo z gumbom "Nova lokacija".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${loc.isMain ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    {loc.isHub ? <Globe className="size-5 text-blue-600" /> : <MapPin className={`size-5 ${loc.isMain ? 'text-emerald-600' : 'text-slate-500'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{loc.name}</span>
                      {loc.code && <Badge variant="outline" className="text-[10px] font-mono">{loc.code}</Badge>}
                      {loc.isMain && <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">GLAVNA</Badge>}
                      {loc.isHub && <Badge className="text-[10px] bg-blue-100 text-blue-800 border-blue-300">HUB</Badge>}
                      {!loc.active && <Badge variant="outline" className="text-[10px] text-red-600">NEAKTIVNA</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {loc.address && <span>{loc.address} · </span>}
                      {loc.hubUrl && <span className="text-blue-600">Hub: {loc.hubUrl}</span>}
                      {!loc.hubUrl && !loc.isHub && <span className="text-amber-600">Ni konfiguriran hub URL</span>}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Zadnja sync:</div>
                    <div className="font-medium">{loc.lastSyncAt ? formatDateTime(loc.lastSyncAt) : '—'}</div>
                  </div>
                  {!loc.isMain && (
                    <Button size="sm" variant="ghost" className="text-red-600 h-8" onClick={() => handleDelete(loc.id, loc.name)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="size-4" />
            Zadnje sinhronizacije
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {syncLogs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">Ni sinhronizacij</div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {syncLogs.map(log => {
                  const status = syncStatusConfig[log.status as keyof typeof syncStatusConfig] || syncStatusConfig.success
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-2 border rounded text-sm">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${status.className}`}>
                        {log.status === 'success' ? <CheckCircle2 className="size-4" /> : log.status === 'failed' ? <XCircle className="size-4" /> : <Clock className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.entityType}</span>
                          <Badge variant="outline" className="text-[10px]">{log.direction === 'push' ? '↑ Push' : '↓ Pull'}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                        </div>
                        <div className="text-xs text-slate-500">
                          {log.location?.name || '—'} · {formatDateTime(log.createdAt)}
                          {log.error && <span className="text-red-600"> · {log.error}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AddLocationDialog open={isAddOpen} onOpenChange={setIsAddOpen} onSaved={load} />
    </div>
  )
}

function AddLocationDialog({ open, onOpenChange, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', code: '', address: '', phone: '', email: '',
    isMain: false, isHub: false, hubUrl: '', hubToken: '',
  })

  const handleSubmit = async () => {
    if (!form.name) {
      toast({ title: 'Manjka ime lokacije', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/pos/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hubUrl: form.hubUrl || null,
          hubToken: form.hubToken || null,
          code: form.code || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: '✅ Lokacija ustvarjena' })
      setForm({ name: '', code: '', address: '', phone: '', email: '', isMain: false, isHub: false, hubUrl: '', hubToken: '' })
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
          <DialogTitle>Nova lokacija</DialogTitle>
          <DialogDescription>Ustvari novo lokacijo za HubSync</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ime lokacije *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ljubljana Center" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Koda</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="LJU01" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+386 1 234 5678" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Naslov</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Slovenska 15, 1000 Ljubljana" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="lju@restavracija.si" />
          </div>
          <Separator />
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isMain} onChange={(e) => setForm({ ...form, isMain: e.target.checked })} className="w-4 h-4" />
              <span className="text-sm">Glavna lokacija</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isHub} onChange={(e) => setForm({ ...form, isHub: e.target.checked })} className="w-4 h-4" />
              <span className="text-sm">Ta lokacija je Hub (master)</span>
            </label>
          </div>
          {!form.isHub && (
            <>
              <div className="space-y-1.5">
                <Label>Hub URL</Label>
                <Input value={form.hubUrl} onChange={(e) => setForm({ ...form, hubUrl: e.target.value })} placeholder="https://hub.restavracija.si" />
              </div>
              <div className="space-y-1.5">
                <Label>Hub Token</Label>
                <Input type="password" value={form.hubToken} onChange={(e) => setForm({ ...form, hubToken: e.target.value })} placeholder="Bearer token" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? 'Shranjujem...' : 'Shrani'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
