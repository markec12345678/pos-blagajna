'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/i18n'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Receipt, Lock, User as UserIcon, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Preveri ali je ze prijavljen
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data.user) router.push('/')
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: t.auth.loginError, description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: t.auth.welcome, description: data.user.name })
      router.push('/')
      router.refresh()
    } catch (e: any) {
      toast({ title: t.auth.loginError, description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white mb-3 shadow-lg">
            <Receipt className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">{t.app.name}</CardTitle>
          <p className="text-sm text-slate-500 mt-1">{t.app.restaurant} Primorska</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.auth.username}</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  placeholder={t.auth.username}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder={t.auth.password}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t.auth.loginButton}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-slate-50 rounded-lg text-xs space-y-1.5">
            <div className="font-semibold text-slate-700 mb-1">Demo:</div>
            <div className="flex justify-between"><span>👤 admin</span><span className="font-mono text-slate-500">admin123</span></div>
            <div className="flex justify-between"><span>👤 cashier</span><span className="font-mono text-slate-500">cashier123</span></div>
            <div className="flex justify-between"><span>👤 chef</span><span className="font-mono text-slate-500">chef123</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
