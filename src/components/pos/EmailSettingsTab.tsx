'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Mail, Send, Loader2, CheckCircle2, XCircle, Info } from 'lucide-react'

export function EmailSettingsTab() {
  const { toast } = useToast()
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({ title: 'Manjka email naslov', variant: 'destructive' })
      return
    }
    setSending(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/pos/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      })
      const data = await res.json()
      setLastResult({ success: data.success, message: data.message || data.error })
      if (data.success) {
        toast({ title: '✅ Testni email poslan', description: `Na ${testEmail}` })
      } else if (!res.ok) {
        toast({ title: 'Napaka', description: data.message || data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Email ni poslan', description: data.message, variant: 'default' })
      }
    } catch (e: any) {
      setLastResult({ success: false, message: e.message })
      toast({ title: 'Napaka', description: e.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Mail className="size-4 text-emerald-600" />
          Email nastavitve
        </h2>
        <p className="text-xs text-slate-500">SMTP konfiguracija za obvestila, rezervacije in povzetke</p>
      </div>

      {/* Info kartica */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <div className="font-medium">Kako konfigurirati SMTP</div>
              <div className="text-slate-600">
                Email nastavitve se berejo iz <code className="bg-slate-100 px-1 rounded text-xs">.env</code> datoteke.
                Dodaj naslednje spremenljivke:
              </div>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-md text-xs mt-2 overflow-x-auto">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=pos@restavracija.si`}
              </pre>
              <div className="text-xs text-slate-500 mt-2">
                💡 Za Gmail uporabi <strong>App Password</strong> (ne redno geslo).<br/>
                💡 Zaprodukcijo priporočamo SendGrid, Mailgun ali Amazon SES.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test email */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="size-4" />
            Pošlji testni email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="test-email">Email naslovnik</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@email.si"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleTestEmail} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700">
                {sending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
                Pošlji test
              </Button>
            </div>
          </div>
          {lastResult && (
            <div className={`p-3 rounded-md text-sm flex items-center gap-2 ${lastResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
              {lastResult.success ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {lastResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predlogi uporabe */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Predlogi uporabe emaila</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 p-2 border rounded">
            <Mail className="size-4 text-emerald-500" />
            <div className="flex-1">
              <div className="font-medium">Potrditev rezervacije</div>
              <div className="text-xs text-slate-500">Avtomatska email potrditev stranki ob ustvarjanju rezervacije</div>
            </div>
            <Badge variant="outline" className="text-[10px]">Rezervacije</Badge>
          </div>
          <div className="flex items-center gap-2 p-2 border rounded">
            <Mail className="size-4 text-amber-500" />
            <div className="flex-1">
              <div className="font-medium">Opozorilo o nizki zalogi</div>
              <div className="text-xs text-slate-500">Email adminu ko pade zaloga pod minimum</div>
            </div>
            <Badge variant="outline" className="text-[10px]">Skladišče</Badge>
          </div>
          <div className="flex items-center gap-2 p-2 border rounded">
            <Mail className="size-4 text-blue-500" />
            <div className="flex-1">
              <div className="font-medium">Dnevni povzetek</div>
              <div className="text-xs text-slate-500">Vsak večer email s prodajo, stroški in dobičkom</div>
            </div>
            <Badge variant="outline" className="text-[10px]">Poročila</Badge>
          </div>
          <div className="flex items-center gap-2 p-2 border rounded">
            <Mail className="size-4 text-purple-500" />
            <div className="flex-1">
              <div className="font-medium">Storno obvestilo</div>
              <div className="text-xs text-slate-500">Email adminu ob stornu računa</div>
            </div>
            <Badge variant="outline" className="text-[10px]">Varnost</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
