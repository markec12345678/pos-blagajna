'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Landmark, CheckCircle2, XCircle, Info, RefreshCw, FileText, Percent,
} from 'lucide-react'

interface FiscalStatus {
  configured: boolean
  country: string
  countryName: string
  zoiLabel: string
  eorLabel: string
  qrLabel: string
  taxNumber: string | null
  premiseId: string | null
  electronicDeviceId: string | null
  testMode: boolean
  vatRates: { standard: number; reduced: number; low: number }
  currentVatRate: number
  taxNumberValid: boolean
  instructions: Record<string, {
    name: string
    envVars: string[]
    vatRates: string
    notes: string
  }>
}

export function FiscalTab() {
  const { toast } = useToast()
  const [status, setStatus] = useState<FiscalStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pos/furs/status')
      const data = await res.json()
      if (res.ok) setStatus(data)
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading || !status) {
    return <div className="text-center py-8 text-slate-500">Nalagam fiskalni status...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Landmark className="size-4 text-emerald-600" />
            Fiskalizacija — davčno potrjevanje računov
          </h2>
          <p className="text-xs text-slate-500">Slovenija (FURS) in Hrvaška (CIS/FINA)</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Osveži
        </Button>
      </div>

      {/* Status kartice */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Država</div>
            <div className="text-lg font-bold">{status.countryName}</div>
            <Badge variant="outline" className="text-[10px] mt-1">{status.country}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Status</div>
            <div className="flex items-center gap-1 mt-0.5">
              {status.configured ? (
                <><CheckCircle2 className="size-5 text-emerald-500" /><span className="font-bold text-emerald-600">Konfigurirano</span></>
              ) : (
                <><XCircle className="size-5 text-red-400" /><span className="font-bold text-red-500">Ni konfigurirano</span></>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Percent className="size-3" /> DDV stopnja</div>
            <div className="text-lg font-bold text-emerald-600">{(status.currentVatRate * 100).toFixed(1)}%</div>
            <div className="text-xs text-slate-400">Splošna stopnja</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-slate-500">Davčna številka</div>
            <div className="text-sm font-bold font-mono">{status.taxNumber || '—'}</div>
            {status.taxNumber && (
              <Badge variant="outline" className={`text-[10px] mt-1 ${status.taxNumberValid ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'}`}>
                {status.taxNumberValid ? '✓ Veljavna' : '✗ Neveljavna'}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fiskalne oznake */}
      {status.configured && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="size-4" /> Fiskalne oznake</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 border rounded">
                <div className="text-xs text-slate-500">Oznaka izdajatelja</div>
                <div className="font-bold text-sm">{status.zoiLabel}</div>
                <div className="text-xs text-slate-400">32-znakovni MD5 hash</div>
              </div>
              <div className="p-2 border rounded">
                <div className="text-xs text-slate-500">Oznaka računa</div>
                <div className="font-bold text-sm">{status.eorLabel}</div>
                <div className="text-xs text-slate-400">36-znakovni UUID</div>
              </div>
              <div className="p-2 border rounded">
                <div className="text-xs text-slate-500">QR koda</div>
                <div className="font-bold text-sm">{status.qrLabel}</div>
                <div className="text-xs text-slate-400">{status.country === 'SI' ? 'Davčna + ZOI' : 'ZKI'}</div>
              </div>
              <div className="p-2 border rounded">
                <div className="text-xs text-slate-500">Poslovni prostor</div>
                <div className="font-bold text-sm">{status.premiseId || '—'}</div>
                <div className="text-xs text-slate-400">Naprava: {status.electronicDeviceId || '—'}</div>
              </div>
            </div>
            {status.testMode && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                ⚠ Test mode aktiven — računi se ne pošiljajo pravemu FURS/CIS strežniku.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DDV stopnje */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Percent className="size-4" /> DDV stopnje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 border rounded text-center">
              <div className="text-xs text-slate-500">Splošna</div>
              <div className="text-xl font-bold text-emerald-600">{(status.vatRates.standard * 100).toFixed(1)}%</div>
            </div>
            <div className="p-3 border rounded text-center">
              <div className="text-xs text-slate-500">Znižana</div>
              <div className="text-xl font-bold text-blue-600">{(status.vatRates.reduced * 100).toFixed(1)}%</div>
            </div>
            <div className="p-3 border rounded text-center">
              <div className="text-xs text-slate-500">Nizka</div>
              <div className="text-xl font-bold text-amber-600">{(status.vatRates.low * 100).toFixed(1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navodila za konfiguracijo */}
      {!status.configured && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="size-4 text-blue-500" /> Navodila za konfiguracijo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(status.instructions).map(([code, info]) => (
              <div key={code} className="p-3 border rounded-lg">
                <div className="font-medium text-sm flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{code}</Badge>
                  {info.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">DDV: {info.vatRates}</div>
                <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[10px] mt-2 overflow-x-auto">
{info.envVars.join('\n')}
                </pre>
                <div className="text-xs text-amber-600 mt-1">⚠ {info.notes}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
