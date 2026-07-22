'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Clock, LogIn, LogOut, Timer } from 'lucide-react'
import type { TimeStatus } from './types'

interface ClockButtonProps {
  userId: string
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.floor(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `${h}h ${m}min`
}

export function ClockButton({ userId }: ClockButtonProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<TimeStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0) // sekunde od clock-in

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/time/status')
      const data = await res.json()
      if (res.ok) {
        setStatus(data)
        if (data.clockedIn && data.currentEntry) {
          const start = new Date(data.currentEntry.clockIn).getTime()
          setElapsed(Math.floor((Date.now() - start) / 1000))
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadStatus()
    // Osveži vsakih 30 sekund
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [loadStatus])

  // Tick vsako sekundo za prikaz trajanja
  useEffect(() => {
    if (!status?.clockedIn) return
    const tick = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(tick)
  }, [status?.clockedIn])

  const handleClockAction = async () => {
    if (loading) return
    setLoading(true)
    const action = status?.clockedIn ? 'out' : 'in'
    try {
      const res = await fetch('/api/pos/time/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (action === 'in') {
        toast({
          title: '✅ Prijavljeni na delo',
          description: 'Čas se zdaj sledi',
        })
      } else {
        const minutes = data.entry?.totalMinutes || 0
        toast({
          title: '👋 Odjava z dela',
          description: `Delali ste ${formatDuration(minutes)}`,
        })
      }
      loadStatus()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (!status) return null

  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  const seconds = elapsed % 60
  const elapsedStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  if (status.clockedIn) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">{elapsedStr}</span>
        </div>
        <div className="hidden sm:flex flex-col text-xs leading-tight">
          <span className="text-slate-500">Danes</span>
          <span className="font-medium">{formatDuration(status.todayMinutes)}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClockAction}
          disabled={loading}
          className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
        >
          <LogOut className="w-3.5 h-3.5 mr-1" />
          Odjava
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex flex-col text-xs leading-tight text-right">
        <span className="text-slate-500">Danes</span>
        <span className="font-medium">{formatDuration(status.todayMinutes)}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleClockAction}
        disabled={loading}
        className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      >
        <LogIn className="w-3.5 h-3.5 mr-1" />
        Prijava na delo
      </Button>
    </div>
  )
}
