'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { TrendingUp, TrendingDown, Minus, Lightbulb, RefreshCw, Calendar } from 'lucide-react'

interface ForecastDay {
  date: string
  dayName: string
  predicted: number
  confidence: number
}

interface DayOfWeekStat {
  day: string
  dayIndex: number
  avg: number
  samples: number
}

interface ForecastData {
  forecast: ForecastDay[]
  insights: string[]
  avgDaily: number
  trend: string
  trendPercent: number
  historical: Array<{ date: string; total: number; count: number }>
  dayOfWeekStats: DayOfWeekStat[]
}

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function SalesForecast() {
  const { toast } = useToast()
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pos/forecast')
      const d = await res.json()
      if (res.ok) setData(d)
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  const trendIcon = data.trend === 'up' ? <TrendingUp className="size-5 text-emerald-500" /> : data.trend === 'down' ? <TrendingDown className="size-5 text-red-500" /> : <Minus className="size-5 text-slate-400" />
  const trendColor = data.trend === 'up' ? 'text-emerald-600' : data.trend === 'down' ? 'text-red-600' : 'text-slate-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-600" />
          AI napoved prodaje
        </h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Osveži
        </Button>
      </div>

      {/* Trend in povprečje */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-xs text-slate-500">Povprečni dnevni promet</div>
          <div className="text-xl font-bold">{formatEUR(data.avgDaily)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-slate-500">Trend (7 dni)</div>
          <div className={`text-xl font-bold flex items-center gap-1 ${trendColor}`}>
            {trendIcon}
            {data.trendPercent > 0 ? '+' : ''}{data.trendPercent}%
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-slate-500">Napoved (7 dni)</div>
          <div className="text-xl font-bold text-blue-600">
            {formatEUR(data.forecast.reduce((s, f) => s + f.predicted, 0))}
          </div>
        </CardContent></Card>
      </div>

      {/* Napoved 7 dni */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="size-4" /> Napoved za naslednjih 7 dni</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.forecast.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-28 text-sm font-medium">{f.dayName}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded relative overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded transition-all"
                    style={{ width: `${Math.min(100, (f.predicted / Math.max(...data.forecast.map(d => d.predicted), 1)) * 100)}%` }}
                  />
                  <span className="absolute right-2 top-0.5 text-xs font-bold text-slate-700">{formatEUR(f.predicted)}</span>
                </div>
                <Badge variant="outline" className={`text-[10px] ${f.confidence > 0.6 ? 'bg-emerald-50 text-emerald-700' : f.confidence > 0.4 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
                  {Math.round(f.confidence * 100)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Povprečje po dnevih v tednu */}
      {data.dayOfWeekStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Povprečje po dnevih v tednu</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {data.dayOfWeekStats.map(d => (
                <div key={d.dayIndex} className="text-center p-2 border rounded">
                  <div className="text-xs text-slate-500">{d.day.substring(0, 3)}</div>
                  <div className="text-sm font-bold text-emerald-600">{formatEUR(d.avg)}</div>
                  <div className="text-[10px] text-slate-400">{d.samples} vzorcev</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="size-4 text-amber-500" /> AI vpogledi in priporočila</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded text-sm">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
