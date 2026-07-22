'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { Clock, RefreshCw, Calendar, User, TrendingUp, Users } from 'lucide-react'
import type { TimeEntry } from './types'

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes && minutes !== 0) return '—'
  if (minutes < 60) return `${Math.floor(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `${h}h ${m}min`
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function TimeEntriesTab() {
  const { toast } = useToast()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) {
        const toDate = new Date(filterTo)
        toDate.setHours(23, 59, 59, 999)
        params.set('to', toDate.toISOString())
      }
      const res = await fetch(`/api/pos/time/entries?${params}`)
      const data = await res.json()
      if (res.ok) {
        setEntries(data.entries || [])
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, toast])

  useEffect(() => {
    load()
  }, [load])

  // Statistika
  const totalMinutes = entries.reduce((sum, e) => sum + (e.totalMinutes || 0), 0)
  const uniqueUsers = new Set(entries.map(e => e.userId)).size
  const openEntries = entries.filter(e => !e.clockOut).length

  // Grupiraj po uporabniku
  const byUser: Record<string, { name: string; role: string; entries: TimeEntry[]; totalMinutes: number }> = {}
  for (const e of entries) {
    const key = e.userId
    if (!byUser[key]) {
      byUser[key] = {
        name: e.user?.name || 'Neznan',
        role: e.user?.role || 'unknown',
        entries: [],
        totalMinutes: 0,
      }
    }
    byUser[key].entries.push(e)
    byUser[key].totalMinutes += e.totalMinutes || 0
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="size-4 text-emerald-600" />
            Sledenje delavcev
          </h2>
          <p className="text-xs text-slate-500">Urnik prijave in odjave z dela</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="size-4 mr-1" />
          Osveži
        </Button>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-blue-500" />
              <div>
                <div className="text-xs text-slate-500">Skupno ur</div>
                <div className="text-base font-bold">{formatDuration(totalMinutes)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-emerald-500" />
              <div>
                <div className="text-xs text-slate-500">Delavcev</div>
                <div className="text-base font-bold">{uniqueUsers}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-amber-500" />
              <div>
                <div className="text-xs text-slate-500">Vnosov</div>
                <div className="text-base font-bold">{entries.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-orange-500" />
              <div>
                <div className="text-xs text-slate-500">Odprtih</div>
                <div className="text-base font-bold">{openEntries}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Od</Label>
          <Input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-40 h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Do</Label>
          <Input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-40 h-9"
          />
        </div>
        {(filterFrom || filterTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterFrom('')
              setFilterTo('')
            }}
            className="h-9"
          >
            Počisti
          </Button>
        )}
      </div>

      {/* Seznam po uporabnikih */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">Nalagam...</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ni vnosov za izbrano obdobje</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {Object.entries(byUser).map(([userId, data]) => (
              <Card key={userId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="size-4" />
                      {data.name}
                      <Badge variant="outline" className="text-[10px]">
                        {data.role === 'admin' ? 'Administrator' : data.role === 'cashier' ? 'Blagajnik' : 'Kuhar'}
                      </Badge>
                    </CardTitle>
                    <div className="text-sm font-bold text-emerald-600">
                      {formatDuration(data.totalMinutes)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {data.entries.slice(0, 10).map(entry => {
                      const stillOpen = !entry.clockOut
                      const minutes = entry.totalMinutes || (stillOpen
                        ? Math.floor((Date.now() - new Date(entry.clockIn).getTime()) / 60000)
                        : 0)
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 p-2 border rounded text-sm hover:bg-slate-50"
                        >
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <div>
                              <div className="text-xs text-slate-500">Prijava</div>
                              <div className="font-medium">{formatDate(entry.clockIn)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Odjava</div>
                              <div className="font-medium">
                                {entry.clockOut ? formatDate(entry.clockOut) : (
                                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                                    ACTIVE
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Trajanje</div>
                              <div className={`font-mono font-medium ${stillOpen ? 'text-emerald-600' : ''}`}>
                                {formatDuration(minutes)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {data.entries.length > 10 && (
                      <div className="text-xs text-slate-500 text-center pt-1">
                        ... in {data.entries.length - 10} več vnosov
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
