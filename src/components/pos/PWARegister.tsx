'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff } from 'lucide-react'

/**
 * Komponenta za registracijo service workerja in prikaz offline statusa.
 * Namesti se v layout.tsx znotraj I18nProvider.
 */
export function PWARegister() {
  const [isOnline, setIsOnline] = useState(true)
  const [swRegistered, setSwRegistered] = useState(false)

  // Registriraj service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope)
          setSwRegistered(true)
        })
        .catch((err) => {
          console.warn('[PWA] SW registration failed:', err)
        })
    }
  }, [])

  // Spremljaj online/offline status
  useEffect(() => {
    const updateOnline = () => {
      setIsOnline(navigator.onLine)
      if (navigator.onLine) {
        console.log('[PWA] Back online')
      } else {
        console.log('[PWA] Gone offline')
      }
    }
    setIsOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  // PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      // Shrani event za kasnejšo uporabo
      ;(window as any).deferredPWAInstall = e
      console.log('[PWA] Install prompt available')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Offline badge — prikaži samo ko je offline
  if (isOnline) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 px-3 py-1.5 gap-1.5 shadow-md">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Brez povezave — delate lahko z buffered podatki</span>
      </Badge>
    </div>
  )
}

/**
 * Helper za sproženje PWA install prompt-a.
 * Vrne true če je bil prompt prikazan.
 */
export async function triggerPWAInstall(): Promise<boolean> {
  const deferredPrompt = (window as any).deferredPWAInstall
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  ;(window as any).deferredPWAInstall = null
  return choice.outcome === 'accepted'
}
