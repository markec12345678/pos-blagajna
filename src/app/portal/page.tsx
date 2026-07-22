'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { LanguageSwitcher } from '@/components/pos/LanguageSwitcher'
import { Receipt, Clock, Calendar, LogOut, TrendingUp, Loader2, CheckCircle2 } from 'lucide-react'

interface Shift {
  id: string
  startTime: string
  endTime?: string | null
  breakMinutes: number
  role: string
  status: string
  note?: string | null
}

interface TimeStatus {
  clockedIn: boolean
  currentEntry?: { id: string; clockIn: string } | null
  todayMinutes: number
  weekMinutes: number
}

interface User {
  id: string
  username: string
  name: string
  role: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Načrtovan', className: 'bg-blue-100 text-blue-800' },
  started: { label: 'V teku', className: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Zaključen', className: 'bg-slate-100 text-slate-800' },
  cancelled: { label: 'Preklican', className: 'bg-red-100 text-red-800' },
  no_show: { label: 'Ni prišel', className: 'bg-orange-100 text-orange-800' },
}

const roleLabels: Record<string, string> = { admin: 'Administrator', cashier: 'Blagajnik', chef: 'Kuhar' }

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('sl-SI', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}
function formatTime(date: string): string {
  return new Intl.DateTimeFormat('sl-SI', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.floor(minutes)} min`
  const h = Math.floor(minutes / 60); const m = Math.floor(minutes % 60)
  return `${h}h ${m}min`
}

export default function PortalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [timeStatus, setTimeStatus] = useState<TimeStatus | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      setLoading(false)
      loadData(data.user.id)
    })
  }, [router])

  const loadData = async (userId: string) => {
    try {
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const [shiftsRes, statusRes] = await Promise.all([
        fetch(`/api/pos/shifts?userId=${userId}&from=${from}&to=${to}`),
        fetch('/api/pos/time/status'),
      ])
      const shiftsData = await shiftsRes.json()
      const statusData = await statusRes.json()
      if (shiftsRes.ok) setShifts(shiftsData.shifts || [])
      if (statusRes.ok) {
        setTimeStatus(statusData)
        if (statusData.clockedIn && statusData.currentEntry) {
          setElapsed(Math.floor((Date.now() - new Date(statusData.currentEntry.clockIn).getTime()) / 1000))
        }
      }
    } catch {}
  }

  // Tick timer
  useEffect(() => {
    if (!timeStatus?.clockedIn) return
    const tick = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(tick)
  }, [timeStatus?.clockedIn])

  const handleClock = async () => {
    const action = timeStatus?.clockedIn ? 'out' : 'in'
    try {
      const res = await fetch('/api/pos/time/clock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: action === 'in' ? '✅ Prijavljeni na delo' : '👋 Odjava z dela',
        description: action === 'out' && data.entry?.totalMinutes
          ? `Delali ste ${formatDuration(data.entry.totalMinutes)}`
          : undefined,
      })
      loadData(user!.id)
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  const seconds = elapsed % 60
  const elapsedStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  // Prihajajoče izmene
  const now = new Date()
  const upcomingShifts = shifts.filter(s => new Date(s.startTime) >= now && s.status === 'scheduled').slice(0, 5)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Portal zaposlenih</h1>
              <p className="text-xs text-slate-500 mt-0.5">{user.name} · {roleLabels[user.role]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Clock in/out kartica */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Trenutni status</div>
                {timeStatus?.clockedIn ? (
                  <>
                    <div className="font-mono text-4xl font-bold text-emerald-600 tabular-nums mt-1">{elapsedStr}</div>
                    <Badge className="mt-2 bg-emerald-100 text-emerald-800">✓ Na delu</Badge>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-slate-400 mt-1">Ni na delu</div>
                    <Badge variant="outline" className="mt-2 text-slate-500">Prijavite se za začetek</Badge>
                  </>
                )}
              </div>
              <Button
                onClick={handleClock}
                size="lg"
                className={timeStatus?.clockedIn
                  ? 'bg-red-600 hover:bg-red-700 text-white h-16 px-8'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white h-16 px-8'
                }
              >
                {timeStatus?.clockedIn ? 'Odjava' : 'Prijava'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Urne statistike */}
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-500" />
              <div><div className="text-xs text-slate-500">Danes</div><div className="text-lg font-bold">{formatDuration(timeStatus?.todayMinutes || 0)}</div></div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <div><div className="text-xs text-slate-500">Ta teden</div><div className="text-lg font-bold">{formatDuration(timeStatus?.weekMinutes || 0)}</div></div>
            </div>
          </CardContent></Card>
        </div>

        {/* Prihajajoče izmene */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 text-emerald-600" /> Prihajajoče izmene</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Ni prihajajočih izmen
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingShifts.map(s => {
                  const status = statusConfig[s.status] || statusConfig.scheduled
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="w-14 h-14 rounded-lg bg-emerald-50 flex flex-col items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-emerald-700">{formatTime(s.startTime)}</span>
                        <span className="text-[10px] text-slate-400">{s.endTime ? formatTime(s.endTime) : '—'}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatDateTime(s.startTime)}</span>
                          <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {s.endTime ? `${formatTime(s.startTime)}–${formatTime(s.endTime)}` : 'Odprta izmena'}
                          {' · '}odmor {s.breakMinutes}min
                          {s.note && ` · 📝 ${s.note}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
