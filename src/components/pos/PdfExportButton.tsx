'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { FileDown, Loader2 } from 'lucide-react'

interface PdfExportButtonProps {
  defaultRange?: 'today' | 'week' | 'month' | 'all'
}

export function PdfExportButton({ defaultRange = 'today' }: PdfExportButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState(defaultRange)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const handleExport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from && to) {
        params.set('from', from)
        params.set('to', to)
        params.set('range', 'all')
      } else {
        params.set('range', range)
      }
      const res = await fetch(`/api/pos/reports/pdf?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Napaka' }))
        throw new Error(err.error)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `porocilo-${range}-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: '✅ PDF poročilo preneseno' })
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Obdobje</Label>
        <Select value={range} onValueChange={(v) => setRange(v as 'today' | 'week' | 'month' | 'all')} disabled={!!from || !!to}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Danes</SelectItem>
            <SelectItem value="week">Teden</SelectItem>
            <SelectItem value="month">Mesec</SelectItem>
            <SelectItem value="all">Vse</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="text-xs text-slate-400 px-1 py-2">ali</div>
      <div className="space-y-1">
        <Label className="text-xs">Od</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40 h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Do</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-40 h-9"
        />
      </div>
      <Button onClick={handleExport} disabled={loading} className="h-9 bg-red-600 hover:bg-red-700">
        {loading ? <Loader2 className="size-4 animate-spin mr-1" /> : <FileDown className="size-4 mr-1" />}
        Izvozi PDF
      </Button>
    </div>
  )
}
