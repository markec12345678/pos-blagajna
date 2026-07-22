'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  CreditCard, Building2, Palette, Globe, RefreshCw, Loader2,
  CheckCircle2, Clock, AlertCircle, ExternalLink,
} from 'lucide-react'

interface TenantBilling {
  id: string
  name: string
  plan: string
  subscriptionStatus: string
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd: boolean
  trialEndsAt?: string | null
  stripeCustomerId?: string | null
  userCount: number
  maxUsers: number
  maxLocations: number
  daysUntilTrialEnds: number | null
  isActive: boolean
}

interface WhiteLabel {
  id: string
  name: string
  customLogoUrl?: string | null
  customPrimaryColor?: string | null
  customName?: string | null
  customDomain?: string | null
  plan: string
}

const planLabels: Record<string, string> = {
  starter: 'Starter',
  pro: 'Professional',
  enterprise: 'Enterprise',
}

const planPrices: Record<string, string> = {
  starter: '29 €/m',
  pro: '79 €/m',
  enterprise: '199 €/m',
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  trialing: { label: 'Trial', className: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  active: { label: 'Aktivna', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  past_due: { label: 'Zapadlo', className: 'bg-red-100 text-red-800 border-red-300', icon: AlertCircle },
  canceled: { label: 'Preklicana', className: 'bg-slate-100 text-slate-800 border-slate-300', icon: AlertCircle },
}

export function BillingTab() {
  const { toast } = useToast()
  const [billing, setBilling] = useState<TenantBilling[]>([])
  const [whitelabel, setWhitelabel] = useState<WhiteLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [savingWL, setSavingWL] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [billingRes, wlRes] = await Promise.all([
        fetch('/api/pos/billing/status'),
        fetch('/api/pos/whitelabel'),
      ])
      const billingData = await billingRes.json()
      const wlData = await wlRes.json()
      if (billingRes.ok) setBilling(billingData.billing || [])
      if (wlRes.ok) setWhitelabel(wlData.tenants || [])
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleSubscribe = async (tenantId: string, plan: string) => {
    setSubscribing(true)
    try {
      const res = await fetch('/api/pos/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setSubscribing(false)
    }
  }

  const handlePortal = async (tenantId: string) => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/pos/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank')
      }
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setPortalLoading(false)
    }
  }

  const handleSaveWL = async (tenantId: string, data: any) => {
    setSavingWL(true)
    try {
      const res = await fetch('/api/pos/whitelabel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...data }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast({ title: '✅ White-label posodobljen' })
      load()
    } catch (e: any) {
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setSavingWL(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Nalagam...</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <CreditCard className="size-4 text-emerald-600" />
          Billing in naročnina
        </h2>
        <p className="text-xs text-slate-500">Upravljanje SaaS naročnine in white-label</p>
      </div>

      {/* Billing kartice */}
      {billing.map(b => {
        const status = statusConfig[b.subscriptionStatus] || statusConfig.trialing
        const StatusIcon = status.icon
        return (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="size-4" />
                  {b.name}
                </CardTitle>
                <Badge variant="outline" className={status.className}>
                  <StatusIcon className="size-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Plan info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">Plan</div>
                  <div className="font-bold">{planLabels[b.plan] || b.plan}</div>
                  <div className="text-xs text-slate-500">{planPrices[b.plan]}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">Uporabniki</div>
                  <div className="font-bold">{b.userCount}/{b.maxUsers}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">Lokacije</div>
                  <div className="font-bold">{b.maxLocations}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">Trial</div>
                  <div className="font-bold text-amber-600">{b.daysUntilTrialEnds !== null ? `${b.daysUntilTrialEnds} dni` : '—'}</div>
                </div>
              </div>

              {/* Plan comparison */}
              <div className="grid grid-cols-3 gap-2">
                {['starter', 'pro', 'enterprise'].map(plan => (
                  <div key={plan} className={`p-3 border rounded-lg text-center ${b.plan === plan ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                    <div className="font-bold text-sm">{planLabels[plan]}</div>
                    <div className="text-lg font-bold text-emerald-600">{planPrices[plan]}</div>
                    <div className="text-xs text-slate-500">
                      {plan === 'starter' ? '5 uporabnikov, 1 lokacija' : plan === 'pro' ? '25 uporabnikov, 5 lokacij' : '100 uporabnikov, 20 lokacij'}
                    </div>
                    {b.plan !== plan && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full h-7 text-xs"
                        onClick={() => handleSubscribe(b.id, plan)}
                        disabled={subscribing}
                      >
                        {subscribing ? <Loader2 className="size-3 animate-spin" /> : 'Nadgradi'}
                      </Button>
                    )}
                    {b.plan === plan && (
                      <Badge className="mt-2 bg-emerald-100 text-emerald-800 text-[10px]">TRENUTNI</Badge>
                    )}
                  </div>
                ))}
              </div>

              {/* Stripe portal */}
              {b.stripeCustomerId && (
                <Button variant="outline" size="sm" onClick={() => handlePortal(b.id)} disabled={portalLoading} className="w-full">
                  {portalLoading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <ExternalLink className="size-4 mr-1" />}
                  Upravljaj naročnino (Stripe Portal)
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* White-label */}
      {whitelabel.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="size-4 text-purple-500" />
              White-label (custom branding)
            </CardTitle>
            <p className="text-xs text-slate-500">Na voljo za Pro in Enterprise plan</p>
          </CardHeader>
          <CardContent>
            {whitelabel.map(wl => (
              <WhiteLabelEditor key={wl.id} tenant={wl} onSave={(data) => handleSaveWL(wl.id, data)} saving={savingWL} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function WhiteLabelEditor({ tenant, onSave, saving }: {
  tenant: WhiteLabel
  onSave: (data: any) => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    customName: tenant.customName || '',
    customPrimaryColor: tenant.customPrimaryColor || '#059669',
    customLogoUrl: tenant.customLogoUrl || '',
    customDomain: tenant.customDomain || '',
  })

  const isStarter = tenant.plan === 'starter'

  return (
    <div className={`space-y-3 ${isStarter ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="text-sm font-medium">{tenant.name}</div>
      {isStarter && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          ⚠ White-label je na voljo samo za Pro in Enterprise plan.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Custom ime</Label>
          <Input
            value={form.customName}
            onChange={(e) => setForm({ ...form, customName: e.target.value })}
            placeholder="POS Blagajna"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Primarna barva</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={form.customPrimaryColor}
              onChange={(e) => setForm({ ...form, customPrimaryColor: e.target.value })}
              className="w-12 h-9 p-1"
            />
            <Input
              value={form.customPrimaryColor}
              onChange={(e) => setForm({ ...form, customPrimaryColor: e.target.value })}
              placeholder="#059669"
              className="h-9 flex-1"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Logo URL</Label>
          <Input
            value={form.customLogoUrl}
            onChange={(e) => setForm({ ...form, customLogoUrl: e.target.value })}
            placeholder="https://..."
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><Globe className="size-3" /> Custom domena</Label>
          <Input
            value={form.customDomain}
            onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
            placeholder="pos.primorska.si"
            className="h-9"
          />
        </div>
      </div>
      {/* Preview */}
      <div className="p-3 border rounded-lg flex items-center gap-3" style={{ borderColor: form.customPrimaryColor + '50' }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
          style={{ background: `linear-gradient(135deg, ${form.customPrimaryColor}, ${form.customPrimaryColor}dd)` }}
        >
          {(form.customName || 'P')[0]}
        </div>
        <div>
          <div className="font-bold text-sm" style={{ color: form.customPrimaryColor }}>
            {form.customName || 'POS Blagajna'}
          </div>
          <div className="text-xs text-slate-500">{form.customDomain || 'pos-blazna.si'}</div>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => onSave(form)}
        disabled={saving || isStarter}
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
        Shrani white-label
      </Button>
    </div>
  )
}
