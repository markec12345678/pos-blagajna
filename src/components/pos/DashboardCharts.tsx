'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, TrendingUp, TrendingDown, Euro, Receipt, Wallet, Percent, AlertCircle, Loader2 } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import type { Reports } from './types'
import { formatEUR } from './types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
)

type ReportRange = 'today' | 'week' | 'month' | 'all'

const rangeLabels: Record<ReportRange, string> = {
  today: 'Danes',
  week: 'Teden',
  month: 'Mesec',
  all: 'Vse',
}

const PALETTE = {
  emerald: '#059669',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
  orange: '#f97316',
  pink: '#ec4899',
}

export function DashboardCharts({ defaultRange = 'today' }: { defaultRange?: ReportRange }) {
  const [reports, setReports] = useState<Reports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<ReportRange>(defaultRange)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pos/reports?range=${range}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Napaka ${res.status}`)
      }
      const data = await res.json()
      setReports(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Napaka pri nalaganju')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    load()
    // Auto-refresh vsakih 60 sekund
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="space-y-4">
      {/* Glava */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-600" />
            Pregled poslovanja
          </h2>
          <p className="text-xs text-slate-500">
            Avto-osvežitev vsakih 60s · {rangeLabels[range]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {(Object.keys(rangeLabels) as ReportRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  range === r ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={load} disabled={loading} className="h-9 w-9">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <Button size="sm" variant="outline" onClick={load} className="mt-3">
              Poskusi znova
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && !reports && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Metrike */}
      {reports && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <MetricCard
            label="Skupna prodaja"
            value={formatEUR(reports.totalSales)}
            icon={<Euro className="size-5 text-emerald-500" />}
            color="emerald"
          />
          <MetricCard
            label="Računov"
            value={String(reports.salesCount)}
            icon={<Receipt className="size-5 text-blue-500" />}
            color="blue"
          />
          <MetricCard
            label="Povprečni račun"
            value={reports.salesCount > 0 ? formatEUR(reports.avgReceipt) : '—'}
            icon={<Wallet className="size-5 text-purple-500" />}
            color="purple"
          />
          <MetricCard
            label="Napitnine"
            value={formatEUR(reports.totalTips)}
            icon={<Wallet className="size-5 text-amber-500" />}
            color="amber"
          />
          <MetricCard
            label="Popusti"
            value={formatEUR(reports.totalDiscounts)}
            icon={<Percent className="size-5 text-orange-500" />}
            color="orange"
          />
          <MetricCard
            label="Stroški"
            value={formatEUR(reports.totalExpenses)}
            icon={<TrendingDown className="size-5 text-red-500" />}
            color="red"
          />
          <MetricCard
            label="Čisti dobiček"
            value={formatEUR(reports.netProfit)}
            icon={<TrendingUp className="size-5 text-teal-500" />}
            color="teal"
            highlight
          />
        </div>
      )}

      {/* Grafikoni */}
      {reports && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Prodaja po urah — Bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Prodaja po urah</CardTitle>
            </CardHeader>
            <CardContent>
              <SalesByHourChart reports={reports} />
            </CardContent>
          </Card>

          {/* Po načinu plačila — Doughnut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Po načinu plačila</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentMethodChart reports={reports} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top izdelki */}
      {reports && reports.topProducts && reports.topProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top 10 izdelkov</CardTitle>
          </CardHeader>
          <CardContent>
            <TopProductsChart reports={reports} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
  color,
  highlight,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'orange' | 'red' | 'teal'
  highlight?: boolean
}) {
  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50/50',
    blue: 'border-blue-200 bg-blue-50/50',
    purple: 'border-purple-200 bg-purple-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    orange: 'border-orange-200 bg-orange-50/50',
    red: 'border-red-200 bg-red-50/50',
    teal: 'border-teal-200 bg-teal-50/50',
  }
  return (
    <div className={`p-3 rounded-lg border ${colorMap[color]} ${highlight ? 'ring-2 ring-emerald-300' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        {icon}
      </div>
      <div className={`text-lg font-bold ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  )
}

function SalesByHourChart({ reports }: { reports: Reports }) {
  const hours = reports.salesByHour || []
  const data = {
    labels: hours.map(h => `${h.hour}:00`),
    datasets: [
      {
        label: 'Prodaja (€)',
        data: hours.map(h => h.total),
        backgroundColor: PALETTE.emerald + '80',
        borderColor: PALETTE.emerald,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v: any) => `${v} €` },
      },
    },
  }
  if (hours.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Ni podatkov</div>
  }
  return <div className="h-48"><Bar data={data} options={options} /></div>
}

function PaymentMethodChart({ reports }: { reports: Reports }) {
  const pm = reports.salesByPaymentMethod || {}
  const data = {
    labels: ['Gotovina', 'Kartica', 'Mobilno'],
    datasets: [
      {
        data: [pm.cash || 0, pm.card || 0, pm.mobile || 0],
        backgroundColor: [PALETTE.emerald, PALETTE.blue, PALETTE.purple],
        borderWidth: 0,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
    },
  }
  const total = (pm.cash || 0) + (pm.card || 0) + (pm.mobile || 0)
  if (total === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Ni podatkov</div>
  }
  return <div className="h-48"><Doughnut data={data} options={options} /></div>
}

function TopProductsChart({ reports }: { reports: Reports }) {
  const products = (reports.topProducts || []).slice(0, 10)
  const data = {
    labels: products.map(p => p.name),
    datasets: [
      {
        label: 'Količina',
        data: products.map(p => p.quantity),
        backgroundColor: PALETTE.teal + '80',
        borderColor: PALETTE.teal,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true },
    },
  }
  return <div className="h-64"><Bar data={data} options={options} /></div>
}
