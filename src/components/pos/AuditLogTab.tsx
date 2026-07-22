'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { History, RefreshCw, Filter, User, Clock, FileText } from 'lucide-react'
import type { AuditLog, auditActionLabels } from './types'

const actionLabels: Record<string, string> = {
  create: 'Ustvarjeno',
  update: 'Posodobljeno',
  delete: 'Izbrisano',
  login: 'Prijava',
  logout: 'Odjava',
  refund: 'Storno',
  storno: 'Storno',
  sync: 'Sinhronizacija',
  test: 'Test',
}

const actionColors: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  update: 'bg-blue-100 text-blue-800 border-blue-300',
  delete: 'bg-red-100 text-red-800 border-red-300',
  login: 'bg-slate-100 text-slate-800 border-slate-300',
  logout: 'bg-slate-100 text-slate-800 border-slate-300',
  refund: 'bg-orange-100 text-orange-800 border-orange-300',
  storno: 'bg-orange-100 text-orange-800 border-orange-300',
  sync: 'bg-purple-100 text-purple-800 border-purple-300',
  test: 'bg-amber-100 text-amber-800 border-amber-300',
}

function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d)
}

export function AuditLogTab() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('all')
  const [filterEntityType, setFilterEntityType] = useState('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '100')
      if (filterAction !== 'all') params.set('action', filterAction)
      if (filterEntityType !== 'all') params.set('entityType', filterEntityType)
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) {
        const toDate = new Date(filterTo)
        toDate.setHours(23, 59, 59, 999)
        params.set('to', toDate.toISOString())
      }
      const res = await fetch(`/api/pos/audit?${params}`)
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterEntityType, filterFrom, filterTo, toast])

  useEffect(() => { load() }, [load])

  // Statistika
  const stats = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <History className="size-4 text-emerald-600" />
            Audit log — zgodovina akcij
          </h2>
          <p className="text-xs text-slate-500">Sledenje vseh admin akcij za varnost in skladnost</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Osveži
        </Button>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Skupno</div><div className="text-xl font-bold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Ustvarjeno</div><div className="text-xl font-bold text-emerald-600">{stats.create || 0}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Posodobljeno</div><div className="text-xl font-bold text-blue-600">{stats.update || 0}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Izbrisano</div><div className="text-xl font-bold text-red-600">{stats.delete || 0}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-slate-500">Storno</div><div className="text-xl font-bold text-orange-600">{stats.storno || stats.refund || 0}</div></CardContent></Card>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Akcija</Label>
          <div className="flex gap-1 flex-wrap">
            {['all', 'create', 'update', 'delete', 'login', 'logout', 'storno', 'sync'].map(a => (
              <Button key={a} size="sm" variant={filterAction === a ? 'default' : 'outline'} onClick={() => setFilterAction(a)} className="h-7 text-xs">
                {a === 'all' ? 'Vse' : actionLabels[a] || a}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tip entitete</Label>
          <div className="flex gap-1 flex-wrap">
            {['all', 'user', 'product', 'sale', 'settings', 'location', 'expense', 'reservation'].map(t => (
              <Button key={t} size="sm" variant={filterEntityType === t ? 'default' : 'outline'} onClick={() => setFilterEntityType(t)} className="h-7 text-xs">
                {t === 'all' ? 'Vse' : t === 'user' ? 'Uporabniki' : t === 'product' ? 'Izdelki' : t === 'sale' ? 'Prodaja' : t === 'settings' ? 'Nastavitve' : t === 'location' ? 'Lokacije' : t === 'expense' ? 'Stroški' : 'Rezervacije'}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Od</Label>
          <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-36 h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Do</Label>
          <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-36 h-9" />
        </div>
        {(filterAction !== 'all' || filterEntityType !== 'all' || filterFrom || filterTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterAction('all'); setFilterEntityType('all'); setFilterFrom(''); setFilterTo('') }} className="h-9">Počisti</Button>
        )}
      </div>

      {/* Seznam logov */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">Nalagam...</div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">
          <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Ni audit logov za izbrane filtre</p>
        </CardContent></Card>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1">
            {logs.map(log => {
              const colorClass = actionColors[log.action] || 'bg-slate-100 text-slate-800 border-slate-300'
              const label = actionLabels[log.action] || log.action
              return (
                <div key={log.id} className="flex items-start gap-3 p-2.5 border rounded-lg hover:bg-slate-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                    {log.action === 'create' ? <FileText className="size-4" /> : log.action === 'delete' ? <FileText className="size-4" /> : log.action === 'login' || log.action === 'logout' ? <User className="size-4" /> : <History className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${colorClass}`}>{label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{log.entityType}</Badge>
                      <span className="text-sm font-medium">{log.description}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {log.user?.name || '—'} ({log.user?.role || '—'})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDateTime(log.createdAt)}
                      </span>
                      {log.ipAddress && log.ipAddress !== 'unknown' && <span>IP: {log.ipAddress}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
