'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  Users, TrendingUp, Gift, Calendar, Star, Phone, Mail, FileText,
  AlertCircle, RefreshCw, Cake, Award, MessageCircle,
} from 'lucide-react'
import { formatEUR } from './types'

interface CrmStats {
  totalCustomers: number
  newCustomers: number
  totalSpent: number
  totalLoyaltyPoints: number
  totalVisits: number
  avgSpentPerCustomer: number
  segments: Array<{ segment: string; count: number; totalSpent: number }>
  topCustomers: Array<{
    id: string; name: string; email?: string | null; phone?: string | null
    segment: string; loyaltyPoints: number; totalSpent: number; visits: number; createdAt: string
  }>
  topInteractionCustomers: Array<{ id: string; name: string; segment: string; interactionCount: number }>
  interactionsByType: Array<{ type: string; count: number }>
  recentInteractions: Array<{
    id: string; type: string; subject: string; description?: string | null
    createdAt: string; customer?: { id: string; name: string; segment: string } | null
  }>
  birthdayThisMonth: Array<{ id: string; name: string; birthday: string; email?: string | null; phone?: string | null }>
}

const segmentLabels: Record<string, string> = {
  regular: 'Redni',
  vip: 'VIP',
  wholesale: 'Veleprodaja',
  blacklist: 'Črna lista',
}

const segmentColors: Record<string, string> = {
  regular: 'bg-slate-100 text-slate-800 border-slate-300',
  vip: 'bg-purple-100 text-purple-800 border-purple-300',
  wholesale: 'bg-blue-100 text-blue-800 border-blue-300',
  blacklist: 'bg-red-100 text-red-800 border-red-300',
}

const interactionLabels: Record<string, string> = {
  call: 'Klic',
  email: 'Email',
  visit: 'Obisk',
  note: 'Beležka',
  complaint: 'Pritožba',
  feedback: 'Povratna informacija',
}

const interactionIcons: Record<string, any> = {
  call: Phone, email: Mail, visit: Users, note: FileText, complaint: AlertCircle, feedback: Star,
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function CrmDashboard() {
  const { toast } = useToast()
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pos/crm/stats')
      const data = await res.json()
      if (res.ok) setStats(data)
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">CRM Dashboard</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Users className="size-4 text-emerald-600" />
          CRM Dashboard
        </h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Osveži
        </Button>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-emerald-500" />
            <div>
              <div className="text-xs text-slate-500">Kupcev skupno</div>
              <div className="text-xl font-bold">{stats.totalCustomers}</div>
              <div className="text-xs text-emerald-600">+{stats.newCustomers} v 30 dneh</div>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-blue-500" />
            <div>
              <div className="text-xs text-slate-500">Skupna poraba</div>
              <div className="text-xl font-bold">{formatEUR(stats.totalSpent)}</div>
              <div className="text-xs text-slate-500">Ø {formatEUR(stats.avgSpentPerCustomer)}/kupec</div>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-amber-500" />
            <div>
              <div className="text-xs text-slate-500">Lojalne točke</div>
              <div className="text-xl font-bold">{stats.totalLoyaltyPoints.toLocaleString('sl-SI')}</div>
              <div className="text-xs text-slate-500">{stats.totalVisits.toLocaleString('sl-SI')} obiskov</div>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Cake className="size-5 text-pink-500" />
            <div>
              <div className="text-xs text-slate-500">Rodni dnevi (ta mesec)</div>
              <div className="text-xl font-bold text-pink-600">{stats.birthdayThisMonth.length}</div>
              <div className="text-xs text-slate-500">Pošlji čestitko!</div>
            </div>
          </div>
        </CardContent></Card>
      </div>

      {/* Segmenti */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Award className="size-4" /> Segmenti kupcev</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats.segments.map(seg => (
              <div key={seg.segment} className={`p-3 rounded-lg border ${segmentColors[seg.segment] || 'bg-slate-100'}`}>
                <div className="text-sm font-semibold">{segmentLabels[seg.segment] || seg.segment}</div>
                <div className="text-lg font-bold">{seg.count}</div>
                <div className="text-xs">{formatEUR(seg.totalSpent)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top 10 kupcev */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Star className="size-4 text-amber-500" /> Top 10 kupcev</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {stats.topCustomers.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 border rounded">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${segmentColors[c.segment]}`}>{segmentLabels[c.segment]}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">{c.visits} obiskov · {c.loyaltyPoints} točk</div>
                    </div>
                    <div className="text-sm font-bold text-emerald-600">{formatEUR(c.totalSpent)}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Zadnje interakcije */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="size-4 text-blue-500" /> Zadnje interakcije</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {stats.recentInteractions.map(int => {
                  const Icon = interactionIcons[int.type] || FileText
                  return (
                    <div key={int.id} className="flex items-start gap-2 p-2 border rounded">
                      <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Icon className="size-3.5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{interactionLabels[int.type] || int.type}</Badge>
                          <span className="text-sm font-medium">{int.subject}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {int.customer?.name || '—'} · {formatDate(int.createdAt)}
                        </div>
                        {int.description && <div className="text-xs text-slate-600 mt-0.5 truncate">{int.description}</div>}
                      </div>
                    </div>
                  )
                })}
                {stats.recentInteractions.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-sm">Ni interakcij</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Interakcije po tipu */}
      {stats.interactionsByType.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Interakcije po tipu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {stats.interactionsByType.map(it => {
                const Icon = interactionIcons[it.type] || FileText
                return (
                  <div key={it.type} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border rounded-lg">
                    <Icon className="size-3.5 text-slate-500" />
                    <span className="text-sm font-medium">{interactionLabels[it.type] || it.type}</span>
                    <Badge className="text-[10px]">{it.count}</Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rodni dnevi ta mesec */}
      {stats.birthdayThisMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Cake className="size-4 text-pink-500" /> Rodni dnevi ta mesec</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {stats.birthdayThisMonth.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-2 border rounded">
                  <Cake className="size-4 text-pink-400" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {new Date(c.birthday).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  {c.email && <Button size="sm" variant="ghost" className="h-7 text-xs">Pošlji čestitko</Button>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
