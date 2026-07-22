'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/i18n'
import {
  Printer,
  Wifi,
  Usb,
  Globe,
  TestTube,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Settings2,
} from 'lucide-react'
import type { Settings } from './types'

interface PrinterSettingsProps {
  settings: Settings | null
  onSaved: () => void
}

export function PrinterSettings({ settings, onSaved }: PrinterSettingsProps) {
  const { toast } = useToast()
  const { t } = useI18n()
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ connected: boolean; latency: number; error?: string } | null>(null)
  const [printingTest, setPrintingTest] = useState(false)
  const [usbConnected, setUsbConnected] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        printerEnabled: settings.printerEnabled ?? false,
        printerType: settings.printerType || 'usb',
        printerIp: settings.printerIp || '',
        printerPort: settings.printerPort || 9100,
        printerWidth: settings.printerWidth || 32,
        printerAutoCut: settings.printerAutoCut ?? true,
        printerBeep: settings.printerBeep ?? true,
        printerOpenDrawer: settings.printerOpenDrawer ?? true,
      })
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/pos/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: t.settings.saveSuccess })
      onSaved()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!form.printerIp) {
      toast({ title: 'Manjka IP naslov', variant: 'destructive' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/pos/print/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: form.printerIp, port: parseInt(form.printerPort) }),
      })
      const data = await res.json()
      setTestResult(data)
      if (data.connected) {
        toast({
          title: '✅ Povezava uspešna',
          description: `Latnost: ${data.latency}ms`,
        })
      } else {
        toast({
          title: '❌ Povezava ni uspela',
          description: data.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const handleTestPrint = async () => {
    setPrintingTest(true)
    try {
      const res = await fetch('/api/pos/print/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.printed) {
        toast({
          title: '✅ Testni izpis natisnjen',
          description: 'Preveri tiskalnik',
        })
      } else if (data.base64 && form.printerType === 'usb') {
        // Poskusi WebUSB
        try {
          const { getPrinter } = await import('@/lib/usb-printer')
          const printer = getPrinter()
          if (!printer.isConnected()) {
            const ok = await printer.connect()
            if (!ok) {
              toast({ title: 'USB tiskalnik ni bil izbran' })
              return
            }
            setUsbConnected(true)
          }
          await printer.printBase64(data.base64)
          toast({
            title: '✅ Testni izpis poslan na USB tiskalnik',
            description: 'Preveri tiskalnik',
          })
        } catch (e: any) {
          toast({
            title: 'USB tiskalnik ni na voljo',
            description: e.message,
            variant: 'destructive',
          })
        }
      } else {
        // Fallback — odpri print preview
        const html = `<html><head><title>Test</title></head><body><pre style="font-family:monospace;font-size:10px;">Testni izpis POS\n\nRestavracija: ${settings?.restaurantName || 'Test'}\n\nČe vidiš to besedilo, tiskalnik deluje.</pre></body></html>`
        const w = window.open('', '_blank')
        if (w) {
          w.document.write(html)
          w.document.close()
          w.print()
        }
        toast({ title: 'Odprt print preview' })
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setPrintingTest(false)
    }
  }

  if (!settings) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5" />
          {t.settings.printerSettings}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Omogoči tiskalnik */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <div className="font-medium text-sm">{t.settings.printerSettings}</div>
            <div className="text-xs text-slate-500">Omogoči ESC/POS tiskalnik za tiskanje računov</div>
          </div>
          <Button
            variant={form.printerEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setForm({ ...form, printerEnabled: !form.printerEnabled })}
            className={form.printerEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {form.printerEnabled ? '✓ Omogočeno' : 'Onemogočeno'}
          </Button>
        </div>

        {/* Tip tiskalnika */}
        <div className="space-y-2">
          <Label>{t.settings.printerType}</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={form.printerType === 'usb' ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, printerType: 'usb' })}
              className="h-16 flex-col gap-1"
            >
              <Usb className="w-5 h-5" />
              <span className="text-xs">USB (WebUSB)</span>
            </Button>
            <Button
              variant={form.printerType === 'network' ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, printerType: 'network' })}
              className="h-16 flex-col gap-1"
            >
              <Wifi className="w-5 h-5" />
              <span className="text-xs">Mreža (TCP/IP)</span>
            </Button>
            <Button
              variant={form.printerType === 'browser' ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, printerType: 'browser' })}
              className="h-16 flex-col gap-1"
            >
              <Globe className="w-5 h-5" />
              <span className="text-xs">Brskalnik</span>
            </Button>
          </div>
        </div>

        {/* Mrežne nastavitve — samo če je network */}
        {form.printerType === 'network' && (
          <div className="space-y-3 p-3 border rounded-lg bg-amber-50/30">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="printerIp">{t.settings.printerIp}</Label>
                <Input
                  id="printerIp"
                  placeholder="192.168.1.100"
                  value={form.printerIp}
                  onChange={(e) => setForm({ ...form, printerIp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="printerPort">{t.settings.printerPort}</Label>
                <Input
                  id="printerPort"
                  type="number"
                  placeholder="9100"
                  value={form.printerPort}
                  onChange={(e) => setForm({ ...form, printerPort: e.target.value })}
                />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !form.printerIp}
              className="w-full"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TestTube className="w-4 h-4 mr-2" />}
              Preveri povezavo
            </Button>

            {testResult && (
              <div className={`p-2 rounded-md text-sm ${testResult.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {testResult.connected ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Povezava uspešna — latnost {testResult.latency}ms
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {testResult.error}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Širina papirja */}
        <div className="space-y-2">
          <Label>{t.settings.printerWidth}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={form.printerWidth === 32 ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, printerWidth: 32 })}
              className="h-12"
            >
              58mm (32 znakov)
            </Button>
            <Button
              variant={form.printerWidth === 48 ? 'default' : 'outline'}
              onClick={() => setForm({ ...form, printerWidth: 48 })}
              className="h-12"
            >
              80mm (48 znakov)
            </Button>
          </div>
        </div>

        {/* Opcije */}
        <div className="space-y-2">
          <Label>Opcije</Label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
              <input
                type="checkbox"
                checked={form.printerAutoCut}
                onChange={(e) => setForm({ ...form, printerAutoCut: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Avtomatsko reži papir</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
              <input
                type="checkbox"
                checked={form.printerBeep}
                onChange={(e) => setForm({ ...form, printerBeep: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Pisuk (beep) po tiskanju</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
              <input
                type="checkbox"
                checked={form.printerOpenDrawer}
                onChange={(e) => setForm({ ...form, printerOpenDrawer: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Odpri predal za gotovino (pri plačilu z gotovino)</span>
            </label>
          </div>
        </div>

        {/* USB status */}
        {form.printerType === 'usb' && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Usb className="w-4 h-4 text-blue-600" />
              <span className="font-medium">USB tiskalnik</span>
              {usbConnected && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Povezan</Badge>}
            </div>
            <p className="text-xs text-slate-600">
              Klikni "Testni izpis" za povezavo z USB tiskalnikom. Brskalnik bo odprl dialog za izbiro naprave.
              Deluje v Chrome in Edge (Chromium).
            </p>
          </div>
        )}

        {/* Akcije */}
        <Separator />
        <div className="flex gap-2">
          <Button
            onClick={handleTestPrint}
            variant="outline"
            className="flex-1"
            disabled={printingTest}
          >
            {printingTest ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
            {t.settings.testPrint}
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {t.app.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
